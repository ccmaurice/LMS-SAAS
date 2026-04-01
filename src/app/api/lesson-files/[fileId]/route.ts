import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canTeacherManageCourse } from "@/lib/courses/access";
import { canAccessLessonDownload, getLessonFileInOrg } from "@/lib/lesson-files/access";
import { loadUpload, removeUpload } from "@/lib/uploads/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const row = await getLessonFileInOrg(fileId, user.organizationId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const courseId = row.lesson.module.course.id;
  const ok = await canAccessLessonDownload(user, row.lessonId, courseId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (row.storageKey) {
    const buf = await loadUpload(row.storageKey);
    if (!buf) {
      return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
    }
    const asciiName = row.name.replace(/[^\x20-\x7E]/g, "_") || "download";
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": row.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asciiName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (row.url.startsWith("http://") || row.url.startsWith("https://")) {
    return NextResponse.redirect(row.url);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const row = await getLessonFileInOrg(fileId, user.organizationId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const createdById = row.lesson.module.course.createdById;
  if (!canTeacherManageCourse(user, createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.storageKey) {
    await removeUpload(row.storageKey);
  }

  await prisma.lessonFile.delete({ where: { id: fileId } });
  return NextResponse.json({ ok: true });
}
