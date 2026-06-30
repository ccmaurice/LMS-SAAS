import type { ReactNode } from "react";

export default function CourseCertificateLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          
          /* Hide all surrounding layouts, headers, sidebars, and panels on print */
          body * {
            visibility: hidden !important;
          }
          
          /* Show only the certificate card and its components */
          .certificate-print,
          .certificate-print * {
            visibility: visible !important;
          }
          
          /* Force certificate container to cover exactly one A4 page */
          .certificate-print {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 297mm !important;
            height: 210mm !important;
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

          /* Stretch the ornate frame to fill the A4 landscape printable area */
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
            padding: 12mm 16mm 14mm 16mm !important;
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
