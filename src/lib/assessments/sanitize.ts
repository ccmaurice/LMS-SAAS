import type { Question } from "@/generated/prisma/client";
import { sanitizeMcqForStudent, shuffleMcqForStudent } from "@/lib/assessments/mcq";

export function questionToStudentJson(q: Question, opts?: { shuffleOptions?: boolean }) {
  const mcq =
    q.type === "MCQ"
      ? opts?.shuffleOptions
        ? shuffleMcqForStudent(q.options)
        : sanitizeMcqForStudent(q.options)
      : q.options;
  return {
    id: q.id,
    assessmentId: q.assessmentId,
    type: q.type,
    prompt: q.prompt,
    order: q.order,
    points: q.points,
    options: mcq,
    mediaAttachments: q.mediaAttachments,
  };
}
