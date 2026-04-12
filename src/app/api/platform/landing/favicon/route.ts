import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";
import {
  MAX_PLATFORM_FAVICON_BYTES,
  extForFaviconMime,
  platformFaviconStorageKey,
} from "@/lib/platform/favicon-storage";
import { LANDING_KEY } from "@/lib/platform/landing-defaults";
import { blobStorageEnabled, removeUpload, saveUpload } from "@/lib/uploads/storage";
import { getUploadRoot } from "@/lib/uploads/root";

async function unlinkPlatformFaviconFiles(root: string) {
  const dir = path.join(root, "platform", "landing");
  try {
    const names = await fs.readdir(dir);
    for (const name of names) {
      if (name.startsWith("favicon.") && /\.(jpe?g|png|webp|gif|ico|svg)$/i.test(name)) {
        await fs.unlink(path.join(dir, name));
      }
    }
  } catch {
    /* missing */
  }
}

export async function POST(req: Request) {
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

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

  if (file.size > MAX_PLATFORM_FAVICON_BYTES) {
    return NextResponse.json({ error: "Favicon must be 512 KB or smaller" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
  const ext = extForFaviconMime(mime);
  if (!ext) {
    return NextResponse.json(
      { error: "Use PNG, JPEG, WebP, GIF, ICO, or SVG (square ~32–512 px works best in tabs)" },
      { status: 400 },
    );
  }

  const prevRow = await prisma.platformSetting.findUnique({
    where: { key: LANDING_KEY.favicon },
    select: { value: true },
  });
  const prev = prevRow?.value?.trim();
  if (prev) {
    await removeUpload(prev);
  }
  if (!blobStorageEnabled()) {
    await unlinkPlatformFaviconFiles(getUploadRoot());
  }

  const relKey = platformFaviconStorageKey(ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store favicon" }, { status: 500 });
  }

  try {
    await prisma.platformSetting.upsert({
      where: { key: LANDING_KEY.favicon },
      create: { key: LANDING_KEY.favicon, value: storedRef },
      update: { value: storedRef },
    });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not save setting" }, { status: 500 });
  }

  return NextResponse.json({
    favicon: storedRef,
    previewUrl: "/api/public/platform/favicon",
  });
}
