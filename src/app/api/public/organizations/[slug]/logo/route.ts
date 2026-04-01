import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSafeOrgLogoSettingStoredValue } from "@/lib/org/public-assets";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";
import { loadUpload } from "@/lib/uploads/storage";

function mimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true, logoImageUrl: true },
  });
  if (!org?.logoImageUrl?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const key = org.logoImageUrl.trim();
  if (/^https?:\/\//i.test(key)) {
    if (isBlobStoredRef(key)) {
      return NextResponse.redirect(key);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!isSafeOrgLogoSettingStoredValue(key, org.id)) {
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
