-- Nouveau rôle 'editeur' (libellé UI « Admin ») entre owner et correcteur.
-- Droits = correcteur + création/édition exams, quizz (révision), matières.
-- Hiérarchie: is_platform_admin (flag) > owner > editeur > correcteur.

-- 1. Contrainte: autoriser 'editeur'.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'editeur', 'correcteur'));

-- 2. Helpers.
--    is_staff = peut accéder à l'espace admin (lecture résultats/correction).
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'editeur', 'correcteur'));
$$;

--    is_content_editor = peut créer/éditer le contenu (owner + editeur).
create or replace function public.is_content_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner', 'editeur'));
$$;

-- 3. EXAMS — écriture ouverte aux éditeurs de contenu (était owner seul).
drop policy if exists exams_admin_write on public.exams;
create policy exams_editor_write on public.exams
  for all to authenticated
  using (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()));

-- 4. QUIZ_COURSES / QUIZ_QUESTIONS — lecture staff, écriture éditeurs.
--    (avant: un seul "for all" ouvert à tout membre du tenant, correcteur inclus.)
drop policy if exists quiz_courses_staff_all on public.quiz_courses;
create policy quiz_courses_staff_select on public.quiz_courses
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));
create policy quiz_courses_editor_write on public.quiz_courses
  for all to authenticated
  using (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()));

drop policy if exists quiz_questions_staff_all on public.quiz_questions;
create policy quiz_questions_staff_select on public.quiz_questions
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));
create policy quiz_questions_editor_write on public.quiz_questions
  for all to authenticated
  using (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()));

-- 5. MATIERES — lecture staff, écriture éditeurs.
drop policy if exists matieres_staff_all on public.matieres;
create policy matieres_staff_select on public.matieres
  for select to authenticated
  using (public.is_platform_admin() or (public.is_staff() and tenant_id = public.current_tenant_id()));
create policy matieres_editor_write on public.matieres
  for all to authenticated
  using (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()))
  with check (public.is_platform_admin() or (public.is_content_editor() and tenant_id = public.current_tenant_id()));

-- 6. set_member_role: owner peut attribuer 'editeur' ou 'correcteur' (owner = provision_owner).
create or replace function public.set_member_role(p_profile_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller_tenant uuid; v_target_tenant uuid;
begin
  if p_role not in ('editeur', 'correcteur') then
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
