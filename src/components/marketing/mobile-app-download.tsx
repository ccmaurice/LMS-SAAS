"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/i18n-provider";
import { getMobileAppStoreLinks } from "@/lib/platform/mobile-app-store-links";
import { cn } from "@/lib/utils";

type BeforeInstallPromptOutcome = { outcome: "accepted" | "dismissed" };
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptOutcome>;
};

function AppleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.317 3.13-.866 1.58-1.756 3.16-3.268 3.16-1.292 0-1.612-1.03-3.263-1.03-1.682 0-2.152 1.05-3.268 1.03-1.492 0-2.637-1.49-3.556-3.07-1.294-2.25-2.28-5.63-2.28-8.84 0-2.58.832-4.68 2.412-6.26 1.292-1.29 2.752-1.97 4.197-1.97 1.562 0 2.414 1.04 3.27 1.04 1.292 0 2.152-1.04 3.268-1.04 1.292 0 2.752.68 4.197 2.22-3.28 1.8-2.75 6.48.21 8.04z" />
    </svg>
  );
}

function PlayMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M9.5 7.5v9l7.5-4.5-7.5-4.5z" />
    </svg>
  );
}

const btnBase =
  "inline-flex min-h-[3rem] min-w-[10.5rem] flex-1 items-center justify-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-[transform,box-shadow] hover:shadow-lg motion-safe:hover:scale-[1.02] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:min-w-[11rem]";

function useStandaloneDisplayMode(): boolean {
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const sync = () => setStandalone(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return standalone;
}

/** All iOS browsers use WebKit — install is always “Add to Home Screen” (no beforeinstallprompt). */
function useIosDevice(): boolean {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS =
      /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(iOS);
  }, []);
  return ios;
}

type MobileAppDownloadProps = {
  compact?: boolean;
  className?: string;
};

export function MobileAppDownload({ compact, className }: MobileAppDownloadProps) {
  const { t } = useI18n();
  const { ios, android } = useMemo(() => getMobileAppStoreLinks(), []);
  const hasStore = Boolean(ios || android);
  const standalone = useStandaloneDisplayMode();
  const isIos = useIosDevice();

  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installBusy, setInstallBusy] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const runInstall = useCallback(async () => {
    if (!installEvt) return;
    setInstallBusy(true);
    try {
      await installEvt.prompt();
      const { outcome } = await installEvt.userChoice;
      setInstallEvt(null);
      if (outcome === "accepted") {
        toast.success(t("landing.installWebAppSuccess"));
      }
    } catch {
      toast.error(t("landing.installWebAppFailed"));
    } finally {
      setInstallBusy(false);
    }
  }, [installEvt, t]);

  if (standalone) {
    return (
      <div
        className={cn(
          "flex flex-col items-center text-center",
          compact ? "mt-8 gap-3" : "mt-10 gap-4",
          className,
        )}
      >
        <p className="max-w-md text-pretty text-xs text-muted-foreground">{t("landing.runningAsInstalledApp")}</p>
        {hasStore ? (
          <div className="flex w-full max-w-md flex-wrap items-stretch justify-center gap-3 sm:flex-nowrap">
            {ios ? (
              <a
                href={ios}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(btnBase, "bg-black focus-visible:outline-neutral-400")}
              >
                <AppleMark className="h-7 w-7 shrink-0 text-white" />
                <span>{t("landing.appStore")}</span>
              </a>
            ) : null}
            {android ? (
              <a
                href={android}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(btnBase, "bg-[#28a745] focus-visible:outline-emerald-400")}
              >
                <PlayMark className="h-7 w-7 shrink-0 text-white" />
                <span>{t("landing.playStore")}</span>
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "mt-8 gap-3" : "mt-10 gap-4",
        className,
      )}
    >
      <h2 className="text-base font-medium tracking-tight text-slate-500 dark:text-slate-400">
        {t("landing.downloadMobileApp")}
      </h2>

      <div className="w-full max-w-md space-y-3">
        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{t("landing.installWebAppLead")}</p>

        {isIos ? (
          <p className="text-pretty text-sm leading-relaxed text-foreground/90">{t("landing.installWebAppIos")}</p>
        ) : installEvt ? (
          <Button
            type="button"
            size="lg"
            className="w-full max-w-xs rounded-xl font-semibold shadow-md sm:w-auto"
            disabled={installBusy}
            onClick={() => void runInstall()}
          >
            {installBusy ? t("landing.installWebAppWorking") : t("landing.installWebAppButton")}
          </Button>
        ) : (
          <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{t("landing.installWebAppFallback")}</p>
        )}
      </div>

      {hasStore ? (
        <>
          <p className="text-xs font-medium text-muted-foreground">{t("landing.orNativeStores")}</p>
          <div className="flex w-full max-w-md flex-wrap items-stretch justify-center gap-3 sm:flex-nowrap">
            {ios ? (
              <a
                href={ios}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(btnBase, "bg-black focus-visible:outline-neutral-400")}
              >
                <AppleMark className="h-7 w-7 shrink-0 text-white" />
                <span>{t("landing.appStore")}</span>
              </a>
            ) : null}
            {android ? (
              <a
                href={android}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(btnBase, "bg-[#28a745] focus-visible:outline-emerald-400")}
              >
                <PlayMark className="h-7 w-7 shrink-0 text-white" />
                <span>{t("landing.playStore")}</span>
              </a>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
