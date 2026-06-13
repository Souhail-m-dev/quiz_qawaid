-- Invitation correcteur par LIEN (sans compte préexistant).
-- L'owner génère un token -> envoie le lien lui-même -> l'invité crée son
-- compte (signUp) puis échange le token: rattaché au tenant en correcteur.

create table if not exists public.corrector_invites (
  token uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete set null
);

create index if not exists corrector_invites_tenant_idx on public.corrector_invites (tenant_id);

alter table public.corrector_invites enable row level security;

-- Lecture des invitations de son tenant (suivi côté owner). Écriture via RPC definer.
create policy corrector_invites_admin_select on public.corrector_invites
  for select to authenticated
  using (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

-- 1. Génère un lien d'invitation. Réservé owner / plateforme. Retourne le token.
create or replace function public.create_invite(p_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_tenant uuid;
  v_token uuid;
begin
  if not (public.is_tenant_admin() or public.is_platform_admin()) then
    raise exception 'Réservé aux propriétaires d''instance.';
  end if;
  select tenant_id into v_tenant from public.profiles where id = auth.uid();
  if v_tenant is null then
    raise exception 'Votre compte n''est rattaché à aucune instance.';
  end if;

  insert into public.corrector_invites (tenant_id, email, created_by)
  values (v_tenant, nullif(trim(p_email), ''), auth.uid())
  returning token into v_token;

  perform public.log_activity('create_invite', p_meta := jsonb_build_object('token', v_token, 'tenant_id', v_tenant));
  return v_token;
end $$;

grant execute on function public.create_invite(text) to authenticated;

-- 2. Coup d'œil public sur un token (page d'acceptation): valide + nom du tenant.
--    Anon car l'invité n'est pas encore connecté.
create or replace function public.peek_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv public.corrector_invites%rowtype;
  v_name text;
begin
  select * into v_inv from public.corrector_invites where token = p_token;
  if not found then
    return jsonb_build_object('valid', false, 'reason', 'introuvable');
  end if;
  if v_inv.used_at is not null then
    return jsonb_build_object('valid', false, 'reason', 'utilisé');
  end if;
  if v_inv.expires_at < now() then
    return jsonb_build_object('valid', false, 'reason', 'expiré');
  end if;
  select name into v_name from public.tenants where id = v_inv.tenant_id;
  return jsonb_build_object('valid', true, 'tenant_name', v_name, 'email', v_inv.email);
end $$;

grant execute on function public.peek_invite(uuid) to anon, authenticated;

-- 3. Échange du token par l'invité (déjà authentifié après signUp).
--    Rattache son profil au tenant du token, rôle correcteur. Marque le token utilisé.
create or replace function public.redeem_invite(p_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv public.corrector_invites%rowtype;
  v_uid uuid := auth.uid();
  v_existing_role text;
begin
  if v_uid is null then
    raise exception 'Authentification requise.';
  end if;

  select * into v_inv from public.corrector_invites where token = p_token for update;
  if not found then raise exception 'Invitation introuvable.'; end if;
  if v_inv.used_at is not null then raise exception 'Invitation déjà utilisée.'; end if;
  if v_inv.expires_at < now() then raise exception 'Invitation expirée.'; end if;

  select role into v_existing_role from public.profiles where id = v_uid;
  if v_existing_role = 'owner' then
    raise exception 'Compte déjà propriétaire d''une instance: rattachement impossible.';
  end if;

  insert into public.profiles (id, tenant_id, role)
  values (v_uid, v_inv.tenant_id, 'correcteur')
  on conflict (id) do update
  set tenant_id = v_inv.tenant_id, role = 'correcteur';

  update public.corrector_invites
  set used_at = now(), used_by = v_uid
  where token = p_token;

  perform public.log_activity('redeem_invite', p_meta := jsonb_build_object('token', p_token, 'tenant_id', v_inv.tenant_id));
end $$;

grant execute on function public.redeem_invite(uuid) to authenticated;
