import { OrgBrandMark } from "@/components/org/org-brand-mark";
import { CertificateOrnateFrame } from "@/components/courses/certificate-ornate-frame";
import { CertificateVerifyQr } from "@/components/courses/certificate-verify-qr";
import { certificateSignatureImageDisplayUrl } from "@/lib/org/certificate-signature-display-url";
import { certificateSealImageDisplayUrl } from "@/lib/org/certificate-seal-display-url";
import { cn } from "@/lib/utils";
import type { OrganizationSettings } from "@/lib/education_context/schema";

export type CourseCompletionCertificateFields = Pick<
  OrganizationSettings,
  | "certificateSignerName"
  | "certificateSignerTitle"
  | "certificateSignatureImageUrl"
  | "certificateSealImageUrl"
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
  const sealUrl = certificateSealImageDisplayUrl(
    orgSlug,
    certificate.certificateSealImageUrl,
  ) || "/default-seal.png";
  const signerPrinted = certificate.certificateSignerName?.trim();
  const signerTitle = certificate.certificateSignerTitle?.trim() || "School administrator";
  const dateLine = issuedAt.toLocaleDateString(undefined, { dateStyle: "long" });
  const nameUnderRule = signerPrinted || orgName;

  return (
    <article
      className={cn(
        "certificate-print certificate-formal-root mx-auto w-full max-w-[920px] bg-[#FAF9F6] text-black shadow-lg",
        "dark:bg-[#FAF9F6] dark:text-black",
        className,
      )}
      style={{ ["--cert-ink" as string]: themeInkHex }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,450;0,550;0,650;0,700;1,400;1,550&family=Pinyon+Script&display=swap');
        .font-cinzel { font-family: 'Cinzel', serif; }
        .font-cormorant { font-family: 'Cormorant Garamond', serif; }
        .font-pinyon { font-family: 'Pinyon Script', cursive; }
      `}} />

      <CertificateOrnateFrame ink={themeInkHex}>
        {/* Header: Logo and School Name */}
        <header className="flex flex-col items-center justify-center gap-2">
          {orgLogoUrl && (
            <OrgBrandMark url={orgLogoUrl} size="lg" className="h-16 w-16 max-h-16 max-w-16 object-contain print:h-14 print:w-14 print:max-h-14 print:max-w-14 mb-1" />
          )}
          <p className="text-center font-cinzel text-xs font-bold uppercase tracking-[0.25em] text-[#C5A880] sm:text-sm">
            {orgName}
          </p>
        </header>

        {/* Certificate Title */}
        <div className="mt-8 text-center space-y-1">
          <h2 className="font-cinzel text-xl sm:text-2xl md:text-3xl text-neutral-850 tracking-[0.22em] font-semibold uppercase">
            Certificate of Completion
          </h2>
          
          {/* Decorative Gold Divider Line with Diamond */}
          <div className="flex items-center justify-center gap-4 py-1.5">
            <div className="h-[1px] w-14 bg-gradient-to-r from-transparent to-[#D4AF37]" />
            <svg className="w-3.5 h-3.5 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 12h10v10l10-10H12V2z" />
            </svg>
            <div className="h-[1px] w-14 bg-gradient-to-l from-transparent to-[#D4AF37]" />
          </div>
        </div>

        {/* Main Certificate Content Body */}
        <div className="mt-6 space-y-3.5 text-center">
          <p className="font-cormorant italic text-base text-neutral-500 tracking-wide">
            This is to certify that
          </p>
          <h1 className="font-cormorant text-4xl sm:text-5xl md:text-5.5xl font-bold tracking-tight text-neutral-850 italic my-2">
            {recipientDisplayName}
          </h1>
          <p className="mx-auto max-w-xl font-cormorant italic text-base text-neutral-500 tracking-wide">
            {phrase}
          </p>
          <p
            className="font-cinzel text-lg sm:text-xl font-bold tracking-wider leading-snug uppercase max-w-2xl mx-auto py-1"
            style={{ color: themeInkHex }}
          >
            {courseTitle}
          </p>
          <p className="font-cormorant italic text-sm text-neutral-500">
            given on <span className="font-semibold text-neutral-700">{dateLine}</span>
          </p>
        </div>

        {/* Symmetrical Footer: Signature, Gold Seal, and QR Verification */}
        <footer className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-3 sm:items-center sm:gap-4 print:mt-10 print:grid-cols-3">
          
          {/* Left Column: Signature */}
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left max-w-[240px] mx-auto sm:mx-0 w-full">
            <div className="flex min-h-[48px] w-full items-end justify-center sm:justify-start">
              {sigUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-provided signature asset URL
                <img
                  src={sigUrl}
                  alt="Signature"
                  className="max-h-[52px] max-w-[180px] object-contain object-bottom"
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
              style={{ borderColor: `${themeInkHex}40` }}
            >
              <p className="font-cormorant text-sm font-bold text-neutral-800 leading-snug">{nameUnderRule}</p>
              <p className="mt-0.5 font-cormorant text-xs font-medium text-neutral-500 leading-none">{signerTitle}</p>
            </div>
          </div>

          {/* Center Column: Accredited Official Gold Seal */}
          <div className="hidden sm:flex flex-col items-center justify-center shrink-0 print:flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sealUrl}
              alt="Official Seal"
              className="h-24 w-20 object-contain drop-shadow-sm print:h-24 print:w-20"
            />
            <span className="font-cinzel text-[8.5px] font-bold text-[#AA7C11] tracking-[0.18em] mt-1 opacity-90">OFFICIAL SEAL</span>
          </div>

          {/* Right Column: QR Verification & Credential ID */}
          <div className="flex w-full flex-col items-center sm:items-end print:items-end">
            <CertificateVerifyQr
              verifyUrl={verifyUrl}
              qrDark={themeInkHex}
              captionClassName="mt-1 w-full text-center text-[10px] font-bold uppercase tracking-wider text-[#C5A880] sm:text-right print:text-right print:text-[8px] print:mt-0.5"
              className="w-full rounded-md border border-solid bg-white p-1.5 sm:w-auto sm:max-w-[180px] print:max-w-[92px] print:p-1 hover:shadow-sm transition-all"
              qrWrapStyle={{ borderColor: `${themeInkHex}30` }}
            />
            <p
              className="mt-2 font-mono text-[10px] tracking-wide font-semibold text-neutral-500 print:text-[8px] print:mt-0.5"
            >
              {credentialId}
            </p>
          </div>
        </footer>
      </CertificateOrnateFrame>
    </article>
  );
}
