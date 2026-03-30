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
        <h1 className="text-2xl font-semibold tracking-tight">Learning resource library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Central PDFs, videos, and links for your organization.{isStaffRole(user.role) ? " Staff can upload and curate." : ""}
        </p>
      </div>
      <LibraryPanel canManage={isStaffRole(user.role)} />
    </div>
  );
}
