import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/guard";
import { fetchDashboardCalendarItems } from "@/lib/calendar/dashboard-calendar";
import { prisma } from "@/lib/db";

const qSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

/** Calendar items visible to the signed-in user (school events + targeted assessments with dates). */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const parsed = qSchema.safeParse({ from, to });
  if (!parsed.success) {
    return NextResponse.json({ error: "from and to ISO datetimes required" }, { status: 400 });
  }
  const rangeStart = new Date(parsed.data.from);
  const rangeEnd = new Date(parsed.data.to);
  if (rangeEnd <= rangeStart || rangeEnd.getTime() - rangeStart.getTime() > 400 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Invalid range (max ~400 days)" }, { status: 400 });
  }

  const parentChildIds =
    user.role === "PARENT"
      ? (
          await prisma.parentStudentLink.findMany({
            where: { parentUserId: user.id, organizationId: user.organizationId },
            select: { studentUserId: true },
          })
        ).map((l) => l.studentUserId)
      : [];

  const items = await fetchDashboardCalendarItems({
    organizationId: user.organizationId,
    orgSlug: user.organization.slug,
    userId: user.id,
    role: user.role,
    parentChildIds,
    rangeStart,
    rangeEnd,
  });

  return NextResponse.json({ items });
}
