"use client";

import { AssessmentPrompt } from "@/components/assessments/assessment-prompt";
import { SanitizedHtmlWithKatex } from "@/components/assessments/sanitized-html-with-katex";
import { looksLikeHtml } from "@/lib/assessments/html-text";
import { cn } from "@/lib/utils";

/**
 * Renders stored question or choice text: HTML from the rich editor when present
 * (with optional `$…$` / `$$…$$` math via KaTeX), otherwise legacy plain text via {@link AssessmentPrompt}.
 */
export function AssessmentQuestionText({ text, className }: { text: string; className?: string }) {
  if (looksLikeHtml(text)) {
    return <SanitizedHtmlWithKatex html={text} className={cn("text-base leading-relaxed", className)} />;
  }
  return <AssessmentPrompt text={text} className={className} />;
}
