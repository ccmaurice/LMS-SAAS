import type { GradingScaleType } from "@/generated/prisma/enums";
import type { OrganizationSettings } from "@/lib/education_context/schema";
import { formatGradeDisplay } from "@/lib/grading_engine";

export type ReportCardPdfRow = {
  courseTitle: string;
  assessmentTitle: string;
  total: number | null;
  max: number | null;
  gradingScale: GradingScaleType;
};

export async function buildReportCardPdfBuffer(opts: {
  orgName: string;
  academicYearLabel: string;
  studentLabel: string;
  rows: ReportCardPdfRow[];
  orgSettings?: OrganizationSettings;
  showRank?: boolean;
  logoBuffer?: Buffer | null;
}): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    let y = doc.y;
    if (opts.logoBuffer && opts.logoBuffer.length > 0) {
      try {
        doc.image(opts.logoBuffer, left, y, { fit: [160, 52] });
        y += 56;
        doc.y = y;
      } catch {
        /* ignore */
      }
    }

    doc.fontSize(16).text(opts.orgName, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Report card · ${opts.academicYearLabel}`);
    doc.text(`Student: ${opts.studentLabel}`);
    if (opts.showRank) doc.text("Rank: not computed");
    doc.moveDown();
    doc.fontSize(10);

    if (opts.rows.length === 0) {
      doc.text("No graded submissions in this export.");
    } else {
      for (const r of opts.rows) {
        doc.text(`${r.courseTitle} — ${r.assessmentTitle}`);
        if (r.total != null && r.max != null && r.max > 0) {
          const p = (r.total / r.max) * 100;
          doc.text(
            `  Score: ${r.total}/${r.max} (${formatGradeDisplay(p, r.gradingScale, opts.orgSettings)})`,
            { indent: 12 },
          );
        } else {
          doc.text("  Score: —", { indent: 12 });
        }
        doc.moveDown(0.25);
      }
    }

    doc.end();
  });
}
