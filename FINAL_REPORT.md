# Refactor backlog — completion report

**Date:** 2026-03-29.  
**Scope:** `REFACTOR_TASKS.md` Phase 0 through Task 12.

## Completed tasks (summary)

| Task | Summary |
|------|--------|
| 1 | Self-serve registration extracted + unit tests; thin `POST /api/auth/register`. |
| 2 | Credential login extracted + tests; thin `POST /api/auth/login`. |
| 3 | Invite accept extracted + tests; thin `POST /api/invite/accept`. |
| 4 | Completion certificate verification + path helper tests. |
| 5 | Rate limit helper tests + `clearRateLimitBucketsForTests`. |
| 6 | `getServerPublicEnv()` Zod schema + metadata base tests. |
| 7 | Dashboard org-scope audit; parent recent-discussions scoped to linked students; `insights.test.ts` + `docs/dashboard-org-scope-audit.md`. |
| 8 | Unused npm packages removed; dead `analytics_engine` lib removed; explicit `postcss` devDependency. |
| 9 | `docs/api-error-conventions.md`; `src/lib/api/api-json.ts`; auth register/login + invite routes aligned. |
| 10 | `src/proxy.ts`: `X-Request-Id` on all responses; opt-in `ENABLE_REQUEST_LOG` (JSON via `console.info`, no PII). **Next.js 16.2:** only `proxy.ts` — no `middleware.ts` alongside (build error if both exist). |
| 11 | Conservative dependency bumps (Prisma 7.6, Next 16.2.2, patches); majors deferred. |
| 12 | This document. |

## Verification (latest run)

- **Tests:** `npm test` — 18 files, **99** tests passed (Vitest 4.1.2).
- **Lint:** `npm run lint` — clean (after using `console.info` for request logs).
- **Build:** `npm run build` — success (Next.js 16.2.2).

## Manual follow-ups

1. **Security / supply chain:** `npm audit` still reports issues; triage separately (no `npm audit fix --force` in this pass).
2. **Knip / dead code:** Re-run `npx knip` after changes; `@prisma/client` may still appear as a false positive depending on knip config.
3. **At-risk analytics:** The removed `scoreAtRisk` heuristic is documented only in `CHANGELOG.md`; reintroduce under a real feature path if product needs it.
4. **Node version:** `package.json` engines ask for Node 20.x; local CI may warn on other majors.
5. **API consistency:** Many routes still use ad-hoc `NextResponse.json({ error })`; extend `api-json` helpers incrementally where touch points occur.
