/**
 * Server-only translation providers: LibreTranslate-compatible API (optional) + MyMemory fallback.
 * Keys stay on the server; never expose third-party keys to the client.
 */

/** GET URL length stays safe for serverless; longer text needs LibreTranslate (POST). */
const MYMEMORY_MAX_CHARS = 2500;

function libreTargetCode(code: string): string {
  if (code === "zh-CN") return "zh";
  return code;
}

function libreSourceCode(code: string): string {
  return libreTargetCode(code);
}

export type TranslateOk = { ok: true; text: string; provider: "libretranslate" | "mymemory" };
export type TranslateErr = {
  ok: false;
  error: string;
  status?: number;
  /** When true, API route may return this message to the client (safe, no secrets). */
  exposeToClient?: boolean;
};

export async function translateWithLibreTranslate(
  baseUrl: string,
  text: string,
  source: string,
  target: string,
  apiKey?: string,
): Promise<TranslateOk | TranslateErr> {
  const url = `${baseUrl.replace(/\/$/, "")}/translate`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        q: text,
        source: libreSourceCode(source),
        target: libreTargetCode(target),
        format: "text",
        ...(apiKey ? { api_key: apiKey } : {}),
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        ok: false,
        error: errText.slice(0, 200) || `LibreTranslate HTTP ${res.status}`,
        status: res.status,
      };
    }
    const data = (await res.json()) as { translatedText?: string; error?: string };
    if (typeof data.translatedText === "string" && data.translatedText.length > 0) {
      return { ok: true, text: data.translatedText, provider: "libretranslate" };
    }
    if (typeof data.error === "string") {
      return { ok: false, error: data.error };
    }
    return { ok: false, error: "LibreTranslate returned an empty translation." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "LibreTranslate request failed";
    return { ok: false, error: msg };
  }
}

/** MyMemory expects zh-CN as Chinese pair; other codes usually match ISO 639-1. */
function myMemoryCode(code: string): string {
  return code;
}

export async function translateWithMyMemory(
  text: string,
  source: string,
  target: string,
  contactEmail?: string,
): Promise<TranslateOk | TranslateErr> {
  if (text.length > MYMEMORY_MAX_CHARS) {
    return {
      ok: false,
      error: `Text is too long for the free MyMemory endpoint (over ${MYMEMORY_MAX_CHARS} characters). Set LIBRETRANSLATE_API_URL for longer translations, or shorten the input.`,
      exposeToClient: true,
      status: 400,
    };
  }
  const pair = `${myMemoryCode(source)}|${myMemoryCode(target)}`;
  const params = new URLSearchParams({
    q: text,
    langpair: pair,
  });
  if (contactEmail?.includes("@")) {
    params.set("de", contactEmail.trim());
  }
  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      return { ok: false, error: `MyMemory HTTP ${res.status}`, status: res.status };
    }
    const data = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
    };
    const status = data.responseStatus;
    if (status && status !== 200) {
      return {
        ok: false,
        error: "MyMemory rate limit or quota exceeded. Try again later or configure LibreTranslate.",
        status: 429,
      };
    }
    const out = data.responseData?.translatedText;
    if (typeof out === "string" && out.length > 0) {
      return { ok: true, text: out, provider: "mymemory" };
    }
    return { ok: false, error: "MyMemory returned no translation." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MyMemory request failed";
    return { ok: false, error: msg };
  }
}

export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<TranslateOk | TranslateErr> {
  if (source === target) {
    return { ok: true, text, provider: "mymemory" };
  }

  const base = process.env.LIBRETRANSLATE_API_URL?.trim();
  const key = process.env.LIBRETRANSLATE_API_KEY?.trim();
  let libreError: string | undefined;
  if (base) {
    const libre = await translateWithLibreTranslate(base, text, source, target, key || undefined);
    if (libre.ok) return libre;
    libreError = libre.error;
  }

  if (text.length > MYMEMORY_MAX_CHARS) {
    return {
      ok: false,
      error:
        libreError ??
        `Text is over ${MYMEMORY_MAX_CHARS} characters. Set a working LIBRETRANSLATE_API_URL or shorten the input.`,
      exposeToClient: true,
      status: 400,
    };
  }

  const email = process.env.MYMEMORY_CONTACT_EMAIL?.trim();
  const mem = await translateWithMyMemory(text, source, target, email || undefined);
  if (mem.ok) return mem;
  return {
    ok: false,
    error: libreError ? `${mem.error} (LibreTranslate also failed: ${libreError})` : mem.error,
    status: mem.status,
  };
}
