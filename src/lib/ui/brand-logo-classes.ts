/**
 * Tailwind classes so black-on-transparent brand marks stay visible on dark backgrounds.
 * Uses brightness(0) + invert in `.dark` only, plus a soft light glow for separation from gradients.
 *
 * Full-color or photo logos may look wrong when inverted — use a dedicated dark-mode asset later
 * or skip these classes at the call site.
 */
export const BRAND_LOGO_MONOCHROME_DARK_CLASSES =
  "dark:brightness-0 dark:invert dark:drop-shadow-[0_0_14px_rgba(255,255,255,0.4)]";

/** Hero-style centered logos (school public page, platform landing). */
export const HERO_BRAND_LOGO_IMG_CLASSES = [
  "max-h-20 w-auto max-w-[min(100%,280px)] object-contain drop-shadow-md md:max-h-24",
  BRAND_LOGO_MONOCHROME_DARK_CLASSES,
  "print:filter-none",
].join(" ");
