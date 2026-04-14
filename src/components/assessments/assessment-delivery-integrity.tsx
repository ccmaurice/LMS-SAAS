"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";

function subscribeFullscreenSupport(_onStoreChange: () => void) {
  return () => {};
}

function getFullscreenApiSupported(): boolean {
  if (typeof document === "undefined") return false;
  return typeof document.documentElement.requestFullscreen === "function";
}

export type AssessmentDeliveryModeValue = "FORMATIVE" | "SECURE_ONLINE" | "LOCKDOWN";

/**
 * Visible leave/focus warnings and optional fullscreen for secure / lockdown delivery.
 * Proctoring events are logged separately by AssessmentProctorHooks.
 */
export function AssessmentDeliveryIntegrity({
  mode,
}: {
  mode: AssessmentDeliveryModeValue;
}) {
  const { t } = useI18n();
  const strict = mode === "SECURE_ONLINE" || mode === "LOCKDOWN";
  const [leaveWarning, setLeaveWarning] = useState(false);
  const [inFullscreen, setInFullscreen] = useState(false);
  const fsSupported = useSyncExternalStore(
    subscribeFullscreenSupport,
    getFullscreenApiSupported,
    () => false,
  );

  useEffect(() => {
    const syncFs = () => setInFullscreen(Boolean(document.fullscreenElement));
    const id = requestAnimationFrame(() => syncFs());
    document.addEventListener("fullscreenchange", syncFs);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener("fullscreenchange", syncFs);
    };
  }, []);

  useEffect(() => {
    if (!strict) return;

    const onBlur = () => setLeaveWarning(true);
    const onVis = () => {
      if (document.visibilityState === "hidden") setLeaveWarning(true);
    };

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [strict]);

  const enterFullscreen = useCallback(() => {
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  if (!strict) return null;

  return (
    <>
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-foreground dark:border-amber-400/30 dark:bg-amber-500/15">
        <p className="font-medium text-amber-950 dark:text-amber-100">
          {mode === "LOCKDOWN" ? t("assessments.integrity.lockdownTitle") : t("assessments.integrity.secureTitle")}
        </p>
        <p className="mt-1 text-amber-950/90 dark:text-amber-100/90">{t("assessments.integrity.stayInWindow")}</p>
        {mode === "LOCKDOWN" ? (
          <p className="mt-1 text-amber-950/90 dark:text-amber-100/90">{t("assessments.integrity.lockdownPaste")}</p>
        ) : null}
        {fsSupported && !inFullscreen ? (
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => enterFullscreen()}>
            {t("assessments.integrity.fullscreen")}
          </Button>
        ) : null}
      </div>

      {leaveWarning ? (
        <div
          role="status"
          className="fixed left-0 right-0 top-0 z-50 border-b border-amber-600/50 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-md dark:border-amber-400/40 dark:bg-amber-600 dark:text-amber-50"
        >
          <span>{t("assessments.integrity.leftBanner")}</span>
          <button
            type="button"
            className="ml-3 rounded-md border border-amber-900/30 bg-white/90 px-2 py-0.5 text-xs font-semibold text-amber-950 hover:bg-white dark:border-amber-100/40 dark:bg-amber-800 dark:text-amber-50 dark:hover:bg-amber-700"
            onClick={() => setLeaveWarning(false)}
          >
            {t("assessments.integrity.dismiss")}
          </button>
        </div>
      ) : null}
    </>
  );
}
