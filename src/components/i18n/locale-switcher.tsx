"use client";

import { useId, useState, useEffect } from "react";
import { ChevronDown, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/i18n-provider";
import { LOCALE_LABELS, UI_LOCALES, type UiLocale } from "@/i18n/locales";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ layout = "toolbar" }: { layout?: "toolbar" | "compact" }) {
  const { locale, setLocale, t } = useI18n();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest("[data-locale-switcher]")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (layout === "compact") {
    return (
      <div className="relative z-[120] print:hidden" data-locale-switcher>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 rounded-lg border-border/80 bg-background shadow-xs"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          aria-haspopup="menu"
          title={t("shell.language")}
          onClick={() => setOpen((o) => !o)}
        >
          <Languages className="size-[1.15rem]" aria-hidden />
          <span className="sr-only">{t("shell.language")}</span>
        </Button>
        {open ? (
          <div className="absolute end-0 top-full mt-1.5">
            <LocalePanel
              id={panelId}
              current={locale}
              hint={t("shell.localeHint")}
              onPick={setLocale}
              onClose={() => setOpen(false)}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative z-[120] print:hidden" data-locale-switcher>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1 border-border/80 bg-background px-2 text-xs shadow-xs"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Languages className="size-3.5 opacity-80" aria-hidden />
        <span className="max-w-[7rem] truncate">{LOCALE_LABELS[locale]}</span>
        <ChevronDown className={cn("size-3.5 opacity-70", open && "rotate-180")} />
      </Button>
      {open ? (
        <div className="absolute end-0 top-full mt-1.5">
          <LocalePanel
            id={panelId}
            current={locale}
            hint={t("shell.localeHint")}
            onPick={setLocale}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function LocalePanel({
  id,
  current,
  hint,
  onPick,
  onClose,
}: {
  id: string;
  current: UiLocale;
  hint: string;
  onPick: (l: UiLocale) => void;
  onClose: () => void;
}) {
  return (
    <div
      id={id}
      role="menu"
      className="min-w-[10.5rem] rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
    >
      {UI_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          role="menuitem"
          className={cn(
            "flex w-full px-3 py-2 text-left text-sm hover:bg-muted",
            code === current && "bg-muted/80 font-medium",
          )}
          onClick={() => {
            onPick(code);
            onClose();
          }}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
      <p className="border-t border-border px-3 py-2 text-[10px] leading-snug text-muted-foreground">{hint}</p>
    </div>
  );
}
