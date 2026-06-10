-- Ajoute une fonction pour inviter un correcteur par email.
-- Résout le problème où l'owner ne peut pas assigner un rôle à un utilisateur
-- qui n'est pas encore dans son tenant (tenant_id est null ou différent).

create or replace function public.invite_corrector(p_email text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_target_id uuid;
  v_tenant_id uuid;
  v_existing_role text;
  v_existing_tenant uuid;
begin
  -- 1. Vérifier que l'appelant est un owner (ou admin plateforme).
  if not (public.is_tenant_admin() or public.is_platform_admin()) then
    raise exception 'Réservé aux propriétaires d''instance.';
  end if;

  -- 2. Récupérer le tenant de l'appelant.
  select tenant_id into v_tenant_id from public.profiles where id = auth.uid();
  if v_tenant_id is null and not public.is_platform_admin() then
    raise exception 'Votre compte n''est rattaché à aucune instance.';
  end if;

  -- 3. Trouver l'ID de l'utilisateur cible dans auth.users.
  select id into v_target_id from auth.users where email = p_email;
  if v_target_id is null then
    raise exception 'L''utilisateur % n''existe pas dans Supabase Auth. Créez-le d''abord dans le Dashboard (Authentication > Users).', p_email;
  end if;

  -- 4. Vérifier le profil existant de la cible.
  select role, tenant_id into v_existing_role, v_existing_tenant from public.profiles where id = v_target_id;
  
  if v_existing_role = 'owner' then
    raise exception 'L''utilisateur % est déjà propriétaire d''une instance (ID: %). Impossible de le rétrograder en correcteur.', p_email, v_existing_tenant;
  end if;

  -- 5. Upsert du profil pour le rattacher au tenant en tant que correcteur.
  insert into public.profiles (id, tenant_id, role)
  values (v_target_id, v_tenant_id, 'correcteur')
  on conflict (id) do update
  set tenant_id = v_tenant_id, role = 'correcteur';

  -- 6. Log de l'activité.
  perform public.log_activity('invite_corrector', p_meta := jsonb_build_object('invited_email', p_email, 'tenant_id', v_tenant_id));
end $$;

grant execute on function public.invite_corrector(text) to authenticated;
