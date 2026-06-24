-- Lien d'invitation: permettre de choisir l'instance cible.
-- Un compte peut être owner de plusieurs tenants (tenants.owner_id), mais
-- profiles.tenant_id n'en désigne qu'un. Avant, create_invite collait le lien
-- à profiles.tenant_id (instance "active"), sans choix possible.

-- 1. Liste des instances vers lesquelles l'appelant peut inviter.
--    Plateforme: toutes. Owner: celles qu'il possède (owner_id).
create or replace function public.invite_tenants()
returns table(id uuid, name text)
language sql stable security definer set search_path = public as $$
  select t.id, t.name
  from public.tenants t
  where public.is_platform_admin() or t.owner_id = auth.uid()
  order by t.name;
$$;

grant execute on function public.invite_tenants() to authenticated;

-- 2. create_invite avec instance cible optionnelle.
--    p_tenant_id null = profiles.tenant_id (comportement historique).
--    Sinon: autorisé si plateforme OU owner du tenant visé.
drop function if exists public.create_invite(text);
create or replace function public.create_invite(p_email text default null, p_tenant_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_tenant uuid; v_token uuid;
begin
  if not (public.is_tenant_admin() or public.is_platform_admin()) then
    raise exception 'Réservé aux propriétaires d''instance.';
  end if;

  if p_tenant_id is not null then
    if not (public.is_platform_admin()
            or exists (select 1 from public.tenants where id = p_tenant_id and owner_id = auth.uid())) then
      raise exception 'Instance non autorisée.';
    end if;
    v_tenant := p_tenant_id;
  else
    select tenant_id into v_tenant from public.profiles where id = auth.uid();
  end if;

  if v_tenant is null then
    raise exception 'Aucune instance cible.';
  end if;

  insert into public.corrector_invites (tenant_id, email, created_by)
  values (v_tenant, nullif(trim(p_email), ''), auth.uid())
  returning token into v_token;

  perform public.log_activity('create_invite', p_meta := jsonb_build_object('token', v_token, 'tenant_id', v_tenant));
  return v_token;
end $$;

grant execute on function public.create_invite(text, uuid) to authenticated;
