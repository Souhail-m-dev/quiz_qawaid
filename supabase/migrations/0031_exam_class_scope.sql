-- Réserver un examen / un cours de révision à une classe précise.
--
-- class_id null  = comportement actuel: visible par tous (vitrine publique
--                  incluse) et par tout élève inscrit à la matière.
-- class_id posé  = réservé aux élèves de cette classe, et RETIRÉ des pages
--                  publiques (un contenu réservé à une classe n'a rien à faire
--                  sur la vitrine anonyme).

alter table public.exams        add column if not exists class_id uuid references public.classes(id) on delete set null;
alter table public.quiz_courses add column if not exists class_id uuid references public.classes(id) on delete set null;
create index if not exists exams_class_id_idx        on public.exams(class_id);
create index if not exists quiz_courses_class_id_idx on public.quiz_courses(class_id);

-- 1. Progression élève: filtrer sur SA classe.
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
declare v_student uuid := coalesce(p_student_id, auth.uid()); v_tenant uuid; v_class uuid;
begin
  if v_student is null then
    raise exception 'Authentification requise.';
  end if;

  select tenant_id, class_id into v_tenant, v_class
    from public.profiles where id = v_student;

  if v_student <> auth.uid() then
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
  left join public.quiz_courses c
         on c.subject_id = m.id
        and (c.class_id is null or c.class_id = v_class)
  left join public.exams e
         on e.course_id = c.id
        and e.tenant_id = m.tenant_id
        and (e.class_id is null or e.class_id = v_class)
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

-- 2. Rattachement d'une copie: refuser un examen réservé à une autre classe.
create or replace function public.link_candidate_to_student(p_candidate_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_exam uuid; v_subject uuid; v_exam_class uuid; v_class uuid;
begin
  if v_uid is null then
    raise exception 'Authentification requise.';
  end if;
  select class_id into v_class from public.profiles
   where id = v_uid and role = 'eleve' and status = 'approved';
  if not found then
    raise exception 'Compte élève non validé.';
  end if;

  select c.exam_id into v_exam
    from public.candidates c
   where c.id = p_candidate_id and c.student_id is null;
  if v_exam is null then
    raise exception 'Copie introuvable ou déjà rattachée.';
  end if;

  select subject_id, class_id into v_subject, v_exam_class from public.exams where id = v_exam;
  if not exists (select 1 from public.student_matiere_ids(v_uid) where matiere_id = v_subject) then
    raise exception 'Non inscrit à cette matière.';
  end if;
  if v_exam_class is not null and v_exam_class is distinct from v_class then
    raise exception 'Examen réservé à une autre classe.';
  end if;

  update public.candidates set student_id = v_uid where id = p_candidate_id;
end $$;

grant execute on function public.link_candidate_to_student(uuid) to authenticated;

-- 3. Pages publiques (anon): masquer ce qui est réservé à une classe.
create or replace function public.matieres_by_host(p_host text)
returns table(id uuid, name text, slug text, description text, has_password boolean,
              exam_count bigint, course_count bigint)
language sql stable security definer set search_path = public as $$
  select m.id, m.name, m.slug, m.description,
         (m.access_code is not null) as has_password,
         (select count(*) from public.exams e
           where e.subject_id = m.id and e.is_open = true and e.class_id is null),
         (select count(*) from public.quiz_courses c
           where c.subject_id = m.id and c.class_id is null)
  from public.matieres m
  join public.tenants t on t.id = m.tenant_id
  where t.host = p_host
  order by m.position, m.name;
$$;

create or replace function public.quiz_courses_by_host(p_host text, p_subject text default null)
returns table(id uuid, subject text, number int, title text, course_date text, pos int, question_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.subject, c.number, c.title, c.course_date, c.position,
         (select count(*) from public.quiz_questions q where q.course_id = c.id)
  from public.quiz_courses c
  join public.tenants t on t.id = c.tenant_id
  where t.host = p_host
    and c.class_id is null
    and (p_subject is null or c.subject = p_subject)
  order by c.created_at, c.position, c.number nulls last, c.title;
$$;

create or replace function public.matiere_content(p_host text, p_slug text, p_code text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m record;
begin
  select mm.* into m from public.matieres mm
    join public.tenants t on t.id = mm.tenant_id
    where t.host = p_host and mm.slug = p_slug;
  if not found then return null; end if;
  if m.access_code is not null and (p_code is null or p_code <> m.access_code) then
    return jsonb_build_object('locked', true, 'name', m.name);
  end if;
  return jsonb_build_object(
    'locked', false,
    'name', m.name,
    'description', m.description,
    'exams', coalesce((
      select jsonb_agg(jsonb_build_object('slug', e.slug, 'title', e.title) order by e.title)
      from public.exams e
      where e.subject_id = m.id and e.is_open = true and e.class_id is null), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'number', c.number, 'title', c.title,
        'question_count', (select count(*) from public.quiz_questions q where q.course_id = c.id))
        order by c.created_at, c.position)
      from public.quiz_courses c
      where c.subject_id = m.id and c.class_id is null), '[]'::jsonb)
  );
end $$;

grant execute on function public.matieres_by_host(text) to anon, authenticated;
grant execute on function public.quiz_courses_by_host(text, text) to anon, authenticated;
grant execute on function public.matiere_content(text, text, text) to anon, authenticated;
