import type { UiLocale } from "@/i18n/locales";
import en from "./en.json";
import fr from "./fr.json";

const frMerged: Record<string, string> = { ...en, ...fr };

const bundles: Record<UiLocale, Record<string, string>> = {
  en,
  fr: frMerged,
  es: en,
  de: en,
  it: en,
  pt: en,
};

export function translate(locale: UiLocale, key: string): string {
  const b = bundles[locale] ?? bundles.en;
  const v = b[key];
  if (typeof v === "string") return v;
  const fb = bundles.en[key];
  return typeof fb === "string" ? fb : key;
}
