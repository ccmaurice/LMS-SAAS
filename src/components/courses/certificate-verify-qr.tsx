import QRCode from "qrcode";

type Props = {
  verifyUrl: string;
  className?: string;
};

/**
 * Server-rendered QR for certificate print/PDF; encodes the public verification URL.
 */
export async function CertificateVerifyQr({ verifyUrl, className }: Props) {
  const dataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 168,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });

  return (
    <div className={className}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL from server-generated QR */}
      <img src={dataUrl} alt="" width={168} height={168} className="mx-auto print:h-[132px] print:w-[132px]" />
      <p className="mt-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Scan to verify
      </p>
    </div>
  );
}
