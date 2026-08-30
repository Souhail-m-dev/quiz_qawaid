-- Espace élève: inscription (compte Supabase Auth), validation par l'owner,
-- inscription aux matières, suivi de progression par cours.
--
-- Le flux candidat anonyme reste inchangé: un élève connecté passe le MÊME
-- examen; sa ligne candidates porte en plus student_id.
--
-- ⚠️ À vérifier AVANT d'appliquer (tables/RPC de base créées hors migrations):
--   select policyname, cmd, roles, qual, with_check from pg_policies
--    where tablename in ('profiles','candidates','attempts');
--   select tgname from pg_trigger where tgrelid = 'auth.users'::regclass;

-- 1. Rôle 'eleve' + statut de validation.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner', 'editeur', 'correcteur', 'eleve'));

alter table public.profiles add column if not exists status text not null default 'approved';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'approved', 'rejected'));
-- default 'approved' pour ne pas bloquer le staff existant; register_student force 'pending'.

-- 2. Anti-escalade: aucun UPDATE direct sur profiles (cf. 0004 « pas d'UPDATE direct »).
--    Une policy self-update laisserait un élève passer role='owner' ou status='approved'.
drop policy if exists users_update_own_profile on public.profiles;
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select to authenticated using (id = auth.uid());

-- 3. Inscription d'un élève aux matières.
create table if not exists public.student_matieres (
  student_id uuid not null references public.profiles(id) on delete cascade,
  matiere_id uuid not null references public.matieres(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, matiere_id)
);
create index if not exists student_matieres_matiere_idx on public.student_matieres(matiere_id);

alter table public.student_matieres enable row level security;

drop policy if exists student_matieres_staff_select on public.student_matieres;
create policy student_matieres_staff_select on public.student_matieres
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists student_matieres_admin_write on public.student_matieres;
create policy student_matieres_admin_write on public.student_matieres
  for all to authenticated
  using (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));
-- Aucune policy pour 'eleve': il lit exclusivement via les RPC security definer ci-dessous.

-- 4. Examen rattaché à un cours + candidat rattaché à un élève.
alter table public.exams      add column if not exists course_id  uuid references public.quiz_courses(id) on delete set null;
alter table public.candidates add column if not exists student_id uuid references public.profiles(id) on delete set null;
create index if not exists exams_course_id_idx       on public.exams(course_id);
create index if not exists candidates_student_id_idx on public.candidates(student_id);

-- 4bis. Un élève connecté est 'authenticated', pas 'anon': les policies du flux
--       candidat anonyme (exams_anon_select_open, *_anon_* sur attempts) ne
--       s'appliquent pas à lui. On rouvre le strict nécessaire, plus étroitement.
drop policy if exists exams_auth_select_open on public.exams;
create policy exams_auth_select_open on public.exams
  for select to authenticated using (is_open = true);
-- (même surface que ce que 'anon' peut déjà lire depuis 0005: aucune fuite nouvelle)

drop policy if exists attempts_student_select on public.attempts;
create policy attempts_student_select on public.attempts
  for select to authenticated
  using (exists (select 1 from public.candidates c
                  where c.id = attempts.candidate_id and c.student_id = auth.uid()));

drop policy if exists attempts_student_update on public.attempts;
create policy attempts_student_update on public.attempts
  for update to authenticated
  using (attempts.submitted_at is null
         and exists (select 1 from public.candidates c
                      where c.id = attempts.candidate_id and c.student_id = auth.uid()))
  with check (exists (select 1 from public.candidates c
                       where c.id = attempts.candidate_id and c.student_id = auth.uid()));

-- Les RPC du flux examen ont été créées hors migrations, avec des grants inconnus.
-- Les rendre appelables par un élève connecté, quelle que soit leur signature.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('register_candidate_and_attempt', 'verify_exam_code')
  loop
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;

-- 5. Les élèves ne sont pas des membres staff: les sortir de la gestion utilisateurs.
create or replace function public.list_members()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  tenant_id uuid,
  is_platform_admin boolean
)
language sql security definer set search_path = public as $$
  select
    p.id,
    u.email::text as email,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') as full_name,
    p.role,
    p.tenant_id,
    p.is_platform_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role is distinct from 'eleve'
    and (public.is_platform_admin()
         or (public.is_tenant_admin() and p.tenant_id = public.current_tenant_id()));
