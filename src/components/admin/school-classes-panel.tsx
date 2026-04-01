"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EducationLevel } from "@/generated/prisma/enums";

type StaffOpt = { id: string; name: string | null; email: string; role: string };

type CohortList = {
  id: string;
  name: string;
  gradeLabel: string | null;
  trackLabel: string | null;
  academicYearLabel: string;
  _count: { members: number };
  homeroomTeacher: { id: string; name: string | null; email: string } | null;
};

type MemberRow = {
  user: { id: string; name: string | null; email: string };
};

type InstructorRow = {
  user: { id: string; name: string | null; email: string; role: string };
};

type CohortDetail = {
  id: string;
  name: string;
  gradeLabel: string | null;
  trackLabel: string | null;
  academicYearLabel: string;
  homeroomTeacher: { id: string; name: string | null; email: string } | null;
  instructors: InstructorRow[];
  members: MemberRow[];
};

function staffLabel(s: StaffOpt) {
  return `${s.name?.trim() || s.email} (${s.role})`;
}

export function SchoolClassesPanel({
  educationLevel,
  staffOptions,
}: {
  educationLevel: EducationLevel;
  staffOptions: StaffOpt[];
}) {
  const [cohorts, setCohorts] = useState<CohortList[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CohortDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [trackLabel, setTrackLabel] = useState("");
  const [createHomeroomId, setCreateHomeroomId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGradeLabel, setEditGradeLabel] = useState("");
  const [editTrackLabel, setEditTrackLabel] = useState("");
  const [editYearLabel, setEditYearLabel] = useState("");
  const [editHomeroomId, setEditHomeroomId] = useState("");
  const [coTeacherEmail, setCoTeacherEmail] = useState("");

  const loadList = useCallback(async () => {
    const res = await fetch("/api/admin/school-cohorts", { credentials: "include" });
    const data = (await res.json()) as { cohorts?: CohortList[] };
    if (!res.ok) {
      toast.error("Could not load classes");
      return;
    }
    setCohorts(data.cohorts ?? []);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/school-cohorts/${id}`, { credentials: "include" });
    const data = (await res.json()) as { cohort?: CohortDetail };
    if (!res.ok) {
      toast.error("Could not load roster");
      return;
    }
    setDetail(data.cohort ?? null);
  }, []);

  useEffect(() => {
    void loadList().finally(() => setLoading(false));
  }, [loadList]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  useEffect(() => {
    if (!detail) {
      setEditName("");
      setEditGradeLabel("");
      setEditTrackLabel("");
      setEditYearLabel("");
      setEditHomeroomId("");
      return;
    }
    setEditName(detail.name);
    setEditGradeLabel(detail.gradeLabel ?? "");
    setEditTrackLabel(detail.trackLabel ?? "");
    setEditYearLabel(detail.academicYearLabel ?? "");
    setEditHomeroomId(detail.homeroomTeacher?.id ?? "");
  }, [detail]);

  async function saveCohortEdits() {
    if (!selected || !editName.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/school-cohorts/${selected}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          gradeLabel: editGradeLabel.trim() || null,
          trackLabel: editTrackLabel.trim() || null,
          academicYearLabel: editYearLabel.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Save failed");
        return;
      }
      await loadDetail(selected);
      await loadList();
      toast.success("Saved");
    } finally {
      setBusy(false);
    }
  }

  async function saveHomeroomTeacher() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/school-cohorts/${selected}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeroomTeacherId: editHomeroomId ? editHomeroomId : null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Could not update homeroom teacher");
        return;
      }
      await loadDetail(selected);
      await loadList();
      toast.success("Homeroom teacher updated");
    } finally {
      setBusy(false);
    }
  }

  async function addCoTeacher() {
    if (!selected || !coTeacherEmail.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/school-cohorts/${selected}/instructors`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: coTeacherEmail.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Add failed");
        return;
      }
      setCoTeacherEmail("");
      await loadDetail(selected);
      toast.success("Co-teacher added");
    } finally {
      setBusy(false);
    }
  }

  async function removeCoTeacher(userId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/school-cohorts/${selected}/instructors?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(typeof d.error === "string" ? d.error : "Remove failed");
        return;
      }
      await loadDetail(selected);
      toast.success("Removed");
    } finally {
      setBusy(false);
    }
  }

  async function createCohort() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        gradeLabel: gradeLabel.trim() || null,
        trackLabel: trackLabel.trim() || null,
      };
      if (createHomeroomId) body.homeroomTeacherId = createHomeroomId;
      const res = await fetch("/api/admin/school-cohorts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Create failed");
        return;
      }
      setName("");
      setGradeLabel("");
      setTrackLabel("");
      setCreateHomeroomId("");
      await loadList();
      toast.success("Class created");
    } finally {
      setBusy(false);
    }
  }

  async function addStudent() {
    if (!selected || !email.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/school-cohorts/${selected}/members`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Add failed");
        return;
      }
      setEmail("");
      await loadDetail(selected);
      await loadList();
      toast.success("Student added to class");
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(userId: string) {
    if (!selected) return;
    const res = await fetch(
      `/api/admin/school-cohorts/${selected}/members?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE", credentials: "include" },
    );
    if (!res.ok) {
      toast.error("Remove failed");
      return;
    }
    await loadDetail(selected);
    await loadList();
    toast.success("Removed from class");
  }

  async function deleteCohort(id: string) {
    if (!confirm("Delete this class and all memberships?")) return;
    const res = await fetch(`/api/admin/school-cohorts/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      toast.error("Delete failed");
      return;
    }
    if (selected === id) setSelected(null);
    await loadList();
    toast.success("Class deleted");
  }

  const additionalCoTeachers =
    detail?.instructors.filter((r) => r.user.id !== detail.homeroomTeacher?.id) ?? [];

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <section className="surface-bento space-y-3 p-5">
        <h2 className="text-lg font-semibold">
          {educationLevel === "SECONDARY" ? "New form group" : "New class / homeroom"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {educationLevel === "SECONDARY"
            ? "Form groups replace primary “classes” in secondary school. Add an optional track or pathway label (e.g. IB, Sciences) to distinguish parallel groups."
            : "Primary schools use this roster for homeroom classes. Students see assignments on their Settings page."}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Display name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={educationLevel === "SECONDARY" ? "Year 10 – Form B" : "Grade 3 – Section A"}
            />
          </div>
          <div className="space-y-1">
            <Label>Grade label (optional)</Label>
            <Input value={gradeLabel} onChange={(e) => setGradeLabel(e.target.value)} placeholder="Year 10" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Homeroom teacher (optional)</Label>
            <select
              className="flex h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm"
              value={createHomeroomId}
              onChange={(e) => setCreateHomeroomId(e.target.value)}
            >
              <option value="">— None —</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {staffLabel(s)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Main teacher for this class; can link the class to their courses for assessment groups. Add co-teachers after
              the class exists.
            </p>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Track / pathway (optional)</Label>
            <Input
              value={trackLabel}
              onChange={(e) => setTrackLabel(e.target.value)}
              placeholder={educationLevel === "SECONDARY" ? "e.g. Sciences, IB Diploma" : "e.g. Gifted stream"}
            />
            <p className="text-xs text-muted-foreground">
              Shown on student and staff hubs alongside the academic year. Leave blank if not used.
            </p>
          </div>
        </div>
        <Button type="button" disabled={busy} onClick={() => void createCohort()}>
          {educationLevel === "SECONDARY" ? "Create form group" : "Create class"}
        </Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-table-wrap">
          <h3 className="border-b border-border px-4 py-3 text-sm font-semibold dark:border-white/10">
            {educationLevel === "SECONDARY" ? "All form groups" : "All classes"}
          </h3>
          <ul className="divide-y divide-border dark:divide-white/10">
            {cohorts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <button
                  type="button"
                  className={`text-left text-sm font-medium ${selected === c.id ? "text-primary" : ""}`}
                  onClick={() => setSelected(c.id === selected ? null : c.id)}
                >
                  {c.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {c._count.members} students
                    {c.gradeLabel ? ` · ${c.gradeLabel}` : ""}
                    {c.trackLabel ? ` · ${c.trackLabel}` : ""}
                    {c.homeroomTeacher ? ` · ${c.homeroomTeacher.name?.trim() || c.homeroomTeacher.email}` : ""}
                  </span>
                </button>
                <Button type="button" variant="ghost" size="sm" onClick={() => void deleteCohort(c.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
          {cohorts.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {educationLevel === "SECONDARY" ? "No form groups yet." : "No classes yet."}
            </p>
          ) : null}
        </section>

        <section className="surface-bento space-y-4 p-5">
          <h3 className="text-sm font-semibold">
            {educationLevel === "SECONDARY" ? "Form group detail & roster" : "Class detail & roster"}
          </h3>
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Select {educationLevel === "SECONDARY" ? "a form group" : "a class"} to edit staff, labels, and students.
            </p>
          ) : (
            <>
              <div className="space-y-3 rounded-lg border border-border/70 p-3 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Homeroom teacher</p>
                <p className="text-xs text-muted-foreground">
                  Lead teacher for this class. Course authors who teach this class can link it under Edit course → Classes
                  taking this course.
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label htmlFor="homeroom-pick">Teacher</Label>
                    <select
                      id="homeroom-pick"
                      className="flex h-9 min-w-[240px] rounded-md border border-input bg-background px-2 text-sm"
                      value={editHomeroomId}
                      onChange={(e) => setEditHomeroomId(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {staffOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {staffLabel(s)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void saveHomeroomTeacher()}>
                    Save homeroom teacher
                  </Button>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 p-3 dark:border-white/10">
                <p className="text-sm font-medium">Co-teachers</p>
                <p className="text-xs text-muted-foreground">
                  Additional teachers assigned to this class (team-teaching). Use their school email; they must already be
                  a teacher or admin member.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    className="max-w-xs"
                    placeholder="Teacher email"
                    value={coTeacherEmail}
                    onChange={(e) => setCoTeacherEmail(e.target.value)}
                  />
                  <Button type="button" size="sm" disabled={busy} onClick={() => void addCoTeacher()}>
                    Add co-teacher
                  </Button>
                </div>
                {additionalCoTeachers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No co-teachers yet (homeroom teacher is not listed here).</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {additionalCoTeachers.map((r) => (
                      <li
                        key={r.user.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border/80 px-3 py-2 dark:border-white/10"
                      >
                        <span>
                          {r.user.name?.trim() || r.user.email}
                          <span className="ml-2 text-xs text-muted-foreground">({r.user.role})</span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void removeCoTeacher(r.user.id)}
                        >
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-3 rounded-lg border border-border/70 p-3 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Labels</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="edit-name">Display name</Label>
                    <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-grade">Grade label</Label>
                    <Input id="edit-grade" value={editGradeLabel} onChange={(e) => setEditGradeLabel(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-year">Academic year</Label>
                    <Input id="edit-year" value={editYearLabel} onChange={(e) => setEditYearLabel(e.target.value)} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label htmlFor="edit-track">Track / pathway</Label>
                    <Input id="edit-track" value={editTrackLabel} onChange={(e) => setEditTrackLabel(e.target.value)} />
                  </div>
                </div>
                <Button type="button" size="sm" disabled={busy} onClick={() => void saveCohortEdits()}>
                  Save labels
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="Student email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button type="button" size="sm" disabled={busy} onClick={() => void addStudent()}>
                  Add student
                </Button>
              </div>
              <ul className="space-y-2 text-sm">
                {detail?.members.map((m) => (
                  <li
                    key={m.user.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border/80 px-3 py-2 dark:border-white/10"
                  >
                    <span>
                      {m.user.name?.trim() || m.user.email}
                      <span className="ml-2 text-xs text-muted-foreground">{m.user.email}</span>
                    </span>
                    <Button type="button" variant="outline" size="sm" onClick={() => void removeStudent(m.user.id)}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              {detail && detail.members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No students in this class yet.</p>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
