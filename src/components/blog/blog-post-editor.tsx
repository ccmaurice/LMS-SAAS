"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BlogPostEditor({
  postId,
  initial,
  slug,
}: {
  postId?: string;
  initial?: { title: string; excerpt: string; body: string; published: boolean };
  slug: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [published, setPublished] = useState(initial?.published ?? false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (postId) {
        const res = await fetch(`/api/blog/${postId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, excerpt: excerpt || null, body, published }),
        });
        const data = (await res.json()) as { post?: { slug: string }; error?: unknown };
        if (!res.ok) {
          setError(typeof data.error === "string" ? data.error : "Could not save");
          return;
        }
        if (data.post?.slug) {
          router.push(`/o/${slug}/blog/${encodeURIComponent(data.post.slug)}`);
          router.refresh();
        }
        return;
      }

      const res = await fetch("/api/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, excerpt: excerpt || null, body, published }),
      });
      const data = (await res.json()) as { post?: { slug: string }; error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not create");
        return;
      }
      if (data.post?.slug) {
        router.push(`/o/${slug}/blog/${encodeURIComponent(data.post.slug)}`);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="surface-bento space-y-5 p-6">
        <div className="space-y-2">
          <Label htmlFor="bt">Title</Label>
          <Input id="bt" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="be">Excerpt (optional)</Label>
          <Textarea id="be" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bb">Body</Label>
          <Textarea id="bb" value={body} onChange={(e) => setBody(e.target.value)} rows={16} className="font-mono text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          Published (visible to students)
        </label>
        <Button type="button" disabled={loading || !title.trim() || !body.trim()} onClick={() => void submit()}>
          {loading ? "Saving…" : postId ? "Save changes" : "Create post"}
        </Button>
      </div>
    </div>
  );
}
