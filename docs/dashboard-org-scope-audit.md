# Dashboard org-scope audit (Task 7)

**Date:** 2026-03-29 (repo snapshot)  
**Scope:** `src/app/o/[slug]/dashboard/page.tsx`, `src/lib/dashboard/insights.ts`, `src/lib/calendar/dashboard-calendar.ts` (calendar + notifications entry points used from the dashboard).

## Summary

All dashboard data loads use `user.organizationId` from the authenticated session (or equivalent nested `course.organizationId` / `organizationId` on org-scoped models). **One issue was fixed:** parent “recent discussions” previously included **all** course chat messages in the organization; they are now limited to courses where **linked students** are enrolled.

## Queries reviewed

| Source | Scoped by `organizationId`? | Notes |
|--------|-----------------------------|--------|
| `parentStudentLink.findMany` | Yes (`parentUserId` + `organizationId`) | |
| `assessment.count` (staff) | Yes (`course.organizationId`) | |
| `cmsEntry.findMany` | Yes | |
| `enrollment.findMany` / `count` | Yes (`course.organizationId`); parent uses child ids in org | |
| `course.count` (teaching / drafts) | Yes | |
| `getRecentSchoolMessages` | Yes | |
| `getRecentDiscussionMessages` | Yes + **role rules** | **PARENT** now requires `linkedStudentUserIds` filter; **ADMIN** org-wide by design |
| `getUserReportCardRows` | Yes (`assessment.course.organizationId`) | |
| `getEligibleCertificates` | Yes | |
| `ensureUpcomingCalendarNotifications` | Yes | See `calendar-notifications.ts` |
| `fetchDashboardCalendarItems` | Yes | School events by `organizationId`; assessments by role + enrollments / children |

## Indexes (no migration in this task)

Existing Prisma indexes already support common dashboard paths:

- `Course`: `@@index([organizationId])`
- `Enrollment`: `@@index([courseId])`, `@@unique([userId, courseId])`
- `CourseChatMessage`: `@@index([courseId, createdAt])`
- `OrganizationMessage`: `@@index([organizationId, createdAt(sort: Desc)])`

If production profiling shows slow dashboard loads, consider composite indexes suggested by `EXPLAIN ANALYZE` on the heaviest org (e.g. submissions report card query), not guessed here.

## Regression tests

`src/lib/dashboard/insights.test.ts` covers `getRecentDiscussionMessages` where-clauses for **PARENT** (empty vs linked students), **STUDENT**, **TEACHER**, and **ADMIN**.
