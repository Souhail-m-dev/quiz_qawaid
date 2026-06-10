-- Phase 6c — Corrige la fuite cross-tenant des examens ouverts.
-- Les policies de lecture publique s'appliquaient à 'public'/'authenticated' :
-- tout staff connecté voyait les examens ouverts de TOUS les tenants.
-- On réserve cette lecture à 'anon' (page d'inscription élève par slug).
-- Le staff connecté passe par exams_staff_select (scopée tenant, créée en 0004).

drop policy if exists exams_anon_select_open on public.exams;
drop policy if exists public_can_read_open_exams on public.exams;

create policy exams_anon_select_open on public.exams
  for select to anon
  using (is_open = true);
