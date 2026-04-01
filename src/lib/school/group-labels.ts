import type { EducationLevel } from "@/generated/prisma/enums";

/** Sidebar / page title for the academic grouping hub (classes vs departments). */
export function navAcademicGroupsLabel(level: EducationLevel): string {
  switch (level) {
    case "PRIMARY":
      return "Classes";
    case "SECONDARY":
      return "Form groups";
    case "HIGHER_ED":
      return "Departments";
    default:
      return "Classes";
  }
}

export function cohortKindNoun(level: EducationLevel): string {
  switch (level) {
    case "PRIMARY":
      return "class";
    case "SECONDARY":
      return "form group";
    case "HIGHER_ED":
      return "department";
    default:
      return "class";
  }
}