$$;

grant execute on function public.list_members() to authenticated;

-- 6. Inscription de l'élève (appelée juste après auth.signUp, côté /eleve/inscription).
--    Le tenant est résolu par le host, comme toutes les entrées publiques.
create or replace function public.register_student(p_host text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_tenant uuid; v_role text; v_status text;
begin
  if v_uid is null then
    raise exception 'Authentification requise.';
  end if;

  select id into v_tenant from public.tenants where host = p_host;
  if v_tenant is null then
    raise exception 'Aucune instance pour ce domaine.';
  end if;

  select role, status into v_role, v_status from public.profiles where id = v_uid;
  if v_role in ('owner', 'editeur', 'correcteur') then
    raise exception 'Ce compte appartient déjà au personnel de l''instance.';
  end if;

  insert into public.profiles (id, tenant_id, role, status)
  values (v_uid, v_tenant, 'eleve', 'pending')
  on conflict (id) do update
    set tenant_id = excluded.tenant_id,
        role = 'eleve',
        -- une réinscription ne réinitialise pas une validation déjà accordée
        status = case when v_status = 'approved' then 'approved' else 'pending' end;

  insert into public.activity_log (actor_id, actor_role, action, tenant_id)
  values (v_uid, 'eleve', 'student_register', v_tenant);

  return jsonb_build_object('status', (select status from public.profiles where id = v_uid));
end $$;

grant execute on function public.register_student(text) to authenticated;

-- 7. Profil élève + matières auxquelles il est inscrit.
--    Seule porte d'entrée de l'élève sur ses données (il échoue is_staff()).
create or replace function public.student_me()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'status', p.status,
    'full_name', coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    'email', u.email::text,
    'tenant_name', t.name,
    'matieres', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'slug', m.slug)
                        order by m.position, m.name)
      from public.student_matieres sm
      join public.matieres m on m.id = sm.matiere_id
      where sm.student_id = p.id
    ), '[]'::jsonb)
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.tenants t on t.id = p.tenant_id
  where p.id = auth.uid();
$$;

grant execute on function public.student_me() to authenticated;

-- 8. Progression: une ligne par examen des matières où l'élève est inscrit
--    (les cours sans examen remontent aussi, exam_id null).
--    p_student_id null = soi-même. Sinon: réservé owner/plateforme du même tenant.
create or replace function public.student_progress(p_student_id uuid default null)
returns table (
  matiere_id uuid, matiere_name text,
  course_id uuid, course_number int, course_title text,
  exam_id uuid, exam_slug text, exam_title text,
  candidate_id uuid, score numeric, total numeric,
  started_at timestamptz, submitted_at timestamptz, graded_at timestamptz,
  answers jsonb
)
language plpgsql stable security definer set search_path = public as $$
declare v_student uuid := coalesce(p_student_id, auth.uid()); v_tenant uuid;
begin
  if v_student is null then
    raise exception 'Authentification requise.';
  end if;
  if v_student <> auth.uid() then
    select tenant_id into v_tenant from public.profiles where id = v_student;
    if not (public.is_platform_admin()
            or (public.is_tenant_admin() and v_tenant = public.current_tenant_id())) then
      raise exception 'Accès refusé.';
    end if;
  end if;

  return query
  select
    m.id, m.name,
    c.id, c.number, c.title,
    e.id, e.slug, e.title,
    cand.id, a.score, a.total,
    a.started_at, a.submitted_at, a.graded_at,
    a.answers
  from public.student_matieres sm
  join public.matieres m on m.id = sm.matiere_id
  left join public.quiz_courses c on c.subject_id = m.id
  left join public.exams e on e.course_id = c.id and e.tenant_id = m.tenant_id
  left join public.candidates cand on cand.exam_id = e.id and cand.student_id = v_student
  left join lateral (
    select at.score, at.total, at.started_at, at.submitted_at, at.graded_at, at.answers
    from public.attempts at
    where at.candidate_id = cand.id
    order by at.started_at desc limit 1
  ) a on true
  where sm.student_id = v_student
  order by m.position, m.name, c.created_at, c.position, c.number nulls last, e.title;
