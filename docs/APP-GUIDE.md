# SaaS LMS — Application guide

This document describes the **structure**, **features**, and **sign-in flows** of the multi-tenant learning platform in this repository. For local setup commands, see the project **README.md** at the repo root.

**Saving as PDF:** Open this file in your editor’s Markdown preview (or any Markdown viewer), then use **Print → Save as PDF** in your browser or system print dialog.

---

## 1. What this application is

- **Multi-tenant LMS**: Each **organization** (school) has its own slug (e.g. `demo-school`). Members sign in **per school**.
- **Platform console**: Separate operator area for managing organizations, landing content, and database tools (not tied to a school user row).
- **Public marketing**: Root `/` lists schools; each school can have a public page at `/school/[slug]`.

**Stack (high level):** Next.js (App Router), React, PostgreSQL, Prisma, JWT session cookies for org users, separate cookie for platform operators.

---

## 2. Main URLs (itinerary / site map)

| Area | Path | Purpose |
|------|------|---------|
| Home / school picker | `/` | Lists active organizations; links to public school pages and login |
| Org login | `/login?org={slug}` | Email/password (and optional Google) for a specific school |
| Self-serve register | `/register` | New school registration (may require platform approval) |
| Registration pending | `/register/pending` | Shown when org is awaiting approval |
| Invite accept | `/invite/[token]` | Join a school from an admin invite link |
| Public school site | `/school/[slug]` | CMS-driven one-pager (hero, about, contact, etc.) |
| **Org app shell** | `/o/{slug}/…` | Authenticated school experience (see below) |
| Platform login | `/platform/login` | Operator sign-in (env-configured credentials) |
| Platform home | `/platform` | Operator dashboard (protected) |
| Platform org detail | `/platform/orgs/[orgId]` | Approve/reject orgs, export SQL, messaging |
| Platform landing editor | `/platform/landing` | Edit global marketing `/` content |
| Platform database | `/platform/database` | Backup/restore tools (operator) |
| Platform settings | `/platform/settings` | Operator profile / preferences |

### Org member routes (`/o/{slug}/…`)

| Path | Typical roles | Purpose |
|------|---------------|---------|
| `/o/{slug}/dashboard` | All | Home / announcements / entry points |
| `/o/{slug}/settings` | All | Profile, preferences |
| `/o/{slug}/courses` | Most | Course catalog; teachers see authoring controls |
| `/o/{slug}/courses/new` | Staff | Create course |
| `/o/{slug}/courses/{courseId}` | Enrolled + staff | Course home |
| `/o/{slug}/courses/{courseId}/edit` | Course author / admin | Course editor |
| `/o/{slug}/courses/{courseId}/lessons/{lessonId}` | Enrolled + staff | Lesson content, attachments, completion |
| `/o/{slug}/courses/{courseId}/assessments` | Enrolled + staff | List assessments |
| `/o/{slug}/courses/{courseId}/assessments/new` | Staff | Create assessment |
| `/o/{slug}/courses/{courseId}/assessments/{id}/take` | Student (enrolled) | Take assessment |
| `/o/{slug}/courses/{courseId}/assessments/{id}/edit` | Staff | Edit assessment |
| `/o/{slug}/courses/{courseId}/assessments/{id}/gradebook` | Staff | Gradebook |
| `/o/{slug}/courses/{courseId}/assessments/{id}/results` | Owner + parent proxy + staff | Results |
| `/o/{slug}/courses/{courseId}/certificate` | Student/parent | Completion certificate (when published + eligible) |
| `/o/{slug}/assessments` | Student-focused | Cross-course assessments view |
| `/o/{slug}/my-classes` | Student/teacher/admin | Class/cohort hub (labels depend on education level) |
| `/o/{slug}/classes/{cohortId}` | Members | Cohort detail |
| `/o/{slug}/departments/{departmentId}` | Higher-ed | Department hub / messages |
| `/o/{slug}/messages` | Members | School wall + DMs (as implemented) |
| `/o/{slug}/library` | Members | Learning resources |
| `/o/{slug}/blog` | All | Org blog list |
| `/o/{slug}/blog/new`, `/edit/...`, `/[postSlug]` | Authors / readers | Blog authoring and reading |
| `/o/{slug}/report-card` | Student/parent (+ staff message) | Report card & GPA links |
| `/o/{slug}/transcript` | Student/parent (+ staff message) | Transcript & PDF |
| `/o/{slug}/certificates` | Student | List eligible certificates |
| `/o/{slug}/admin/users` | Admin | Users, invites, parent links |
| `/o/{slug}/admin/school` | Admin | School settings, brand logo, hero, education level, GPA bands |
| `/o/{slug}/admin/terms` | Admin | Academic terms |
| `/o/{slug}/admin/classes` or `admin/departments` | Admin | Primary/secondary cohorts vs higher-ed departments |
| `/o/{slug}/admin/cms` | Admin | Dashboard copy + public school CMS fields |
| `/o/{slug}/admin/analytics` | Admin | Analytics summary |

---

## 3. Roles

