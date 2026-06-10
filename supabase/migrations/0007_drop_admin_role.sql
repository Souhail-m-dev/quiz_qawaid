-- Supprime le rôle intra-tenant 'admin' (hérité). Hiérarchie finale:
--   is_platform_admin (flag) > owner (gère son tenant) > correcteur.
-- L'« admin » conceptuel tout en haut = is_platform_admin, inchangé.

-- 1. Migration des données (avant de resserrer la contrainte).
--    Plateforme: 'admin' -> 'owner' (garde le flag).
update public.profiles set role = 'owner'
  where role = 'admin' and is_platform_admin = true;
--    Admins tenant -> rétrogradés en 'correcteur'.
update public.profiles set role = 'correcteur'
  where role = 'admin' and is_platform_admin = false;

-- 2. Helpers: retirer 'admin'.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'correcteur'));
$$;

create or replace function public.is_tenant_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner');
$$;

-- is_admin() (hérité, encore référencé par d'anciennes policies) = owner désormais.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner');
$$;

-- 3. set_member_role: seul 'correcteur' (owner = provision_owner).
create or replace function public.set_member_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller_tenant uuid; v_target_tenant uuid;
begin
  if p_role <> 'correcteur' then
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

-- 4. Contrainte: plus que owner/correcteur (après migration des données).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'correcteur'));
