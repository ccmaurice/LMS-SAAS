import type { Question } from "@/generated/prisma/client";
import { sanitizeMcqForStudent, shuffleMcqForStudent } from "@/lib/assessments/mcq";
import { stripDragDropCorrectForStudent } from "@/lib/assessments/drag-drop-schema";

export function questionToStudentJson(q: Question, opts?: { shuffleOptions?: boolean }) {
  const mcq =
    q.type === "MCQ"
      ? opts?.shuffleOptions
        ? shuffleMcqForStudent(q.options)
        : sanitizeMcqForStudent(q.options)
      : q.options;
  const questionSchema =
    q.type === "DRAG_DROP" ? stripDragDropCorrectForStudent(q.questionSchema) : q.questionSchema;
  return {
    id: q.id,
    assessmentId: q.assessmentId,
    type: q.type,
    prompt: q.prompt,
    order: q.order,
    points: q.points,
    options: mcq,
    correctAnswer: null,
    markingScheme: null,
    rubric: null,
    mediaAttachments: q.mediaAttachments,
    questionSchema: questionSchema ?? null,
  };
}
