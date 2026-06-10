-- Phase 6 — Multi-tenant (modèle "pooled": une seule base, isolation par tenant_id + RLS).
-- NON DESTRUCTIF: colonnes nullable + backfill d'un tenant par défaut pour tout l'existant,
-- puis attribution automatique du tenant_id par triggers. Aucun examen existant n'est cassé.
--
-- Hiérarchie des rôles:
--   platform admin (toi)  -> profiles.is_platform_admin = true : voit TOUS les tenants.
--   owner                 -> administrateur de son instance (tenant). Contrôle total intra-tenant.
--   correcteur            -> staff intra-tenant (correction, certificats).
-- 'admin' (rôle hérité de 0001) reste valide et équivaut à owner intra-tenant.

-- 1. Table des tenants (instances).
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.tenants enable row level security;

-- 2. profiles: rattachement tenant + flag plateforme + rôle 'owner'.
alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists is_platform_admin boolean not null default false;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles drop constraint profiles_role_check;
  end if;
  alter table public.profiles
    add constraint profiles_role_check check (role in ('owner', 'admin', 'correcteur'));
end $$;

-- 3. tenant_id sur les tables métier (nullable d'abord).
alter table public.exams         add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.candidates    add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.attempts      add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;
alter table public.activity_log  add column if not exists tenant_id uuid;
alter table public.exam_correctors add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

-- 4. Backfill: un tenant par défaut, propriétaire = premier admin existant.
do $$
declare
  v_tenant uuid;
  v_owner uuid;
begin
  select id into v_tenant from public.tenants where name = 'Instance par défaut' limit 1;
  if v_tenant is null then
    select id into v_owner from public.profiles
      where role in ('owner', 'admin') or is_admin = true
      order by 1 limit 1;
    insert into public.tenants (name, owner_id) values ('Instance par défaut', v_owner)
      returning id into v_tenant;
  end if;

  -- Rattacher tout l'existant à ce tenant.
  update public.profiles      set tenant_id = v_tenant where tenant_id is null;
  update public.exams         set tenant_id = v_tenant where tenant_id is null;
  update public.candidates    set tenant_id = v_tenant where tenant_id is null;
  update public.attempts      set tenant_id = v_tenant where tenant_id is null;
  update public.activity_log  set tenant_id = v_tenant where tenant_id is null;
  update public.exam_correctors set tenant_id = v_tenant where tenant_id is null;

  -- Les admins hérités deviennent admins plateforme (vue cross-tenant) + owner du tenant.
  update public.profiles set is_platform_admin = true
    where (role = 'admin' or is_admin = true) and is_platform_admin = false;
end $$;

create index if not exists exams_tenant_idx on public.exams (tenant_id);
create index if not exists candidates_tenant_idx on public.candidates (tenant_id);
create index if not exists attempts_tenant_idx on public.attempts (tenant_id);
create index if not exists activity_log_tenant_idx on public.activity_log (tenant_id);

-- 5. Helpers.
create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_platform_admin from public.profiles where id = auth.uid()), false);
$$;

-- 6. Attribution automatique du tenant_id (aucun changement requis côté client).
--    exam: depuis le profil du créateur.
create or replace function public.tg_set_exam_tenant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null then
    new.tenant_id := (select tenant_id from public.profiles where id = coalesce(new.created_by, auth.uid()));
  end if;
  return new;
end $$;
drop trigger if exists trg_set_exam_tenant on public.exams;
create trigger trg_set_exam_tenant before insert on public.exams
  for each row execute function public.tg_set_exam_tenant();

--    candidate + attempt: hérités de l'examen (le candidat est anonyme, pas de profil).
create or replace function public.tg_inherit_tenant_from_exam()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tenant_id is null and new.exam_id is not null then
    new.tenant_id := (select tenant_id from public.exams where id = new.exam_id);
  end if;
  return new;
end $$;
drop trigger if exists trg_candidate_tenant on public.candidates;
create trigger trg_candidate_tenant before insert on public.candidates
  for each row execute function public.tg_inherit_tenant_from_exam();
drop trigger if exists trg_attempt_tenant on public.attempts;
create trigger trg_attempt_tenant before insert on public.attempts
  for each row execute function public.tg_inherit_tenant_from_exam();

