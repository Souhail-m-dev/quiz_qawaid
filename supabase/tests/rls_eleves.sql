-- Tests d'isolation pour l'espace élève (migrations 0027 + 0028 classes).
-- À exécuter À LA MAIN dans le SQL editor Supabase, APRÈS 0027, sur un projet de test
-- ou en transaction (rollback à la fin — le script se termine par un ROLLBACK).
--
-- Principe: on simule un appelant en posant request.jwt.claims + role, comme PostgREST.
-- Chaque bloc lève une exception si l'isolation est violée.

begin;

-- ── Fixtures: deux instances, un owner et un élève chacune ──────────────────
do $$
declare
  t_a uuid; t_b uuid;
  own_a uuid := gen_random_uuid();
  own_b uuid := gen_random_uuid();
  elv_a uuid := gen_random_uuid();
  elv_b uuid := gen_random_uuid();
  mat_a uuid; mat_b uuid;
begin
  insert into public.tenants (name, host) values ('Test A', 'test-a.invalid') returning id into t_a;
  insert into public.tenants (name, host) values ('Test B', 'test-b.invalid') returning id into t_b;

  -- auth.users minimal (les RPC joignent auth.users pour email/full_name)
  insert into auth.users (id, email, raw_user_meta_data)
  values (own_a, 'own-a@test.invalid', '{"full_name":"Owner A"}'),
         (own_b, 'own-b@test.invalid', '{"full_name":"Owner B"}'),
         (elv_a, 'elv-a@test.invalid', '{"full_name":"Élève A"}'),
         (elv_b, 'elv-b@test.invalid', '{"full_name":"Élève B"}');

  insert into public.profiles (id, tenant_id, role, status) values
    (own_a, t_a, 'owner', 'approved'),
    (own_b, t_b, 'owner', 'approved'),
    (elv_a, t_a, 'eleve', 'approved'),
    (elv_b, t_b, 'eleve', 'approved');

  update public.tenants set owner_id = own_a where id = t_a;
  update public.tenants set owner_id = own_b where id = t_b;

  insert into public.matieres (tenant_id, name, slug) values (t_a, 'Matière A', 'matiere-a') returning id into mat_a;
  insert into public.matieres (tenant_id, name, slug) values (t_b, 'Matière B', 'matiere-b') returning id into mat_b;

  insert into public.student_matieres (student_id, matiere_id, tenant_id) values (elv_a, mat_a, t_a);
  insert into public.student_matieres (student_id, matiere_id, tenant_id) values (elv_b, mat_b, t_b);

  -- Mémorise les ids pour les blocs suivants.
  create temp table _ids as
  select t_a, t_b, own_a, own_b, elv_a, elv_b, mat_a, mat_b;
end $$;

