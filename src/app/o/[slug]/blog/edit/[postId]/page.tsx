import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { BlogPostEditor } from "@/components/blog/blog-post-editor";

export default async function BlogEditPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/blog`);

  const post = await prisma.blogPost.findFirst({
    where: { id: postId, organizationId: user.organizationId },
  });
  if (!post) notFound();

  return (
    <div className="space-y-6">
      <h1 className="page-title">Edit post</h1>
      <BlogPostEditor
        slug={slug}
        postId={post.id}
        initial={{
          title: post.title,
          excerpt: post.excerpt ?? "",
          body: post.body,
          published: post.published,
        }}
      />
    </div>
  );
}
