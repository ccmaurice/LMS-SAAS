import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSafeOrgAboutVideoStoredValue } from "@/lib/org/public-assets";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";
import { loadUpload } from "@/lib/uploads/storage";

const CMS_KEY = "school.public.about.videoUrl";

function mimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const row = await prisma.cmsEntry.findUnique({
    where: { organizationId_key: { organizationId: org.id, key: CMS_KEY } },
    select: { value: true },
  });
  const key = row?.value?.trim() ?? "";
  if (!key) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (/^https?:\/\//i.test(key)) {
    if (isBlobStoredRef(key)) {
      return NextResponse.redirect(key);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isSafeOrgAboutVideoStoredValue(key, org.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await loadUpload(key);
  if (!buf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mimeFromKey(key),
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
