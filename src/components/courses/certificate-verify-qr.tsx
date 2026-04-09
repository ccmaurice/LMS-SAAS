import type { CSSProperties } from "react";
import QRCode from "qrcode";

type Props = {
  verifyUrl: string;
  className?: string;
  /** QR module color (hex). Defaults to near-black for generic UI; use navy on formal certificates. */
  qrDark?: string;
  captionClassName?: string;
  /** Merged onto the wrapper div (e.g. theme-tinted border on certificates). */
  qrWrapStyle?: CSSProperties;
};

/**
 * Server-rendered QR for certificate print/PDF; encodes the public verification URL.
 */
export async function CertificateVerifyQr({
  verifyUrl,
  className,
  qrDark,
  captionClassName,
  qrWrapStyle,
}: Props) {
  const dark = qrDark?.trim() || "#0a0a0a";
  const dataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 168,
    errorCorrectionLevel: "M",
    color: { dark, light: "#ffffff" },
  });

  return (
    <div className={className} style={qrWrapStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from server-generated QR */}
      <img src={dataUrl} alt="" width={168} height={168} className="mx-auto print:h-[132px] print:w-[132px]" />
      <p
        className={
          captionClassName ??
          "mt-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        }
      >
        Scan to verify
      </p>
    </div>
  );
}
