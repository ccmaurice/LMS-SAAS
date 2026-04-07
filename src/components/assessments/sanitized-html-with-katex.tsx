"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import "katex/dist/katex.min.css";
import { processMathInRichHtmlRoot } from "@/lib/assessments/rich-html-math";
import { htmlContainsMathDelimiters } from "@/lib/assessments/html-text";
import { sanitizeAssessmentHtml } from "@/components/assessments/sanitized-html";
import { cn } from "@/lib/utils";

/**
 * Renders trusted-sanitized HTML, then upgrades `$…$` / `$$…$$` segments to KaTeX in the live DOM
 * (after hydration) so rich-text prompts can mix formatting and math.
 */
export function SanitizedHtmlWithKatex({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeAssessmentHtml(html), [html]);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (!htmlContainsMathDelimiters(clean)) return;
    processMathInRichHtmlRoot(root);
  }, [clean]);

  return (
    <div
      ref={ref}
      className={cn("assessment-rich-html", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
