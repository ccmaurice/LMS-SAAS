import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";
import { LANDING_KEY } from "@/lib/platform/landing-defaults";
import { MAX_PLATFORM_LOGO_BYTES, extForAvatarMime, platformLogoStorageKey } from "@/lib/platform/logo-storage";
import { blobStorageEnabled, removeUpload, saveUpload } from "@/lib/uploads/storage";
import { getUploadRoot } from "@/lib/uploads/root";

async function unlinkPlatformLogoFiles(root: string) {
  const dir = path.join(root, "platform", "landing");
  try {
    const names = await fs.readdir(dir);
    for (const name of names) {
      if (name.startsWith("logo.") && /\.(jpe?g|png|webp|gif)$/i.test(name)) {
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

  if (file.size > MAX_PLATFORM_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo must be 2 MB or smaller" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
  const ext = extForAvatarMime(mime);
  if (!ext) {
    return NextResponse.json({ error: "Use JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }

  const prevRow = await prisma.platformSetting.findUnique({
    where: { key: LANDING_KEY.logo },
    select: { value: true },
  });
  const prev = prevRow?.value?.trim();
  if (prev) {
    await removeUpload(prev);
  }
  if (!blobStorageEnabled()) {
    await unlinkPlatformLogoFiles(getUploadRoot());
  }

  const relKey = platformLogoStorageKey(ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store logo" }, { status: 500 });
  }

  try {
    await prisma.platformSetting.upsert({
      where: { key: LANDING_KEY.logo },
      create: { key: LANDING_KEY.logo, value: storedRef },
      update: { value: storedRef },
    });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not save setting" }, { status: 500 });
  }

  return NextResponse.json({
    logo: storedRef,
    previewUrl: "/api/public/platform/logo",
  });
}
