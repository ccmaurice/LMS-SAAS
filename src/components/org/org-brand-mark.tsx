import { cn } from "@/lib/utils";
import { BRAND_LOGO_MONOCHROME_DARK_CLASSES } from "@/lib/ui/brand-logo-classes";

/** School logo from hero / CMS; decorative when a visible title is next to it. */
export function OrgBrandMark({
  url,
  className,
  size = "md",
  adaptMonochromeDarkMode = false,
}: {
  url: string | null | undefined;
  className?: string;
  /** md: header rows; sm: compact sidebar */
  size?: "sm" | "md" | "lg";
  /** In dark theme, invert black-on-transparent marks (see brand-logo-classes). */
  adaptMonochromeDarkMode?: boolean;
}) {
  if (!url?.trim()) return null;
  const sizeCls =
    size === "lg"
      ? "h-16 max-h-16"
      : size === "sm"
        ? "h-9 max-h-9"
        : "h-12 max-h-12";
  return (
    <img
      src={url}
      alt=""
      className={cn(
        "w-auto max-w-[220px] object-contain object-left",
        sizeCls,
        adaptMonochromeDarkMode ? BRAND_LOGO_MONOCHROME_DARK_CLASSES : null,
        "print:filter-none",
        className,
      )}
    />
  );
}
