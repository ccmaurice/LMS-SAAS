import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { mergeOrganizationSettings, parseOrganizationSettings } from "@/lib/education_context";
import { extForAvatarMime } from "@/lib/profile/avatar-storage";
import {
  MAX_ORG_HERO_BYTES,
  isSafeOrgCertificateSignatureStoredValue,
  orgCertificateSignatureSettingPath,
} from "@/lib/org/public-assets";
import { blobStorageEnabled, removeUpload, saveUpload } from "@/lib/uploads/storage";
import { getUploadRoot } from "@/lib/uploads/root";

async function unlinkOrgSignatureVariants(root: string, orgId: string) {
  const dir = path.join(root, "orgs", orgId);
  try {
    const names = await fs.readdir(dir);
    for (const name of names) {
      if (name.startsWith("signature.") && /\.(jpe?g|png|webp|gif)$/i.test(name)) {
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
  const currentRow = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { organizationSettings: true },
  });
  const prev = parseOrganizationSettings(currentRow?.organizationSettings).certificateSignatureImageUrl?.trim();
  if (prev && isSafeOrgCertificateSignatureStoredValue(prev, orgId)) {
    await removeUpload(prev);
  }
  if (!blobStorageEnabled()) {
    await unlinkOrgSignatureVariants(getUploadRoot(), orgId);
  }

  const relKey = orgCertificateSignatureSettingPath(orgId, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store image" }, { status: 500 });
  }

  const merged = mergeOrganizationSettings(currentRow?.organizationSettings, {
    certificateSignatureImageUrl: storedRef,
  });

  try {
    await prisma.organization.update({
      where: { id: orgId },
      data: { organizationSettings: merged as Prisma.InputJsonValue },
    });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not update organization" }, { status: 500 });
  }

  return NextResponse.json({
    certificateSignatureImageUrl: storedRef,
    previewUrl: `/api/public/organizations/${user.organization.slug}/certificate-signature`,
  });
}
