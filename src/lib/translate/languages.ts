/** ISO-style codes sent to translation providers (MyMemory / LibreTranslate). */
export type LangCode = string;

export type LanguageOption = {
  code: LangCode;
  label: string;
};

/** Source/target dropdown options (10+ languages). */
export const TRANSLATION_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ja", label: "Japanese" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "nl", label: "Dutch" },
  { code: "pl", label: "Polish" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "sv", label: "Swedish" },
];

const ALLOWED = new Set(TRANSLATION_LANGUAGES.map((l) => l.code));

export function isAllowedLanguage(code: string): boolean {
  return ALLOWED.has(code);
}
