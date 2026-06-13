-- Suppression d'entrées (candidats + leurs tentatives) par l'admin d'instance.
-- Manquait: aucune policy DELETE → la suppression échouait en RLS.
-- Réservé au tenant-admin (owner) de son tenant, ou à l'admin plateforme.

create policy candidates_admin_delete on public.candidates
  for delete to authenticated
  using (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));

create policy attempts_admin_delete on public.attempts
  for delete to authenticated
  using (public.is_platform_admin() or (public.is_tenant_admin() and tenant_id = public.current_tenant_id()));
