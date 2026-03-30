"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/user-avatar";
import { cn } from "@/lib/utils";

export type SchoolMessageRow = {
  id: string;
  body: string;
  createdAt: string;
  senderKind: "MEMBER" | "PLATFORM";
  platformEmail: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
    image: string | null;
  } | null;
};

function authorLine(m: SchoolMessageRow): string {
  if (m.senderKind === "PLATFORM") {
    return `Platform · ${m.platformEmail ?? "operator"}`;
  }
  const u = m.user;
  if (!u) return "Member";
  return `${u.name?.trim() || u.email} · ${u.role}`;
}

type Props = {
  mode: "member" | "platform";
  /** Required when mode is platform */
  orgId?: string;
  className?: string;
  /** Shorter panel on dashboard */
  compact?: boolean;
};

export function SchoolMessagesPanel({ mode, orgId, className, compact }: Props) {
  const reduce = useReducedMotion();
  const [messages, setMessages] = useState<SchoolMessageRow[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const listUrl =
    mode === "member"
      ? "/api/school-messages"
      : `/api/platform/organizations/${orgId ?? ""}/school-messages`;
  const streamUrl =
    mode === "member"
      ? "/api/school-messages/stream"
      : `/api/platform/organizations/${orgId ?? ""}/school-messages/stream`;

  const load = useCallback(async () => {
    if (mode === "platform" && !orgId) return;
    try {
      const res = await fetch(listUrl, { credentials: "include" });
      const data = (await res.json()) as { messages?: SchoolMessageRow[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [listUrl, mode, orgId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (mode === "platform" && !orgId) return;
    const es = new EventSource(streamUrl, { withCredentials: true });
    es.onmessage = () => {
      void load();
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [streamUrl, load, mode, orgId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const t = body.trim();
    if (!t || (mode === "platform" && !orgId)) return;
    setSending(true);
    try {
      const res = await fetch(listUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
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

  if (mode === "platform" && !orgId) {
    return null;
  }

  if (loading) {
    return (
      <section className={cn("surface-bento space-y-3 p-4", className)}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  const maxH = compact ? "max-h-56" : "max-h-[min(420px,55vh)]";

  return (
    <motion.section
      id="school-messages"
      className={cn("surface-bento scroll-mt-24 overflow-hidden", className)}
      initial={reduce ? false : { opacity: 0, y: 20 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
    >
      <div className="border-b border-border/60 px-4 py-3 dark:border-white/10">
        <h2 className="text-sm font-semibold tracking-tight">
          {mode === "platform" ? "Message this school" : "School messages"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {mode === "platform"
            ? "Visible to all admins, teachers, and students in this organization."
            : "Everyone in your school can read and post. Platform operators may post from the platform console."}
        </p>
      </div>
      <div className={cn("space-y-3 overflow-y-auto px-4 py-3", maxH)}>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages yet. Start the conversation.</p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-xl border px-3 py-2 text-sm",
                m.senderKind === "PLATFORM"
                  ? "border-primary/25 bg-primary/5 dark:bg-primary/10"
                  : "border-border/60 bg-muted/30 dark:border-white/10",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                {m.senderKind === "MEMBER" && m.user ? (
                  <UserAvatar user={m.user} size={28} className="ring-0" />
                ) : null}
                <p className="text-xs font-medium text-muted-foreground">{authorLine(m)}</p>
                {m.senderKind === "PLATFORM" ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Platform
                  </Badge>
                ) : null}
                <span className="text-[10px] text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border/60 p-3 dark:border-white/10">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={mode === "platform" ? "Write to the whole school…" : "Write a message to your school…"}
          rows={compact ? 2 : 3}
          className="resize-none text-sm"
        />
        <Button type="button" className="mt-2" size="sm" disabled={sending || !body.trim()} onClick={() => void send()}>
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </motion.section>
  );
}
