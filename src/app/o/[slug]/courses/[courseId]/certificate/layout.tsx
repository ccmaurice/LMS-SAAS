import type { ReactNode } from "react";

export default function CourseCertificateLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,450;0,550;0,650;0,700;1,400;1,550&family=Pinyon+Script&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          
          /* Hide all surrounding sidebar and print-hidden components (do NOT hide certificate header) */
          #org-sidebar,
          .print\\:hidden {
            display: none !important;
          }

          /* Force high print opacity on gold border lines, corner ornaments, and decorative polygons */
          svg.certificate-border-svg g,
          svg.certificate-border-svg path,
          svg.certificate-border-svg rect,
          svg.certificate-border-svg polygon {
            opacity: 1 !important;
          }
          
          /* Reset parent layout containers to let the certificate scale naturally */
          html,
          body,
          .relative.flex.min-h-full,
          .relative.z-10.flex.min-h-0,
          main,
          main > div,
          main > div > div {
            margin: 0 !important;
            padding: 0 !important;
            height: 100% !important;
            min-height: 100% !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: none !important;
            background: none !important;
            transform: none !important;
          }
          
          /* Force certificate container to cover exactly the page printable area */
          .certificate-print {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background-color: #FAF9F6 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            z-index: 9999999 !important;
          }

          /* Stretch the ornate frame to fill the printable area */
          .certificate-ornate-frame {
            width: 100% !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            box-sizing: border-box !important;
          }

          /* Vertically distribute contents within padding constraints */
          .certificate-ornate-frame > div {
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
            padding: 8mm 12mm 10mm 12mm !important;
          }

          svg.certificate-border-svg {
            width: 100% !important;
            height: 100% !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
        }
      `}</style>
      {children}
    </>
  );
}
