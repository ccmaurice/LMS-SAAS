"use client";

import { useEffect } from "react";

function allowClipboardShortcuts(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-lockdown-allow-input]")) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Blocks context menu and Ctrl/Cmd+C/V/X outside answer fields when active. */
export function AssessmentLockdownGuards({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!active) return;

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== "c" && k !== "v" && k !== "x") return;
      if (allowClipboardShortcuts(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [active]);

  return <>{children}</>;
}
