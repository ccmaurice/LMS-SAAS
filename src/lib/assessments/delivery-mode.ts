import type { AssessmentDeliveryMode } from "@/generated/prisma/enums";

/** i18n keys — pass `t` from `useI18n()` or `getServerT()` for translated UI. */
export type DeliveryModeT = (key: string) => string;

export function deliveryModeShortLabel(mode: AssessmentDeliveryMode, t?: DeliveryModeT): string {
  if (t) {
    const k =
      mode === "FORMATIVE"
        ? "assessments.delivery.shortFormative"
        : mode === "SECURE_ONLINE"
          ? "assessments.delivery.shortSecureOnline"
          : mode === "LOCKDOWN"
            ? "assessments.delivery.shortLockdown"
            : "";
    if (k) return t(k);
  }
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
export function deliveryModeBadgeLabel(mode: AssessmentDeliveryMode, t?: DeliveryModeT): string {
  if (t) {
    const k =
      mode === "FORMATIVE"
        ? "assessments.delivery.badgeFormative"
        : mode === "SECURE_ONLINE"
          ? "assessments.delivery.badgeSecure"
          : mode === "LOCKDOWN"
            ? "assessments.delivery.badgeLockdown"
            : "";
    if (k) return t(k);
  }
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

export function deliveryModeStudentNote(mode: AssessmentDeliveryMode, t?: DeliveryModeT): string | null {
  if (t) {
    if (mode === "SECURE_ONLINE") return t("assessments.delivery.noteSecureOnline");
    if (mode === "LOCKDOWN") return t("assessments.delivery.noteLockdown");
    return null;
  }
  switch (mode) {
    case "SECURE_ONLINE":
      return "This assessment may log when you leave the window or switch tabs.";
    case "LOCKDOWN":
      return "Strict mode: limited copy/paste and context menu outside answers; leaving the window may be logged.";
    default:
      return null;
  }
}
