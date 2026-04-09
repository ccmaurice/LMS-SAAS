import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { CertificateVerifyQr } from "@/components/courses/certificate-verify-qr";
import { certificateSignatureImageDisplayUrl } from "@/lib/org/certificate-signature-display-url";
import { cn } from "@/lib/utils";
import type { OrganizationSettings } from "@/lib/education_context/schema";

const CERT_NAVY = "#1a305e";

export type CourseCompletionCertificateFields = Pick<
  OrganizationSettings,
  | "certificateSignerName"
  | "certificateSignerTitle"
  | "certificateSignatureImageUrl"
  | "certificateCompletionPhrase"
>;

type Props = {
  orgSlug: string;
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
        "certificate-print certificate-formal-root mx-auto w-full max-w-[920px] bg-white text-[color:var(--cert-ink)]",
        "dark:bg-white dark:text-[color:var(--cert-ink)]",
        className,
      )}
      style={{ ["--cert-ink" as string]: CERT_NAVY }}
    >
      <div className="border-[3px] border-[color:var(--cert-ink)] p-1 print:border-[color:var(--cert-ink)]">
        <div className="border border-[color:var(--cert-ink)] px-6 py-8 sm:px-10 sm:py-10 print:px-8 print:py-8">
          <header className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            <OrgBrandMark url={orgLogoUrl} size="md" className="max-h-12 object-contain print:max-h-11" />
            <p className="text-center font-serif text-lg font-semibold uppercase tracking-[0.14em] sm:text-xl">
              {orgName}
            </p>
          </header>

          <div className="mt-8 space-y-4 text-center sm:mt-10">
            <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-[2.35rem]">
              {recipientDisplayName}
            </h1>
            <p className="mx-auto max-w-2xl font-serif text-base text-[color:var(--cert-ink)]/90 sm:text-lg">{phrase}</p>
            <p className="font-serif text-xl font-semibold leading-snug sm:text-2xl">{courseTitle}</p>
            <p className="pt-1 font-serif text-sm text-[color:var(--cert-ink)]/85">on {dateLine}</p>
          </div>

          <footer className="mt-10 grid gap-10 sm:mt-14 sm:grid-cols-2 sm:items-end sm:gap-6 print:mt-12 print:grid-cols-2">
            <div className="text-left">
              <div className="flex min-h-[48px] items-end">
                {sigUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-provided signature asset URL
                  <img
                    src={sigUrl}
                    alt=""
                    className="max-h-[52px] max-w-[min(100%,280px)] object-contain object-left"
                  />
                ) : signerPrinted ? (
                  <p
                    className="text-[1.65rem] leading-none text-[color:var(--cert-ink)]/90 sm:text-[1.85rem]"
                    style={{ fontFamily: SCRIPT_STACK }}
                  >
                    {signerPrinted}
                  </p>
                ) : null}
              </div>
              <div className="mt-1 border-t border-[color:var(--cert-ink)]/55 pt-2">
                <p className="font-serif text-sm font-medium">{nameUnderRule}</p>
                <p className="mt-0.5 font-serif text-xs text-[color:var(--cert-ink)]/90">{signerTitle}</p>
              </div>
            </div>

            <div className="flex w-full flex-col items-center sm:items-end print:items-end">
              <CertificateVerifyQr
                verifyUrl={verifyUrl}
                qrDark={CERT_NAVY}
                captionClassName="mt-1 w-full text-center text-[10px] font-medium uppercase tracking-wide text-[color:var(--cert-ink)]/70 sm:text-right print:text-right"
                className="w-full rounded-md border border-[color:var(--cert-ink)]/25 bg-white p-2 sm:w-auto sm:max-w-[200px]"
              />
              <p className="mt-2 font-mono text-[11px] tracking-tight text-[color:var(--cert-ink)]">{credentialId}</p>
            </div>
          </footer>
        </div>
      </div>
    </article>
  );
}
