import { prisma } from "@/lib/db";
import { requirePlatformOperator } from "@/lib/platform/api-guard";

export async function GET(req: Request, ctx: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await ctx.params;
  const { op, response } = await requirePlatformOperator();
  if (!op) return response!;

  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) {
    return new Response("Not found", { status: 404 });
  }

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
