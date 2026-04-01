import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { extForAvatarMime } from "@/lib/profile/avatar-storage";
import { blobStorageEnabled, removeUpload, saveUpload } from "@/lib/uploads/storage";
import { getUploadRoot } from "@/lib/uploads/root";
import { MAX_ORG_HERO_BYTES, orgLogoSettingPath } from "@/lib/org/public-assets";

async function unlinkOrgLogoVariants(root: string, orgId: string) {
  const dir = path.join(root, "orgs", orgId);
  try {
    const names = await fs.readdir(dir);
    for (const name of names) {
      if (name.startsWith("logo.") && /\.(jpe?g|png|webp|gif)$/i.test(name)) {
        await fs.unlink(path.join(dir, name));
      }
    }
  } catch {
    /* dir missing */
  }
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

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

  if (file.size > MAX_ORG_HERO_BYTES) {
    return NextResponse.json({ error: "Image must be 8 MB or smaller" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
  const ext = extForAvatarMime(mime);
  if (!ext) {
    return NextResponse.json({ error: "Use JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }

  const orgId = user.organizationId;
  const current = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { logoImageUrl: true },
  });
  const prev = current?.logoImageUrl?.trim();
  if (prev) {
    await removeUpload(prev);
  }
  if (!blobStorageEnabled()) {
    await unlinkOrgLogoVariants(getUploadRoot(), orgId);
  }

  const relKey = orgLogoSettingPath(orgId, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store image" }, { status: 500 });
  }

  try {
    await prisma.organization.update({
      where: { id: orgId },
      data: { logoImageUrl: storedRef },
    });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not update organization" }, { status: 500 });
  }

  return NextResponse.json({
    logoImageUrl: storedRef,
    previewUrl: `/api/public/organizations/${user.organization.slug}/logo`,
  });
}
