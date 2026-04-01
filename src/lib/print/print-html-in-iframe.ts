/** Escape text for safe insertion into HTML (body context). */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const printShellStyle = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 12mm; font: 14px/1.45 system-ui, "Segoe UI", sans-serif; color: #111; background: #fff; }
  .brand-row { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
  .brand-row img { max-height: 52px; max-width: 220px; object-fit: contain; }
  h1 { font-size: 1.35rem; margin: 0 0 4px; font-weight: 600; }
  h2 { font-size: 1.1rem; margin: 20px 0 8px; font-weight: 600; }
  .muted { color: #444; font-size: 0.9rem; margin: 0 0 16px; }
  .small { font-size: 0.8rem; color: #555; margin: 8px 0 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f2f2f2; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .bento { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin-top: 16px; }
  .semgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
  .sembox { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .snapgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .snapbox { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  @media print {
    body { padding: 10mm; }
  }
`;

/**
 * Opens a minimal document in a hidden iframe and invokes print. Avoids SPA shell, backdrop-filter, and theme
 * variables that often yield blank previews in Chromium/Safari.
 */
export function printHtmlInIframe(innerBodyHtml: string, documentTitle: string): void {
  const title = escapeHtml(documentTitle);
  const doc = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${title}</title><style>${printShellStyle}</style></head><body>${innerBodyHtml}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;inset:0;width:0;height:0;border:0;opacity:0;pointer-events:none;visibility:hidden";

  document.body.appendChild(iframe);
  const w = iframe.contentWindow;
  const d = iframe.contentDocument;
  if (!w || !d) {
    iframe.remove();
    return;
  }

  d.open();
  d.write(doc);
  d.close();

  const cleanup = () => {
    w.removeEventListener("afterprint", cleanup);
    iframe.remove();
  };
  w.addEventListener("afterprint", cleanup);
  setTimeout(() => {
    if (iframe.isConnected) iframe.remove();
  }, 120_000);

  setTimeout(() => {
    w.focus();
    w.print();
  }, 100);
}
