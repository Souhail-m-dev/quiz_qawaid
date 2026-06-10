-- Liste des membres (staff) lisible: email + nom depuis auth.users.
-- profiles ne stocke pas l'email; on le récupère via auth.users dans un
-- SECURITY DEFINER, en reproduisant l'isolation tenant de la RLS profiles.

create or replace function public.list_members()
returns table (
  id uuid,
  email text,
  full_name text,
  role text,
  tenant_id uuid,
  is_platform_admin boolean
)
language sql
security definer
set search_path = public
as $$
  select
    p.id,
    u.email::text as email,
    coalesce(
      u.raw_user_meta_data->>'full_name',
      u.raw_user_meta_data->>'name'
    ) as full_name,
    p.role,
    p.tenant_id,
    p.is_platform_admin
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_platform_admin()
     or (public.is_tenant_admin() and p.tenant_id = public.current_tenant_id());
$$;

grant execute on function public.list_members() to authenticated;
