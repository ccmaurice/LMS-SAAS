import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeacherCohortIds } from "@/lib/school/cohort-access";
import { getFacultyDepartmentIds } from "@/lib/school/department-access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { navAcademicGroupsLabel, cohortKindNoun } from "@/lib/school/group-labels";
import type { EducationLevel } from "@/generated/prisma/enums";

function facultyListForDepartment(dept: {
  chair: { id: string; name: string | null; email: string } | null;
  instructors: { user: { id: string; name: string | null; email: string; role: string } }[];
}) {
  const rows: { id: string; label: string }[] = [];
  if (dept.chair) {
    rows.push({ id: dept.chair.id, label: dept.chair.name?.trim() || dept.chair.email });
  }
  for (const i of dept.instructors) {
    const u = i.user;
    if (dept.chair?.id === u.id) continue;
    if (u.role !== "TEACHER" && u.role !== "ADMIN") continue;
    rows.push({ id: u.id, label: u.name?.trim() || u.email });
  }
  return rows;
}

export default async function MyClassesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const base = `/o/${slug}`;
  const level: EducationLevel = user.organization.educationLevel;

  if (level === "HIGHER_ED") {
    if (user.role === "STUDENT") {
      const affiliations = await prisma.studentDepartmentAffiliation.findMany({
        where: { userId: user.id, department: { organizationId: user.organizationId } },
        include: {
          department: {
            include: {
              facultyDivision: { select: { name: true } },
              chair: { select: { id: true, name: true, email: true } },
              instructors: {
                include: { user: { select: { id: true, name: true, email: true, role: true } } },
              },
            },
          },
        },
        orderBy: { department: { name: "asc" } },
      });

      const peerCounts = await Promise.all(
        affiliations.map(async (m) => {
          const n = await prisma.studentDepartmentAffiliation.count({ where: { departmentId: m.departmentId } });
          return { departmentId: m.departmentId, n: Math.max(0, n - 1) };
        }),
      );
      const countMap = new Map(peerCounts.map((c) => [c.departmentId, c.n]));
      const hub = navAcademicGroupsLabel(level);

      return (
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="page-title">My {hub}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Faculty, peers, and notices for each academic department. Message people from{" "}
              <Link href={`${base}/messages`} className="font-medium text-primary underline-offset-4 hover:underline">
                Messages
              </Link>
              .
            </p>
          </div>
          {affiliations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not assigned to a department yet. Your administrator can add you under Admin → Departments.
            </p>
          ) : (
            <ul className="space-y-4">
              {affiliations.map((m) => {
                const d = m.department;
                const faculty = facultyListForDepartment(d);
                const div = d.facultyDivision?.name;
                return (
                  <li key={m.departmentId} className="surface-bento space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{d.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {d.code ? `${d.code}` : ""}
                          {d.code && div ? " · " : ""}
                          {div ?? ""}
                          {m.isPrimary ? (
                            <span className="ml-2 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                              Primary
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <Link
                        href={`${base}/departments/${m.departmentId}`}
                        className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                      >
                        Department notices
                      </Link>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-muted-foreground">Faculty</p>
                      <ul className="mt-1 list-inside list-disc text-foreground">
                        {faculty.length === 0 ? (
                          <li className="text-muted-foreground">No faculty listed yet</li>
                        ) : (
                          faculty.map((f) => <li key={f.id}>{f.label}</li>)
                        )}
                      </ul>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      About {countMap.get(m.departmentId) ?? 0} peer
                      {(countMap.get(m.departmentId) ?? 0) === 1 ? "" : "s"} in this department — open Messages → New
                      to start a chat.
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
      );
    }

    if (user.role === "TEACHER" || user.role === "ADMIN") {
      const deptIds =
        user.role === "ADMIN"
          ? (
              await prisma.academicDepartment.findMany({
                where: { organizationId: user.organizationId },
                select: { id: true },
              })
            ).map((d) => d.id)
          : await getFacultyDepartmentIds(user.id, user.organizationId);

      const departments =
        deptIds.length === 0
          ? []
          : await prisma.academicDepartment.findMany({
              where: { id: { in: deptIds }, organizationId: user.organizationId },
              orderBy: { name: "asc" },
              include: {
                facultyDivision: { select: { name: true } },
                _count: { select: { studentAffiliations: true } },
                chair: { select: { name: true, email: true } },
              },
            });

      const hub = navAcademicGroupsLabel(level);

      return (
        <div className="mx-auto max-w-3xl space-y-8">
          <div>
            <h1 className="page-title">
              {user.role === "ADMIN" ? `All ${hub}` : `My ${hub}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {user.role === "ADMIN"
                ? "Open a department to post notices. Assign chairs, instructors, and students under Admin → Departments."
                : "Departments where you are chair or instructor. Post notices and link courses for targeted assessments."}
            </p>
          </div>
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No departments to show.</p>
          ) : (
            <ul className="space-y-3">
              {departments.map((d) => (
                <li key={d.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {d.code ? `${d.code} · ` : ""}
                      {d.facultyDivision?.name ? `${d.facultyDivision.name} · ` : ""}
                      {d._count.studentAffiliations} students
                      {d.chair ? ` · Chair: ${d.chair.name?.trim() || d.chair.email}` : ""}
                    </p>
                  </div>
                  <Link href={`${base}/departments/${d.id}`} className={cn(buttonVariants({ size: "sm" }))}>
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            ← Dashboard
          </Link>
        </div>
      );
    }

    redirect(`${base}/dashboard`);
  }

  const cohortNoun = cohortKindNoun(level);
  const hubLabel = navAcademicGroupsLabel(level);

  if (user.role === "STUDENT") {
    const memberships = await prisma.cohortMembership.findMany({
      where: { userId: user.id, cohort: { organizationId: user.organizationId } },
      include: {
        cohort: {
          include: {
            homeroomTeacher: { select: { id: true, name: true, email: true } },
            instructors: {
              include: { user: { select: { id: true, name: true, email: true, role: true } } },
            },
          },
        },
      },
      orderBy: { cohort: { name: "asc" } },
    });

    const classmateCounts = await Promise.all(
      memberships.map(async (m) => {
        const n = await prisma.cohortMembership.count({ where: { cohortId: m.cohortId } });
        return { cohortId: m.cohortId, n: Math.max(0, n - 1) };
      }),
    );
    const countMap = new Map(classmateCounts.map((c) => [c.cohortId, c.n]));

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="page-title">My {hubLabel}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your {cohortNoun} roster, teachers, and classmates — message them from{" "}
            <Link href={`${base}/messages`} className="font-medium text-primary underline-offset-4 hover:underline">
              Messages
            </Link>
            .
          </p>
        </div>
        {memberships.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You are not assigned to a {cohortNoun} yet. Your school administrator can add you under Admin → Classes.
          </p>
        ) : (
          <ul className="space-y-4">
            {memberships.map((m) => {
              const t = m.cohort.homeroomTeacher;
              const extra = m.cohort.instructors
                .map((i) => i.user)
                .filter((u) => u.id !== t?.id && u.role === "TEACHER");
              return (
                <li key={m.cohortId} className="surface-bento space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{m.cohort.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {m.cohort.gradeLabel ? `${m.cohort.gradeLabel} · ` : ""}
                        {m.cohort.academicYearLabel || "—"}
                        {m.cohort.trackLabel ? ` · ${m.cohort.trackLabel}` : ""}
                      </p>
                    </div>
                    <Link
                      href={`${base}/classes/${m.cohortId}`}
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                    >
                      {hubLabel} messages
                    </Link>
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-muted-foreground">Teachers</p>
                    <ul className="mt-1 list-inside list-disc text-foreground">
                      {t ? (
                        <li>{t.name?.trim() || t.email}</li>
                      ) : (
                        <li className="text-muted-foreground">No homeroom teacher set</li>
                      )}
                      {extra.map((u) => (
                        <li key={u.id}>{u.name?.trim() || u.email}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    About {countMap.get(m.cohortId) ?? 0} classmate
                    {(countMap.get(m.cohortId) ?? 0) === 1 ? "" : "s"} — open Messages → New to start a chat.
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Dashboard
        </Link>
      </div>
    );
  }

  if (user.role === "TEACHER" || user.role === "ADMIN") {
    const cohortIds =
      user.role === "ADMIN"
        ? (
            await prisma.schoolCohort.findMany({
              where: { organizationId: user.organizationId },
              select: { id: true },
            })
          ).map((c) => c.id)
        : await getTeacherCohortIds(user.id, user.organizationId);

    const cohorts =
      cohortIds.length === 0
        ? []
        : await prisma.schoolCohort.findMany({
            where: { id: { in: cohortIds }, organizationId: user.organizationId },
            orderBy: { name: "asc" },
            include: {
              _count: { select: { members: true } },
              homeroomTeacher: { select: { id: true, name: true, email: true } },
            },
          });

    return (
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="page-title">
            {user.role === "ADMIN" ? `All ${hubLabel}` : `My ${hubLabel}`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.role === "ADMIN"
              ? `Open a ${cohortNoun} to post announcements. Assign a homeroom teacher under Admin → Classes.`
              : `${hubLabel} where you are homeroom or instructor. Post announcements and assign assessments to linked courses.`}
          </p>
        </div>
        {cohorts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
        ) : (
          <ul className="space-y-3">
            {cohorts.map((c) => (
              <li key={c.id} className="surface-bento flex flex-wrap items-center justify-between gap-3 p-5">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {c.gradeLabel ? `${c.gradeLabel} · ` : ""}
                    {c.academicYearLabel || "—"}
                    {c.trackLabel ? ` · ${c.trackLabel}` : ""} · {c._count.members} students
                  </p>
                </div>
                <Link href={`${base}/classes/${c.id}`} className={cn(buttonVariants({ size: "sm" }))}>
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href={`${base}/dashboard`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Dashboard
        </Link>
      </div>
    );
  }

  redirect(`${base}/dashboard`);
}
