# CLAUDE.md — Quiz Al-Qawaaid (`quizz_qawaid`)

Multitenant exam / quiz SaaS for Islamic-education centres. Package `quiz-alqawaaid`
(final product name pending). This file is the working map: read it before touching code.

> The legacy `PRD_Quiz_AlQawaaid.md` is **stale** (describes the old single-screen static SPA).
> Do not architect from it. This file is the source of truth.

---

## 1. Vision

One sellable, self-serve **exam centre** a teacher/institute logs into to:
create exams + revision quizzes, share an anonymous candidate link, auto + manual
grade, emit certificates/results by email, track stats. Multi-client from a single
deployment (one domain per client). It is ~80% built — the work now is **polish +
hardening**, not a rebuild.

## 2. Spirit / constraints (chore)

- **Simplicity first.** Minimum code that solves the problem; no speculative abstraction.
- **Surgical changes.** Touch only what the task needs; match surrounding style; don't
  refactor what isn't broken; don't delete pre-existing dead code unasked.
- **Tenant isolation is sacred.** Every new table/query/policy must be scoped by `tenant_id`.
  RLS policies are PERMISSIVE (OR'd) — adding a policy does NOT restrict; you must replace
  loose ones. A single bad policy leaks across clients.
- **Anonymous candidates.** Students never have accounts. Public reads go through
  `security definer` RPCs, never broad anon table policies.
- **French UI.** All user-facing strings in French.
- **Migrations are append-only SQL files**, applied manually by the owner in the Supabase
  SQL editor, in order. The MCP/CLI cannot reach the project — never assume auto-apply.

## 3. Tech stack

- **Frontend:** React 18 + Vite 5, React Router 7, Tailwind 3, react-hook-form 7,
  framer-motion. Plain npm (not pnpm).
- **PDF/zip:** jspdf, jszip, file-saver (certificates).
- **Backend:** Supabase (Postgres + Auth + RLS + Edge Functions). Project ref
  `actcxenbivmpyzmnctvi` (« qawaid-muthla », eu-west-3). **Joignable via le connecteur
  Supabase de claude.ai** (`mcp__claude_ai_Supabase__*`) — l'ancienne note « NOT in the
  MCP-accessible org » était fausse (vérifié 2026-08-30). Le serveur MCP local nommé
  `supabase`, lui, timeout.
- **Email:** Resend, via the `send-certificate` edge function.
- **Deploy:** Docker + nginx (`Dockerfile`, `nginx.conf`), one Coolify app, pooled.
  `vercel.json` present (legacy/alt). nginx is catch-all `server_name _`.
- **Env:** Vite vars in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  `.env.local` holds dead `NEXT_PUBLIC_*` vars — app is Vite, ignore them.

## 4. Tenancy & domains

Pooled multitenancy: one DB, `tenant_id` column + RLS. **Tenant = the client (exam
centre), NOT the subject.** Add a client = 1 row in `tenants` + 1 Coolify domain + 1 DNS.

- Tenant resolved by **Host header** via `tenants.host`, côté client via `src/lib/tenantHost.js`
  (`TENANT_HOST`). En dev (`localhost`), aucun tenant ne correspond → repli sur
  `examen.drmiloud.com` (Miloud), surchargeable par `VITE_TENANT_HOST` dans `.env.local`.
  **Toujours passer par `TENANT_HOST`, jamais par `window.location.hostname` en direct.**
- Live: `qawaid.abouabdelwahab.com` → *Abou Abdelwahab* (`6badf254-…`),
  `examen.drmiloud.com` → *Miloud*.
- Branding per host: RPC `tenant_branding_by_host` → `useTenantBranding` → `<ExamBrand/>`.
- **Matière (subject) = category under a client**, first-class table `matieres`
  (`exams.subject_id` / `quiz_courses.subject_id`, auto-linked from the text `subject`
  by a find-or-create trigger). Ex: "Hisnul Mouslim", "Qawaid al-Muthla" under Abou Abdelwahab.
- **Portée classe d'un contenu:** `exams.class_id` / `quiz_courses.class_id`. `null` = visible
  par tous (vitrine anon incluse); posé = réservé aux élèves de cette classe et **exclu des RPC
  publiques**. Filtré dans `student_progress` et refusé par `link_candidate_to_student`.
- **Classe = groupe d'élèves porteur d'un jeu de matières** (`classes` + `class_matieres`,
  `profiles.class_id`). Chaîne d'accès élève: **classe → matières → cours → examen/quizz**.
  Matières effectives = `student_matiere_ids()` = matières de la classe ∪ `student_matieres`
  (attributions individuelles). Toute logique élève doit passer par cette fonction.

## 5. Roles

Hierarchy: `is_platform_admin` (flag) > `owner` > `editeur` > `correcteur`. À part: `eleve`
(compte apprenant, hors `is_staff()`, jamais staff).

| Role | DB value | Can |
|------|----------|-----|
| Platform admin | `is_platform_admin=true` | everything, cross-tenant (`/admin/tenants`) |
| Owner | `owner` | full intra-tenant: users, activity, content, grading |
| **Admin** (UI label) | `editeur` | create/edit exams + quizzes + matières, **+ all corrector rights**. NO user mgmt, activity log, deletes, tenant mgmt |
| Correcteur | `correcteur` | grade open answers, certificates/results, view stats/results |
| **Élève** | `eleve` + `profiles.status` + `profiles.class_id` | s'inscrit seul (`/eleve/inscription`), validé par l'owner, rattaché à une **classe**. Voit SES matières/cours/notes via RPC `security definer`. Aucune lecture directe de table. |
| Candidate | — | anonymous, no account |

`useAuth` exposes `{ role, tenantId, status, isPlatformAdmin, isOwner, isAdmin, isEditor,
isContentManager, isCorrector, isStaff, isStudent, roleLabel }`. Guards in `RequireRole.jsx`:
`RequireAdmin` (owner), `RequireContentManager` (owner+editeur), `RequireStaff`
(all staff), `RequirePlatformAdmin`, `RequireStudent` (`eleve` + `status='approved'`). `editeur` is shown as **« Admin »** in the UI
(`roleLabel`) — its DB value is `editeur` to avoid colliding with `is_admin()`=owner.

## 6. Structure (file/folder purpose)

```
src/
  App.jsx                 routes + role guards (single source of routing truth)
  main.jsx                React root
  lib/
    supabase.js           Supabase client
    tenantHost.js         hôte → tenant; en local retombe sur VITE_TENANT_HOST ou Miloud
    useAuth.js            session/role/tenant + role helpers + ROLE_LABELS/roleLabel
    useTenantBranding.js  host → branding (logo/name) via RPC
  components/
    AdminLayout.jsx       admin sidebar (links gated by role)
    ProgressionMatieres.jsx  matières → cours → note, partagé élève/admin
    RequireRole.jsx       route guards (RequireAdmin/ContentManager/Staff/PlatformAdmin)
    ExamBrand.jsx         per-host public branding header
    DynamicForm.jsx       renders pre/post exam forms from schema
    FormSchemaBuilder.jsx admin builder for form schemas (uniqueKey() — see §10)
    QuestionsBuilder.jsx  exam question editor
    QuizSession.jsx       revision quiz player
    ResultatsFinaux.jsx   revision quiz results
    QuestionCard / OptionButton / FeedbackPanel / ProgressBar / ScoreIndicator / icons
  pages/
    admin/
      AdminDashboard.jsx  exam list + create
      ExamEditor.jsx      create/edit exam (questions + forms + cert threshold)
      ExamResults.jsx     results table, filters, CSV export, bulk certs/emails, delete
      ExamStats.jsx       per-question + corrector stats
      CandidateAttemptDetail.jsx  single student: grading UI + detail CSV + cert/email
      ReviewQueue.jsx     open-answer review queue
      Users.jsx           members + role change + invite link (+ target-instance picker)
      Activity.jsx        audit log (owner)
      MatieresAdmin.jsx   matières CRUD (passwords, descriptions)
      QuizBank.jsx        revision courses bank
      QuizCourseEditor.jsx revision course questions
      Students.jsx / StudentDetail.jsx  élèves: validation, classe, matières, progression
      ClassesAdmin.jsx      classes: CRUD + matières de la classe
      Tenants.jsx / TenantDetail.jsx  platform-admin cross-tenant view
      AdminLogin.jsx
    eleve/                espace élève: StudentSignup / StudentLogin / StudentDashboard
    exam/                 anonymous candidate flow: Registration → Instructions → Run → Done
                          (un élève connecté passe le MÊME examen; sa copie porte student_id)
    public/               TenantHome (host vitrine) + MatierePage (password gate)
    revision/QuizRoute.jsx  public revision entry (subject → course → session)
    InviteAccept.jsx      corrector invite redemption (/invite/:token)
  utils/
    questionModel.js      type/points helpers, buildAnswer, effectivePoints, tallyScore
    gradeOpen.js          deterministic open-answer grading (+ .test.mjs, the one test)
    examReview.js         buildReviewRows (email), buildDetailRows (CSV), validFormKeys
    certificates.js       PDF/PNG/zip generation, eligibility, filenames
    quizUtils.js          revision helpers
    studentProgress.js    groupProgress: lignes plates student_progress → matières/cours (+ .test.mjs)
  config/certificateTemplates.js  per-tenant certificate template mapping
supabase/
  migrations/             0001…0027 SQL, applied manually in order
  tests/rls_eleves.sql    tests d'isolation tenant de l'espace élève (manuel, finit par ROLLBACK)
  functions/grade-open    optional AI fallback grader (provider not chosen)
  functions/send-certificate  Resend email (result or certificate PDF)
Dockerfile / nginx.conf / vercel.json   deploy
grading/                  LOCAL scratch (gitignored) — ad-hoc grading scripts/CSVs
hisn*.json                LOCAL import sources (gitignored)
```

## 7. Question & grading model

Question `{ type: 'mcq'|'truefalse'|'open', points, ... }` (`questionModel.js`).
Answers stored in `attempts.answers` jsonb with `pointsObtenus/pointsMax/correction/
needsReview`; score = sum of effective points (corrector override wins).

- **mcq/truefalse:** auto-graded on submit.
- **open:** deterministic grading (`gradeOpen.js`) via `grading.mode`:
  `exact` (`acceptedAnswers[]`) / `numeric` (`expected`±`tolerance`) / `keywords`
  (`groups[].any` + partial credit, `requireAtLeast` for "N of M"). Flagged
  `needsReview` for manual confirm in CandidateAttemptDetail / ReviewQueue.
- AI grading (`functions/grade-open`) is an OPTIONAL fallback, provider not chosen.

`tenant_id` auto-assigned by triggers (exam from creator profile; candidate/attempt
inherit from exam).

## 8. Forms

`exams.pre_form_schema` / `post_form_schema` (jsonb) built in ExamEditor via
`FormSchemaBuilder`, rendered by `DynamicForm`; answers in
`candidates.pre_form_data` / `post_form_data`. Field keys MUST be unique
(`uniqueKey()`); duplicate keys = data collision (see §10).

## 9. Revision mode (free practice, separate from graded exams)

Tables `quiz_courses` + `quiz_questions` (tenant_id, subject, difficulté
facile/moyenne/difficile, options jsonb, correct_index, justification). Staff CRUD at
`/admin/quiz`; public play at `/revision` and `/m/:slug`. Anonymous reads via
`security definer` RPCs (`quiz_subjects_by_host`, `quiz_courses_by_host`,
`quiz_questions_by_course`, `matieres_by_host`, `matiere_content`).

## 10. Known gaps / hazards

- **RLS isolation:** loose staff/admin policies were replaced with tenant-scoped ones
  (0004, 0016, 0020). Any NEW table needs the same. Verify with
  `select policyname,cmd,qual from pg_policies where tablename='…'`.
- **Form key collision (fixed):** `FormSchemaBuilder` once defaulted every field to
  key `"champ"` → react-hook-form merged all under `f_champ` → only one value survived
  per candidate, destroyed client-side before insert (irrecoverable). Fixed by
  `uniqueKey()`. Miloud data partially recovered (2026-06; backup
  `_miloud_preform_backup`). CSV exports now drop duplicate-key fields via
  `validFormKeys()`.
- **Multi-instance owner:** one account can own several tenants (`tenants.owner_id`)
  but `profiles.tenant_id` is single. Invite links target a chosen instance via
  `create_invite(p_email, p_tenant_id)` + `invite_tenants()` (0021); other flows still
  act on the active tenant.
- 🔑 **`auth.users` a un trigger `on_auth_user_created` → `handle_new_user()`** (créé dans le
  dashboard, hors repo) qui fait `insert into profiles (id, is_admin) values (new.id, false)`.
  Il ne pose ni `role` ni `status` → ils tombent sur les **défauts de colonne**. Avant 0029 ces
  défauts étaient `'correcteur'` / `'approved'`: **tout compte créé devenait staff**, ce qui
  cassait l'inscription élève et ouvrait la coquille `/admin`. 0029 met les défauts à
  `'eleve'` / `'pending'`. **Toute logique de signup doit tenir compte de ce trigger:
  la ligne `profiles` existe déjà quand ton RPC est appelé.**
- **Pas de policy UPDATE sur `profiles`** (vérifié): seules 3 policies SELECT existent
  (`profiles_self_select`, `users_read_own_profile` — doublon —, `profiles_tenant_admin_select`).
  Le rôle ne se change que par RPC `security definer`. Ne pas ajouter de self-update.
- **Un membre du personnel a toujours un `tenant_id`.** C'est le critère qui distingue un vrai
  staff d'une ligne auto-créée (utilisé par `register_student`).
- **Élève connecté ≠ anon.** Les policies du flux candidat (`exams_anon_select_open`,
  `*_anon_*` sur `attempts`) sont `to anon`; un élève est `authenticated` et n'y a pas droit.
  0027 rouvre le strict nécessaire (`exams_auth_select_open`, `attempts_student_select/update`
  bornées par `candidates.student_id = auth.uid()`). Toute nouvelle policy anon du flux examen
  doit avoir son pendant élève.
- **`register_candidate_and_attempt` / `verify_exam_code` n'ont pas de source dans le repo**
  (créées dans le dashboard). 0027 les regrante à `authenticated` via un `DO` qui balaie
  `pg_proc` — ne pas les réécrire à l'aveugle.
- **Tests:** `gradeOpen.test.mjs` + `studentProgress.test.mjs` (`npm test`).
  Isolation RLS: `supabase/tests/rls_eleves.sql`, manuel, couvre l'espace élève seulement —
  le reste des tables est toujours dû.

## 11. Migrations (apply in order, manually)

0001 subjects/roles/forms · 0002 activity triggers · 0003 multi-tenant · 0004 tenant RLS ·
0005 exam public read · 0006 list_members · 0007 drop 'admin' role · 0008 tenant logo ·
0009 attempt graded · 0010 invite corrector · 0011 delete candidates · 0012 invite link ·
0013 hisnul tenant (undone in 0015) · 0014 branding RPC · 0015 axe client=tenant ·
0016 revision quiz · 0017 matières · 0018 import Qawaid revision · 0019 import Hisn cours 1 ·
0020 role `editeur` · 0021 invite target tenant · 0022/0023 imports Hisn cours 2-3 ·
0024 merge matières Hisn · 0025 matching matière par slug · 0026 tri des cours par created_at ·
0027 espace élève (role `eleve` + `profiles.status`, `student_matieres`, `exams.course_id`,
`candidates.student_id`, RPC `register_student`/`student_me`/`student_progress`/
`link_candidate_to_student`/`list_students`/`set_student_status`/`set_student_matieres`) ·
0028 classes (`classes`, `class_matieres`, `profiles.class_id`, `student_matiere_ids()`,
`set_student_class`; les RPC élève de 0027 sont réécrites pour passer par l'union) ·
0029 correctif inscription élève (défauts `profiles.role`/`status`, `register_student` robuste
au trigger `handle_new_user`) · 0030 `list_students()` masque les élèves sans instance ·
0031 portée classe (`exams.class_id`, `quiz_courses.class_id`; null = public, posé = réservé
à la classe ET retiré des vues anon `matieres_by_host`/`quiz_courses_by_host`/`matiere_content`).

**État en base au 2026-08-30:** 0001→0029 appliquées. **0030 et 0031 ne le sont pas.**

**Contenu par instance (2026-08-30):** Abou Abdelwahab = 3 matières, 41 cours révision,
2 examens · Miloud = **0 matière, 0 cours**, 1 examen. Aucun examen n'a encore de `course_id`.
Pour tester la chaîne classe → matière → cours → examen, viser Abou Abdelwahab
(`VITE_TENANT_HOST=qawaid.abouabdelwahab.com`).

## 12. Sprint / plan

**Done (recent):** multi-tenant + per-domain vitrine; matières as first-class; revision
mode multitenant; CSV export (list); role consolidation → owner/correcteur; corrector
invite links + single-use/expiry; per-question + corrector stats; results filtering;
`editeur` («Admin») role; invite target-instance picker; Hisn cours 1 import.

**Ongoing:** CSV export split — **CSV liste** (results) + **CSV détaillé** (all answers
per student) in ExamResults, detail CSV + form fields in CandidateAttemptDetail, broken
fields excluded. *(in progress, may be uncommitted)*

**Done (0027-0028):** espace élève complet — inscription libre `/eleve/inscription`, validation
owner `/admin/eleves` (statut + matières), examen rattaché à un cours (`exams.course_id`),
copie rattachée à l'élève (`candidates.student_id`), progression matière → cours → note
(`/eleve` et `/admin/eleves/:id`), classes (`/admin/classes`) portant les matières,
tests d'isolation RLS de l'espace élève.

**Planned:** rewrite the PRD to match reality; write **RLS tenant-isolation tests**;
clean `.env.local` dead vars; finalize product name; AI open-answer grading (pick provider);
optionally let invite links grant `editeur` directly + tenant picker for platform-admin.

## 13. Working guidelines (carry into every change)

- State assumptions; if multiple interpretations exist, surface them — don't pick silently.
- Define a verifiable success criterion before coding ("write a failing test, make it pass").
- Build (`npm run build`) and `npm test` before declaring done.
- Commit only when asked. Workflow in use: commit on `saas-generic` → merge to `main`
  (prod) → push both. End commit messages with the `Co-Authored-By` trailer.
- Every changed line should trace to the request. If 200 lines could be 50, rewrite.
