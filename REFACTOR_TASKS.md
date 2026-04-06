# Refactor task backlog — SaaS LMS (multi-tenant)

**Tenant model:** `Organization` + `organizationId` on all member data (not `tenant_id`). Isolation is enforced in API guards and queries.

**Stack:** Next.js 16 App Router, TypeScript, Prisma 7, PostgreSQL, Vitest, JWT cookies.

**How to use:** Complete one task at a time. After each: `npm test` and `npm run lint`. Every 5 tasks: `npm run build`. Do **not** run destructive migrations without explicit approval.

---

## Phase 0 — Discovery (done)

| Feature area | Test coverage today |
|----------------|---------------------|
| Grading / assessments (pure lib) | Yes (`*.test.ts` under `lib/assessments`, `lib/grading_engine`) |
| Transcript scope | Yes |
| School public CMS parse | Yes |
| Platform tenant usage weights | Yes |
| **Auth: self-serve register** | **No** → Task 1 |
| **Auth: login / session** | No |
| **Invite accept (join org)** | No |
| **Certificate verification** | No |
| API route handlers (HTTP integration) | No (would need test DB or heavy mocks) |

Legacy scan (sample): no class components in `src/components`; Prisma used (no raw SQL concatenation in app code). Prefer small extractions + unit tests over full HTTP integration until a test DB strategy exists.

---

## Task 1 — Self-serve school registration (extract + test) ✅

- **Files:** `src/lib/auth/self-serve-registration.ts` (new), `src/app/api/auth/register/route.ts`, `src/lib/auth/self-serve-registration.test.ts`
- **Outcome:** Registration business logic is unit-tested (slug collision, invalid slug, success path with `organizationId` on user). Route stays thin (rate limit + JSON + delegate).
- **Test:** `npx vitest run src/lib/auth/self-serve-registration.test.ts`
- **Dependencies:** None

## Task 2 — Login credentials flow (extract + test) ✅

- **Files:** `src/app/api/auth/login/route.ts`, `src/lib/auth/login-credentials.ts`, `src/lib/auth/login-credentials.test.ts`
- **Outcome:** Email/password validation + org slug resolution + password verify testable without HTTP; JWT signing + cookie remain in route.
- **Test:** `npx vitest run src/lib/auth/login-credentials.test.ts` (9 tests)
- **Dependencies:** Task 1 optional (none)

## Task 3 — Invite accept tenant binding ✅

- **Files:** `src/lib/invites/accept-invite.ts`, `src/lib/invites/accept-invite.test.ts`, `src/app/api/invite/accept/route.ts`
- **Outcome:** `acceptInviteSchoolUser()`; user `organizationId`, `role`, and `email` come from the invite row only; session cookie + JWT remain in route.
- **Test:** `npx vitest run src/lib/invites/accept-invite.test.ts` (5 tests)
- **Dependencies:** None

## Task 4 — Certificate public verification ✅

- **Files:** `src/lib/certificates/completion-certificate.ts` (unchanged), `src/lib/certificates/completion-certificate.test.ts`
- **Outcome:** Tests for `verifyCompletionCertificatePublic` (empty/long id, no row, course `organizationId` ≠ cert org, success, email fallback) and `completionCertificateVerifyPath` encoding.
- **Test:** `npx vitest run src/lib/certificates/completion-certificate.test.ts` (8 tests)
- **Dependencies:** None

## Task 5 — Rate limit helper behaviour ✅

- **Files:** `src/lib/api/rate-limit.ts` (`clearRateLimitBucketsForTests`), `src/lib/api/rate-limit.test.ts`
- **Outcome:** Tests for `getRequestIp`, fixed-window `checkRateLimit` (429 + `Retry-After`), key isolation, window rollover (fake timers).
- **Test:** `npx vitest run src/lib/api/rate-limit.test.ts` (8 tests)
- **Dependencies:** None

## Task 6 — Shared Zod schema for server env (non-secret) ✅

- **Files:** `src/lib/env/server-public.ts`, `src/lib/env/server-public.test.ts`, `src/lib/seo/metadata-base.ts`, `.env.example` note
- **Outcome:** Zod parse for `NODE_ENV`, `NEXT_PUBLIC_APP_URL` (http/https only), `VERCEL_*`; `getServerPublicEnv()` cached; `getMetadataBase()` reads from it; invalid public URL fails at first use (build/runtime).
- **Test:** `npx vitest run src/lib/env/server-public.test.ts` (5 tests)
- **Dependencies:** None

## Task 7 — Prisma query audit: dashboard org scope ✅

- **Files:** `src/app/o/[slug]/dashboard/page.tsx`, `src/lib/dashboard/insights.ts`, `src/lib/dashboard/insights.test.ts`, `docs/dashboard-org-scope-audit.md`
- **Outcome:** Audited dashboard + calendar paths; **fixed** parent recent-discussions leak (now scoped to linked students’ enrollments); documented queries + indexes; Vitest for discussion where-clauses.
- **Test:** `npx vitest run src/lib/dashboard/insights.test.ts`
- **Dependencies:** None

## Task 8 — Remove dead exports / unused deps ✅

- **Files:** `package.json`, `knip` or manual `ts-prune` output
- **Outcome:** Drop unused packages; remove unreachable exports.
- **Dependencies:** Tasks 1–5 green
- **Done:** Removed unused deps (`jsonwebtoken`, `cookie`, `zustand`, `@radix-ui/react-dialog`, redundant `@types/*`); added explicit `postcss` devDependency; deleted dead `src/lib/analytics_engine/*`.

## Task 9 — API route response shape consistency ✅

- **Files:** selected `src/app/api/**/route.ts`
- **Outcome:** Standardize `{ error: string }` vs `{ error: object }` for 400s (document breaking changes if any).
- **Dependencies:** Task 2
- **Done:** `docs/api-error-conventions.md` + `src/lib/api/api-json.ts`; register, invite accept, invites POST, auth login use helpers.

## Task 10 — Observability: structured request logging (opt-in) ✅

- **Files:** `src/proxy.ts` (Next.js 16 proxy; do not add `middleware.ts` alongside)
- **Outcome:** `X-Request-Id`, log org slug + route (no PII); env flag `ENABLE_REQUEST_LOG`.
- **Dependencies:** None
- **Done:** Every proxy response gets `X-Request-Id`; `ENABLE_REQUEST_LOG=true` emits one JSON line per matched request via `console.info`.

## Task 11 — Dependency upgrades (minor/patch) ✅

- **Files:** `package.json`, lockfile
- **Outcome:** `npm outdated` triage; bump safe minors; full `npm test && npm run build`.
- **Dependencies:** Tasks 1–5 green
- **Done:** Prisma 7.6.x, Next 16.2.2 + eslint-config-next, dotenv, katex, shadcn, `@types/node` patch; skipped major jumps (`@vercel/blob` 2.x, ESLint 10, TS 6).

## Task 12 — FINAL_REPORT.md (termination doc) ✅

- **Files:** `FINAL_REPORT.md`
- **Outcome:** Summary of completed tasks, metrics, manual follow-ups.
- **Dependencies:** Phase 2 scope agreed with stakeholder

---

## Phase 3 / 4 notes

Full “80% coverage” and “no legacy patterns” per the original prompt require CI test DB, E2E (Playwright), and multiple iterations. This backlog is scoped to **actionable, low-risk** steps for the current codebase.
