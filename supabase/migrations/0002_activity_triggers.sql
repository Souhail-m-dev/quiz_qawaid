-- Phase 5 — Audit des actions élèves via triggers (l'anon ne peut pas insérer
-- dans activity_log à cause de la RLS; les triggers tournent au privilège owner).

-- Inscription d'un candidat.
create or replace function public.tg_log_register()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_log (actor_role, action, exam_id, candidate_id)
  values ('eleve', 'register', new.exam_id, new.id);
  return new;
end $$;

drop trigger if exists trg_log_register on public.candidates;
create trigger trg_log_register
  after insert on public.candidates
  for each row execute function public.tg_log_register();

-- Soumission d'un examen (submitted_at passe de null à non-null).
create or replace function public.tg_log_submit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.submitted_at is not null and old.submitted_at is null then
    insert into public.activity_log (actor_role, action, exam_id, candidate_id, attempt_id, meta)
    values ('eleve', 'submit', new.exam_id, new.candidate_id, new.id,
            jsonb_build_object('score', new.score, 'total', new.total));
  end if;
  return new;
end $$;

drop trigger if exists trg_log_submit on public.attempts;
create trigger trg_log_submit
  after update on public.attempts
  for each row execute function public.tg_log_submit();
