-- Branding public par sous-domaine: les candidats anon ne peuvent pas lire la table
-- tenants (RLS member/platform only). RPC security definer exposant UNIQUEMENT nom + logo.
create or replace function public.tenant_branding_by_host(p_host text)
returns table(name text, logo_url text)
language sql stable security definer set search_path = public as $$
  select name, logo_url from public.tenants where host = p_host limit 1;
$$;

grant execute on function public.tenant_branding_by_host(text) to anon, authenticated;
