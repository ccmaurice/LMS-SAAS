"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo, type ReactNode } from "react";

function renderKatex(inner: string, displayMode: boolean, key: number): ReactNode {
  try {
    const html = katex.renderToString(inner, { displayMode, throwOnError: false });
    return displayMode ? (
      <div key={key} className="my-3 overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: html }} />
    ) : (
      <span key={key} className="mx-0.5 inline-block align-middle" dangerouslySetInnerHTML={{ __html: html }} />
    );
  } catch {
    return (
      <code key={key} className="rounded bg-muted px-1 text-xs text-muted-foreground">
        {displayMode ? `$$${inner}$$` : `$${inner}$`}
      </code>
    );
  }
}

/**
 * Renders prompts with `$$...$$` display math and `$...$` inline math via KaTeX.
 */
export function AssessmentPrompt({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => {
    const out: ReactNode[] = [];
    const re = /(\$\$[\s\S]*?\$\$)|(\$[^$\n]+\$)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let key = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) {
        out.push(
          <span key={key++} className="whitespace-pre-wrap">
            {text.slice(last, m.index)}
          </span>,
        );
      }
      if (m[1]) {
        const inner = m[1].slice(2, -2).trim();
        out.push(renderKatex(inner, true, key++));
      } else if (m[2]) {
        const inner = m[2].slice(1, -1).trim();
        out.push(renderKatex(inner, false, key++));
      }
      last = m.index + m[0].length;
    }
    if (last < text.length) {
      out.push(
        <span key={key++} className="whitespace-pre-wrap">
          {text.slice(last)}
        </span>,
      );
    }
    return out;
  }, [text]);

  return <div className={className}>{nodes}</div>;
}