create or replace function pg_temp.act_as(p_uid uuid, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
end $$;

create or replace function pg_temp.check(p_ok boolean, p_label text)
returns void language plpgsql as $$
begin
  if not p_ok then raise exception 'ÉCHEC: %', p_label; end if;
  raise notice '  OK  %', p_label;
end $$;

-- ── 1. Un élève ne lit AUCUNE ligne de student_matieres en direct ───────────
do $$
declare v_uid uuid; n int;
begin
  select elv_a into v_uid from _ids;
  perform pg_temp.act_as(v_uid);
  select count(*) into n from public.student_matieres;
  reset role;
  perform pg_temp.check(n = 0, 'élève: 0 ligne visible dans student_matieres');
end $$;

-- ── 2. Un élève ne peut pas s'auto-promouvoir (aucune policy UPDATE) ────────
do $$
declare v_uid uuid; n int; v_role text;
begin
  select elv_a into v_uid from _ids;
  perform pg_temp.act_as(v_uid);
  update public.profiles set role = 'owner', status = 'approved' where id = v_uid;
  get diagnostics n = row_count;
  reset role;
  select role into v_role from public.profiles where id = v_uid;
  perform pg_temp.check(n = 0 and v_role = 'eleve', 'élève: UPDATE profiles sans effet (anti-escalade)');
end $$;

-- ── 3. student_progress d'autrui: refusé pour un élève ──────────────────────
do $$
declare a uuid; b uuid; ok boolean := false;
begin
  select elv_a, elv_b into a, b from _ids;
  perform pg_temp.act_as(a);
  begin
    perform * from public.student_progress(b);
  exception when others then ok := true;
  end;
  reset role;
  perform pg_temp.check(ok, 'élève: student_progress(autre élève) refusé');
end $$;

-- ── 4. Owner A ne voit pas l'élève de l'instance B ──────────────────────────
do $$
declare a uuid; b uuid; n int;
begin
  select own_a, elv_b into a, b from _ids;
  perform pg_temp.act_as(a);
  select count(*) into n from public.list_students() s where s.id = b;
  reset role;
  perform pg_temp.check(n = 0, 'owner A: list_students() exclut l''élève B');
end $$;

-- ── 5. Owner A ne peut ni valider ni inscrire l'élève de B ──────────────────
do $$
declare a uuid; b uuid; mb uuid; ok1 boolean := false; ok2 boolean := false;
begin
  select own_a, elv_b, mat_b into a, b, mb from _ids;
  perform pg_temp.act_as(a);
  begin perform public.set_student_status(b, 'approved'); exception when others then ok1 := true; end;
  begin perform public.set_student_matieres(b, array[mb]); exception when others then ok2 := true; end;
  begin perform * from public.student_progress(b); exception when others then null; end;
  reset role;
  perform pg_temp.check(ok1, 'owner A: set_student_status(élève B) refusé');
  perform pg_temp.check(ok2, 'owner A: set_student_matieres(élève B) refusé');
end $$;

-- ── 6. Owner A ne peut pas inscrire son élève à une matière hors instance ───
do $$
declare a uuid; ea uuid; mb uuid; ok boolean := false;
begin
  select own_a, elv_a, mat_b into a, ea, mb from _ids;
  perform pg_temp.act_as(a);
  begin perform public.set_student_matieres(ea, array[mb]); exception when others then ok := true; end;
  reset role;
  perform pg_temp.check(ok, 'owner A: matière hors instance refusée');
end $$;

-- ── 7. list_members() ne renvoie plus les élèves ────────────────────────────
do $$
declare a uuid; ea uuid; n int;
begin
  select own_a, elv_a into a, ea from _ids;
  perform pg_temp.act_as(a);
  select count(*) into n from public.list_members() m where m.id = ea;
  reset role;
  perform pg_temp.check(n = 0, 'list_members(): les élèves sont exclus');
end $$;

-- ── 8. link_candidate_to_student: matière non inscrite → refus ──────────────
do $$
declare ea uuid; ta uuid; mb uuid; v_exam uuid; v_cand uuid; ok boolean := false;
begin
  select elv_a, t_a, mat_b into ea, ta, mb from _ids;
  insert into public.exams (title, slug, is_open, tenant_id, subject_id)
  values ('Examen hors matière', 'test-hors-matiere', true, ta, mb) returning id into v_exam;
  insert into public.candidates (exam_id, full_name, email, tenant_id)
  values (v_exam, 'X', 'x@test.invalid', ta) returning id into v_cand;

  perform pg_temp.act_as(ea);
  begin perform public.link_candidate_to_student(v_cand); exception when others then ok := true; end;
  reset role;
  perform pg_temp.check(ok, 'élève: link_candidate_to_student hors matière refusé');
end $$;

-- ── 9. attempts: un élève ne voit que ses propres copies ────────────────────
do $$
declare ea uuid; eb uuid; ta uuid; ma uuid; v_exam uuid; c_mine uuid; c_other uuid; n int;
begin
  select elv_a, elv_b, t_a, mat_a into ea, eb, ta, ma from _ids;
  insert into public.exams (title, slug, is_open, tenant_id, subject_id)
  values ('Examen A', 'test-exam-a', true, ta, ma) returning id into v_exam;
  insert into public.candidates (exam_id, full_name, email, tenant_id, student_id)
  values (v_exam, 'Élève A', 'elv-a@test.invalid', ta, ea) returning id into c_mine;
  insert into public.candidates (exam_id, full_name, email, tenant_id, student_id)
  values (v_exam, 'Élève B', 'elv-b@test.invalid', ta, eb) returning id into c_other;
  insert into public.attempts (exam_id, candidate_id, tenant_id) values (v_exam, c_mine, ta);
  insert into public.attempts (exam_id, candidate_id, tenant_id) values (v_exam, c_other, ta);

  perform pg_temp.act_as(ea);
  select count(*) into n from public.attempts;
  reset role;
  perform pg_temp.check(n = 1, 'élève: ne voit qu''une seule copie (la sienne)');
end $$;

-- ── 10. Classes: un élève ne lit ni classes ni class_matieres en direct ────
do $$
declare ea uuid; ta uuid; ma uuid; v_class uuid; n1 int; n2 int;
begin
  select elv_a, t_a, mat_a into ea, ta, ma from _ids;
  insert into public.classes (tenant_id, name, slug) values (ta, 'Niveau 1', 'niveau-1') returning id into v_class;
  insert into public.class_matieres (class_id, matiere_id, tenant_id) values (v_class, ma, ta);

  perform pg_temp.act_as(ea);
  select count(*) into n1 from public.classes;
  select count(*) into n2 from public.class_matieres;
  reset role;
  perform pg_temp.check(n1 = 0 and n2 = 0, 'élève: 0 ligne visible dans classes / class_matieres');
end $$;

-- ── 11. La classe donne bien accès à ses matières (union avec les directes) ─
do $$
declare ea uuid; ta uuid; ma uuid; v_class uuid; n int;
begin
  select elv_a, t_a, mat_a into ea, ta, ma from _ids;
  -- Retirer la matière individuelle: seule la classe doit la fournir.
  delete from public.student_matieres where student_id = ea;
  select id into v_class from public.classes where tenant_id = ta and slug = 'niveau-1';
  update public.profiles set class_id = v_class where id = ea;

  perform pg_temp.act_as(ea);
  select count(*) into n from public.student_matiere_ids(ea) where matiere_id = ma;
  reset role;
  perform pg_temp.check(n = 1, 'élève: matière héritée de la classe');
end $$;

-- ── 12. Owner A ne peut pas rattacher son élève à une classe de B ───────────
do $$
declare a uuid; ea uuid; tb uuid; v_class_b uuid; ok boolean := false;
begin
  select own_a, elv_a, t_b into a, ea, tb from _ids;
  insert into public.classes (tenant_id, name, slug) values (tb, 'Classe B', 'classe-b') returning id into v_class_b;
  perform pg_temp.act_as(a);
  begin perform public.set_student_class(ea, v_class_b); exception when others then ok := true; end;
  reset role;
  perform pg_temp.check(ok, 'owner A: classe hors instance refusée');
end $$;

rollback;
