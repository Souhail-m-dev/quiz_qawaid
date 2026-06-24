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
  `actcxenbivmpyzmnctvi` (NOT in the MCP-accessible org).
- **Email:** Resend, via the `send-certificate` edge function.
- **Deploy:** Docker + nginx (`Dockerfile`, `nginx.conf`), one Coolify app, pooled.
  `vercel.json` present (legacy/alt). nginx is catch-all `server_name _`.
- **Env:** Vite vars in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
  `.env.local` holds dead `NEXT_PUBLIC_*` vars — app is Vite, ignore them.

## 4. Tenancy & domains

Pooled multitenancy: one DB, `tenant_id` column + RLS. **Tenant = the client (exam
centre), NOT the subject.** Add a client = 1 row in `tenants` + 1 Coolify domain + 1 DNS.

- Tenant resolved by **Host header** via `tenants.host`.
- Live: `qawaid.abouabdelwahab.com` → *Abou Abdelwahab* (`6badf254-…`),
  `examen.drmiloud.com` → *Miloud*.
- Branding per host: RPC `tenant_branding_by_host` → `useTenantBranding` → `<ExamBrand/>`.
- **Matière (subject) = category under a client**, first-class table `matieres`
  (`exams.subject_id` / `quiz_courses.subject_id`, auto-linked from the text `subject`
  by a find-or-create trigger). Ex: "Hisnul Mouslim", "Qawaid al-Muthla" under Abou Abdelwahab.

## 5. Roles

Hierarchy: `is_platform_admin` (flag) > `owner` > `editeur` > `correcteur`.

| Role | DB value | Can |
|------|----------|-----|
| Platform admin | `is_platform_admin=true` | everything, cross-tenant (`/admin/tenants`) |
| Owner | `owner` | full intra-tenant: users, activity, content, grading |
| **Admin** (UI label) | `editeur` | create/edit exams + quizzes + matières, **+ all corrector rights**. NO user mgmt, activity log, deletes, tenant mgmt |
| Correcteur | `correcteur` | grade open answers, certificates/results, view stats/results |
| Candidate | — | anonymous, no account |

`useAuth` exposes `{ role, tenantId, isPlatformAdmin, isOwner, isAdmin, isEditor,
isContentManager, isCorrector, isStaff, roleLabel }`. Guards in `RequireRole.jsx`:
`RequireAdmin` (owner), `RequireContentManager` (owner+editeur), `RequireStaff`
(all staff), `RequirePlatformAdmin`. `editeur` is shown as **« Admin »** in the UI
(`roleLabel`) — its DB value is `editeur` to avoid colliding with `is_admin()`=owner.

## 6. Structure (file/folder purpose)

```
src/
  App.jsx                 routes + role guards (single source of routing truth)
  main.jsx                React root
  lib/
    supabase.js           Supabase client
    useAuth.js            session/role/tenant + role helpers + ROLE_LABELS/roleLabel
    useTenantBranding.js  host → branding (logo/name) via RPC
  components/
    AdminLayout.jsx       admin sidebar (links gated by role)
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
      Tenants.jsx / TenantDetail.jsx  platform-admin cross-tenant view
      AdminLogin.jsx
    exam/                 anonymous candidate flow: Registration → Instructions → Run → Done
    public/               TenantHome (host vitrine) + MatierePage (password gate)
    revision/QuizRoute.jsx  public revision entry (subject → course → session)
    InviteAccept.jsx      corrector invite redemption (/invite/:token)
  utils/
    questionModel.js      type/points helpers, buildAnswer, effectivePoints, tallyScore
    gradeOpen.js          deterministic open-answer grading (+ .test.mjs, the one test)
    examReview.js         buildReviewRows (email), buildDetailRows (CSV), validFormKeys
    certificates.js       PDF/PNG/zip generation, eligibility, filenames
    quizUtils.js          revision helpers
  config/certificateTemplates.js  per-tenant certificate template mapping
supabase/
  migrations/             0001…0021 SQL, applied manually in order
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
- **Only one automated test** (`gradeOpen.test.mjs`). RLS isolation tests still owed.

## 11. Migrations (apply in order, manually)

0001 subjects/roles/forms · 0002 activity triggers · 0003 multi-tenant · 0004 tenant RLS ·
0005 exam public read · 0006 list_members · 0007 drop 'admin' role · 0008 tenant logo ·
0009 attempt graded · 0010 invite corrector · 0011 delete candidates · 0012 invite link ·
0013 hisnul tenant (undone in 0015) · 0014 branding RPC · 0015 axe client=tenant ·
0016 revision quiz · 0017 matières · 0018 import Qawaid revision · 0019 import Hisn cours 1 ·
0020 role `editeur` · 0021 invite target tenant.

## 12. Sprint / plan

**Done (recent):** multi-tenant + per-domain vitrine; matières as first-class; revision
mode multitenant; CSV export (list); role consolidation → owner/correcteur; corrector
invite links + single-use/expiry; per-question + corrector stats; results filtering;
`editeur` («Admin») role; invite target-instance picker; Hisn cours 1 import.

**Ongoing:** CSV export split — **CSV liste** (results) + **CSV détaillé** (all answers
per student) in ExamResults, detail CSV + form fields in CandidateAttemptDetail, broken
fields excluded. *(in progress, may be uncommitted)*

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
