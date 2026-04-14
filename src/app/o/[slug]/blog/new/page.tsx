import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { getServerT } from "@/i18n/server";
import { BlogPostEditor } from "@/components/blog/blog-post-editor";

export default async function BlogNewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const t = await getServerT();
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");
  if (!isStaffRole(user.role)) redirect(`/o/${slug}/blog`);

  return (
    <div className="space-y-6">
      <h1 className="page-title">{t("orgPages.blog.newTitle")}</h1>
      <BlogPostEditor slug={slug} />
    </div>
  );
}
