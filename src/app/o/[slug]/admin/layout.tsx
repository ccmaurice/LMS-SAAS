import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AdminSectionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?org=${encodeURIComponent(slug)}`);
  }
  if (user.role !== "ADMIN") {
    redirect(`/o/${slug}/dashboard`);
  }
  return children;
}
