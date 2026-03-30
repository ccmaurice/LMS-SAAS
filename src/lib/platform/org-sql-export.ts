import { prisma } from "@/lib/db";

function bt(name: string): string {
  return '"' + name.replace(/"/g, "") + '"';
}

function q(s: string | null | undefined): string {
  if (s == null) return "NULL";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

function qBool(b: boolean): string {
  return b ? "TRUE" : "FALSE";
}

function qDate(d: Date): string {
  const iso = d.toISOString();
  const s = iso.slice(0, 10) + " " + iso.slice(11, 23);
  return q(s);
}

function qEnum(s: string): string {
  return q(String(s).replace(/'/g, "''"));
}

/**
 * Partial SQL: removes existing rows for this org (courses cascade), then inserts core data.
 * Targets PostgreSQL (quoted identifiers; Prisma `postgresql` provider).
 */
export async function exportOrganizationCoreSql(organizationId: string): Promise<string | null> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return null;

  const lines: string[] = [
    "-- SaaS LMS — partial organization export (PostgreSQL, core tables).",
    "-- Test on a copy first. Does not include assessments, enrollments, DMs, lesson files, etc.",
    "BEGIN;",
    `DELETE FROM ${bt("Course")} WHERE ${bt("organizationId")} = ${q(organizationId)};`,
    `DELETE FROM ${bt("BlogPost")} WHERE ${bt("organizationId")} = ${q(organizationId)};`,
    `DELETE FROM ${bt("LearningResource")} WHERE ${bt("organizationId")} = ${q(organizationId)};`,
    `DELETE FROM ${bt("OrganizationMessage")} WHERE ${bt("organizationId")} = ${q(organizationId)};`,
    `DELETE FROM ${bt("CmsEntry")} WHERE ${bt("organizationId")} = ${q(organizationId)};`,
    `DELETE FROM ${bt("UserInvite")} WHERE ${bt("organizationId")} = ${q(organizationId)};`,
    `DELETE FROM ${bt("User")} WHERE ${bt("organizationId")} = ${q(organizationId)};`,
    `DELETE FROM ${bt("Organization")} WHERE ${bt("id")} = ${q(organizationId)};`,
    "",
  ];

  lines.push(
    `INSERT INTO ${bt("Organization")} (${bt("id")},${bt("name")},${bt("slug")},${bt("subdomain")},${bt("status")},${bt("reportCardsPublished")},${bt("certificatesPublished")},${bt("academicYearLabel")},${bt("promotionPassMinPercent")},${bt("promotionProbationMinPercent")},${bt("themeTemplate")},${bt("customPrimaryHex")},${bt("customAccentHex")},${bt("heroImageUrl")},${bt("createdAt")},${bt("updatedAt")}) VALUES (${q(org.id)},${q(org.name)},${q(org.slug)},${q(org.subdomain)},${qEnum(org.status)},${qBool(org.reportCardsPublished)},${qBool(org.certificatesPublished)},${q(org.academicYearLabel)},${org.promotionPassMinPercent},${org.promotionProbationMinPercent},${q(org.themeTemplate)},${q(org.customPrimaryHex)},${q(org.customAccentHex)},${q(org.heroImageUrl)},${qDate(org.createdAt)},${qDate(org.updatedAt)});`,
  );

  const users = await prisma.user.findMany({ where: { organizationId } });
  for (const u of users) {
    lines.push(
      `INSERT INTO ${bt("User")} (${bt("id")},${bt("email")},${bt("passwordHash")},${bt("googleSub")},${bt("name")},${bt("role")},${bt("image")},${bt("suspendedAt")},${bt("organizationId")},${bt("createdAt")},${bt("updatedAt")}) VALUES (${q(u.id)},${q(u.email)},${q(u.passwordHash)},${q(u.googleSub)},${q(u.name)},${qEnum(u.role)},${q(u.image)},${u.suspendedAt ? qDate(u.suspendedAt) : "NULL"},${q(u.organizationId)},${qDate(u.createdAt)},${qDate(u.updatedAt)});`,
    );
  }

  const invites = await prisma.userInvite.findMany({ where: { organizationId } });
  for (const inv of invites) {
    lines.push(
      `INSERT INTO ${bt("UserInvite")} (${bt("id")},${bt("organizationId")},${bt("email")},${bt("role")},${bt("token")},${bt("expiresAt")},${bt("createdAt")},${bt("createdById")}) VALUES (${q(inv.id)},${q(inv.organizationId)},${q(inv.email)},${qEnum(inv.role)},${q(inv.token)},${qDate(inv.expiresAt)},${qDate(inv.createdAt)},${inv.createdById ? q(inv.createdById) : "NULL"});`,
    );
  }

  const cmsRows = await prisma.cmsEntry.findMany({ where: { organizationId } });
  for (const c of cmsRows) {
    lines.push(
      `INSERT INTO ${bt("CmsEntry")} (${bt("id")},${bt("organizationId")},${bt("key")},${bt("value")},${bt("updatedAt")}) VALUES (${q(c.id)},${q(c.organizationId)},${q(c.key)},${q(c.value)},${qDate(c.updatedAt)});`,
    );
  }

  const courses = await prisma.course.findMany({ where: { organizationId } });
  for (const c of courses) {
    lines.push(
      `INSERT INTO ${bt("Course")} (${bt("id")},${bt("organizationId")},${bt("title")},${bt("description")},${bt("published")},${bt("gradeWeightContinuous")},${bt("gradeWeightExam")},${bt("gradingScale")},${bt("createdById")},${bt("createdAt")},${bt("updatedAt")}) VALUES (${q(c.id)},${q(c.organizationId)},${q(c.title)},${q(c.description)},${qBool(c.published)},${c.gradeWeightContinuous},${c.gradeWeightExam},${qEnum(c.gradingScale)},${q(c.createdById)},${qDate(c.createdAt)},${qDate(c.updatedAt)});`,
    );
  }

  const modules = await prisma.module.findMany({
    where: { course: { organizationId } },
    orderBy: [{ courseId: "asc" }, { order: "asc" }],
  });
  for (const m of modules) {
    lines.push(
      `INSERT INTO ${bt("Module")} (${bt("id")},${bt("courseId")},${bt("title")},${bt("order")}) VALUES (${q(m.id)},${q(m.courseId)},${q(m.title)},${m.order});`,
    );
  }

  const lessons = await prisma.lesson.findMany({
    where: { module: { course: { organizationId } } },
    orderBy: [{ moduleId: "asc" }, { order: "asc" }],
  });
  for (const l of lessons) {
    lines.push(
      `INSERT INTO ${bt("Lesson")} (${bt("id")},${bt("moduleId")},${bt("title")},${bt("content")},${bt("order")},${bt("videoUrl")},${bt("createdAt")},${bt("updatedAt")}) VALUES (${q(l.id)},${q(l.moduleId)},${q(l.title)},${q(l.content)},${l.order},${q(l.videoUrl)},${qDate(l.createdAt)},${qDate(l.updatedAt)});`,
    );
  }

  const posts = await prisma.blogPost.findMany({ where: { organizationId } });
  for (const p of posts) {
    lines.push(
      `INSERT INTO ${bt("BlogPost")} (${bt("id")},${bt("organizationId")},${bt("slug")},${bt("title")},${bt("excerpt")},${bt("body")},${bt("published")},${bt("authorId")},${bt("createdAt")},${bt("updatedAt")}) VALUES (${q(p.id)},${q(p.organizationId)},${q(p.slug)},${q(p.title)},${q(p.excerpt)},${q(p.body)},${qBool(p.published)},${q(p.authorId)},${qDate(p.createdAt)},${qDate(p.updatedAt)});`,
    );
  }

  const resources = await prisma.learningResource.findMany({ where: { organizationId } });
  for (const r of resources) {
    lines.push(
      `INSERT INTO ${bt("LearningResource")} (${bt("id")},${bt("organizationId")},${bt("title")},${bt("description")},${bt("kind")},${bt("externalUrl")},${bt("storageKey")},${bt("mimeType")},${bt("sortOrder")},${bt("published")},${bt("createdAt")},${bt("updatedAt")}) VALUES (${q(r.id)},${q(r.organizationId)},${q(r.title)},${q(r.description)},${qEnum(r.kind)},${q(r.externalUrl)},${q(r.storageKey)},${q(r.mimeType)},${r.sortOrder},${qBool(r.published)},${qDate(r.createdAt)},${qDate(r.updatedAt)});`,
    );
  }

  const wall = await prisma.organizationMessage.findMany({ where: { organizationId } });
  for (const w of wall) {
    lines.push(
      `INSERT INTO ${bt("OrganizationMessage")} (${bt("id")},${bt("organizationId")},${bt("senderKind")},${bt("userId")},${bt("platformEmail")},${bt("body")},${bt("createdAt")}) VALUES (${q(w.id)},${q(w.organizationId)},${qEnum(w.senderKind)},${w.userId ? q(w.userId) : "NULL"},${q(w.platformEmail)},${q(w.body)},${qDate(w.createdAt)});`,
    );
  }

  lines.push("COMMIT;");
  return lines.join("\n");
}
