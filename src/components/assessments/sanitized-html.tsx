"use client";

import DOMPurify from "isomorphic-dompurify";
import type { Config } from "dompurify";
import { cn } from "@/lib/utils";

export const ASSESSMENT_HTML_SANITIZE: Config = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target", "rel", "colspan", "rowspan"],
};

export function sanitizeAssessmentHtml(html: string): string {
  return DOMPurify.sanitize(html, ASSESSMENT_HTML_SANITIZE);
}

export function SanitizedHtml({ html, className }: { html: string; className?: string }) {
  const clean = sanitizeAssessmentHtml(html);
  return (
    <div
      className={cn("assessment-rich-html", className)}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
