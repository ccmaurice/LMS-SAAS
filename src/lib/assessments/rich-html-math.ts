import katex from "katex";

const MATH_RE = /(\$\$[\s\S]*?\$\$)|(\$[^$\n]+\$)/g;

function isInsideSkippedContext(textNode: Text, boundary: HTMLElement): boolean {
  let el: HTMLElement | null = textNode.parentElement;
  if (!el) return true;
  if (el.closest(".katex")) return true;
  while (el && el !== boundary) {
    const tag = el.tagName;
    if (tag === "CODE" || tag === "PRE" || tag === "KBD" || tag === "SAMP") return true;
    el = el.parentElement;
  }
  return false;
}

function replaceMathInTextNode(textNode: Text): void {
  const text = textNode.nodeValue ?? "";
  MATH_RE.lastIndex = 0;
  if (!MATH_RE.test(text)) return;
  MATH_RE.lastIndex = 0;

  const parent = textNode.parentNode;
  if (!parent) return;

  const frag = document.createDocumentFragment();
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = MATH_RE.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const display = Boolean(m[1]);
    const raw = m[1] ?? m[2]!;
    const inner = display ? raw.slice(2, -2).trim() : raw.slice(1, -1).trim();
    const el = document.createElement(display ? "div" : "span");
    if (display) el.className = "my-2 overflow-x-auto text-center [&_.katex]:text-base";
    else el.className = "mx-0.5 inline-block align-middle";
    try {
      el.innerHTML = katex.renderToString(inner, { displayMode: display, throwOnError: false });
    } catch {
      el.textContent = raw;
    }
    frag.appendChild(el);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  parent.replaceChild(frag, textNode);
}

/**
 * After sanitized HTML is mounted in `root`, finds text nodes that contain `$…$` / `$$…$$`
 * and replaces them with KaTeX output. Skips code blocks and existing `.katex` regions.
 * Call only in the browser (e.g. `useLayoutEffect`).
 */
export function processMathInRichHtmlRoot(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const batch: Text[] = [];
  let n: Node | null = walker.nextNode();
  while (n) {
    const t = n as Text;
    const raw = t.nodeValue ?? "";
    if (!isInsideSkippedContext(t, root) && /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/.test(raw)) {
      batch.push(t);
    }
    n = walker.nextNode();
  }
  for (const textNode of batch) {
    if (textNode.parentNode) replaceMathInTextNode(textNode);
  }
}
