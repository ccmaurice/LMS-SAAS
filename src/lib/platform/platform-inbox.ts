import { prisma } from "@/lib/db";

export async function notifyPlatformNewSchoolPending(args: {
  organizationId: string;
  name: string;
  slug: string;
}) {
  await prisma.platformNotification.create({
    data: {
      type: "school_pending",
      title: "New school pending approval",
      body: `${args.name} (${args.slug}) is waiting for you to approve or reject it.`,
      link: `/platform/orgs/${args.organizationId}`,
    },
  });
}

export async function notifyPlatformSchoolDecided(args: {
  type: "school_approved" | "school_rejected";
  title: string;
  body: string;
  link?: string | null;
}) {
  await prisma.platformNotification.create({
    data: {
      type: args.type,
      title: args.title,
      body: args.body,
      link: args.link ?? null,
    },
  });
}
