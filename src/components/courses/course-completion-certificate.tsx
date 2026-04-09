import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { CertificateOrnateFrame } from "@/components/courses/certificate-ornate-frame";
import { CertificateVerifyQr } from "@/components/courses/certificate-verify-qr";
import { certificateSignatureImageDisplayUrl } from "@/lib/org/certificate-signature-display-url";
import { cn } from "@/lib/utils";
import type { OrganizationSettings } from "@/lib/education_context/schema";

export type CourseCompletionCertificateFields = Pick<
  OrganizationSettings,
  | "certificateSignerName"
  | "certificateSignerTitle"
  | "certificateSignatureImageUrl"
  | "certificateCompletionPhrase"
>;

type Props = {
  orgSlug: string;
  /** School theme primary (resolved for white / print — frame, accents, QR). */
  themeInkHex: string;
  orgName: string;
  orgLogoUrl: string | null;
  recipientDisplayName: string;
  courseTitle: string;
  issuedAt: Date;
  verifyUrl: string;
  credentialId: string;
  certificate: CourseCompletionCertificateFields;
  className?: string;
};

const SCRIPT_STACK = '"Segoe Script","Brush Script MT","Apple Chancery",cursive';

export async function CourseCompletionCertificateView({
  orgSlug,
  themeInkHex,
  orgName,
  orgLogoUrl,
  recipientDisplayName,
  courseTitle,
  issuedAt,
  verifyUrl,
  credentialId,
  certificate,
  className,
}: Props) {
  const phrase =
    certificate.certificateCompletionPhrase?.trim() || "has successfully completed the course";
  const sigUrl = certificateSignatureImageDisplayUrl(
    orgSlug,
    certificate.certificateSignatureImageUrl,
  );
  const signerPrinted = certificate.certificateSignerName?.trim();
  const signerTitle = certificate.certificateSignerTitle?.trim() || "School administrator";
  const dateLine = issuedAt.toLocaleDateString(undefined, { dateStyle: "long" });
  const nameUnderRule = signerPrinted || orgName;

  return (
    <article
      className={cn(
        "certificate-print certificate-formal-root mx-auto w-full max-w-[920px] bg-white text-black",
        "dark:bg-white dark:text-black",
        className,
      )}
      style={{ ["--cert-ink" as string]: themeInkHex }}
    >
      <CertificateOrnateFrame ink={themeInkHex}>
        <header className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <OrgBrandMark url={orgLogoUrl} size="md" className="max-h-12 object-contain print:max-h-11" />
          <p className="text-center font-serif text-lg font-semibold uppercase tracking-[0.14em] text-[color:var(--cert-ink)] sm:text-xl">
            {orgName}
          </p>
        </header>

        <div className="mt-8 space-y-4 text-center sm:mt-10">
          <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-[2.35rem]">
            {recipientDisplayName}
          </h1>
          <p className="mx-auto max-w-2xl font-serif text-base text-[color:var(--cert-ink)]/85 sm:text-lg">
            {phrase}
          </p>
          <p
            className="font-serif text-xl font-semibold leading-snug sm:text-2xl"
            style={{ color: themeInkHex }}
          >
            {courseTitle}
          </p>
          <p className="pt-1 font-serif text-sm text-[color:var(--cert-ink)]/75">on {dateLine}</p>
        </div>

        <footer className="mt-10 grid gap-10 sm:mt-14 sm:grid-cols-2 sm:items-end sm:gap-6 print:mt-12 print:grid-cols-2">
          <div className="flex max-w-[320px] flex-col items-center text-center">
            <div className="flex min-h-[48px] w-full items-end justify-center">
              {sigUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-provided signature asset URL
                <img
                  src={sigUrl}
                  alt=""
                  className="max-h-[52px] max-w-[min(100%,280px)] object-contain object-bottom"
                />
              ) : signerPrinted ? (
                <p
                  className="text-[1.65rem] leading-none sm:text-[1.85rem]"
                  style={{ fontFamily: SCRIPT_STACK, color: themeInkHex }}
                >
                  {signerPrinted}
                </p>
              ) : null}
            </div>
            <div
              className="mt-1 w-full border-t border-solid pt-2"
              style={{ borderColor: `${themeInkHex}55` }}
            >
              <p className="font-serif text-sm font-medium">{nameUnderRule}</p>
              <p className="mt-0.5 font-serif text-xs text-neutral-700">{signerTitle}</p>
            </div>
          </div>

          <div className="flex w-full flex-col items-center sm:items-end print:items-end">
            <CertificateVerifyQr
              verifyUrl={verifyUrl}
              qrDark={themeInkHex}
              captionClassName="mt-1 w-full text-center text-[10px] font-medium uppercase tracking-wide text-[color:var(--cert-ink)]/65 sm:text-right print:text-right"
              className="w-full rounded-md border border-solid bg-white p-2 sm:w-auto sm:max-w-[200px]"
              qrWrapStyle={{ borderColor: `${themeInkHex}40` }}
            />
            <p
              className="mt-2 font-mono text-[11px] tracking-tight"
              style={{ color: themeInkHex }}
            >
              {credentialId}
            </p>
          </div>
        </footer>
      </CertificateOrnateFrame>
    </article>
  );
}
