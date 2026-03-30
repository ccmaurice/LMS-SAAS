import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/guard";
import { listEligibleDmRecipients } from "@/lib/direct-messages/eligible";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const recipients = await listEligibleDmRecipients({
    id: user.id,
    role: user.role,
    organizationId: user.organizationId,
  });

  return NextResponse.json({ recipients });
}
