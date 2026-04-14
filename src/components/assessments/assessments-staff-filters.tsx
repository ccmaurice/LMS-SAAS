"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import type { EducationLevel } from "@/generated/prisma/enums";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Label } from "@/components/ui/label";

export type CohortFilterOption = { id: string; name: string; academicYearLabel: string | null };

export type DepartmentFilterOption = { id: string; name: string; code: string | null };

export function AssessmentsStaffFilters({
  slug,
  educationLevel,
  cohorts,
  years,
  departments,
}: {
  slug: string;
  educationLevel: EducationLevel;
  cohorts: CohortFilterOption[];
  years: string[];
  departments: DepartmentFilterOption[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const cohortId = sp.get("cohort") ?? "";
  const year = sp.get("year") ?? "";
  const deptId = sp.get("dept") ?? "";

  const setParamsK12 = useCallback(
    (next: { cohort?: string; year?: string }) => {
      const p = new URLSearchParams(sp.toString());
      p.delete("dept");
      const c = next.cohort !== undefined ? next.cohort : cohortId;
      const y = next.year !== undefined ? next.year : year;
      if (c) p.set("cohort", c);
      else p.delete("cohort");
      if (y) p.set("year", y);
      else p.delete("year");
      const q = p.toString();
      startTransition(() => {
        router.push(q ? `/o/${slug}/assessments?${q}` : `/o/${slug}/assessments`);
      });
    },
    [router, slug, sp, cohortId, year],
  );

  const setParamsHe = useCallback(
    (next: { dept?: string }) => {
      const p = new URLSearchParams(sp.toString());
      p.delete("cohort");
      p.delete("year");
      const d = next.dept !== undefined ? next.dept : deptId;
      if (d) p.set("dept", d);
      else p.delete("dept");
      const q = p.toString();
      startTransition(() => {
        router.push(q ? `/o/${slug}/assessments?${q}` : `/o/${slug}/assessments`);
      });
    },
    [router, slug, sp, deptId],
  );

  const yearOptions = useMemo(() => [...years].sort(), [years]);

  if (educationLevel === "HIGHER_ED") {
    return (
      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 dark:border-white/10">
        <div className="space-y-1.5">
          <Label htmlFor="flt-dept">{t("assessments.filterDepartment")}</Label>
          <select
            id="flt-dept"
            disabled={pending}
            className="flex h-9 min-w-[240px] rounded-md border border-input bg-background px-2 text-sm"
            value={deptId}
            onChange={(e) => setParamsHe({ dept: e.target.value })}
          >
            <option value="">{t("assessments.filterAllDepartments")}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.code ? ` (${d.code})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  const cohortLabel =
    educationLevel === "SECONDARY" ? t("assessments.filterFormGroup") : t("assessments.filterClass");
  const allCohortOption =
    educationLevel === "SECONDARY" ? t("assessments.filterAllFormGroups") : t("assessments.filterAllClasses");

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border/80 bg-muted/20 p-4 dark:border-white/10">
      <div className="space-y-1.5">
        <Label htmlFor="flt-cohort">{cohortLabel}</Label>
        <select
          id="flt-cohort"
          disabled={pending}
          className="flex h-9 min-w-[200px] rounded-md border border-input bg-background px-2 text-sm"
          value={cohortId}
          onChange={(e) => setParamsK12({ cohort: e.target.value })}
        >
          <option value="">{allCohortOption}</option>
          {cohorts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.academicYearLabel ? ` (${c.academicYearLabel})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="flt-year">{t("assessments.filterAcademicYear")}</Label>
        <select
          id="flt-year"
          disabled={pending}
          className="flex h-9 min-w-[180px] rounded-md border border-input bg-background px-2 text-sm"
          value={year}
          onChange={(e) => setParamsK12({ year: e.target.value })}
        >
          <option value="">{t("assessments.filterAllYears")}</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
