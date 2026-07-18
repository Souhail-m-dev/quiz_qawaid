-- Fusion des matières doublons "Hisn" (tenant Abou Abdelwahab), créées par le
-- trigger find-or-create à partir de saisies libres avec fautes de frappe.
-- Canonique : "Hisnul Mouslim" (slug hisnul-mouslim, description + mot de passe).
-- Doublons : "Hisnu al-muslim" (hisnu-al-muslim), "Hisnul Muslim" (hisnul-muslim).
-- On repointe examens + cours de révision vers la canonique, puis on supprime.

do $$
declare
  t uuid;
  canon uuid;
  canon_name text;
  dup uuid;
begin
  select id into t from public.tenants where host = 'qawaid.abouabdelwahab.com';
  if t is null then raise exception 'tenant abouabdelwahab introuvable'; end if;

  select id, name into canon, canon_name
    from public.matieres where tenant_id = t and slug = 'hisnul-mouslim';
  if canon is null then raise exception 'matière canonique hisnul-mouslim introuvable'; end if;

  for dup in
    select id from public.matieres
    where tenant_id = t and slug in ('hisnu-al-muslim', 'hisnul-muslim')
  loop
    update public.exams
      set subject = canon_name, subject_id = canon
      where subject_id = dup;
    update public.quiz_courses
      set subject = canon_name, subject_id = canon
      where subject_id = dup;
    delete from public.matieres where id = dup;
  end loop;
end $$;
