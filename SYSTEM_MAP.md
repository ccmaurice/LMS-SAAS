# SaaS LMS — system map & evolution baseline

**Generated:** architecture audit for the “Master Evolution” program.  
**Stack:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind 4, Prisma 7 + PostgreSQL (`@prisma/adapter-pg`), `jose` JWT sessions, Zod 4, Shadcn-style UI on `@base-ui/react`.

---

## 1. Frontend

| Area | Location | Notes |
|------|-----------|--------|
| App shell / org nav | `src/components/app-shell.tsx`, `org-mobile-nav.tsx`, `org-command-menu.tsx` | Role-based sidebar; ⌘K palette; notifications bell (SSE). |
| Auth UI | `src/components/auth/login-form.tsx`, `register-form.tsx` | Email/password + optional Google OAuth (`NEXT_PUBLIC_GOOGLE_CLIENT_ID`). |
| Marketing home | `src/app/page.tsx` | Public landing. |
| Org routes | `src/app/o/[slug]/*` | Layout enforces session + org match (`layout.tsx`). |
| Platform operator | `src/app/platform/*` | Separate JWT cookie; impersonation APIs. |
| Global UI | `src/components/ui/*`, `globals.css` | Theming via `next-themes`; toasts via `sonner`. |

**UI / design trends:** Tailwind utility-first, semantic tokens (`muted`, `card`, `border`), compact professional shell. Gaps vs “top tier”: no dedicated marketing CMS on public home (until org-scoped CMS is wired), limited motion/illustration, course pages are utilitarian.

---

## 2. Backend

| Area | Location | Notes |
|------|-----------|--------|
| API routes | `src/app/api/**/route.ts` | REST-style JSON; cookie session on org routes. |
| Guards | `src/lib/api/guard.ts` | `requireUser`, `requireRoles`. |
| Domain logic | `src/lib/courses/*`, `lib/assessments/*`, `lib/auth/*`, `lib/platform/*` | Access checks scoped by `organizationId`. |
| File uploads | `src/lib/uploads/*`, lesson file APIs | Local disk under `UPLOAD_DIR`; `LessonFile.storageKey`. |
| Email | `src/lib/email/send.ts` | Resend optional. |
| AI | `src/lib/ai/*` | OpenAI optional for long-answer grading. |

**Middleware** (`src/middleware.ts`): protects `/o/[slug]/*` and `/platform/*` (except platform login). **Note:** Next 16 deprecation warning for “middleware” naming — migrate to `proxy` when upgrading.

---

## 3. Database (Prisma)

**Core domain (existing):** `Organization`, `User`, `UserInvite`, `Course` → `Module` → `Lesson` (+ `LessonFile`), `Enrollment`, `LessonProgress`, `Assessment` → `Question`, `Submission` → `Answer`, `Notification`.

**Auth fields:** `User.passwordHash` optional (Google link), `User.googleSub` + composite unique per org.

**Evolution (additive migrations only):** `CmsEntry` (headless strings per org), `BlogPost`, `LearningResource` + `ResourceProgress`, `CourseChatMessage` — see latest migration under `prisma/migrations/`.

---

## 4. Auth & security

- **Session:** HTTP-only cookie `saas_lms_token`; payload `sub`, `orgId`, `orgSlug`, `role` (`src/lib/auth/jwt.ts`).
- **Platform:** `saas_lms_platform_token` with `PLATFORM_JWT_SECRET`.
- **Dev-only:** `GET /api/dev/quick-login` (development only).

**Technical debt / risks**

- No global `Content-Security-Policy` by default (Next + inline scripts complicate strict CSP); baseline security headers added in `next.config.ts`.
- Upload MIME allow-lists are per-route; new resource upload route must stay aligned.
- Real-time today: SSE for notifications and (optional) course chat stream — not Socket.io (avoids custom Node server on Vercel); can swap to Supabase Realtime later.
- Video: native HTML5 + progress API + optional external HLS URL; Mux/Elemental = env + provider SDK when keys exist.

---

## 5. Verification

- `npm run verify` → `scripts/verify.mjs` (lint + `next build`).
- `scripts/verify.sh` — same + optional `VERIFY_BASE_URL` HTTP smoke (`/api/health`, CMS 401 check).

---

## 6. Evolution features (Master program)

| Feature | Routes / APIs | Notes |
|--------|----------------|-------|
| Headless CMS | `/o/[slug]/admin/cms`, `GET/PATCH /api/admin/cms` | **Admin-only**; key/value copy (e.g. `dashboard.welcome`). |
| Blog | `/o/[slug]/blog`, `.../new`, `.../edit/[id]`, `/api/blog` | Staff author; students see `published` only. |
| Resource library | `/o/[slug]/library`, `/api/learning-resources`, `upload`, `file`, `progress` | PDF/video upload + links; HTML5 progress to DB. |
| Course chat | `CourseChatPanel` on course page; `GET/POST /api/courses/[id]/chat`, `.../chat/stream` (SSE) | Enrolled + staff; lightweight realtime. |

## 7. Env reference (see `.env.example`)

`DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, optional `OPENAI_*`, Google OAuth, `RESEND_*`, `PLATFORM_*`, `UPLOAD_DIR`. Hosted video providers (Mux / Elemental) integrate via `externalUrl` or future playback-id fields.
