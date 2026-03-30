"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

/**
 * Renders prompt with `$$...$$` display math via KaTeX. Inline `$...$` is left as plain text for simplicity.
 */
export function AssessmentPrompt({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => {
    const parts = text.split(/(\$\$[\s\S]*?\$\$)/g);
    return parts.map((part, i) => {
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const inner = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(inner, { displayMode: true, throwOnError: false });
          return (
            // eslint-disable-next-line react/no-danger -- KaTeX output is trusted math markup
            <div key={i} className="my-3 overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: html }} />
          );
        } catch {
          return (
            <pre key={i} className="my-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {part}
            </pre>
          );
        }
      }
      return (
        <span key={i} className="whitespace-pre-wrap">
          {part}
        </span>
      );
    });
  }, [text]);

  return <div className={className}>{nodes}</div>;
}
