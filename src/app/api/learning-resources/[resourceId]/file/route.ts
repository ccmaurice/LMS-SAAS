import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canViewLearningResource } from "@/lib/learning-resources/access";
import { loadUpload } from "@/lib/uploads/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const ok = await canViewLearningResource(user, resourceId);
  if (!ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await prisma.learningResource.findFirst({
    where: { id: resourceId, organizationId: user.organizationId },
  });
  if (!row?.storageKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await loadUpload(row.storageKey);
  if (!buf) {
    return NextResponse.json({ error: "File missing on disk" }, { status: 404 });
  }

  const mime = row.mimeType || "application/octet-stream";
  const inline = mime.startsWith("video/") || mime === "application/pdf";
  const asciiName = row.title.replace(/[^\x20-\x7E]/g, "_") || "resource";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
