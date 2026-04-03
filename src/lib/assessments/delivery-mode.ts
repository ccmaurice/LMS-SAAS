import type { AssessmentDeliveryMode } from "@/generated/prisma/enums";

export function deliveryModeShortLabel(mode: AssessmentDeliveryMode): string {
  switch (mode) {
    case "FORMATIVE":
      return "Formative";
    case "SECURE_ONLINE":
      return "Secure online";
    case "LOCKDOWN":
      return "Lockdown";
    default:
      return String(mode);
  }
}

/** Badge-style label for compact UI. */
export function deliveryModeBadgeLabel(mode: AssessmentDeliveryMode): string {
  switch (mode) {
    case "FORMATIVE":
      return "Formative";
    case "SECURE_ONLINE":
      return "Secure";
    case "LOCKDOWN":
      return "Lockdown";
    default:
      return String(mode);
  }
}

export function deliveryModeStudentNote(mode: AssessmentDeliveryMode): string | null {
  switch (mode) {
    case "SECURE_ONLINE":
      return "This assessment may log when you leave the window or switch tabs.";
    case "LOCKDOWN":
      return "Strict mode: limited copy/paste and context menu outside answers; leaving the window may be logged.";
    default:
      return null;
  }
}
