"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

type Row = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=25");
      if (!res.ok) return;
      const data = (await res.json()) as { notifications: Row[]; unreadCount: number };
      setRows(data.notifications);
      setUnreadCount(data.unreadCount);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    const es = new EventSource("/api/notifications/events");
    es.onmessage = (ev) => {
      try {
        const p = JSON.parse(ev.data) as { unreadCount?: number };
        if (typeof p.unreadCount === "number" && p.unreadCount >= 0) {
          setUnreadCount(p.unreadCount);
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      es.close();
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const btn = (e.target as HTMLElement).closest("[data-notification-bell-trigger]");
        if (btn) return;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds: [id] }),
    });
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r)));
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        data-notification-bell-trigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground",
        )}
        aria-label="Notifications"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void refreshList();
        }}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-sm font-medium">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => void markAll()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {rows.map((n) => {
                  const inner = (
                    <>
                      <p className={cn("text-sm", !n.read && "font-medium")}>{n.title}</p>
                      {n.body ? <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p> : null}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(n.createdAt).toLocaleString()}
                      </p>
                    </>
                  );
                  if (n.link) {
                    const href = n.link.startsWith("/") ? n.link : `/o/${slug}/${n.link}`;
                    return (
                      <li key={n.id}>
                        <Link
                          href={href}
                          className="block px-3 py-2.5 transition-colors hover:bg-muted/80"
                          onClick={() => {
                            if (!n.read) void markRead(n.id);
                            setOpen(false);
                          }}
                        >
                          {inner}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={n.id} className="px-3 py-2.5">
                      {inner}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
