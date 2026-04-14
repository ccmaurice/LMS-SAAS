import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { MobileAppDownload } from "@/components/marketing/mobile-app-download";
import { Skeleton } from "@/components/ui/skeleton";

function LoginSkeleton() {
  return (
    <div className="surface-glass space-y-4 p-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-full max-w-xs" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

function envFlagDisabled(v: string | undefined): boolean {
  if (!v?.trim()) return false;
  return ["1", "true", "yes"].includes(v.trim().toLowerCase());
}

export default function LoginPage() {
  const showDemoHint =
    process.env.NODE_ENV === "development" &&
    !envFlagDisabled(process.env.NEXT_PUBLIC_HIDE_DEMO_LOGIN_HINT);
  return (
    <>
      <Suspense fallback={<LoginSkeleton />}>
        <LoginForm showDemoHint={showDemoHint} />
      </Suspense>
      <MobileAppDownload compact />
    </>
  );
}
