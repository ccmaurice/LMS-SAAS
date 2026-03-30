import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

export async function GET(req: Request, ctx: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const thread = await prisma.directMessageThread.findFirst({
    where: {
      id: threadId,
      organizationId: user.organizationId,
      OR: [{ participantLowId: user.id }, { participantHighId: user.id }],
    },
    select: { id: true },
  });

  if (!thread) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const tick = async () => {
        try {
          const count = await prisma.directMessage.count({ where: { threadId } });
          const latest = await prisma.directMessage.findFirst({
            where: { threadId },
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
