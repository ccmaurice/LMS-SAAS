import type { OrganizationSettings } from "@/lib/education_context/schema";

export type TranscriptPdfRow = {
  courseTitle: string;
  termLabel: string | null;
  credits: number;
  gradeLine: string;
  gpaPoints: string;
};

export type TranscriptPdfSemesterSummary = {
  semester: number;
  termGpa: string;
  avgPercent: string;
  credits: string;
};

export async function buildTranscriptPdfBuffer(opts: {
  orgName: string;
  academicYearLabel: string;
  studentLabel: string;
  cumulativeGpa: string;
  creditsAttempted: string;
  showGpaColumn: boolean;
  rows: TranscriptPdfRow[];
  /** Shown below the course list when `showGpaColumn` is true */
  semesterSummaries?: TranscriptPdfSemesterSummary[];
  /** Calendar filter line (terms or semesters, from `AcademicTerm`). */
  scopeSubtitle?: string | null;
  orgSettings?: OrganizationSettings;
  /** Optional school logo (PNG/JPEG/WebP/GIF) */
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
        /* ignore corrupt / unsupported image */
      }
    }

    doc.fontSize(16).text(opts.orgName, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Academic transcript · ${opts.academicYearLabel}`);
    if (opts.scopeSubtitle?.trim()) {
      doc.fontSize(10).text(opts.scopeSubtitle.trim());
    }
    doc.text(`Student: ${opts.studentLabel}`);
    if (opts.showGpaColumn) {
      doc.text(`Cumulative GPA: ${opts.cumulativeGpa} · Credits (graded): ${opts.creditsAttempted}`);
    }
    doc.moveDown();
    doc.fontSize(10);

    if (opts.rows.length === 0) {
      doc.text("No course enrollments in this export.");
    } else {
      for (const r of opts.rows) {
        doc.text(`${r.courseTitle}${r.termLabel ? ` · ${r.termLabel}` : ""}`);
        doc.text(`  Credits: ${r.credits} · Grade: ${r.gradeLine}${opts.showGpaColumn ? ` · GPA: ${r.gpaPoints}` : ""}`, {
          indent: 12,
        });
        doc.moveDown(0.25);
      }
    }

    if (opts.showGpaColumn && opts.semesterSummaries && opts.semesterSummaries.length > 0) {
      doc.moveDown();
      doc.fontSize(10).text("GPA by semester (1–3)", { underline: true });
      doc.moveDown(0.35);
      doc.fontSize(9);
      for (const s of opts.semesterSummaries) {
        doc.text(
          `Semester ${s.semester}: GPA ${s.termGpa} · Avg ${s.avgPercent} · Credits ${s.credits}`,
          { indent: 8 },
        );
        doc.moveDown(0.2);
      }
    }

    doc.end();
  });
}
