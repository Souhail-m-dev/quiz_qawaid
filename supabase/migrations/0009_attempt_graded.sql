-- Statut de validation de la correction au niveau de la tentative.
-- Le correcteur marque la tentative comme corrigée (graded_at renseigné).
-- L'UPDATE est déjà autorisé au staff du tenant (policy attempts_staff_update, 0004).
alter table public.attempts
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid references auth.users(id) on delete set null;
