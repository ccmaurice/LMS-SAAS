import { NextResponse } from "next/server";
import { requireUser, requireRoles } from "@/lib/api/guard";
import { recomputeAndStorePromotionSnapshots } from "@/lib/grading/promotion-service";

export async function POST() {
  const { user, response } = await requireUser();
  if (!user) return response!;
  const forbidden = requireRoles(user, ["ADMIN"]);
  if (forbidden) return forbidden;

  const count = await recomputeAndStorePromotionSnapshots(user.organizationId);
  return NextResponse.json({ ok: true, studentsUpdated: count });
}
