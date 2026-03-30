import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { BlogPostEditor } from "@/components/blog/blog-post-editor";

export default async function BlogNewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/blog`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">New blog post</h1>
      <BlogPostEditor slug={slug} />
    </div>
  );
}
