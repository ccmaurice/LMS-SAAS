/** Safe CSS class fragment from org slug */
export function orgBrandClassSlug(slug: string): string {
  return slug.replace(/[^a-z0-9]/gi, "_").toLowerCase() || "org";
}

const TEMPLATES: Record<
  string,
  {
    light: { primary: string; ring: string; accent: string; fg: string };
    dark: { primary: string; ring: string; accent: string; fg: string };
  }
> = {
  SLATE: {
    light: { primary: "#334155", ring: "#64748b", accent: "#e2e8f0", fg: "#f8fafc" },
    dark: { primary: "#e2e8f0", ring: "#94a3b8", accent: "#334155", fg: "#0f172a" },
  },
  VIOLET: {
    light: { primary: "#5b21b6", ring: "#7c3aed", accent: "#ede9fe", fg: "#faf5ff" },
    dark: { primary: "#c4b5fd", ring: "#a78bfa", accent: "#4c1d95", fg: "#1e1b4b" },
  },
  EMERALD: {
    light: { primary: "#047857", ring: "#059669", accent: "#d1fae5", fg: "#ecfdf5" },
    dark: { primary: "#6ee7b7", ring: "#34d399", accent: "#064e3b", fg: "#022c22" },
  },
  ROSE: {
    light: { primary: "#be123c", ring: "#e11d48", accent: "#ffe4e6", fg: "#fff1f2" },
    dark: { primary: "#fda4af", ring: "#fb7185", accent: "#881337", fg: "#4c0519" },
  },
  AMBER: {
    light: { primary: "#b45309", ring: "#d97706", accent: "#fef3c7", fg: "#fffbeb" },
    dark: { primary: "#fcd34d", ring: "#fbbf24", accent: "#78350f", fg: "#451a03" },
  },
};

export const ORG_THEME_TEMPLATES = ["DEFAULT", "SLATE", "VIOLET", "EMERALD", "ROSE", "AMBER"] as const;
export type OrgThemeTemplate = (typeof ORG_THEME_TEMPLATES)[number];

export function isValidHex6(s: string | null | undefined): s is string {
  return typeof s === "string" && /^#[0-9A-Fa-f]{6}$/.test(s);
}

/** Relative luminance 0–1; rough threshold for readable text on background */
function pickFg(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? "#0f172a" : "#fafafa";
}

function lightenHex(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amount;
  let g = ((n >> 8) & 0xff) + amount;
  let b = (n & 0xff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/** Build scoped CSS for org accent colors. Returns null to use global defaults only. */
export function buildOrgBrandingCss(
  slug: string,
  template: string,
  customPrimaryHex: string | null,
  customAccentHex: string | null,
): string | null {
  const id = orgBrandClassSlug(slug);
  const customP = isValidHex6(customPrimaryHex) ? customPrimaryHex : null;
  const customA = isValidHex6(customAccentHex) ? customAccentHex : null;
  let preset = TEMPLATES[template] ?? null;
  if (!customP && !preset && customA) {
    preset = TEMPLATES.SLATE;
  }

  if (!customP && !customA && !preset) return null;

  const lightPrimary = customP ?? preset?.light.primary ?? null;
  const lightRing = customP ? lightenHex(customP, 40) : preset?.light.ring;
  const lightAccent = customA ?? preset?.light.accent ?? null;
  const lightFg = lightPrimary ? pickFg(lightPrimary) : preset?.light.fg;

  const darkPrimary = customP ? lightenHex(customP, 120) : preset?.dark.primary;
  const darkRing = customP ? lightenHex(customP, 100) : preset?.dark.ring;
  const darkAccent = customA ? lightenHex(customA, -40) : preset?.dark.accent;
  const darkFg = darkPrimary ? pickFg(darkPrimary) : preset?.dark.fg;

  if (!lightPrimary || !lightRing || !lightFg || !darkPrimary || !darkRing || !darkFg) return null;

  const lightAccentBlock = lightAccent
    ? `--accent: ${lightAccent}; --accent-foreground: ${pickFg(lightAccent)};`
    : "";
  const darkAccentBlock = darkAccent
    ? `--accent: ${darkAccent}; --accent-foreground: ${pickFg(darkAccent)};`
    : "";

  return `
.org-brand-${id} {
  --primary: ${lightPrimary};
  --primary-foreground: ${lightFg};
  --ring: ${lightRing};
  --glow-spot: ${lightRing};
  --sidebar-primary: ${lightPrimary};
  --sidebar-primary-foreground: ${lightFg};
  ${lightAccentBlock}
}
.dark .org-brand-${id} {
  --primary: ${darkPrimary};
  --primary-foreground: ${darkFg};
  --ring: ${darkRing};
  --glow-spot: ${darkRing};
  --sidebar-primary: ${darkPrimary};
  --sidebar-primary-foreground: ${darkFg};
  ${darkAccentBlock}
}
`.trim();
}
