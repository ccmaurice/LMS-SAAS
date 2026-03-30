import { NextResponse } from "next/server";
import { getPlatformOperator } from "@/lib/platform/session";
import { platformAvatarDisplayUrl } from "@/lib/profile/avatar-url";

export async function GET() {
  const op = await getPlatformOperator();
  if (!op) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    email: op.email,
    image: op.image,
    imageUrl: platformAvatarDisplayUrl(op.image),
  });
}
