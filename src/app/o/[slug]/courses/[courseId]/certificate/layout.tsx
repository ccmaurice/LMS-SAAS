import type { ReactNode } from "react";

export default function CourseCertificateLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 12mm;
          }
        }
      `}</style>
      {children}
    </>
  );
}
