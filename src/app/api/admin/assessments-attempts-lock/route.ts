import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

/**
 * Org admin: lock or unlock **new** student attempts on every assessment in the school.
 * In-progress drafts can still be submitted (same rules as per-assessment lock).
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Only school admins can use this action." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const locked = Boolean((body as { locked?: boolean }).locked);

  const result = await prisma.assessment.updateMany({
    where: { course: { organizationId: user.organizationId } },
    data: { studentAttemptsLocked: locked },
  });

  return NextResponse.json({ ok: true, updated: result.count, locked });
}
