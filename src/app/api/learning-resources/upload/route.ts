import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import type { LearningResourceKind } from "@/generated/prisma/enums";
import { bufferMatchesDeclaredMime } from "@/lib/uploads/file-sniff";
import { sanitizeDownloadBasename } from "@/lib/uploads/filename";
import { MAX_LESSON_UPLOAD_BYTES } from "@/lib/uploads/root";
import { removeUpload, saveUpload } from "@/lib/uploads/storage";

const metaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  kind: z.enum(["PDF", "VIDEO", "OTHER"]),
});

const ALLOWED = new Set([
  "application/pdf",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/octet-stream",
]);

function extMime(ext: string): string {
  const m: Record<string, string> = {
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
  };
  return m[ext] ?? "";
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN", "TEACHER"]);
  if (forbidden) return forbidden;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const metaRaw = form.get("meta");
  if (typeof metaRaw !== "string") {
    return NextResponse.json({ error: "Missing meta JSON" }, { status: 400 });
  }

  let meta: unknown;
  try {
    meta = JSON.parse(metaRaw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid meta JSON" }, { status: 400 });
  }

  const parsed = metaSchema.safeParse(meta);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (file.size > MAX_LESSON_UPLOAD_BYTES * 2) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  const rawName = typeof (file as File).name === "string" ? (file as File).name : "file";
  const displayName = sanitizeDownloadBasename(rawName, "file");
  const i = displayName.lastIndexOf(".");
  const ext = i >= 0 ? displayName.slice(i).toLowerCase() : "";
  let mime = file.type || extMime(ext);
  if (mime === "application/octet-stream") {
    mime = extMime(ext) || mime;
  }
  if (!ALLOWED.has(mime)) {
    return NextResponse.json({ error: "File type not allowed for library upload" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!bufferMatchesDeclaredMime(buffer, mime)) {
    return NextResponse.json({ error: "File content does not match its type" }, { status: 400 });
  }
  const id = randomUUID();
  const safeStem = sanitizeDownloadBasename(displayName.replace(/\.[^.]+$/, ""), "resource");
  const relKey = `${user.organizationId}/lib/${id}_${safeStem}${ext}`;

  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store file" }, { status: 500 });
  }

  const kindMap: Record<string, LearningResourceKind> = {
    PDF: "PDF",
    VIDEO: "VIDEO",
    OTHER: "OTHER",
  };

  try {
    const resource = await prisma.learningResource.create({
      data: {
        id,
        organizationId: user.organizationId,
        title: parsed.data.title.trim(),
        description: parsed.data.description?.trim() || null,
        kind: kindMap[parsed.data.kind] ?? "OTHER",
        storageKey: storedRef,
        mimeType: mime,
        published: true,
        createdById: user.id,
      },
      select: { id: true, title: true, kind: true },
    });
    return NextResponse.json({ resource });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not save resource" }, { status: 500 });
  }
}
