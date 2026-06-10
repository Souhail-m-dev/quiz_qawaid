-- Phase 0 — Multi-sujets + rôles + formulaires + correction ouverte
-- Idempotent: réexécutable sans casse. Projet: actcxenbivmpyzmnctvi.

-- 1. profiles.role (admin | correcteur). Conserve is_admin le temps de la bascule.
alter table public.profiles
  add column if not exists role text not null default 'correcteur';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('admin', 'correcteur'));
  end if;
end $$;

-- Bascule: tout is_admin existant devient role='admin'.
update public.profiles set role = 'admin' where is_admin = true and role <> 'admin';

-- 2. exams: sujet libre + schémas de formulaires avant/après.
alter table public.exams
  add column if not exists subject text,
  add column if not exists pre_form_schema jsonb,
  add column if not exists post_form_schema jsonb;

-- 3. candidates: réponses des formulaires dynamiques.
alter table public.candidates
  add column if not exists pre_form_data jsonb,
  add column if not exists post_form_data jsonb;

-- 4. attempts: score/total en numeric pour points fractionnés.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempts'
      and column_name='score' and data_type in ('integer','bigint','smallint')
  ) then
    alter table public.attempts alter column score type numeric using score::numeric;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='attempts'
      and column_name='total' and data_type in ('integer','bigint','smallint')
  ) then
    alter table public.attempts alter column total type numeric using total::numeric;
  end if;
end $$;

-- 5. Helpers de rôle (SECURITY DEFINER pour lire profiles depuis RLS).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'correcteur')
  );
$$;

-- 6. Affectation correcteurs ↔ examens (optionnel; vide = accès à tout examen).
create table if not exists public.exam_correctors (
  exam_id uuid not null references public.exams(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (exam_id, profile_id)
);
alter table public.exam_correctors enable row level security;

drop policy if exists exam_correctors_admin_all on public.exam_correctors;
create policy exam_correctors_admin_all on public.exam_correctors
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists exam_correctors_self_read on public.exam_correctors;
create policy exam_correctors_self_read on public.exam_correctors
  for select using (profile_id = auth.uid());

-- 7. Journal d'audit (super-admin voit tout; correcteur insère seulement).
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  exam_id uuid,
  candidate_id uuid,
  attempt_id uuid,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);
create index if not exists activity_log_exam_idx on public.activity_log (exam_id);

alter table public.activity_log enable row level security;

drop policy if exists activity_log_admin_read on public.activity_log;
create policy activity_log_admin_read on public.activity_log
  for select using (public.is_admin());

drop policy if exists activity_log_staff_insert on public.activity_log;
create policy activity_log_staff_insert on public.activity_log
  for insert with check (public.is_staff() and actor_id = auth.uid());

-- 8. RPC SECURITY DEFINER pour stocker les réponses de formulaires (candidat anon).
--    Restreint: pré-form écrit une seule fois (avant 1ère écriture), post-form après soumission.
create or replace function public.save_candidate_pre_form(p_candidate_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.candidates
     set pre_form_data = p_data
   where id = p_candidate_id and pre_form_data is null;
end $$;

create or replace function public.save_candidate_post_form(p_candidate_id uuid, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.candidates c
     set post_form_data = p_data
   where c.id = p_candidate_id
     and exists (
       select 1 from public.attempts a
       where a.candidate_id = c.id and a.submitted_at is not null
     );
end $$;

grant execute on function public.save_candidate_pre_form(uuid, jsonb) to anon, authenticated;
grant execute on function public.save_candidate_post_form(uuid, jsonb) to anon, authenticated;

-- 9. RPC d'insertion dans l'audit (utilisable par le staff authentifié).
create or replace function public.log_activity(
  p_action text, p_exam_id uuid default null, p_candidate_id uuid default null,
  p_attempt_id uuid default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role is null then return; end if; -- seulement staff connecté
  insert into public.activity_log (actor_id, actor_role, action, exam_id, candidate_id, attempt_id, meta)
  values (auth.uid(), v_role, p_action, p_exam_id, p_candidate_id, p_attempt_id, p_meta);
end $$;

grant execute on function public.log_activity(text, uuid, uuid, uuid, jsonb) to authenticated;
