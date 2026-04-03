export type DashboardCalendarItemSource = "school" | "assessment";

export type DashboardCalendarItemJson = {
  id: string;
  source: DashboardCalendarItemSource;
  kind: string;
  title: string;
  subtitle: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  href: string | null;
  accent: "emerald" | "rose" | "amber" | "violet" | "sky" | "slate";
};

/** First day of (month − pad) through first day of (month + pad + 1) in local time — matches dashboard month navigation. */
export function defaultDashboardCalendarRange(center: Date, monthsPad = 2): { rangeStart: Date; rangeEnd: Date } {
  const y = center.getFullYear();
  const m = center.getMonth();
  const rangeStart = new Date(y, m - monthsPad, 1, 0, 0, 0, 0);
  const rangeEnd = new Date(y, m + monthsPad + 1, 1, 0, 0, 0, 0);
  return { rangeStart, rangeEnd };
}
