# Changelog

All notable changes for the universal education platform rollout are summarized by phase. **Preserved** = existing behavior unchanged by default; **Added** = new capabilities; **Deprecated** = scheduled or soft removal.

## Phase 1 — Education context

- **Preserved:** Existing org settings (theme, hero, promotion thresholds, report/certificate flags) and default `SECONDARY` education level for current rows.
- **Added:** `Organization.educationLevel`, `Organization.organizationSettings` (JSON); admin `PATCH /api/admin/organization` fields validated with Zod; `src/lib/education_context/*` (terminology, resolver, merge/partial settings).

## Phase 2 — Grading engine

- **Preserved:** CA/exam weighting formula and default letter bands matching legacy `scale.ts` when settings omit `letterBands`.
- **Added:** `src/lib/grading_engine/*` (weighted semester percent, letter/GPA from org config); `computeCourseSemesterGrade` structured result; Vitest tests in `src/lib/grading_engine/__tests__/`.

## Phase 3 — Assessments

- **Preserved:** Existing question delivery when no pools are configured; MCQ grading behavior for core types.
- **Added:** `shuffleOptions` on assessments; `AssessmentQuestionPool` / `AssessmentPoolEntry`; extended `QuestionType` and JSON fields `rubric`, `questionSchema`; student take flow uses pool resolution + option shuffle; `POST .../proctoring` and client hooks on take page.

## Phase 4 — Rubric & moderation

- **Preserved:** Manual score flow via existing gradebook PATCH.
- **Added:** `Submission.moderationState`; optional `rubricScores` / `annotations` on answers; `GradingAuditLog` on manual scores and moderation transitions; `PATCH .../submissions/[id]/moderation`.

## Phase 5 — Reporting

- **Preserved:** In-app report card UI.
- **Added:** `src/lib/reporting_engine` PDF builder (PDFKit); `GET /api/me/report-card-pdf`; `reportShowRank` in org settings (PDF placeholder line when enabled).

## Phase 6 — Platform

- **Preserved:** STUDENT/TEACHER/ADMIN flows.
- **Added:** `Role.PARENT`, `ParentStudentLink`, parent invites, DM policy, dashboard/report-card/assessments parent paths; `LearningStandard` / `QuestionStandard`; `GET/POST /api/admin/learning-standards`; `POST /api/admin/parent-links`; `GET /api/parent/children`; CSV header validation stub; offline draft sync stub (`202`); `analytics_engine` at-risk heuristic.

## CI / verify

- **Added:** `npm test` (Vitest); `scripts/verify.mjs` runs lint → test → build.

## Migrations

- Apply with: `npx prisma migrate deploy` (or `migrate dev` locally). Migration `20260331120001_universal_education_platform` adds enums, columns, and new tables listed in `prisma/migrations/`.