end $$;

grant execute on function public.student_progress(uuid) to authenticated;

-- 9. Rattachement de la copie à l'élève, après register_candidate_and_attempt
--    (dont le source vit dans le dashboard: on ne le modifie pas).
create or replace function public.link_candidate_to_student(p_candidate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_exam uuid; v_subject uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise.';
  end if;
  if not exists (select 1 from public.profiles
                  where id = v_uid and role = 'eleve' and status = 'approved') then
    raise exception 'Compte élève non validé.';
  end if;

  select c.exam_id into v_exam
    from public.candidates c
   where c.id = p_candidate_id and c.student_id is null;
  if v_exam is null then
    raise exception 'Copie introuvable ou déjà rattachée.';
  end if;

  select subject_id into v_subject from public.exams where id = v_exam;
  if not exists (select 1 from public.student_matieres
                  where student_id = v_uid and matiere_id = v_subject) then
    raise exception 'Non inscrit à cette matière.';
  end if;

  update public.candidates set student_id = v_uid where id = p_candidate_id;
end $$;

grant execute on function public.link_candidate_to_student(uuid) to authenticated;

-- 10. Gestion des élèves (owner / plateforme).
create or replace function public.list_students()
returns table (
  id uuid, email text, full_name text, status text, tenant_id uuid,
  matiere_ids uuid[], exams_done bigint, avg_pct numeric, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    p.status,
    p.tenant_id,
    coalesce((select array_agg(sm.matiere_id) from public.student_matieres sm where sm.student_id = p.id),
             '{}'::uuid[]),
    (select count(*) from public.candidates c
      join public.attempts a on a.candidate_id = c.id
     where c.student_id = p.id and a.submitted_at is not null),
    (select round(avg(a.score / nullif(a.total, 0)) * 100, 1) from public.candidates c
      join public.attempts a on a.candidate_id = c.id
     where c.student_id = p.id and a.submitted_at is not null),
    u.created_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'eleve'
    and (public.is_platform_admin()
         or (public.is_tenant_admin() and p.tenant_id = public.current_tenant_id()))
  order by p.status, u.created_at desc;
$$;

grant execute on function public.list_students() to authenticated;

create or replace function public.set_student_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if p_status not in ('pending', 'approved', 'rejected') then
    raise exception 'Statut invalide.';
  end if;
  select tenant_id into v_tenant from public.profiles where id = p_id and role = 'eleve';
  if v_tenant is null then
    raise exception 'Élève introuvable.';
  end if;
  if not (public.is_platform_admin()
          or (public.is_tenant_admin() and v_tenant = public.current_tenant_id())) then
    raise exception 'Accès refusé.';
  end if;

  update public.profiles set status = p_status where id = p_id;
  perform public.log_activity('set_student_status',
    p_meta := jsonb_build_object('student_id', p_id, 'status', p_status));
end $$;

grant execute on function public.set_student_status(uuid, text) to authenticated;

create or replace function public.set_student_matieres(p_id uuid, p_matiere_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  select tenant_id into v_tenant from public.profiles where id = p_id and role = 'eleve';
  if v_tenant is null then
    raise exception 'Élève introuvable.';
  end if;
  if not (public.is_platform_admin()
          or (public.is_tenant_admin() and v_tenant = public.current_tenant_id())) then
    raise exception 'Accès refusé.';
  end if;
  if exists (select 1 from unnest(coalesce(p_matiere_ids, '{}'::uuid[])) mid
              where mid not in (select id from public.matieres where tenant_id = v_tenant)) then
    raise exception 'Matière hors instance.';
  end if;

  delete from public.student_matieres where student_id = p_id;
  insert into public.student_matieres (student_id, matiere_id, tenant_id)
  select p_id, mid, v_tenant from unnest(coalesce(p_matiere_ids, '{}'::uuid[])) mid;

  perform public.log_activity('set_student_matieres',
    p_meta := jsonb_build_object('student_id', p_id, 'count', coalesce(array_length(p_matiere_ids, 1), 0)));
end $$;

grant execute on function public.set_student_matieres(uuid, uuid[]) to authenticated;
