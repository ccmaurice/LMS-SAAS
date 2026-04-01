"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Division = { id: string; name: string; code: string | null; sortOrder: number; _count: { departments: number } };
type DeptRow = {
  id: string;
  name: string;
  code: string | null;
  facultyDivision: { id: string; name: string } | null;
  chair: { id: string; name: string | null; email: string } | null;
  _count: { instructors: number; studentAffiliations: number };
};

type InstructorRow = { user: { id: string; name: string | null; email: string; role: string } };
type StudentRow = { user: { id: string; name: string | null; email: string }; isPrimary: boolean };

type DeptDetail = {
  id: string;
  name: string;
  code: string | null;
  facultyDivision: { id: string; name: string } | null;
  chair: { id: string; name: string | null; email: string } | null;
  instructors: InstructorRow[];
  studentAffiliations: StudentRow[];
};

export function DepartmentsAdminPanel() {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<DeptDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [divName, setDivName] = useState("");
  const [divCode, setDivCode] = useState("");

  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDivisionId, setDeptDivisionId] = useState("");
  const [deptChairEmail, setDeptChairEmail] = useState("");

  const [chairEmail, setChairEmail] = useState("");
  const [instrEmail, setInstrEmail] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentPrimary, setStudentPrimary] = useState(true);

  const loadDivisions = useCallback(async () => {
    const res = await fetch("/api/admin/faculty-divisions", { credentials: "include" });
    const data = (await res.json()) as { divisions?: Division[] };
    if (!res.ok) {
      toast.error("Could not load faculty divisions");
      return;
    }
    setDivisions(data.divisions ?? []);
  }, []);

  const loadDepartments = useCallback(async () => {
    const res = await fetch("/api/admin/academic-departments", { credentials: "include" });
    const data = (await res.json()) as { departments?: DeptRow[] };
    if (!res.ok) {
      toast.error("Could not load departments");
      return;
    }
    setDepartments(data.departments ?? []);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/academic-departments/${id}`, { credentials: "include" });
    const data = (await res.json()) as { department?: DeptDetail };
    if (!res.ok) {
      toast.error("Could not load department");
      return;
    }
    setDetail(data.department ?? null);
    setChairEmail("");
  }, []);

  useEffect(() => {
    void Promise.all([loadDivisions(), loadDepartments()]).finally(() => setLoading(false));
  }, [loadDivisions, loadDepartments]);

  useEffect(() => {
    if (selected) void loadDetail(selected);
    else setDetail(null);
  }, [selected, loadDetail]);

  async function createDivision() {
    if (!divName.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/faculty-divisions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: divName.trim(),
          code: divCode.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(d.error ?? "Create failed");
        return;
      }
      setDivName("");
      setDivCode("");
      await loadDivisions();
      toast.success("Faculty division created");
    } finally {
      setBusy(false);
    }
  }

  async function createDepartment() {
    if (!deptName.trim()) {
      toast.error("Name is required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/academic-departments", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deptName.trim(),
          code: deptCode.trim() || null,
          facultyDivisionId: deptDivisionId || null,
          chairEmail: deptChairEmail.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(typeof d.error === "string" ? d.error : "Create failed");
        return;
      }
      setDeptName("");
      setDeptCode("");
      setDeptChairEmail("");
      await loadDepartments();
      toast.success("Department created");
    } finally {
      setBusy(false);
    }
  }

  async function updateChair() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/academic-departments/${selected}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chairEmail: chairEmail.trim() === "" ? "" : chairEmail.trim().toLowerCase(),
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(typeof d.error === "string" ? d.error : "Update failed");
        return;
      }
      setChairEmail("");
      await loadDetail(selected);
      await loadDepartments();
      toast.success("Chair updated");
    } finally {
      setBusy(false);
    }
  }

  async function addInstructor() {
    if (!selected || !instrEmail.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/academic-departments/${selected}/instructors`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: instrEmail.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(typeof d.error === "string" ? d.error : "Add failed");
        return;
      }
      setInstrEmail("");
      await loadDetail(selected);
      toast.success("Instructor added");
    } finally {
      setBusy(false);
    }
  }

  async function removeInstructor(userId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/academic-departments/${selected}/instructors?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        toast.error("Remove failed");
        return;
      }
      await loadDetail(selected);
      toast.success("Removed");
    } finally {
      setBusy(false);
    }
  }

  async function addStudent() {
    if (!selected || !studentEmail.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/academic-departments/${selected}/students`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: studentEmail.trim().toLowerCase(),
          isPrimary: studentPrimary,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        toast.error(typeof d.error === "string" ? d.error : "Add failed");
        return;
      }
      setStudentEmail("");
      await loadDetail(selected);
      await loadDepartments();
      toast.success("Student affiliated");
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(userId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/admin/academic-departments/${selected}/students?userId=${encodeURIComponent(userId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        toast.error("Remove failed");
        return;
      }
      await loadDetail(selected);
      await loadDepartments();
      toast.success("Removed");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDepartment(id: string) {
    if (!confirm("Delete this department and all links?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/academic-departments/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        toast.error("Delete failed");
        return;
      }
      if (selected === id) setSelected(null);
      await loadDepartments();
      toast.success("Department deleted");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <section className="surface-bento space-y-3 p-5">
        <h2 className="text-lg font-semibold">Faculty divisions</h2>
        <p className="text-sm text-muted-foreground">
          Optional groupings (e.g. Faculty of Science). Departments can sit under a division for clearer navigation.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            className="max-w-xs"
            placeholder="Division name"
            value={divName}
            onChange={(e) => setDivName(e.target.value)}
          />
          <Input
            className="max-w-[120px]"
            placeholder="Code"
            value={divCode}
            onChange={(e) => setDivCode(e.target.value)}
          />
          <Button type="button" disabled={busy} onClick={() => void createDivision()}>
            Add division
          </Button>
        </div>
        <ul className="text-sm text-muted-foreground">
          {divisions.map((d) => (
            <li key={d.id}>
              {d.name}
              {d.code ? ` (${d.code})` : ""} · {d._count.departments} departments
            </li>
          ))}
        </ul>
      </section>

      <section className="surface-bento space-y-3 p-5">
        <h2 className="text-lg font-semibold">New academic department</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="Computer Science" />
          </div>
          <div className="space-y-1">
            <Label>Code (optional)</Label>
            <Input value={deptCode} onChange={(e) => setDeptCode(e.target.value)} placeholder="CS" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Faculty division (optional)</Label>
            <select
              className="h-9 w-full max-w-md rounded-md border border-input bg-background px-2 text-sm"
              value={deptDivisionId}
              onChange={(e) => setDeptDivisionId(e.target.value)}
            >
              <option value="">— None —</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Chair email (optional)</Label>
            <Input
              type="email"
              value={deptChairEmail}
              onChange={(e) => setDeptChairEmail(e.target.value)}
              placeholder="chair@school.edu"
            />
          </div>
        </div>
        <Button type="button" disabled={busy} onClick={() => void createDepartment()}>
          Create department
        </Button>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface-table-wrap">
          <h3 className="border-b border-border px-4 py-3 text-sm font-semibold dark:border-white/10">
            Departments
          </h3>
          <ul className="divide-y divide-border dark:divide-white/10">
            {departments.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <button
                  type="button"
                  className={`text-left text-sm font-medium ${selected === d.id ? "text-primary" : ""}`}
                  onClick={() => setSelected(d.id === selected ? null : d.id)}
                >
                  {d.name}
                  <span className="ml-2 block text-xs font-normal text-muted-foreground sm:inline">
                    {d.code ? `${d.code} · ` : ""}
                    {d.facultyDivision?.name ?? "No division"} · {d._count.studentAffiliations} students ·{" "}
                    {d._count.instructors} instructors
                  </span>
                </button>
                <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void deleteDepartment(d.id)}>
                  Delete
                </Button>
              </li>
            ))}
          </ul>
          {departments.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No departments yet.</p> : null}
        </section>

        <section className="surface-bento space-y-4 p-5">
          <h3 className="text-sm font-semibold">Department detail</h3>
          {!selected || !detail ? (
            <p className="text-sm text-muted-foreground">Select a department to manage chair, faculty, and students.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Chair (school email)</Label>
                <p className="text-xs text-muted-foreground">
                  Current: {detail.chair ? detail.chair.email : "—"} · Leave empty and save to clear.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    className="max-w-xs"
                    placeholder="chair@school.edu"
                    value={chairEmail}
                    onChange={(e) => setChairEmail(e.target.value)}
                  />
                  <Button type="button" size="sm" disabled={busy} onClick={() => void updateChair()}>
                    Save chair
                  </Button>
                </div>
              </div>

              <div className="space-y-2 border-t border-border pt-4 dark:border-white/10">
                <p className="text-sm font-medium">Instructors</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    className="max-w-xs"
                    placeholder="Teacher email"
                    value={instrEmail}
                    onChange={(e) => setInstrEmail(e.target.value)}
                  />
                  <Button type="button" size="sm" disabled={busy} onClick={() => void addInstructor()}>
                    Add
                  </Button>
                </div>
                <ul className="space-y-1 text-sm">
                  {detail.instructors.map((r) => (
                    <li key={r.user.id} className="flex items-center justify-between gap-2 rounded-md border border-border/80 px-2 py-1 dark:border-white/10">
                      <span>
                        {r.user.name?.trim() || r.user.email}{" "}
                        <span className="text-xs text-muted-foreground">({r.user.role})</span>
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy || detail.chair?.id === r.user.id}
                        onClick={() => void removeInstructor(r.user.id)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2 border-t border-border pt-4 dark:border-white/10">
                <p className="text-sm font-medium">Students</p>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={studentPrimary} onChange={(e) => setStudentPrimary(e.target.checked)} />
                  Mark as primary department for these students
                </label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="email"
                    className="max-w-xs"
                    placeholder="Student email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                  />
                  <Button type="button" size="sm" disabled={busy} onClick={() => void addStudent()}>
                    Add student
                  </Button>
                </div>
                <ul className="space-y-1 text-sm">
                  {detail.studentAffiliations.map((r) => (
                    <li key={r.user.id} className="flex items-center justify-between gap-2 rounded-md border border-border/80 px-2 py-1 dark:border-white/10">
                      <span>
                        {r.user.name?.trim() || r.user.email}
                        {r.isPrimary ? (
                          <span className="ml-2 rounded bg-primary/10 px-1 text-xs text-primary">Primary</span>
                        ) : null}
                      </span>
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void removeStudent(r.user.id)}>
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
