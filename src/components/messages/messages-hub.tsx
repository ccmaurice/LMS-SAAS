"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SchoolMessagesPanel } from "@/components/messages/school-messages-panel";
import { DirectMessagesPanel } from "@/components/messages/direct-messages-panel";

type Tab = "school" | "direct";

export function MessagesHub() {
  const [tab, setTab] = useState<Tab>("direct");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-xl border border-border/80 bg-muted/20 p-1 dark:border-white/10">
        <button
          type="button"
          onClick={() => setTab("direct")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "direct"
              ? "bg-background text-foreground shadow-sm dark:bg-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Direct messages
        </button>
        <button
          type="button"
          onClick={() => setTab("school")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === "school"
              ? "bg-background text-foreground shadow-sm dark:bg-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          School wall
        </button>
      </div>

      {tab === "school" ? (
        <SchoolMessagesPanel mode="member" />
      ) : (
        <DirectMessagesPanel />
      )}
    </div>
  );
}
