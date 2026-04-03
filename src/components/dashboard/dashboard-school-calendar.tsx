"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";
import {
  defaultDashboardCalendarRange,
  type DashboardCalendarItemJson,
} from "@/lib/calendar/dashboard-calendar-shared";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const ACCENT_BORDER: Record<DashboardCalendarItemJson["accent"], string> = {
  emerald: "border-l-emerald-500",
  rose: "border-l-rose-500",
  amber: "border-l-amber-500",
  violet: "border-l-violet-500",
  sky: "border-l-sky-500",
  slate: "border-l-slate-400",
};

function localYmd(d: Date) {
  return {
    y: d.getFullYear(),
    m: d.getMonth(),
    day: d.getDate(),
  };
}

function sameLocalDay(a: Date, b: Date) {
  const x = localYmd(a);
  const y = localYmd(b);
  return x.y === y.y && x.m === y.m && x.day === y.day;
}

function itemOccursOnDay(item: DashboardCalendarItemJson, day: Date): boolean {
  const start = new Date(item.startsAt);
  if (sameLocalDay(start, day)) return true;
  if (item.endsAt) {
    const end = new Date(item.endsAt);
    const t0 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0).getTime();
    const t1 = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999).getTime();
    const s = start.getTime();
    const e = end.getTime();
    return s <= t1 && e >= t0;
  }
  return false;
}

function monthGrid(year: number, monthIndex: number): { day: Date; inMonth: boolean }[] {
  const first = new Date(year, monthIndex, 1);
  const startOffset = first.getDay();
  const gridStart = new Date(year, monthIndex, 1 - startOffset);
  const cells: { day: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ day: d, inMonth: d.getMonth() === monthIndex });
  }
  return cells;
}

function rangeForMonth(year: number, monthIndex: number): { from: Date; to: Date } {
  const center = new Date(year, monthIndex, 15, 12, 0, 0, 0);
  const { rangeStart, rangeEnd } = defaultDashboardCalendarRange(center, 1);
  return { from: rangeStart, to: rangeEnd };
}

export function DashboardSchoolCalendar({
  slug,
  isAdmin,
  initialItems,
}: {
  slug: string;
  isAdmin: boolean;
  initialItems: DashboardCalendarItemJson[];
}) {
  const base = `/o/${slug}`;
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Date>(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  });

  const loadRange = useCallback(async (from: Date, to: Date) => {
    setLoading(true);
    try {
      const u = new URL("/api/me/calendar", window.location.origin);
      u.searchParams.set("from", from.toISOString());
      u.searchParams.set("to", to.toISOString());
      const res = await fetch(u.toString(), { credentials: "include" });
      const data = (await res.json()) as { items?: DashboardCalendarItemJson[] };
      if (res.ok && data.items) setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  const onPrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    const { from, to } = rangeForMonth(d.getFullYear(), d.getMonth());
    void loadRange(from, to);
  };

  const onNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    const { from, to } = rangeForMonth(d.getFullYear(), d.getMonth());
    void loadRange(from, to);
  };

  const cells = useMemo(() => monthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const itemsForSelected = useMemo(
    () => items.filter((it) => itemOccursOnDay(it, selected)),
    [items, selected],
  );

  const labelMonth = new Date(viewYear, viewMonth, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <section
      id="school-calendar"
      className="surface-bento scroll-mt-24 overflow-hidden p-0 md:p-0"
      aria-label="School calendar"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 dark:border-white/10 md:px-5">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/15">
            <CalendarDays className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-tight">School calendar</h2>
            <p className="text-xs text-muted-foreground">
              Official dates, events, and dated quizzes &amp; exams (when staff set open/due times).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <Link
              href={`${base}/admin/calendar`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Manage events
            </Link>
          ) : null}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              aria-label="Previous month"
              onClick={onPrevMonth}
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium tabular-nums">{labelMonth}</span>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
              aria-label="Next month"
              onClick={onNextMonth}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="border-b border-border/60 p-3 dark:border-white/10 md:border-b-0 md:border-r">
          <div className="grid grid-cols-7 gap-px rounded-lg border border-border/60 bg-border/40 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground dark:border-white/10">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-background px-1 py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-px grid grid-cols-7 gap-px rounded-lg border border-border/60 bg-border/40 dark:border-white/10">
            {cells.map(({ day, inMonth }) => {
              const count = items.filter((it) => itemOccursOnDay(it, day)).length;
              const isSel = sameLocalDay(day, selected);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelected(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0, 0))}
                  className={cn(
                    "relative min-h-[4.25rem] bg-background p-1 text-left text-sm transition-colors hover:bg-muted/40",
                    !inMonth && "text-muted-foreground/50",
                    isSel && "ring-1 ring-inset ring-primary/40",
                  )}
                >
                  <span className="tabular-nums">{day.getDate()}</span>
                  {count > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-0.5">
                      {Array.from({ length: Math.min(3, count) }).map((_, i) => (
                        <span
                          key={i}
                          className="block size-1.5 rounded-full bg-primary/70"
                          aria-hidden
                        />
                      ))}
                      {count > 3 ? (
                        <span className="text-[9px] text-muted-foreground">+{count - 3}</span>
                      ) : null}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          {loading ? <p className="mt-2 px-1 text-xs text-muted-foreground">Updating…</p> : null}
        </div>

        <div className="flex flex-col gap-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {selected.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          {itemsForSelected.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled this day.</p>
          ) : (
            <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
              {itemsForSelected.map((it) => {
                const card = (
                  <div
                    className={cn(
                      "rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm dark:border-white/10",
                      "border-l-4",
                      ACCENT_BORDER[it.accent],
                    )}
                  >
                    <p className="font-medium leading-snug">{it.title}</p>
                    {it.subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{it.subtitle}</p> : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {it.allDay
                        ? "All day"
                        : `${new Date(it.startsAt).toLocaleTimeString(undefined, { timeStyle: "short" })}`}
                      {it.source === "school" ? ` · School` : ` · ${it.kind === "DUE" ? "Due" : "Opens"}`}
                    </p>
                  </div>
                );
                return (
                  <li key={it.id}>
                    {it.href ? (
                      <Link href={it.href} className="block transition-opacity hover:opacity-90">
                        {card}
                      </Link>
                    ) : (
                      card
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-auto pt-2 text-[10px] text-muted-foreground">
            Change month to load a wider date window. Linked quizzes and exams respect class or department targeting.
          </p>
        </div>
      </div>
    </section>
  );
}
