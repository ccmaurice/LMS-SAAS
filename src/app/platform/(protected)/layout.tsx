import { redirect } from "next/navigation";
import { PlatformHeaderTitles } from "@/components/platform/platform-header-titles";
import { PlatformHeaderToolbar } from "@/components/platform/platform-header-toolbar";
import { PlatformAvatar } from "@/components/profile/platform-avatar";
import { getPlatformOperator } from "@/lib/platform/session";

export default async function PlatformProtectedLayout({ children }: { children: React.ReactNode }) {
  const op = await getPlatformOperator();
  if (!op) {
    redirect("/platform/login");
  }

  return (
    <div className="relative min-h-full flex-1">
      <div className="pointer-events-none fixed inset-0 bg-app-mesh opacity-90 dark:opacity-100" aria-hidden />
      <div className="relative z-10 flex min-h-full flex-col">
        <header className="relative z-30 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background/70 px-4 py-3 backdrop-blur-md dark:border-white/10 dark:bg-background/50 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <PlatformAvatar email={op.email} image={op.image} size={40} />
            <PlatformHeaderTitles email={op.email} />
          </div>
          <PlatformHeaderToolbar />
        </header>
        <main className="relative z-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
