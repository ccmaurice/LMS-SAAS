import type { EducationLevel } from "@/generated/prisma/enums";

/** Default UI labels (keys are capitalized role / surface names). */
export const DEFAULT_TERMINOLOGY: Record<EducationLevel, Record<string, string>> = {
  PRIMARY: {
    Teacher: "Teacher",
    Student: "Learner",
    Course: "Subject",
    Assessment: "Activity",
    Class: "Class",
    Term: "Term",
    Homeroom: "Homeroom",
  },
  SECONDARY: {
    Teacher: "Teacher",
    Student: "Student",
    Course: "Course",
    Assessment: "Assessment",
    Class: "Homeroom",
    Term: "Term",
  },
  HIGHER_ED: {
    Teacher: "Instructor",
    Student: "Student",
    Course: "Course",
    Assessment: "Assessment",
    Class: "Cohort",
    Term: "Term",
  },
};

export function defaultTerminologyForLevel(level: EducationLevel): Record<string, string> {
  return { ...DEFAULT_TERMINOLOGY[level] };
}
