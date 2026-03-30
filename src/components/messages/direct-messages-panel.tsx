"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/profile/user-avatar";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

type ThreadRow = {
  threadId: string;
  other: { id: string; name: string | null; email: string; role: string; image: string | null };
  lastPreview: string;
  lastAt: string;
  lastFromMe: boolean;
};

type Msg = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string | null; email: string; role: string; image: string | null };
};

type Recipient = { id: string; name: string | null; email: string; role: string };

function displayName(u: { name: string | null; email: string }): string {
  return u.name?.trim() || u.email;
}

export function DirectMessagesPanel() {
  const reduce = useReducedMotion();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [pickId, setPickId] = useState("");
  const [opening, setOpening] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await fetch("/api/direct-messages/threads", { credentials: "include" });
      const data = (await res.json()) as { threads?: ThreadRow[] };
      setThreads(data.threads ?? []);
    } catch {
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadEligible = useCallback(async () => {
    try {
      const res = await fetch("/api/direct-messages/eligible-recipients", { credentials: "include" });
      const data = (await res.json()) as { recipients?: Recipient[] };
      setRecipients(data.recipients ?? []);
    } catch {
      setRecipients([]);
    }
  }, []);

  useEffect(() => {
    void loadThreads();
    void loadEligible();
  }, [loadThreads, loadEligible]);

  const loadMessages = useCallback(async (threadId: string) => {
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/direct-messages/threads/${threadId}/messages`, { credentials: "include" });
      const data = (await res.json()) as { messages?: Msg[] };
      setMessages(data.messages ?? []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (!selectedId) return;
    const es = new EventSource(`/api/direct-messages/threads/${selectedId}/stream`, { withCredentials: true });
    es.onmessage = () => {
      void loadMessages(selectedId);
      void loadThreads();
    };
    es.onerror = () => es.close();
    return () => es.close();
  }, [selectedId, loadMessages, loadThreads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function openThread() {
    if (!pickId) return;
    setOpening(true);
    try {
      const res = await fetch("/api/direct-messages/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientId: pickId }),
      });
      const data = (await res.json()) as { threadId?: string; error?: string };
      if (!res.ok || !data.threadId) return;
      setPickId("");
      await loadThreads();
      setSelectedId(data.threadId);
      setMobileThread(true);
    } finally {
      setOpening(false);
    }
  }

  async function send() {
    const t = body.trim();
    if (!t || !selectedId) return;
    setSending(true);
    try {
      const res = await fetch(`/api/direct-messages/threads/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: t }),
      });
      if (res.ok) {
        setBody("");
        await loadMessages(selectedId);
        await loadThreads();
      }
    } finally {
      setSending(false);
    }
  }

  const selectedOther = threads.find((x) => x.threadId === selectedId)?.other;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_1fr]">
      <motion.div
        className={cn(
          "space-y-3",
          mobileThread && selectedId ? "hidden lg:block" : "block",
        )}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
      >
        <div className="surface-bento p-4">
          <Label htmlFor="dm-recipient" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New conversation
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Students: teachers of your courses and classmates. Teachers: admins and students in your courses. Admins:
            all teachers and students.
          </p>
          <select
            id="dm-recipient"
            className="mt-3 flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
          >
            <option value="">Choose someone…</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {displayName(r)} ({r.role})
              </option>
            ))}
          </select>
          <Button type="button" className="mt-3 w-full" size="sm" disabled={!pickId || opening} onClick={() => void openThread()}>
            {opening ? "Opening…" : "Open chat"}
          </Button>
        </div>

        <div className="surface-bento overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3 dark:border-white/10">
            <h3 className="text-sm font-semibold tracking-tight">Inbox</h3>
          </div>
          {loadingThreads ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : threads.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <ul className="max-h-[min(360px,50vh)] divide-y divide-border/60 overflow-y-auto dark:divide-white/10">
              {threads.map((t) => (
                <li key={t.threadId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(t.threadId);
                      setMobileThread(true);
                    }}
                    className={cn(
                      "w-full px-4 py-3 text-left text-sm transition-colors hover:bg-muted/40",
                      selectedId === t.threadId && "bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2">
                        <UserAvatar user={t.other} size={32} className="ring-0" />
                        <span className="truncate font-medium">{displayName(t.other)}</span>
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {t.other.role}
                      </Badge>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {t.lastFromMe ? "You: " : ""}
                      {t.lastPreview || "No messages yet"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>

      <motion.div
        className={cn(!mobileThread || !selectedId ? "hidden lg:block" : "block")}
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={reduce ? undefined : { opacity: 1, y: 0 }}
      >
        {!selectedId ? (
          <div className="surface-bento flex min-h-[280px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
            Select a conversation or start a new one.
          </div>
        ) : (
          <div className="surface-bento flex max-h-[min(520px,70vh)] flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 dark:border-white/10">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Back to inbox"
                onClick={() => setMobileThread(false)}
              >
                <ArrowLeft className="size-4" />
              </Button>
              {selectedOther ? <UserAvatar user={selectedOther} size={40} className="ring-0" /> : null}
              <div>
                <h3 className="font-semibold tracking-tight">{selectedOther ? displayName(selectedOther) : "Chat"}</h3>
                {selectedOther ? (
                  <p className="text-xs text-muted-foreground">
                    {selectedOther.email} · {selectedOther.role}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {loadingMsgs ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className="flex gap-2 rounded-xl border border-border/60 bg-muted/20 px-3 py-2 text-sm dark:border-white/10"
                  >
                    <UserAvatar user={m.sender} size={32} className="mt-0.5 ring-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">
                        {displayName(m.sender)} · {m.sender.role} · {new Date(m.createdAt).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-border/60 p-3 dark:border-white/10">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a direct message…"
                rows={3}
                className="resize-none text-sm"
              />
              <Button type="button" className="mt-2" size="sm" disabled={sending || !body.trim()} onClick={() => void send()}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
