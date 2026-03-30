function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Sends via Resend when RESEND_API_KEY is set; otherwise logs in development only.
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<{ sent: boolean; skipped?: boolean }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() ?? "LMS <onboarding@resend.dev>";

  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[email] ${input.subject} → ${input.to}`);
    }
    return { sent: false, skipped: true };
  }

  const html = input.html ?? `<p>${escapeHtml(input.text).replaceAll("\n", "<br/>")}</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[email] Resend error:", res.status, err);
    return { sent: false };
  }

  return { sent: true };
}
