-- Phase 6b — Isolation RLS par tenant + correctifs.
-- Remplace les policies staff/admin "voient tout" par des versions scopées au tenant.
-- Conserve la lecture publique anon (inscription élève par slug) et le flux d'examen anon.

-- 1. Helpers: inclure 'owner' (oublié en 0001), ajouter is_tenant_admin.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'admin', 'correcteur'));
$$;

create or replace function public.is_tenant_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'admin'));
$$;

-- 2. EXAMS — staff lit son tenant; tenant-admin écrit son tenant; anon lit les examens ouverts.
drop policy if exists exams_admin_all on public.exams;

create policy exams_staff_select on public.exams
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));

create policy exams_admin_write on public.exams
  for all to authenticated
  using (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));
-- (exams_anon_select_open / public_can_read_open_exams conservées telles quelles.)

-- 3. CANDIDATES — staff lit son tenant; insertion anon conservée.
drop policy if exists candidates_admin_select on public.candidates;

create policy candidates_staff_select on public.candidates
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));
-- (candidates_anon_insert_open_exam conservée.)

-- 4. ATTEMPTS — staff lit ET corrige (UPDATE) son tenant; flux anon conservé.
drop policy if exists attempts_admin_select on public.attempts;

create policy attempts_staff_select on public.attempts
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));

-- Manquait totalement: sans ça la correction (update answers/score) échoue en RLS.
create policy attempts_staff_update on public.attempts
  for update to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));
-- (anon_can_read_attempts / anon_can_update_attempts / attempts_anon_insert /
--  attempts_anon_update_unsubmitted conservées: nécessaires au déroulé de l'examen.)

-- 5. PROFILES — tenant-admin voit les profils de son tenant; pas d'UPDATE direct (escalade).
drop policy if exists profiles_admin_select_all on public.profiles;

create policy profiles_tenant_admin_select on public.profiles
  for select to authenticated
  using (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));
-- (profiles_self_select / users_read_own_profile / users_update_own_profile conservées.)

-- 6. activity_log / exam_correctors: utiliser is_tenant_admin (inclut owner).
drop policy if exists activity_log_admin_read on public.activity_log;
create policy activity_log_admin_read on public.activity_log
  for select using (
    public.is_platform_admin()
    or (public.is_tenant_admin() and tenant_id = public.current_tenant_id())
  );

drop policy if exists exam_correctors_admin_all on public.exam_correctors;
create policy exam_correctors_admin_all on public.exam_correctors
  for all using (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

-- 7. Changement de rôle d'un membre via RPC (évite l'escalade is_platform_admin par UPDATE direct).
--    Autorise seulement admin/correcteur, dans le tenant de l'appelant (ou plateforme).
create or replace function public.set_member_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller_tenant uuid; v_target_tenant uuid;
begin
  if p_role not in ('admin', 'correcteur') then
    raise exception 'Rôle non autorisé via cette opération (owner = provision_owner).';
  end if;
  if public.is_platform_admin() then
    update public.profiles set role = p_role where id = p_profile_id;
    return;
  end if;
  if not public.is_tenant_admin() then
    raise exception 'Réservé aux administrateurs.';
  end if;
  select tenant_id into v_caller_tenant from public.profiles where id = auth.uid();
  select tenant_id into v_target_tenant from public.profiles where id = p_profile_id;
  if v_caller_tenant is null or v_caller_tenant <> v_target_tenant then
    raise exception 'Profil hors de votre instance.';
  end if;
  update public.profiles set role = p_role where id = p_profile_id;
end $$;

grant execute on function public.set_member_role(uuid, text) to authenticated;
