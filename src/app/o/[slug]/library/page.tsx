import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { LibraryPanel } from "@/components/learning/library-panel";

export default async function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="page-title">Learning resource library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Central PDFs, videos, and links for your organization.
          {isStaffRole(user.role)
            ? user.role === "ADMIN"
              ? " Admins see all resources, including unpublished."
              : " Teachers can add items and edit or remove only what they uploaded; published items are visible to everyone."
            : ""}
        </p>
      </div>
      <LibraryPanel canManage={isStaffRole(user.role)} />
    </div>
  );
}
