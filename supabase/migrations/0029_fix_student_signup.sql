-- Correctif d'inscription élève.
--
-- Symptôme: « Ce compte appartient déjà au personnel de l'instance. » à chaque
-- création de compte depuis /eleve/inscription.
--
-- Cause (vérifiée sur actcxenbivmpyzmnctvi): le trigger `on_auth_user_created`
-- → `handle_new_user()` fait `insert into profiles (id, is_admin) values (new.id, false)`.
-- Il ne pose PAS le rôle, qui retombe donc sur le défaut de colonne 'correcteur',
-- et le statut sur 'approved'. La ligne existe avant l'appel à register_student:
-- le garde-fou anti-usurpation de 0027 y voyait un compte « personnel ».
--
-- Deux conséquences, corrigées ici:
--   1. l'inscription élève était impossible;
--   2. tout nouvel inscrit obtenait role='correcteur' → is_staff() vrai → accès
--      à la coquille /admin (sans données: tenant_id null ne matche aucune
--      policy, mais l'écran s'ouvre). À fermer.

-- 1. Défaut de rôle inoffensif. Les rôles staff sont toujours posés
--    explicitement (redeem_invite, invite_corrector, provision_owner,
--    set_member_role) — ce défaut ne sert que les lignes auto-créées.
alter table public.profiles alter column role set default 'eleve';

--    Idem pour le statut: une ligne auto-créée ne doit jamais être déjà validée
--    (sinon RequireStudent la laisse passer avant toute validation admin).
--    Rien ne lit `status` pour le personnel, ce défaut ne concerne que les élèves.
alter table public.profiles alter column status set default 'pending';

-- 2. Fermer les lignes déjà créées par le trigger et jamais rattachées:
--    correcteur sans instance = compte qui ne peut rien faire, mais qui ouvre
--    /admin. Aucun correcteur légitime n'a tenant_id null (create_invite et
--    invite_corrector le renseignent toujours).
update public.profiles
   set role = 'eleve', status = 'pending'
 where role = 'correcteur'
   and tenant_id is null
   and is_platform_admin is not true
   and coalesce(is_admin, false) = false;

-- 3. register_student: distinguer un vrai compte du personnel d'une ligne
--    auto-créée. Le critère fiable est l'instance: un membre du personnel a
--    toujours un tenant_id, une ligne fraîchement auto-créée n'en a pas.
create or replace function public.register_student(p_host text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_tenant uuid;
  v_role text;
  v_status text;
  v_prev_tenant uuid;
  v_platform boolean;
begin
  if v_uid is null then
    raise exception 'Authentification requise.';
  end if;

  select id into v_tenant from public.tenants where host = p_host;
  if v_tenant is null then
    raise exception 'Aucune instance pour ce domaine.';
  end if;

  select role, status, tenant_id, is_platform_admin
    into v_role, v_status, v_prev_tenant, v_platform
    from public.profiles where id = v_uid;

  if v_platform is true
     or (v_role in ('owner', 'editeur', 'correcteur') and v_prev_tenant is not null) then
    raise exception 'Ce compte appartient déjà au personnel de l''instance.';
  end if;

  insert into public.profiles (id, tenant_id, role, status)
  values (v_uid, v_tenant, 'eleve', 'pending')
  on conflict (id) do update
    set tenant_id = excluded.tenant_id,
        role = 'eleve',
        -- Une validation déjà accordée est conservée; une ligne auto-créée
        -- (status 'approved' par défaut, sans instance) repasse en 'pending'.
        status = case
          when v_role = 'eleve' and v_prev_tenant is not null and v_status = 'approved'
            then 'approved'
          else 'pending'
        end;

  insert into public.activity_log (actor_id, actor_role, action, tenant_id)
  values (v_uid, 'eleve', 'student_register', v_tenant);

  return jsonb_build_object('status', (select status from public.profiles where id = v_uid));
end $$;

grant execute on function public.register_student(text) to authenticated;
