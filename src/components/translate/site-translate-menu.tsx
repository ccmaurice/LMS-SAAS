"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Globe, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRANSLATION_LANGUAGES } from "@/lib/translate/languages";
import { cn } from "@/lib/utils";
import { useSiteTranslate } from "@/components/translate/google-translate-provider";

const COOKIE = "googtrans";

export function setGoogTransCookie(targetCode: string | null) {
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

type Layout = "fab" | "toolbar";

export function SiteTranslateMenu({ layout }: { layout: Layout }) {
  const { enabled, ready } = useSiteTranslate();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const rootAttr = `site-translate-${layout}`;

  const pickLanguage = useCallback((code: string | null) => {
    setGoogTransCookie(code);
    setOpen(false);
    window.location.reload();
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest(`[data-site-translate-root="${rootAttr}"]`)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, rootAttr]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled) return null;

  if (layout === "fab") {
    return (
      <div
        data-site-translate-root={rootAttr}
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
          <MenuPanel id={panelId} ready={ready} pickLanguage={pickLanguage} />
        ) : null}
      </div>
    );
  }

  return (
    <div data-site-translate-root={rootAttr} className="relative z-[120] print:hidden">
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0 rounded-lg border-border/80 bg-background shadow-xs"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="menu"
        title="Site language · Google Translate"
        onClick={() => setOpen((o) => !o)}
      >
        <Globe className="size-[1.15rem]" aria-hidden />
        <span className="sr-only">Site language</span>
      </Button>
      {open ? (
        <div className="absolute end-0 top-full mt-1.5">
          <MenuPanel id={panelId} ready={ready} pickLanguage={pickLanguage} className="w-[min(100vw-2rem,16rem)]" />
        </div>
      ) : null}
    </div>
  );
}

function MenuPanel({
  id,
  ready,
  pickLanguage,
  className,
}: {
  id: string;
  ready: boolean;
  pickLanguage: (code: string | null) => void;
  className?: string;
}) {
  return (
    <div
      id={id}
      role="menu"
      className={cn(
        "max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10",
        className,
      )}
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
        Google Translate · reloads the page
      </p>
    </div>
  );
}

/** Floating control on public routes (hidden inside /o/* and platform console). */
export function SiteTranslateFabPublic() {
  const pathname = usePathname() ?? "";
  const { enabled } = useSiteTranslate();

  if (!enabled) return null;
  if (pathname.startsWith("/o/")) return null;
  const isPlatformConsole = pathname.startsWith("/platform") && pathname !== "/platform/login";
  if (isPlatformConsole) return null;

  return <SiteTranslateMenu layout="fab" />;
}
