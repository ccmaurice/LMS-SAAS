import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isRemoteAvatarRef, isSafeUserAvatarKey } from "@/lib/profile/avatar-storage";
import { loadUpload } from "@/lib/uploads/storage";

function mimeFromKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET(_req: Request, ctx: { params: Promise<{ userId: string }> }) {
  const { userId } = await ctx.params;
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, organizationId: viewer.organizationId },
    select: { image: true },
  });

  if (!target?.image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (isRemoteAvatarRef(target.image)) {
    return NextResponse.redirect(target.image);
  }

  if (!isSafeUserAvatarKey(target.image, userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = await loadUpload(target.image);
  if (!buf) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mimeFromKey(target.image),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
