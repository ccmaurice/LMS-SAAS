import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidJsonResponse, messageErrorResponse } from "@/lib/api/api-json";
import { checkRateLimit, getRequestIp } from "@/lib/api/rate-limit";
import { isAllowedLanguage } from "@/lib/translate/languages";
import { translateText } from "@/lib/translate/providers";

const bodySchema = z.object({
  text: z.string().min(1, "Enter text to translate.").max(5000, "Text is too long (max 5000 characters)."),
  source: z.string().min(2).max(12).default("en"),
  target: z.string().min(2).max(12),
});

export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const limited = checkRateLimit(`translate:${ip}`, 40, 15 * 60 * 1000);
  if (!limited.ok) return limited.response;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return invalidJsonResponse();
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg = [first.text?.[0], first.target?.[0], first.source?.[0]].find(Boolean);
    return messageErrorResponse(msg ?? "Invalid request", 400);
  }

  const { text, source, target } = parsed.data;
  if (!isAllowedLanguage(source)) {
    return messageErrorResponse("Unsupported source language.", 400);
  }
  if (!isAllowedLanguage(target)) {
    return messageErrorResponse("Unsupported target language.", 400);
  }

  const result = await translateText(text.trim(), source, target);
  if (!result.ok) {
    if (process.env.NODE_ENV === "development") {
      console.error("[translate]", result.error);
    }
    const status = result.status && result.status >= 400 && result.status < 600 ? result.status : 502;
    const userMsg = result.exposeToClient
      ? result.error
      : status === 429
        ? "Translation service is busy or rate-limited. Please try again in a minute."
        : "Translation failed. Please try again.";
    return NextResponse.json(
      {
        error: userMsg,
        ...(process.env.NODE_ENV === "development" && !result.exposeToClient ? { detail: result.error } : {}),
      },
      { status },
    );
  }

  return NextResponse.json({
    translatedText: result.text,
    provider: result.provider,
  });
}
