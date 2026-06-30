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
          
          /* Hide all surrounding sidebar, header, and print-hidden components */
          #org-sidebar,
          header,
          .print\\:hidden,
          button,
          a {
            display: none !important;
          }
          
          /* Hide all general body elements by default */
          body * {
            visibility: hidden !important;
          }
          
          /* Show only the certificate card and its components */
          .certificate-print,
          .certificate-print * {
            visibility: visible !important;
          }

          /* Disable transforms, position relative locks, animations, and height constraints on all parent containers */
          html,
          body,
          main,
          div:has(.certificate-print),
          section:has(.certificate-print),
          article:has(.certificate-print) {
            position: static !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            perspective: none !important;
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          
          /* Force certificate container to cover exactly the page printable area */
          .certificate-print {
            position: fixed !important;
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
