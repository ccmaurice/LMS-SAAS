import type { Question } from "@/generated/prisma/client";
import { sanitizeMcqForStudent } from "@/lib/assessments/mcq";

export function questionToStudentJson(q: Question) {
  return {
    id: q.id,
    assessmentId: q.assessmentId,
    type: q.type,
    prompt: q.prompt,
    order: q.order,
    points: q.points,
    options: q.type === "MCQ" ? sanitizeMcqForStudent(q.options) : q.options,
    mediaAttachments: q.mediaAttachments,
  };
}
