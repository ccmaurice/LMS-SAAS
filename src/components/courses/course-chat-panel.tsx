"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";

type Msg = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string; image: string | null };
};

export function CourseChatPanel({ courseId }: { courseId: string }) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/chat`);
      const data = (await res.json()) as { messages?: Msg[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const es = new EventSource(`/api/courses/${courseId}/chat/stream`);
    es.onmessage = () => {
      void load();
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [courseId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const t = body.trim();
    if (!t) return;
    setSending(true);
    try {
      const res = await fetch(`/api/courses/${courseId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: t }),
      });
      if (res.ok) {
        setBody("");
        await load();
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <section className="surface-bento space-y-3 p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full" />
      </section>
    );
  }

  return (
    <motion.section
      id="course-discussion"
      className="surface-bento scroll-mt-24 overflow-hidden"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div className="border-b border-border/60 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-semibold tracking-tight">Course discussion</h2>
        <p className="text-xs text-muted-foreground">Live updates via server stream.</p>
      </div>
      <div className="max-h-72 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Start the thread.</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="flex gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <UserAvatar user={m.user} size={32} className="mt-0.5 ring-0" />
              <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted-foreground">
                {m.user.name ?? m.user.email} · {new Date(m.createdAt).toLocaleString()}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          rows={2}
          className="resize-none text-sm"
        />
        <Button type="button" className="mt-2" size="sm" disabled={sending || !body.trim()} onClick={() => void send()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </motion.section>
  );
}
