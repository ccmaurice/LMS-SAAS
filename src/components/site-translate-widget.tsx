"use client";

/**
 * Free whole-page translation via Google's website translator script.
 * No API key for you as the site owner — Google hosts the service (see their terms / privacy).
 * Works by setting the `googtrans` cookie and reloading so the script rewrites visible text.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Globe, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRANSLATION_LANGUAGES } from "@/lib/translate/languages";
import { cn } from "@/lib/utils";

const COOKIE = "googtrans";
const SCRIPT_ID = "google-translate-script";
const CB_NAME = "googleTranslateElementInit";

function setGoogTransCookie(targetCode: string | null) {
  const path = "/";
  const maxAgePast = "Thu, 01 Jan 1970 00:00:00 GMT";
  if (!targetCode) {
    document.cookie = `${COOKIE}=;path=${path};expires=${maxAgePast}`;
    const host = window.location.hostname;
    if (host && !host.startsWith("localhost")) {
      document.cookie = `${COOKIE}=;path=${path};domain=.${host};expires=${maxAgePast}`;
    }
    return;
  }
  const value = `/en/${targetCode}`;
  document.cookie = `${COOKIE}=${encodeURIComponent(value)};path=${path};max-age=31536000;SameSite=Lax`;
}

declare global {
  interface Window {
    [CB_NAME]?: () => void;
    google?: {
      translate: {
        TranslateElement: {
          new (
            options: {
              pageLanguage: string;
              includedLanguages: string;
              layout?: number;
              autoDisplay?: boolean;
            },
            containerId: string,
          ): unknown;
          InlineLayout: { SIMPLE: number };
        };
      };
    };
  }
}

export function SiteTranslateWidget() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    function initGoogleTranslate() {
      if (!mounted.current) return;
      if (!window.google?.translate?.TranslateElement) return;
      const mount = document.getElementById("google_translate_element");
      if (!mount) return;
      mount.innerHTML = "";
      try {
        const { TranslateElement } = window.google.translate;
        new TranslateElement(
          {
            pageLanguage: "en",
            includedLanguages: TRANSLATION_LANGUAGES.map((l) => l.code).filter((c) => c !== "en").join(","),
            layout: TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          "google_translate_element",
        );
        setReady(true);
      } catch {
        setReady(false);
      }
    }

    window[CB_NAME] = initGoogleTranslate;

    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.async = true;
      s.src = `https://translate.google.com/translate_a/element.js?cb=${CB_NAME}`;
      document.body.appendChild(s);
    } else if (window.google?.translate?.TranslateElement) {
      queueMicrotask(initGoogleTranslate);
    }

    return () => {
      mounted.current = false;
    };
  }, []);

  const pickLanguage = useCallback((code: string | null) => {
    setGoogTransCookie(code);
    setOpen(false);
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-site-translate-root]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (process.env.NEXT_PUBLIC_DISABLE_SITE_TRANSLATE === "1") {
    return null;
  }

  return (
    <>
      {/* Hidden mount point required by Google’s script */}
      <div id="google_translate_element" className="sr-only" aria-hidden />

      <div
        data-site-translate-root
        className="fixed bottom-4 end-4 z-[200] flex flex-col items-end gap-1 print:hidden"
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="pointer-events-auto shadow-md ring-1 ring-foreground/10"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-haspopup="menu"
          onClick={() => setOpen((o) => !o)}
        >
          <Globe className="mr-1.5 size-4 opacity-80" aria-hidden />
          Site language
          <ChevronDown className={cn("ml-1 size-4 opacity-70 transition-transform", open && "rotate-180")} />
        </Button>

        {open ? (
          <div
            id={panelId}
            role="menu"
            className="max-h-[min(70vh,24rem)] w-[min(100vw-2rem,16rem)] overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => pickLanguage(null)}
            >
              <Languages className="size-4 shrink-0 opacity-60" aria-hidden />
              English (original)
            </button>
            <div className="mx-2 my-1 border-t border-border" />
            {TRANSLATION_LANGUAGES.filter((l) => l.code !== "en").map((l) => (
              <button
                key={l.code}
                type="button"
                role="menuitem"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => pickLanguage(l.code)}
              >
                {l.label}
              </button>
            ))}
            {!ready ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">Loading translator…</p>
            ) : null}
            <p className="border-t border-border px-3 py-2 text-[10px] leading-snug text-muted-foreground">
              Powered by Google Translate. Reloads the page. No API key required on your side.
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
