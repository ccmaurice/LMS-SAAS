"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";

function parseLatexFromStored(raw: string): string {
  try {
    const j = JSON.parse(raw) as { latex?: string };
    if (typeof j.latex === "string") return j.latex;
  } catch {
    /* legacy plain string */
  }
  return raw;
}

export function FormulaAnswerField({
  valueJson,
  onChange,
  disabled,
}: {
  valueJson: string;
  onChange: (json: string) => void;
  disabled?: boolean;
}) {
  const latex = parseLatexFromStored(valueJson);

  const previewHtml = useMemo(() => {
    const t = latex.trim();
    if (!t) return null;
    try {
      return katex.renderToString(t, { displayMode: true, throwOnError: false });
    } catch {
      return null;
    }
  }, [latex]);

  return (
    <div className="mt-3 space-y-2">
      <Textarea
        rows={3}
        className="font-mono text-sm"
        placeholder={'LaTeX, e.g. x^2 + \\frac{1}{2} or wrap in $$…$$ in the prompt for display math'}
        value={latex}
        disabled={disabled}
        onChange={(e) => onChange(JSON.stringify({ latex: e.target.value }))}
      />
      {previewHtml ? (
        <div className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-sm dark:border-white/10">
          <p className="mb-1 text-xs text-muted-foreground">Preview</p>
          <div className="overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      ) : null}
    </div>
  );
}
