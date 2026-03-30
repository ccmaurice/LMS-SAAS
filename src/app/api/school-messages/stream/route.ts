import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

/** SSE: poll for new school messages (same pattern as course chat). */
export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const orgId = user.organizationId;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const tick = async () => {
        try {
          const count = await prisma.organizationMessage.count({ where: { organizationId: orgId } });
          const latest = await prisma.organizationMessage.findFirst({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
            select: { id: true, createdAt: true },
          });
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ count, latestId: latest?.id ?? null })}\n\n`),
          );
        } catch {
          controller.enqueue(encoder.encode(`data: {}\n\n`));
        }
      };

      void tick();
      const interval = setInterval(() => void tick(), 5000);

      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
