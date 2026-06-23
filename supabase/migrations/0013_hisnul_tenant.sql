-- Phase: second sujet "Hisnul Mouslim" comme nouveau tenant (pooled, même app).
-- Additif: aucune ligne existante touchée hormis le renseignement du host du tenant par défaut.

-- 1. Mapping sous-domaine -> tenant (pour branding/résolution host plus tard).
alter table public.tenants add column if not exists host text;
create unique index if not exists tenants_host_key on public.tenants (host) where host is not null;

-- 2. Host du tenant existant (Qawaid). On ne renseigne que s'il est encore vide.
update public.tenants
  set host = 'qawaid.abouabdelwahab'
  where name = 'Instance par défaut' and host is null;

-- 3. Créer le tenant Hisnul Mouslim s'il n'existe pas. Owner = un admin plateforme
--    (ne modifie PAS le tenant_id du profil owner : il reste sur son tenant courant).
do $$
declare v_owner uuid;
begin
  if not exists (select 1 from public.tenants where host = 'hisnulmouslim.abouabdelwahab') then
    select id into v_owner from public.profiles where is_platform_admin = true limit 1;
    insert into public.tenants (name, owner_id, host)
      values ('Hisnul Mouslim', v_owner, 'hisnulmouslim.abouabdelwahab');
  end if;
end $$;
