import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Premium Ivy-League style certificate frame:
 * - Thick brand-colored outer border with stepped corners
 * - Subtly textured background with a golden security guilloche pattern
 * - Symmetrical golden accent rules and elegant corner diamond decorations
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
    <div
      className={cn(
        "certificate-ornate-frame relative w-full border border-[#D4AF37]/35 shadow-2xl rounded-lg overflow-hidden",
        "bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#FAF9F6] via-[#FAF8F4] to-[#F1EAE0]",
        className
      )}
    >
      <svg
        className="certificate-border-svg pointer-events-none absolute inset-0 size-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 700"
        preserveAspectRatio="none"
        aria-hidden
      >
        <title>Certificate border</title>
        <defs>
          {/* Subtle security wave pattern */}
          <pattern id="cert-watermark" width="60" height="60" patternUnits="userSpaceOnUse">
            <path
              d="M 0 30 Q 15 10, 30 30 T 60 30"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="0.25"
              opacity="0.08"
            />
            <path
              d="M 0 30 Q 15 50, 30 30 T 60 30"
              fill="none"
              stroke="#D4AF37"
              strokeWidth="0.25"
              opacity="0.08"
            />
          </pattern>
        </defs>

        {/* Solid cream background to ensure it prints even when "Background graphics" is disabled */}
        <rect width="1000" height="700" fill="#FAF9F6" />

        {/* Textured background */}
        <rect width="1000" height="700" fill="url(#cert-watermark)" />

        {/* Outer brand-colored border */}
        <g fill="none" stroke={ink}>
          <path
            strokeLinejoin="miter"
            strokeMiterlimit={8}
            strokeWidth={6}
            vectorEffect="nonScalingStroke"
            d="M 24 8 L 976 8 L 976 24 L 992 24 L 992 676 L 976 676 L 976 692 L 24 692 L 24 676 L 8 676 L 8 24 L 24 24 Z"
            opacity="0.9"
          />
        </g>

        {/* Golden inner hairlines & corners */}
        <g fill="none" stroke="#D4AF37">
          {/* Hairline 1 */}
          <rect
            x={36}
            y={36}
            width={928}
            height={628}
            strokeWidth={1}
            vectorEffect="nonScalingStroke"
            opacity="0.75"
          />
          {/* Hairline 2 */}
          <rect
            x={42}
            y={42}
            width={916}
            height={616}
            strokeWidth={1.5}
            vectorEffect="nonScalingStroke"
            opacity="0.85"
          />
          {/* Hairline 3 */}
          <rect
            x={48}
            y={48}
            width={904}
            height={604}
            strokeWidth={1}
            vectorEffect="nonScalingStroke"
            opacity="0.75"
          />

          {/* Corner Bracket Details */}
          {/* Top Left */}
          <path d="M 64 96 L 64 64 L 96 64" strokeWidth={1.5} vectorEffect="nonScalingStroke" opacity="0.85" />
          {/* Top Right */}
          <path d="M 936 96 L 936 64 L 904 64" strokeWidth={1.5} vectorEffect="nonScalingStroke" opacity="0.85" />
          {/* Bottom Left */}
          <path d="M 64 604 L 64 636 L 96 636" strokeWidth={1.5} vectorEffect="nonScalingStroke" opacity="0.85" />
          {/* Bottom Right */}
          <path d="M 936 604 L 936 636 L 904 636" strokeWidth={1.5} vectorEffect="nonScalingStroke" opacity="0.85" />
        </g>

        {/* Decorative corner diamond markers */}
        <g fill="#D4AF37" opacity="0.9">
          {/* Top Left */}
          <polygon points="80,80 85,75 90,80 85,85" />
          {/* Top Right */}
          <polygon points="920,80 925,75 930,80 925,85" />
          {/* Bottom Left */}
          <polygon points="80,620 85,615 90,620 85,625" />
          {/* Bottom Right */}
          <polygon points="920,620 925,615 930,620 925,625" />
        </g>
      </svg>
      {/* Padding aligned to innermost line + comfortable content inset */}
      <div className="relative z-10 px-[min(8%,3.25rem)] py-[min(7%,2.75rem)] pb-[min(8%,3rem)] pt-[min(9%,3.25rem)] sm:px-[min(9%,3.75rem)] sm:py-[min(8%,3.25rem)] sm:pb-[min(9%,3.25rem)] sm:pt-[min(10%,3.75rem)] print:px-12 print:pb-10 print:pt-12">
        {children}
      </div>
    </div>
  );
}
