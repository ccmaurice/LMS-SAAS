import { cookies } from "next/headers";
import { lookupMessage } from "@/i18n/messages";
import { isUiLocale, LOCALE_COOKIE, type UiLocale } from "@/i18n/locales";

/** UI locale from `skilltech-locale` cookie (for server components / RSC). */
export async function getRequestLocale(): Promise<UiLocale> {
  const store = await cookies();
  const raw = store.get(LOCALE_COOKIE)?.value ?? "";
  return isUiLocale(raw) ? raw : "en";
}

/** Dictionary lookup bound to the request locale (for server components). */
export async function getServerT(): Promise<(key: string) => string> {
  const locale = await getRequestLocale();
  return (key: string) => lookupMessage(locale, key);
}
