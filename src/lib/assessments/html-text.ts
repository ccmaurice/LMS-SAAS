/**
 * Lightweight HTML → plain text for validation, auto-grading, and previews.
 * Not a full HTML parser; sufficient for rich-text fields produced by TipTap.
 */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikeHtml(s: string): boolean {
  const t = s.trim();
  if (!t) return false;
  return /^<[a-z][\s\S]*>/i.test(t);
}

export function isRichTextEmpty(html: string): boolean {
  return stripHtmlToPlainText(html).length === 0;
}

/** True if raw HTML may contain `$inline$` or `$$display$$` math markers (before client KaTeX pass). */
export function htmlContainsMathDelimiters(html: string): boolean {
  return /\$[^$\n]+\$|\$\$[\s\S]*?\$\$/.test(html);
}
