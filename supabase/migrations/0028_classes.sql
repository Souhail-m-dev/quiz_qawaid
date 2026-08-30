-- Classes: un élève est rattaché à une classe, la classe porte les matières.
-- Chaîne: classe → matières → cours → examen/quizz.
--
-- Les matières attribuées individuellement (student_matieres, 0027) restent
-- possibles en complément: les matières effectives d'un élève sont l'UNION des
-- deux (classe ∪ individuelles). Voir student_matiere_ids() ci-dessous.

-- 1. Tables.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.class_matieres (
  class_id   uuid not null references public.classes(id) on delete cascade,
  matiere_id uuid not null references public.matieres(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  primary key (class_id, matiere_id)
);
create index if not exists class_matieres_matiere_idx on public.class_matieres(matiere_id);

alter table public.profiles add column if not exists class_id uuid references public.classes(id) on delete set null;
create index if not exists profiles_class_id_idx on public.profiles(class_id);

-- 2. tenant_id + slug automatiques (même mécanique que matieres, cf. 0017).
create or replace function public.tg_set_class_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    select tenant_id into new.tenant_id
      from public.profiles where id = coalesce(new.created_by, auth.uid());
  end if;
  if new.slug is null or new.slug = '' then
    new.slug := public.slugify(new.name);
  end if;
  return new;
end $$;

drop trigger if exists trg_set_class_tenant on public.classes;
create trigger trg_set_class_tenant before insert on public.classes
  for each row execute function public.tg_set_class_tenant();

create or replace function public.tg_inherit_tenant_from_class()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    select tenant_id into new.tenant_id from public.classes where id = new.class_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_class_matiere_tenant on public.class_matieres;
create trigger trg_class_matiere_tenant before insert on public.class_matieres
  for each row execute function public.tg_inherit_tenant_from_class();

-- 3. RLS: lecture staff, écriture éditeur de contenu (comme matieres, 0020).
--    Aucune policy 'eleve': il lit via les RPC security definer.
alter table public.classes       enable row level security;
alter table public.class_matieres enable row level security;

drop policy if exists classes_staff_select on public.classes;
create policy classes_staff_select on public.classes
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists classes_editor_write on public.classes;
create policy classes_editor_write on public.classes
  for all to authenticated
  using (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()));

drop policy if exists class_matieres_staff_select on public.class_matieres;
create policy class_matieres_staff_select on public.class_matieres
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));

drop policy if exists class_matieres_editor_write on public.class_matieres;
create policy class_matieres_editor_write on public.class_matieres
  for all to authenticated
  using (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()));

-- 4. Matières effectives d'un élève: celles de sa classe + les individuelles.
--    Point d'entrée unique — toute logique élève doit passer par ici.
create or replace function public.student_matiere_ids(p_student uuid)
returns table (matiere_id uuid)
language sql stable security definer set search_path = public as $$
  select sm.matiere_id from public.student_matieres sm where sm.student_id = p_student
  union
  select cm.matiere_id
    from public.profiles p
    join public.class_matieres cm on cm.class_id = p.class_id
   where p.id = p_student;
$$;

grant execute on function public.student_matiere_ids(uuid) to authenticated;

-- 5. Les RPC élève de 0027 passent toutes par student_matiere_ids().
create or replace function public.student_me()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'status', p.status,
    'full_name', coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    'email', u.email::text,
    'tenant_name', t.name,
    'class_id', p.class_id,
    'class_name', cl.name,
    'matieres', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'slug', m.slug)
                        order by m.position, m.name)
      from public.student_matiere_ids(p.id) sm
      join public.matieres m on m.id = sm.matiere_id
    ), '[]'::jsonb)
  )
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.tenants t on t.id = p.tenant_id
  left join public.classes cl on cl.id = p.class_id
  where p.id = auth.uid();
$$;

grant execute on function public.student_me() to authenticated;

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
  from public.student_matiere_ids(v_student) sm
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
  order by m.position, m.name, c.created_at, c.position, c.number nulls last, e.title;
end $$;

grant execute on function public.student_progress(uuid) to authenticated;

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
  if not exists (select 1 from public.student_matiere_ids(v_uid) where matiere_id = v_subject) then
    raise exception 'Non inscrit à cette matière.';
  end if;

  update public.candidates set student_id = v_uid where id = p_candidate_id;
end $$;

grant execute on function public.link_candidate_to_student(uuid) to authenticated;

-- 6. Gestion: classe de l'élève + classe affichée dans la liste.
create or replace function public.set_student_class(p_id uuid, p_class_id uuid)
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
  if p_class_id is not null
     and not exists (select 1 from public.classes where id = p_class_id and tenant_id = v_tenant) then
    raise exception 'Classe hors instance.';
  end if;

  update public.profiles set class_id = p_class_id where id = p_id;
  perform public.log_activity('set_student_class',
    p_meta := jsonb_build_object('student_id', p_id, 'class_id', p_class_id));
end $$;

grant execute on function public.set_student_class(uuid, uuid) to authenticated;

-- `create or replace` refuse un changement de colonnes OUT (42P13): on ajoute
-- class_id/class_name, donc drop explicite d'abord.
drop function if exists public.list_students();
create or replace function public.list_students()
returns table (
  id uuid, email text, full_name text, status text, tenant_id uuid,
  class_id uuid, class_name text,
  matiere_ids uuid[], exams_done bigint, avg_pct numeric, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'),
    p.status,
    p.tenant_id,
    p.class_id,
    cl.name,
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
  left join public.classes cl on cl.id = p.class_id
  where p.role = 'eleve'
    and (public.is_platform_admin()
         or (public.is_tenant_admin() and p.tenant_id = public.current_tenant_id()))
  order by p.status, u.created_at desc;
$$;

grant execute on function public.list_students() to authenticated;
