-- Mode RÉVISION (entraînement libre), distinct des examens notés.
-- Banque multitenant: tenant_id + RLS. Contenu ajouté progressivement par le staff.
-- Public (anon) lit via RPC security definer (pas de policy anon sur les tables -> pas de fuite).

create table if not exists public.quiz_courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  subject text not null,                 -- matière (ex: "Qawaid al-Muthla", "Hisnul Mouslim")
  number int,                            -- numéro d'unité (affichage "Unité N")
  title text not null,
  course_date text,                      -- date libre (optionnel)
  position int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  course_id uuid not null references public.quiz_courses(id) on delete cascade,
  difficulte text not null default 'moyenne' check (difficulte in ('facile','moyenne','difficile')),
  question text not null,
  options jsonb not null,                -- array de chaînes
  correct_index int not null,
  justification text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists quiz_courses_tenant_subject_idx on public.quiz_courses (tenant_id, subject);
create index if not exists quiz_questions_course_idx on public.quiz_questions (course_id);
create index if not exists quiz_questions_tenant_idx on public.quiz_questions (tenant_id);

alter table public.quiz_courses enable row level security;
alter table public.quiz_questions enable row level security;

-- tenant_id auto depuis le profil créateur (sauf si fourni explicitement, ex: platform-admin).
create or replace function public.tg_set_quiz_course_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    new.tenant_id := (select tenant_id from public.profiles where id = coalesce(new.created_by, auth.uid()));
  end if;
  return new;
end $$;
drop trigger if exists trg_quiz_course_tenant on public.quiz_courses;
create trigger trg_quiz_course_tenant before insert on public.quiz_courses
  for each row execute function public.tg_set_quiz_course_tenant();

-- question hérite le tenant de son cours.
create or replace function public.tg_set_quiz_question_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null and new.course_id is not null then
    new.tenant_id := (select tenant_id from public.quiz_courses where id = new.course_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_quiz_question_tenant on public.quiz_questions;
create trigger trg_quiz_question_tenant before insert on public.quiz_questions
  for each row execute function public.tg_set_quiz_question_tenant();

-- RLS staff (scoping tenant; pas de policy anon -> accès public uniquement via RPC).
drop policy if exists quiz_courses_staff_all on public.quiz_courses;
create policy quiz_courses_staff_all on public.quiz_courses for all to authenticated
  using (public.is_platform_admin() or tenant_id = public.current_tenant_id())
  with check (public.is_platform_admin() or tenant_id = public.current_tenant_id());

drop policy if exists quiz_questions_staff_all on public.quiz_questions;
create policy quiz_questions_staff_all on public.quiz_questions for all to authenticated
  using (public.is_platform_admin() or tenant_id = public.current_tenant_id())
  with check (public.is_platform_admin() or tenant_id = public.current_tenant_id());

-- RPC publics (révision = contenu public, scoping par host->tenant).
create or replace function public.quiz_subjects_by_host(p_host text)
returns table(subject text, course_count bigint)
language sql stable security definer set search_path = public as $$
  select c.subject, count(*)
  from public.quiz_courses c
  join public.tenants t on t.id = c.tenant_id
  where t.host = p_host
  group by c.subject
  order by c.subject;
$$;

create or replace function public.quiz_courses_by_host(p_host text, p_subject text default null)
returns table(id uuid, subject text, number int, title text, course_date text, pos int, question_count bigint)
language sql stable security definer set search_path = public as $$
  select c.id, c.subject, c.number, c.title, c.course_date, c.position,
         (select count(*) from public.quiz_questions q where q.course_id = c.id)
  from public.quiz_courses c
  join public.tenants t on t.id = c.tenant_id
  where t.host = p_host
    and (p_subject is null or c.subject = p_subject)
  order by c.position, c.number nulls last, c.title;
$$;

create or replace function public.quiz_questions_by_course(p_course_id uuid)
returns table(id uuid, difficulte text, question text, options jsonb, correct_index int, justification text)
language sql stable security definer set search_path = public as $$
  select q.id, q.difficulte, q.question, q.options, q.correct_index, q.justification
  from public.quiz_questions q
  where q.course_id = p_course_id
  order by q.position;
$$;

grant execute on function public.quiz_subjects_by_host(text) to anon, authenticated;
grant execute on function public.quiz_courses_by_host(text, text) to anon, authenticated;
grant execute on function public.quiz_questions_by_course(uuid) to anon, authenticated;
