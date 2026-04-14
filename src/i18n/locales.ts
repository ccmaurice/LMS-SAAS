/** Full UI copy in `messages/{locale}.json` (merged over English for missing keys). */
export const UI_LOCALES = ["en", "fr", "es", "de", "it", "pt"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

export const LOCALE_COOKIE = "skilltech-locale";

export const LOCALE_LABELS: Record<UiLocale, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
};

export function isUiLocale(v: string): v is UiLocale {
  return (UI_LOCALES as readonly string[]).includes(v);
}

/** BCP 47 tags for `Intl` date/time formatting aligned with UI locale. */
export const UI_LOCALE_TO_BCP47: Record<UiLocale, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
};
