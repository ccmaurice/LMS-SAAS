import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api/guard";
import { canAccessCourseChat } from "@/lib/learning-resources/access";

/** SSE: push latest message count for course chat (lightweight “live” layer). */
export async function GET(req: Request, ctx: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await ctx.params;
  const { user, response } = await requireUser();
  if (!user) return response!;

  const ok = await canAccessCourseChat(user, courseId);
  if (!ok) {
    return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const tick = async () => {
        try {
          const count = await prisma.courseChatMessage.count({ where: { courseId } });
          const latest = await prisma.courseChatMessage.findFirst({
            where: { courseId },
            orderBy: { createdAt: "desc" },
            select: { id: true, createdAt: true },
          });
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ count, latestId: latest?.id ?? null })}\n\n`,
            ),
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
