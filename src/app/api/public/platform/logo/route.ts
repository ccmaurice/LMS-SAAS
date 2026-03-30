import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LANDING_KEY } from "@/lib/platform/landing-defaults";
import { isSafePlatformLogoStoredValue } from "@/lib/platform/logo-storage";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";
import { loadUpload } from "@/lib/uploads/storage";

function mimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET() {
  const row = await prisma.platformSetting.findUnique({
    where: { key: LANDING_KEY.logo },
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
  if (!isSafePlatformLogoStoredValue(key)) {
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
