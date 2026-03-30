import { Suspense } from "react";
import { PlatformLoginForm } from "@/components/platform/platform-login-form";
import { Skeleton } from "@/components/ui/skeleton";

function PlatformLoginSkeleton() {
  return (
    <div className="surface-glass w-full max-w-md space-y-6 p-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

export default function PlatformLoginPage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="pointer-events-none fixed inset-0 bg-app-mesh opacity-90 dark:opacity-100" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={<PlatformLoginSkeleton />}>
          <PlatformLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
