"use client";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export function CertificatePrintButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={cn(buttonVariants({ variant: "secondary" }), "text-sm", className)}
      onClick={() => window.print()}
    >
      Print / Save PDF
    </button>
  );
}
