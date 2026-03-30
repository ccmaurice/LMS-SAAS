"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export type EditableLessonFile = { id: string; name: string; url: string };

export type EditableLesson = {
  id: string;
  title: string;
  content: string | null;
  videoUrl: string | null;
  order: number;
  files: EditableLessonFile[];
};

export type EditableModule = {
  id: string;
  title: string;
  order: number;
  lessons: EditableLesson[];
};

export type EditableCourse = {
  id: string;
  title: string;
  description: string | null;
  published: boolean;
  modules: EditableModule[];
};

export function CourseEditor({ orgSlug, initial }: { orgSlug: string; initial: EditableCourse }) {
  const router = useRouter();
  const [course, setCourse] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description ?? "");
  const [published, setPublished] = useState(initial.published);
  const [savingMeta, setSavingMeta] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, { title: string; content: string; videoUrl: string }>>(
    {},
  );

  async function saveMeta() {
    setSavingMeta(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          published,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { course: EditableCourse };
      if (data.course) {
        setCourse((c) => ({ ...c, ...data.course, modules: data.course.modules ?? c.modules }));
      }
      router.refresh();
    } finally {
      setSavingMeta(false);
    }
  }

  async function addModule() {
    if (!newModuleTitle.trim()) return;
    const res = await fetch(`/api/courses/${course.id}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newModuleTitle.trim() }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { module: EditableModule };
    setCourse((c) => ({ ...c, modules: [...c.modules, { ...data.module, lessons: [] }] }));
    setNewModuleTitle("");
    router.refresh();
  }

  async function removeModule(moduleId: string) {
    if (!confirm("Delete this module and all its lessons?")) return;
    const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
    if (!res.ok) return;
    setCourse((c) => ({ ...c, modules: c.modules.filter((m) => m.id !== moduleId) }));
    router.refresh();
  }

  async function addLesson(moduleId: string) {
    const d = lessonDrafts[moduleId] ?? { title: "", content: "", videoUrl: "" };
    if (!d.title.trim()) return;
    const res = await fetch(`/api/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: d.title.trim(),
        content: d.content.trim() || null,
        videoUrl: d.videoUrl.trim() || null,
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { lesson: EditableLesson };
    const lesson = { ...data.lesson, files: data.lesson.files ?? [] };
    setCourse((c) => ({
      ...c,
      modules: c.modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: [...m.lessons, lesson] } : m,
      ),
    }));
    setLessonDrafts((prev) => ({ ...prev, [moduleId]: { title: "", content: "", videoUrl: "" } }));
    router.refresh();
  }

  async function saveLesson(lesson: EditableLesson) {
    const res = await fetch(`/api/lessons/${lesson.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: lesson.title,
        content: lesson.content,
        videoUrl: lesson.videoUrl ?? "",
      }),
    });
    if (!res.ok) return;
    router.refresh();
  }

  async function uploadLessonFile(lessonId: string, moduleId: string, file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/lessons/${lessonId}/files`, {
      method: "POST",
      body: fd,
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { file: EditableLessonFile };
    setCourse((c) => ({
      ...c,
      modules: c.modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === lessonId ? { ...l, files: [...l.files, data.file] } : l,
              ),
            }
          : m,
      ),
    }));
    router.refresh();
  }

  async function removeLessonFile(fileId: string, lessonId: string, moduleId: string) {
    const res = await fetch(`/api/lesson-files/${fileId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    setCourse((c) => ({
      ...c,
      modules: c.modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              lessons: m.lessons.map((l) =>
                l.id === lessonId ? { ...l, files: l.files.filter((f) => f.id !== fileId) } : l,
              ),
            }
          : m,
      ),
    }));
    router.refresh();
  }

  async function removeLesson(lessonId: string, moduleId: string) {
    if (!confirm("Delete this lesson?")) return;
    const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
    if (!res.ok) return;
    setCourse((c) => ({
      ...c,
      modules: c.modules.map((m) =>
        m.id === moduleId ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) } : m,
      ),
    }));
    router.refresh();
  }

  function draft(moduleId: string) {
    return lessonDrafts[moduleId] ?? { title: "", content: "", videoUrl: "" };
  }

  function setDraft(moduleId: string, patch: Partial<{ title: string; content: string; videoUrl: string }>) {
    setLessonDrafts((prev) => ({
      ...prev,
      [moduleId]: { ...draft(moduleId), ...patch },
    }));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/o/${orgSlug}/courses/${course.id}`} className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          ← Back to course
        </Link>
      </div>

      <section className="surface-bento space-y-4 p-5">
        <h2 className="text-lg font-semibold">Course details</h2>
        <div className="space-y-2">
          <Label htmlFor="ct">Title</Label>
          <Input id="ct" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cd">Description</Label>
          <Textarea id="cd" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published
        </label>
        <Button type="button" onClick={saveMeta} disabled={savingMeta}>
          {savingMeta ? "Saving…" : "Save details"}
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Modules & lessons</h2>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="New module title"
            value={newModuleTitle}
            onChange={(e) => setNewModuleTitle(e.target.value)}
            className="max-w-xs"
          />
          <Button type="button" onClick={addModule}>
            Add module
          </Button>
        </div>

        <div className="space-y-6">
          {course.modules.map((mod) => (
            <div key={mod.id} className="surface-bento p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{mod.title}</p>
                <Button type="button" variant="destructive" size="sm" onClick={() => removeModule(mod.id)}>
                  Delete module
                </Button>
              </div>
              <Separator className="my-3" />
              <ul className="space-y-4">
                {mod.lessons.map((lesson) => (
                  <li key={lesson.id} className="rounded-md border border-border/80 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <Link
                        href={`/o/${orgSlug}/courses/${course.id}/lessons/${lesson.id}`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Open lesson view
                      </Link>
                      <Button type="button" variant="outline" size="sm" onClick={() => removeLesson(lesson.id, mod.id)}>
                        Delete
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      <Input
                        value={lesson.title}
                        onChange={(e) =>
                          setCourse((c) => ({
                            ...c,
                            modules: c.modules.map((m) =>
                              m.id === mod.id
                                ? {
                                    ...m,
                                    lessons: m.lessons.map((l) =>
                                      l.id === lesson.id ? { ...l, title: e.target.value } : l,
                                    ),
                                  }
                                : m,
                            ),
                          }))
                        }
                      />
                      <Textarea
                        rows={3}
                        value={lesson.content ?? ""}
                        onChange={(e) =>
                          setCourse((c) => ({
                            ...c,
                            modules: c.modules.map((m) =>
                              m.id === mod.id
                                ? {
                                    ...m,
                                    lessons: m.lessons.map((l) =>
                                      l.id === lesson.id ? { ...l, content: e.target.value } : l,
                                    ),
                                  }
                                : m,
                            ),
                          }))
                        }
                      />
                      <Input
                        placeholder="Video URL"
                        value={lesson.videoUrl ?? ""}
                        onChange={(e) =>
                          setCourse((c) => ({
                            ...c,
                            modules: c.modules.map((m) =>
                              m.id === mod.id
                                ? {
                                    ...m,
                                    lessons: m.lessons.map((l) =>
                                      l.id === lesson.id ? { ...l, videoUrl: e.target.value || null } : l,
                                    ),
                                  }
                                : m,
                            ),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          const m = course.modules.find((x) => x.id === mod.id);
                          const l = m?.lessons.find((x) => x.id === lesson.id);
                          if (l) void saveLesson(l);
                        }}
                      >
                        Save lesson
                      </Button>
                      <div className="mt-3 space-y-2 rounded-md border border-dashed border-border p-2">
                        <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                        {lesson.files.length > 0 ? (
                          <ul className="space-y-1 text-sm">
                            {lesson.files.map((f) => (
                              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
                                <span className="truncate">{f.name}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0 text-destructive"
                                  onClick={() => void removeLessonFile(f.id, lesson.id, mod.id)}
                                >
                                  Remove
                                </Button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-xs text-muted-foreground">No files yet.</p>
                        )}
                        <label className="block">
                          <span className="sr-only">Upload file</span>
                          <Input
                            type="file"
                            className="cursor-pointer text-xs"
                            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) void uploadLessonFile(lesson.id, mod.id, f);
                            }}
                          />
                        </label>
                        <p className="text-xs text-muted-foreground">PDF, images, plain text, or Markdown — max 15 MB.</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-4 space-y-2 rounded-md bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Add lesson</p>
                <Input
                  placeholder="Title"
                  value={draft(mod.id).title}
                  onChange={(e) => setDraft(mod.id, { title: e.target.value })}
                />
                <Textarea
                  placeholder="Content (markdown-style text)"
                  rows={2}
                  value={draft(mod.id).content}
                  onChange={(e) => setDraft(mod.id, { content: e.target.value })}
                />
                <Input
                  placeholder="Video URL (optional)"
                  value={draft(mod.id).videoUrl}
                  onChange={(e) => setDraft(mod.id, { videoUrl: e.target.value })}
                />
                <Button type="button" size="sm" onClick={() => addLesson(mod.id)}>
                  Add lesson
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
