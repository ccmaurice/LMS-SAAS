import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { canTeacherManageCourse, getLessonInOrganization } from "@/lib/courses/access";
import { sanitizeDownloadBasename } from "@/lib/uploads/filename";
import { MAX_LESSON_UPLOAD_BYTES } from "@/lib/uploads/root";
import { removeUpload, saveUpload } from "@/lib/uploads/storage";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
]);

function extFromName(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

const EXT_FALLBACK_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

export async function POST(req: Request, ctx: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  const lesson = await getLessonInOrganization(lessonId, user.organizationId);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canTeacherManageCourse(user, lesson.module.course.createdById)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_LESSON_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File too large (max ${MAX_LESSON_UPLOAD_BYTES / (1024 * 1024)} MB)` }, { status: 400 });
  }

  const rawName = typeof (file as File).name === "string" ? (file as File).name : "attachment";
  const displayName = sanitizeDownloadBasename(rawName, "attachment");
  let mime = file.type || "";
  if (!mime || mime === "application/octet-stream") {
    mime = EXT_FALLBACK_MIME[extFromName(displayName)] ?? "";
  }
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const id = randomUUID();
  const safeStem = sanitizeDownloadBasename(displayName.replace(/\.[^.]+$/, ""), "file");
  const ext = extFromName(displayName);
  const relKey = `${user.organizationId}/${id}_${safeStem}${ext}`;

  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store file" }, { status: 500 });
  }

  try {
    const row = await prisma.lessonFile.create({
      data: {
        id,
        lessonId,
        name: displayName,
        url: `/api/lesson-files/${id}`,
        mimeType: mime,
        storageKey: storedRef,
      },
    });
    return NextResponse.json({ file: row });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not save file record" }, { status: 500 });
  }
}
