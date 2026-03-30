import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  MAX_AVATAR_BYTES,
  extForAvatarMime,
  isRemoteAvatarRef,
  isSafeUserAvatarKey,
  newAvatarFileId,
  userAvatarStorageKey,
} from "@/lib/profile/avatar-storage";
import { isBlobStoredRef } from "@/lib/uploads/blob-ref";
import { removeUpload, saveUpload } from "@/lib/uploads/storage";

async function removePreviousAvatar(image: string | null, userId: string) {
  if (!image) return;
  if (isRemoteAvatarRef(image) && !isBlobStoredRef(image)) return;
  if (!isRemoteAvatarRef(image) && !isSafeUserAvatarKey(image, userId)) return;
  await removeUpload(image);
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = newAvatarFileId();
  const relKey = userAvatarStorageKey(user.id, fileId, ext);

  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store image" }, { status: 500 });
  }

  const previous = user.image;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { image: storedRef },
    });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }

  await removePreviousAvatar(previous, user.id);

  return NextResponse.json({
    image: storedRef,
    imageUrl: `/api/users/${user.id}/avatar`,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await removePreviousAvatar(user.image, user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { image: null },
  });

  return NextResponse.json({ ok: true });
}
