"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";
import { cn } from "@/lib/utils";

const PANEL_MAX_REM = 22;
const VIEWPORT_GUTTER_PX = 16;
const GAP_PX = 8;

/**
 * Renders children in a fixed layer on `document.body` so the panel stays above
 * main content (e.g. dashboard motion cards) and mobile bottom nav.
 */
export function NotificationFloatingPanel({
  open,
  anchorRef,
  panelRef,
  className,
  children,
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLDivElement | null>;
  className?: string;
  children: React.ReactNode;
}) {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    const el = anchorRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      const w = Math.min(window.innerWidth - 2 * VIEWPORT_GUTTER_PX, PANEL_MAX_REM * 16);
      setStyle({
        position: "fixed",
        top: r.bottom + GAP_PX,
        right: Math.max(VIEWPORT_GUTTER_PX, window.innerWidth - r.right),
        width: w,
        zIndex: 200,
      });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div ref={panelRef} className={cn("rounded-lg border border-border bg-popover shadow-lg", className)} style={style}>
      {children}
    </div>,
    document.body,
  );
}
