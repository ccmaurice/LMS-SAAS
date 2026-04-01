import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/guard";

const bodySchema = z.object({
  assessmentId: z.string().min(1),
  clientDraftId: z.string().min(1).max(128),
  answers: z.record(z.string(), z.string()).optional(),
  updatedAt: z.string().optional(),
});

/**
 * Placeholder for idempotent offline sync. Client should use IndexedDB until this returns 202 with server id.
 */
export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  return NextResponse.json(
    {
      accepted: true,
      clientDraftId: parsed.data.clientDraftId,
      note: "Offline merge not persisted yet — open a draft submission via the standard submissions API when online.",
    },
    { status: 202 },
  );
}
