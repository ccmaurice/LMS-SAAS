import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  isSafeOrgPublicCardImageStoredValue,
  isSafeOrgPublicCardVideoStoredValue,
} from "@/lib/org/public-assets";
import { loadUpload } from "@/lib/uploads/storage";

function mimeImage(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function mimeVideo(key: string): string {
  return key.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4";
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const keyRaw = url.searchParams.get("key");
  if (!keyRaw || (type !== "image" && type !== "video")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let key: string;
  try {
    key = decodeURIComponent(keyRaw);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const org = await prisma.organization.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (type === "image") {
    if (!isSafeOrgPublicCardImageStoredValue(key, org.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  } else if (!isSafeOrgPublicCardVideoStoredValue(key, org.id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await loadUpload(key);
  if (!buf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const contentType = type === "image" ? mimeImage(key) : mimeVideo(key);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