-- 7. RLS tenants.
drop policy if exists tenants_platform_all on public.tenants;
create policy tenants_platform_all on public.tenants
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists tenants_member_read on public.tenants;
create policy tenants_member_read on public.tenants
  for select using (id = public.current_tenant_id());

-- 8. RLS isolation tenant — ATTENTION (sécurité):
--    Les politiques RLS sont PERMISSIVES (OR). Ajouter une politique tenant ne RESTREINT pas
--    si une politique existante autorise déjà tout le staff à lire toutes les lignes.
--    => Pour une vraie isolation, il faut REMPLACER les politiques staff/admin existantes
--       sur exams / candidates / attempts par les versions tenant ci-dessous.
--    Les noms des politiques existantes ne sont pas connus de cette migration: décommentez
--    et adaptez après avoir listé les politiques actuelles:
--       select policyname, cmd, qual, with_check from pg_policies
--       where schemaname='public' and tablename in ('exams','candidates','attempts');
--
-- Modèle d'isolation (à activer après revue) :
--   -- exams: lecture publique anon par slug conservée (NE PAS toucher la policy anon select).
--   -- Staff:
--   drop policy if exists exams_staff_select on public.exams;
--   create policy exams_staff_select on public.exams for select to authenticated
--     using (public.is_platform_admin() or tenant_id = public.current_tenant_id());
--   drop policy if exists exams_admin_write on public.exams;
--   create policy exams_admin_write on public.exams for all to authenticated
--     using (public.is_platform_admin() or tenant_id = public.current_tenant_id())
--     with check (public.is_platform_admin() or tenant_id = public.current_tenant_id());
--   -- candidates / attempts: idem (lecture/écriture staff scoping par tenant_id).

-- activity_log: restreindre la lecture admin au tenant (sauf plateforme).
drop policy if exists activity_log_admin_read on public.activity_log;
create policy activity_log_admin_read on public.activity_log
  for select using (
    public.is_platform_admin()
    or (public.is_admin() and tenant_id = public.current_tenant_id())
  );

-- exam_correctors: scoping tenant.
drop policy if exists exam_correctors_admin_all on public.exam_correctors;
create policy exam_correctors_admin_all on public.exam_correctors
  for all using (public.is_platform_admin() or (public.is_admin() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_admin() and tenant_id = public.current_tenant_id()));

-- 9. log_activity + triggers d'audit: renseigner tenant_id.
create or replace function public.log_activity(
  p_action text, p_exam_id uuid default null, p_candidate_id uuid default null,
  p_attempt_id uuid default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_role text; v_tenant uuid;
begin
  select role, tenant_id into v_role, v_tenant from public.profiles where id = auth.uid();
  if v_role is null then return; end if;
  if p_exam_id is not null then
    v_tenant := coalesce((select tenant_id from public.exams where id = p_exam_id), v_tenant);
  end if;
  insert into public.activity_log (actor_id, actor_role, action, exam_id, candidate_id, attempt_id, meta, tenant_id)
  values (auth.uid(), v_role, p_action, p_exam_id, p_candidate_id, p_attempt_id, p_meta, v_tenant);
end $$;

create or replace function public.tg_log_register()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (actor_role, action, exam_id, candidate_id, tenant_id)
  values ('eleve', 'register', new.exam_id, new.id, new.tenant_id);
  return new;
end $$;

create or replace function public.tg_log_submit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.submitted_at is not null and old.submitted_at is null then
    insert into public.activity_log (actor_role, action, exam_id, candidate_id, attempt_id, meta, tenant_id)
    values ('eleve', 'submit', new.exam_id, new.candidate_id, new.id,
            jsonb_build_object('score', new.score, 'total', new.total), new.tenant_id);
  end if;
  return new;
end $$;

-- 10. Provisionnement d'un owner + son tenant (réservé plateforme).
--     p_profile_id doit déjà exister (compte créé via invitation Supabase Auth).
create or replace function public.provision_owner(p_profile_id uuid, p_tenant_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'Réservé à l''administrateur plateforme.';
  end if;
  insert into public.tenants (name, owner_id) values (p_tenant_name, p_profile_id)
    returning id into v_tenant;
  update public.profiles set role = 'owner', tenant_id = v_tenant where id = p_profile_id;
  return v_tenant;
end $$;

grant execute on function public.provision_owner(uuid, text) to authenticated;
