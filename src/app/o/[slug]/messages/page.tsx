import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { MessagesHub } from "@/components/messages/messages-hub";

export default async function MessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>Direct messages</strong> follow role rules: students with classmates, their course teachers, and
          org admins; teachers with other teachers, admins, and students in their courses; admins with all teachers
          and students. The <strong>school wall</strong> is still available for organization-wide announcements.
        </p>
      </div>
      <MessagesHub />
    </div>
  );
}
