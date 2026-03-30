import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import { BlogPostList, type BlogPostCard } from "@/components/blog/blog-post-list";

export default async function BlogListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  const org = await prisma.organization.findUnique({ where: { slug } });
  if (!org) notFound();

  const where = {
    organizationId: org.id,
    ...(isStaffRole(user.role) ? {} : { published: true }),
  };

  const postsRaw = await prisma.blogPost.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      published: true,
      updatedAt: true,
      author: { select: { name: true, email: true } },
    },
  });

  const posts: BlogPostCard[] = postsRaw.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    published: p.published,
    updatedAt: p.updatedAt.toISOString(),
    authorLabel: p.author.name ?? p.author.email,
  }));

  const base = `/o/${slug}/blog`;
  const staff = isStaffRole(user.role);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">News and updates from your school.</p>
        </div>
        {staff ? (
          <Link href={`${base}/new`} className={cn(buttonVariants())}>
            New post
          </Link>
        ) : null}
      </div>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No posts yet.{staff ? " Create the first one." : ""}</p>
      ) : (
        <BlogPostList base={base} posts={posts} showDraftBadges={staff} />
      )}
    </div>
  );
}
