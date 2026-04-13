"use client";

/**
 * Loads Google’s website translator once and exposes readiness for menu UIs.
 */

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { TRANSLATION_LANGUAGES } from "@/lib/translate/languages";

const SCRIPT_ID = "google-translate-script";
const CB_NAME = "googleTranslateElementInit";

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

type TranslateCtx = { enabled: boolean; ready: boolean };

const GoogleTranslateContext = createContext<TranslateCtx | null>(null);

export function useSiteTranslate(): TranslateCtx {
  return useContext(GoogleTranslateContext) ?? { enabled: false, ready: false };
}

export function GoogleTranslateProvider({ children }: { children: ReactNode }) {
  const disabled = process.env.NEXT_PUBLIC_DISABLE_SITE_TRANSLATE === "1";
  const [ready, setReady] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    if (disabled) return;

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
  }, [disabled]);

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <GoogleTranslateContext.Provider value={{ enabled: true, ready }}>
      <div id="google_translate_element" className="sr-only" aria-hidden />
      {children}
    </GoogleTranslateContext.Provider>
  );
}
