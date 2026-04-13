"use client";

import { useCallback, useState } from "react";
import { ArrowLeftRight, Check, Copy, Languages, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TRANSLATION_LANGUAGES } from "@/lib/translate/languages";
import { cn } from "@/lib/utils";

const MAX_CHARS = 5000;

const selectClassName = cn(
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm shadow-sm outline-none",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
);

export function TranslationTool() {
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("fr");
  const [sourceText, setSourceText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);

  const charCount = sourceText.length;

  const translate = useCallback(async () => {
    setError(null);
    setDetail(null);
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setError("Enter some text to translate.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError(`Text must be at most ${MAX_CHARS} characters.`);
      return;
    }

    setLoading(true);
    setOutputText("");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: trimmed,
          source: sourceLang,
          target: targetLang,
        }),
      });
      const raw = await res.text();
      let data: { translatedText?: string; error?: string; detail?: string };
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {};
      } catch {
        setError("The server returned an unexpected response. Please try again.");
        return;
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Translation failed. Please try again.");
        if (typeof data.detail === "string") setDetail(data.detail);
        return;
      }
      if (typeof data.translatedText !== "string") {
        setError("Translation failed. Please try again.");
        return;
      }
      setOutputText(data.translatedText);
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [sourceLang, targetLang, sourceText]);

  const swapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setSourceText(outputText);
    setOutputText(sourceText);
    setError(null);
    setDetail(null);
  }, [sourceLang, targetLang, sourceText, outputText]);

  const copyOutput = useCallback(async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [outputText]);

  return (
    <Card className="mx-auto w-full max-w-3xl shadow-md">
      <CardHeader className="border-b border-foreground/10">
        <div className="flex items-center gap-2">
          <Languages className="size-5 text-muted-foreground" aria-hidden />
          <CardTitle className="text-lg">Translation</CardTitle>
        </div>
        <CardDescription>
          Translate text using a server-side API (LibreTranslate if configured, otherwise MyMemory). Source defaults to
          English; you can change both languages and swap them with the output.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 pt-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="translate-source-lang">From</Label>
            <select
              id="translate-source-lang"
              className={selectClassName}
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              disabled={loading}
            >
              {TRANSLATION_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="translate-target-lang">To</Label>
            <select
              id="translate-target-lang"
              className={selectClassName}
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              disabled={loading}
            >
              {TRANSLATION_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={translate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                Translating…
              </>
            ) : (
              "Translate"
            )}
          </Button>
          <Button type="button" variant="outline" onClick={swapLanguages} disabled={loading}>
            <ArrowLeftRight className="mr-2 size-4" aria-hidden />
            Swap
          </Button>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="translate-source">Source text</Label>
            <span
              className={cn(
                "text-xs tabular-nums text-muted-foreground",
                charCount > MAX_CHARS && "font-medium text-destructive",
              )}
            >
              {charCount} / {MAX_CHARS}
            </span>
          </div>
          <Textarea
            id="translate-source"
            rows={6}
            placeholder="Type or paste text here…"
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            disabled={loading}
            maxLength={MAX_CHARS}
            aria-invalid={charCount > MAX_CHARS}
          />
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="translate-output">Translation</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyOutput}
              disabled={!outputText || loading}
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 size-3.5" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 size-3.5" aria-hidden />
                  Copy
                </>
              )}
            </Button>
          </div>
          <Textarea
            id="translate-output"
            rows={6}
            readOnly
            placeholder={loading ? "Translating…" : "Translation will appear here."}
            value={outputText}
            className="bg-muted/40"
          />
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
            {detail ? (
              <p className="mt-1 font-mono text-xs text-destructive/90 opacity-90">{detail}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="border-t border-foreground/10 text-xs text-muted-foreground">
        To translate the whole app without any API key, use the <strong>globe</strong> button in the top bar (school /
        platform) or the floating <strong>Site language</strong> control on public pages (Google Translate). This box is
        for translating custom pasted text via the server (optional{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono">LIBRETRANSLATE_API_URL</code> for longer passages).
      </CardFooter>
    </Card>
  );
}
