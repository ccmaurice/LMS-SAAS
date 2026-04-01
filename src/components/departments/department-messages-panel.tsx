"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/profile/user-avatar";
import { cn } from "@/lib/utils";

type Sender = { id: string; name: string | null; email: string; role: string; image: string | null };

type Msg = { id: string; body: string; createdAt: string; sender: Sender };

export function DepartmentMessagesPanel({
  departmentId,
  canPost,
}: {
  departmentId: string;
  canPost: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/departments/${departmentId}/messages`, { credentials: "include" });
      const data = (await res.json()) as { messages?: Msg[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [departmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    const t = body.trim();
    if (!t) return;
    setSending(true);
    try {
      const res = await fetch(`/api/departments/${departmentId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: t }),
      });
      if (!res.ok) return;
      setBody("");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      {canPost ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Post a notice to students and faculty in this department…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Button type="button" disabled={sending || !body.trim()} onClick={() => void send()}>
            {sending ? "Sending…" : "Post notice"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Faculty and admins post notices here. Students can read; use Messages for direct conversations.
        </p>
      )}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading messages…</p>
      ) : messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No department notices yet.</p>
      ) : (
        <ul className="space-y-4">
          {messages.map((m) => (
            <li key={m.id} className="flex gap-3 border-b border-border/60 pb-4 last:border-0 dark:border-white/10">
              <UserAvatar
                user={{
                  id: m.sender.id,
                  name: m.sender.name,
                  email: m.sender.email,
                  image: m.sender.image,
                }}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {m.sender.name?.trim() || m.sender.email}
                  <span className={cn("ml-2 text-xs font-normal capitalize text-muted-foreground")}>
                    {m.sender.role.toLowerCase()}
                  </span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