| Role | Summary |
|------|---------|
| **ADMIN** | Full school settings, users, invites, CMS, terms, cohorts/departments, analytics |
| **TEACHER** | Courses they manage, assessments, gradebook, cohort/department messaging as applicable |
| **STUDENT** | Enrolled courses, assessments, report card, transcript, certificates, library |
| **PARENT** | Linked students: view child report card, transcript, assessments, certificates (within published rules) |

**Organization status:** New orgs may be `PENDING` until a **platform operator** approves them (`ACTIVE`). Rejected orgs cannot sign in.

---

## 4. Feature areas (functions)

### Authentication & access

- Email + password login per **organization slug** (`/api/auth/login`).
- Optional **Google OAuth** when server env vars are set (`/api/auth/google`).
- JWT in **httpOnly cookie** for school sessions.
- **Invites** for joining a school with a role.
- **Platform operator** auth is separate (`PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`).

### Courses & content

- Modules and lessons; lesson files and video links.
- Course enrollment; lesson completion tracking.
- Course editing, grading scale, credit hours (transcript/GPA for higher-ed).

### Assessments

- Types such as quiz/exam; questions; submissions; grading; optional proctoring hooks.
- Gradebook and student results views.

### Grading, promotion, transcripts

- Organization **education level**: PRIMARY, SECONDARY, HIGHER_ED (drives labels and transcript behavior).
- Report card views; **promotion snapshots** (semester averages, standing) where configured.
- **Transcript** from enrollments and graded work; **PDF** export (`/api/me/transcript-pdf`).
- **Report card PDF** (`/api/me/report-card-pdf`).
- **Print** from browser uses a dedicated iframe document for reliable output.

### Branding

- **Brand logo** (`logoImageUrl`): upload or URL in **Admin → School**; used in sidebar, transcripts, report cards, certificates, PDFs.
- **Hero image** for marketing/carousel/public page; CMS can override public hero.
- Theme templates and optional primary/accent hex.

### Communication

- Organization-wide **school messages**; **direct messages** between members.
- Course or cohort/department scoped chat (as implemented in routes).

### Platform operator

- List and **approve** organizations.
- **Impersonation** (where enabled), **SQL export** for an org, school messaging from console.
- Edit **platform landing** (headline, logo, feature cards on `/`).
- **Database** dump/restore tools (use with extreme care; production safeguards apply).

### Public API surface (representative)

- `/api/public/organizations`, `/api/public/organizations/[slug]/hero`, `/logo`, `/cms-hero`, etc.
- `/api/me/*` for current user exports (transcript/report-card PDF).
- Extensive `/api/admin/*`, `/api/courses/*`, `/api/assessments/*`, etc., for the app UI.

---

## 5. Login details

### A. School (organization) members

1. Go to **`/login`** (optionally `?org=your-school-slug`).
2. Enter **school slug**, **email**, and **password**.

**Optional Google:** If the server has Google OAuth environment variables configured, a Google sign-in button appears; the user must already exist in that school (or have completed invite flow as required).

### B. Demo accounts (after `npm run db:seed`)

The seed script creates organization **`demo-school`** and users (all use the same demo password **`password123`** unless you change the seed):

| Email | Role |
|--------|------|
| `admin@test.com` | ADMIN |
| `teacher@test.com` | TEACHER |
| `student@test.com` | STUDENT |
| `ward2@test.com` | STUDENT |
| `parent@test.com` | PARENT |

**School slug for login:** `demo-school`

> **Security:** Change these passwords in any shared or production environment. Do not commit real passwords to git. Keep personal notes (e.g. a local `LOCAL-CREDENTIALS.txt`) out of version control.

### C. Development shortcut

In **`NODE_ENV=development`** only, visiting **`/api/dev/quick-login`** sets a session as the seeded demo admin and redirects to the demo school dashboard. Disable or avoid in production.

### D. Platform operator console

1. Set in **`.env` / `.env.local`** (names only):
   - `PLATFORM_ADMIN_EMAIL`
   - `PLATFORM_ADMIN_PASSWORD`
2. Sign in at **`/platform/login`** with those values.
3. Requires a valid **JWT secret** for platform tokens (same family of auth secrets as the app; see app env docs).

If these variables are missing, the API returns that the platform operator is not configured.

---

## 6. Environment variables (reference)

Typical names (values are **not** listed here):

- `DATABASE_URL` — PostgreSQL connection string  
- `JWT_SECRET` (or app session secret as documented in your deployment)  
- `PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` — platform console  
- Google OAuth (if used): client ID, secret, redirect URI variables as wired in `/api/auth/google`  
- Blob/storage-related vars if using cloud file storage  
- `NEXT_PUBLIC_HIDE_DEMO_LOGIN_HINT` — hide demo hints on `/login` in development  

---

## 7. Database & migrations

- **Prisma** schema in `prisma/schema.prisma`.
- Apply migrations: `npm run db:deploy` (or `prisma migrate deploy`).
- Seed: `npm run db:seed`.

---

## 8. Scripts (from `package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm start` | Production build and run |
| `npm run db:migrate` | Create/apply migrations (dev; needs DB permissions) |
| `npm run db:deploy` | Apply migrations (CI/production) |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Prisma Studio |
| `npm test` | Vitest |

---

*This guide reflects the codebase structure at the time of writing. For the latest routes and behavior, search under `src/app` and `src/app/api`.*
