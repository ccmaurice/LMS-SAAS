import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isStaffRole } from "@/lib/courses/access";
import { CourseCreateForm } from "@/components/courses/course-create-form";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default async function NewCoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }
  if (!isStaffRole(user.role)) {
    redirect(`/o/${slug}/courses`);
  }

  return (
    <div className="space-y-6">
      <Link href={`/o/${slug}/courses`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
        ← All courses
      </Link>
      <div>
        <h1 className="page-title">New course</h1>
        <p className="text-muted-foreground">You can add modules and lessons after creating the shell.</p>
      </div>
      <CourseCreateForm orgSlug={slug} />
    </div>
  );
}
