import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ProfileAvatarEditor } from "@/components/profile/profile-avatar-editor";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user || user.organization.slug !== slug) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Profile for {user.email}</p>
      </div>
      <section className="surface-bento p-6">
        <h2 className="text-lg font-semibold tracking-tight">Profile</h2>
        <div className="mt-4 space-y-8">
          <ProfileAvatarEditor
            user={{
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            }}
          />
          <ProfileForm initialName={user.name} />
        </div>
      </section>
    </div>
  );
}
