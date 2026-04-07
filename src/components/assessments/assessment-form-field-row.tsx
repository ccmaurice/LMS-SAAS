import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AssessmentFormFieldRow({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border/70 py-5 last:border-b-0 sm:flex-row sm:items-start sm:gap-10",
        className,
      )}
    >
      <div className="shrink-0 sm:w-40 sm:pt-2.5">
        <span className="text-sm font-medium text-foreground">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
