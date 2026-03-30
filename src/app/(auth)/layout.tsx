export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-full flex-1 flex-col items-center justify-center bg-canvas px-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-app-mesh opacity-80 dark:opacity-100" aria-hidden />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </div>
  );
}
