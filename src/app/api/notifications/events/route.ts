import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";

export async function GET(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response!;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const tick = async () => {
        try {
          const unreadCount = await prisma.notification.count({
            where: { userId: user.id, read: false },
          });
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ unreadCount })}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ unreadCount: -1 })}\n\n`));
        }
      };

      void tick();
      const interval = setInterval(() => void tick(), 12_000);

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
