import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const post = await prisma.blogPost.findFirst({
    where: { organizationId: user.organizationId, slug: postSlug },
    include: { author: { select: { name: true, email: true } } },
  });

  if (!post) notFound();
  if (!post.published && !isStaffRole(user.role)) notFound();

  const base = `/o/${slug}/blog`;

  return (
    <article className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link href={base} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}>
          ← All posts
        </Link>
        {isStaffRole(user.role) ? (
          <Link href={`/o/${slug}/blog/edit/${post.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Edit
          </Link>
        ) : null}
      </div>

      <div className="surface-bento p-8">
        <header className="space-y-2 border-b border-border/80 pb-6 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{post.title}</h1>
            {!post.published ? <Badge variant="secondary">Draft</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {post.author.name ?? post.author.email} · {post.updatedAt.toLocaleDateString(undefined, { dateStyle: "long" })}
          </p>
        </header>

        <div className="mt-6 max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground">{post.body}</div>
      </div>
    </article>
  );
}
