import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { extForAvatarMime } from "@/lib/profile/avatar-storage";
import {
  MAX_ABOUT_VIDEO_BYTES,
  MAX_ORG_HERO_BYTES,
  extForAboutVideoMime,
  isSafeOrgAboutVideoStoredValue,
  isSafeOrgCmsHeroStoredValue,
  orgAboutVideoStorageKey,
  orgCmsHeroStorageKey,
  orgPublicCardImageStorageKey,
  orgPublicCardVideoStorageKey,
} from "@/lib/org/public-assets";
import { removeUpload, saveUpload } from "@/lib/uploads/storage";

const CMS_HERO_KEY = "school.public.hero.imageUrl";
const ABOUT_VIDEO_KEY = "school.public.about.videoUrl";

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

  const kind = String(form.get("kind") ?? "");
  const allowed = ["cmsHero", "aboutVideo", "publicCardImage", "publicCardVideo"] as const;
  if (!allowed.includes(kind as (typeof allowed)[number])) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const orgId = user.organizationId;
  const slug = user.organization.slug;

  if (kind === "publicCardImage") {
    if (file.size > MAX_ORG_HERO_BYTES) {
      return NextResponse.json({ error: "Image must be 8 MB or smaller" }, { status: 400 });
    }
    const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
    const ext = extForAvatarMime(mime);
    if (!ext) {
      return NextResponse.json({ error: "Use JPEG, PNG, WebP, or GIF" }, { status: 400 });
    }
    const relKey = orgPublicCardImageStorageKey(orgId, ext);
    const buffer = Buffer.from(await file.arrayBuffer());
    let storedRef: string;
    try {
      storedRef = await saveUpload(relKey, buffer, mime);
    } catch {
      return NextResponse.json({ error: "Could not store image" }, { status: 500 });
    }
    return NextResponse.json({
      value: storedRef,
      previewUrl: `/api/public/organizations/${slug}/card-media?type=image&key=${encodeURIComponent(storedRef)}`,
    });
  }

  if (kind === "publicCardVideo") {
    if (file.size > MAX_ABOUT_VIDEO_BYTES) {
      return NextResponse.json({ error: "Video must be 45 MB or smaller" }, { status: 400 });
    }
    const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
    const ext = extForAboutVideoMime(mime);
    if (!ext) {
      return NextResponse.json({ error: "Use MP4 or WebM" }, { status: 400 });
    }
    const relKey = orgPublicCardVideoStorageKey(orgId, ext);
    const buffer = Buffer.from(await file.arrayBuffer());
    let storedRef: string;
    try {
      storedRef = await saveUpload(relKey, buffer, mime);
    } catch {
      return NextResponse.json({ error: "Could not store video" }, { status: 500 });
    }
    return NextResponse.json({
      value: storedRef,
      previewUrl: `/api/public/organizations/${slug}/card-media?type=video&key=${encodeURIComponent(storedRef)}`,
    });
  }

  if (kind === "cmsHero") {
    if (file.size > MAX_ORG_HERO_BYTES) {
      return NextResponse.json({ error: "Image must be 8 MB or smaller" }, { status: 400 });
    }
    const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
    const ext = extForAvatarMime(mime);
    if (!ext) {
      return NextResponse.json({ error: "Use JPEG, PNG, WebP, or GIF" }, { status: 400 });
    }

    const prev = await prisma.cmsEntry.findUnique({
      where: { organizationId_key: { organizationId: orgId, key: CMS_HERO_KEY } },
      select: { value: true },
    });
    if (prev?.value && isSafeOrgCmsHeroStoredValue(prev.value, orgId)) {
      await removeUpload(prev.value);
    }

    const relKey = orgCmsHeroStorageKey(orgId, ext);
    const buffer = Buffer.from(await file.arrayBuffer());
    let storedRef: string;
    try {
      storedRef = await saveUpload(relKey, buffer, mime);
    } catch {
      return NextResponse.json({ error: "Could not store image" }, { status: 500 });
    }

    try {
      await prisma.cmsEntry.upsert({
        where: { organizationId_key: { organizationId: orgId, key: CMS_HERO_KEY } },
        create: { organizationId: orgId, key: CMS_HERO_KEY, value: storedRef },
        update: { value: storedRef },
        select: { value: true },
      });
    } catch {
      await removeUpload(storedRef);
      return NextResponse.json({ error: "Could not save CMS entry" }, { status: 500 });
    }

    return NextResponse.json({
      key: CMS_HERO_KEY,
      value: storedRef,
      previewUrl: `/api/public/organizations/${user.organization.slug}/cms-hero`,
    });
  }

  if (file.size > MAX_ABOUT_VIDEO_BYTES) {
    return NextResponse.json({ error: "Video must be 45 MB or smaller" }, { status: 400 });
  }
  const mime = (file.type || "").toLowerCase().split(";")[0]!.trim();
  const ext = extForAboutVideoMime(mime);
  if (!ext) {
    return NextResponse.json({ error: "Use MP4 or WebM" }, { status: 400 });
  }

  const prev = await prisma.cmsEntry.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: ABOUT_VIDEO_KEY } },
    select: { value: true },
  });
  if (prev?.value && isSafeOrgAboutVideoStoredValue(prev.value, orgId)) {
    await removeUpload(prev.value);
  }

  const relKey = orgAboutVideoStorageKey(orgId, ext);
  const buffer = Buffer.from(await file.arrayBuffer());
  let storedRef: string;
  try {
    storedRef = await saveUpload(relKey, buffer, mime);
  } catch {
    return NextResponse.json({ error: "Could not store video" }, { status: 500 });
  }

  try {
    await prisma.cmsEntry.upsert({
      where: { organizationId_key: { organizationId: orgId, key: ABOUT_VIDEO_KEY } },
      create: { organizationId: orgId, key: ABOUT_VIDEO_KEY, value: storedRef },
      update: { value: storedRef },
      select: { value: true },
    });
  } catch {
    await removeUpload(storedRef);
    return NextResponse.json({ error: "Could not save CMS entry" }, { status: 500 });
  }

  return NextResponse.json({
    key: ABOUT_VIDEO_KEY,
    value: storedRef,
    previewUrl: `/api/public/organizations/${user.organization.slug}/about-video`,
  });
}
