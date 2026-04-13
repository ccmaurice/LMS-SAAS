import type { UiLocale } from "@/i18n/locales";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import it from "./it.json";
import pt from "./pt.json";

function merge(base: Record<string, string>, override: Record<string, string>): Record<string, string> {
  return { ...base, ...override };
}

const bundles: Record<UiLocale, Record<string, string>> = {
  en,
  fr: merge(en, fr),
  es: merge(en, es),
  de: merge(en, de),
  it: merge(en, it),
  pt: merge(en, pt),
};

/** Resolve a UI string for the given locale (dictionary-based; not an external translation API). */
export function lookupMessage(locale: UiLocale, key: string): string {
  const b = bundles[locale] ?? bundles.en;
  const v = b[key];
  if (typeof v === "string") return v;
  const fb = bundles.en[key];
  return typeof fb === "string" ? fb : key;
}
