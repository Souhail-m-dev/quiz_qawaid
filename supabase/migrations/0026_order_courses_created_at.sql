-- Ordre des cours de révision côté public : par date de création (puis position
-- en départage pour les imports en lot, qui partagent le même created_at).
-- Avant : position d'abord — les cours ajoutés via l'admin (position 0 par défaut)
-- passaient devant les cours importés numérotés.

create or replace function public.quiz_courses_by_host(p_host text, p_subject text default null)
returns table(id uuid, subject text, number int, title text, course_date text, pos int, question_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.subject, c.number, c.title, c.course_date, c.position,
         (select count(*) from public.quiz_questions q where q.course_id = c.id)
  from public.quiz_courses c
  join public.tenants t on t.id = c.tenant_id
  where t.host = p_host
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
      from public.exams e where e.subject_id = m.id and e.is_open = true), '[]'::jsonb),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'number', c.number, 'title', c.title,
        'question_count', (select count(*) from public.quiz_questions q where q.course_id = c.id)) order by c.created_at, c.position)
      from public.quiz_courses c where c.subject_id = m.id), '[]'::jsonb)
  );
end $$;
