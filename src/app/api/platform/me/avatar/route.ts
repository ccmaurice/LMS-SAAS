import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  MAX_AVATAR_BYTES,
  extForAvatarMime,
  isRemoteAvatarRef,
  isSafePlatformAvatarKey,
  platformAvatarStorageKey,
} from "@/lib/profile/avatar-storage";
import { requirePlatformOperator } from "@/lib/platform/api-guard";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";
import { loadUpload, removeUpload, saveUpload } from "@/lib/uploads/storage";

async function removePreviousPlatformAvatar(image: string | null, email: string) {
  if (!image) return;
  if (isRemoteAvatarRef(image) && !isBlobStoredRef(image)) return;
  if (!isRemoteAvatarRef(image) && !isSafePlatformAvatarKey(image, email)) return;
  await removeUpload(image);
}

function mimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET() {
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

  const profile = await prisma.platformProfile.findUnique({
    where: { email: op.email },
    select: { image: true },
  });
  const image = profile?.image ?? null;

  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isRemoteAvatarRef(image)) {
    return NextResponse.redirect(image);
  }

  if (!isSafePlatformAvatarKey(image, op.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await loadUpload(image);
  if (!buf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mimeFromKey(image),
      "Cache-Control": "private, max-age=3600",
    },
  });
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

  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: "Image must be 2 MB or smaller" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
  const ext = extForAvatarMime(mime);
  if (!ext) {
    return NextResponse.json({ error: "Use JPEG, PNG, WebP, or GIF" }, { status: 400 });
  }

  const relKey = platformAvatarStorageKey(op.email, ext);
  const buffer = Buffer.from(await file.arrayBuffer());

  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store image" }, { status: 500 });
  }

  const previous = await prisma.platformProfile.findUnique({
    where: { email: op.email },
    select: { image: true },
  });

  try {
    await prisma.platformProfile.upsert({
      where: { email: op.email },
      create: { email: op.email, image: storedRef },
      update: { image: storedRef },
    });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }

  await removePreviousPlatformAvatar(previous?.image ?? null, op.email);

  return NextResponse.json({
    image: storedRef,
    imageUrl: "/api/platform/me/avatar",
  });
}

export async function DELETE() {
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

  const profile = await prisma.platformProfile.findUnique({
    where: { email: op.email },
    select: { image: true },
  });

  await removePreviousPlatformAvatar(profile?.image ?? null, op.email);

  if (profile) {
    await prisma.platformProfile.update({
      where: { email: op.email },
      data: { image: null },
    });
  }

  return NextResponse.json({ ok: true });
}
