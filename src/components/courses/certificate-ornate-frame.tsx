import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Columbia-style certificate frame: thick outer border with stepped corners, white gutter,
 * and three inner hairline rules (SVG, non-scaling strokes for stable print/PDF).
 */
export function CertificateOrnateFrame({
  ink,
  children,
  className,
}: {
  ink: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("certificate-ornate-frame relative w-full bg-white", className)}>
      <svg
        className="pointer-events-none absolute inset-0 size-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 700"
        preserveAspectRatio="none"
        aria-hidden
      >
        <title>Certificate border</title>
        <g fill="none" stroke={ink}>
          <path
            strokeLinejoin="miter"
            strokeMiterlimit={8}
            strokeWidth={5}
            vectorEffect="nonScalingStroke"
            d="M 24 8 L 976 8 L 976 24 L 992 24 L 992 676 L 976 676 L 976 692 L 24 692 L 24 676 L 8 676 L 8 24 L 24 24 Z"
          />
          <rect
            x={40}
            y={40}
            width={920}
            height={620}
            strokeLinejoin="miter"
            strokeWidth={1}
            vectorEffect="nonScalingStroke"
          />
          <rect
            x={44}
            y={44}
            width={912}
            height={612}
            strokeLinejoin="miter"
            strokeWidth={1}
            vectorEffect="nonScalingStroke"
          />
          <rect
            x={48}
            y={48}
            width={904}
            height={604}
            strokeLinejoin="miter"
            strokeWidth={1}
            vectorEffect="nonScalingStroke"
          />
        </g>
      </svg>
      {/* Padding aligned to innermost line + comfortable content inset */}
      <div className="relative z-10 px-[min(8%,3.25rem)] py-[min(7%,2.75rem)] pb-[min(8%,3rem)] pt-[min(9%,3.25rem)] sm:px-[min(9%,3.75rem)] sm:py-[min(8%,3.25rem)] sm:pb-[min(9%,3.25rem)] sm:pt-[min(10%,3.75rem)] print:px-12 print:pb-10 print:pt-12">
        {children}
      </div>
    </div>
  );
}
