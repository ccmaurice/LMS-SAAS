"use client";

import { useEffect } from "react";

/**
 * Registers `/sw.js` in production builds. Keeps dev (`next dev`) free of SW caching/HMR issues.
 * Test install locally with `next build && next start`.
 */
export function PwaRegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch {
        // Non-fatal: PWA still partially works from manifest alone on some platforms
      }
    };

    void register();
  }, []);

  return null;
}
