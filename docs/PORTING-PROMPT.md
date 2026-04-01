# Prompt / note: port assessment, gradebook & reporting logic from SaaS LMS

**How to use this:** Copy everything below the line into a **new chat in your other project** (or paste into Cursor’s prompt). Attach or `@`-reference the **saasLMS** repo folder so the model can read files. Replace `{PATH_TO_SAASLMS}` with the absolute path to this project on your machine (e.g. `c:\saasLMS`).

---

## Prompt (paste into the other project)

I am building a **different stack** than my reference repo, but I want to **reuse the same business logic** for:

- Assessments (questions, submissions, scoring)
- Gradebook behavior
- Report card / promotion-style reporting
- Transcript / GPA (higher-ed)
- **Organization education level**: PRIMARY, SECONDARY, HIGHER_ED and how settings change behavior

**Reference implementation** lives at: `{PATH_TO_SAASLMS}` (Next.js + Prisma + PostgreSQL).

### What to port (logic-first, framework-agnostic where possible)

1. **Pure TypeScript / domain logic** — copy or reimplement with the same inputs/outputs (no Next.js in these cores):
   - `src/lib/assessments/grade.ts` — per-question auto-grading (MCQ, short answer, true/false, long answer rules, `effectiveAnswerScore`).
   - `src/lib/assessments/score.ts` — `recomputeSubmissionTotals` (sum answer scores → submission `totalScore` / `maxScore`).
   - `src/lib/assessments/mcq.ts`, `sanitize.ts`, `time.ts` as needed.
   - `src/lib/grading/scale.ts` — UI/client grade display helpers (may duplicate small parts of engine).
   - `src/lib/grading_engine/` — **letter bands, GPA from percent, weighted semester %, course semester grade**:
     - `letter-gpa.ts` (`letterFromPercent`, `gpaFromPercent`, `formatGradeDisplay`, `letterAndGpaForLevel`)
     - `weighted-semester.ts` (`computeWeightedSemesterPercent` — CA/exam style weights)
     - `index.ts` re-exports
     - `__tests__/course-grade.test.ts` — use tests as the spec
   - `src/lib/grading/course-grade.ts` — ties course + submissions to a rolled-up percent/letter for transcript-style use (read and follow imports).
   - `src/lib/grading/promotion-service.ts` — promotion snapshot computation (semester averages, standing vs org thresholds).
   - `src/lib/transcript/build-transcript.ts` — transcript rows, GPA, semester summaries; **branches on `educationLevel === "HIGHER_ED"`** for credits/GPA columns.
   - `src/lib/education_context/schema.ts` — Zod schema for **`organizationSettings`**: `letterBands`, `gpaBands`, `terminology`, `reportShowRank`, etc. This is the **config contract** for grading/reporting.
   - `src/lib/education_context/` — `parseOrganizationSettings`, `mergeOrganizationSettings`, resolver if you need label resolution.

2. **Report card data assembly** (read as spec; reimplement queries in my ORM):
   - `src/lib/dashboard/insights.ts` — `getUserReportCardRows`, `getUserPromotionSnapshot` (how rows and snapshot are built from submissions + assessments + courses).

3. **Assessment access rules by education level** (important for parity):
   - `src/lib/assessments/access.ts` — `canStudentViewAssessment`, cohort vs department visibility (PRIMARY/SECONDARY vs HIGHER_ED).

4. **Schema / data model you must mirror** (from `prisma/schema.prisma` — adapt to my DB):
   - `Organization`: `educationLevel`, `organizationSettings` (JSON), `academicYearLabel`, `promotionPassMinPercent`, `promotionProbationMinPercent`, `reportCardsPublished`, etc.
   - `Course`: `gradingScale` (PERCENTAGE, LETTER_AF, NUMERIC_10), `creditHours`, `semesterWeights` (JSON for weighted rollup), `academicTermId`, department/cohort links as applicable.
   - `Assessment`: `kind` (QUIZ/EXAM), `semester` (1–3 for promotion/transcript tagging), `courseId`, cohort/department restrictions.
   - `Submission`, `Answer`, `Question` — types, points, `totalScore`/`maxScore`, statuses.
   - `StudentPromotionSnapshot` — stored promotion snapshot per student/year.

5. **What not to port verbatim**
   - Next.js `app/` routes, React components, middleware — **reimplement** endpoints/UI in my stack but call the same pure functions.
   - Prisma client calls — translate to my ORM/query layer while keeping field semantics.

### Behavioral rules to preserve

- **Grading scale per course** drives how a raw percent maps to letters / display (`GradingScaleType`).
- **Higher education**: GPA uses **`gpaBands`** in `organizationSettings` (min percent → GPA points); transcript uses **credit hours** and **semester-tagged** assessments; weighted course grade uses **`semesterWeights`** on the course when present.
- **Primary / secondary**: same submission pipeline; UI labels and **navigation** differ (`navAcademicGroupsLabel`, cohort vs department) — see `src/lib/school/group-labels.ts` and org layout/nav.
- **Promotion / report card**: snapshot stores semester averages and **standing** (PASS / PROBATION / RETAIN) vs org thresholds; report card UI filters by semester view.

### Deliverables in my project

1. A short **domain layer** (folders like `domain/grading`, `domain/assessments`, `domain/reporting`) with the ported pure functions and types.
2. **Tests** ported or rewritten from `grading_engine/__tests__`.
3. **DB migrations** that match the semantic model above.
4. **API or services** that replace the old repo’s `/api` behavior using my stack’s patterns.

### First steps

1. Open `{PATH_TO_SAASLMS}/prisma/schema.prisma` and list entities/fields used by Assessment → Submission → Course.
2. Read `src/lib/transcript/build-transcript.ts` and `src/lib/grading/promotion-service.ts` end-to-end — they encode the cross-cutting rules.
3. Map each imported file in those chains into my project structure.

If anything is ambiguous, prefer **matching the reference repo’s test expectations** over inventing new rules.

---

## Optional one-liner for Cursor

*“Port pure TS grading, assessment scoring, transcript, promotion snapshot, and organizationSettings (letterBands/gpaBands) from `{PATH_TO_SAASLMS}/src/lib` into this project; mirror Prisma models for Course/Assessment/Submission/StudentPromotionSnapshot/Organization.educationLevel; ignore Next.js routes.”*

---

*File created in saasLMS repo: `docs/PORTING-PROMPT.md` — keep this file next to the reference codebase.*
