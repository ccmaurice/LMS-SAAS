import { cn } from "@/lib/utils";

const FONT =
  'ui-sans-serif, system-ui, "Segoe UI", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

/**
 * 文 (upper-left) + Latin A (lower-right) — matches common translate / language affordances.
 */
export function TranslateGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("size-4 shrink-0", className)}
      aria-hidden
    >
      <text
        x="1"
        y="11.5"
        fontSize="11"
        fontWeight={600}
        fontFamily={FONT}
        dominantBaseline="middle"
      >
        文
      </text>
      <text
        x="11.5"
        y="19"
        fontSize="9.5"
        fontWeight={700}
        fontFamily={FONT}
        dominantBaseline="middle"
      >
        A
      </text>
    </svg>
  );
}
