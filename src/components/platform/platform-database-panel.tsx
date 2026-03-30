"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CONFIRM = "RESTORE_FULL_DATABASE";

export function PlatformDatabasePanel({ toolsEnabled }: { toolsEnabled: boolean }) {
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [dumpBusy, setDumpBusy] = useState(false);

  async function downloadFullDump() {
    setDumpBusy(true);
    setRestoreMsg(null);
    try {
      const res = await fetch("/api/platform/database/dump");
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        setRestoreMsg(j.error ?? `Download failed (${res.status}).`);
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="([^"]+)"/);
      const name = m?.[1] ?? "backup.sql";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setRestoreMsg("Network error during download.");
    } finally {
      setDumpBusy(false);
    }
  }

  async function onRestoreSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRestoreMsg(null);
    const form = e.currentTarget;
    const typed = (form.elements.namedItem("typedConfirm") as HTMLInputElement).value.trim();
    if (typed !== CONFIRM) {
      setRestoreMsg(`Type exactly: ${CONFIRM}`);
      return;
    }
    const fileInput = form.elements.namedItem("sqlFile") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setRestoreMsg("Choose a .sql file.");
      return;
    }

    setRestoreBusy(true);
    try {
      const fd = new FormData();
      fd.set("confirmation", CONFIRM);
      fd.set("file", file);

      const res = await fetch("/api/platform/database/restore", {
        method: "POST",
        headers: { "X-Platform-Restore-Confirm": CONFIRM },
        body: fd,
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setRestoreMsg(data.error ?? `Restore failed (${res.status}).`);
        return;
      }
      setRestoreMsg("Restore completed. Restart the app if connections are stale.");
      fileInput.value = "";
    } catch {
      setRestoreMsg("Network error during restore.");
    } finally {
      setRestoreBusy(false);
    }
  }

  if (!toolsEnabled) {
    return (
      <p className="text-sm text-muted-foreground">
        In-app full dump/restore is only available for legacy <code className="rounded bg-muted px-1">mysql://</code>{" "}
        URLs with <code className="rounded bg-muted px-1">ENABLE_PLATFORM_DATABASE_TOOLS=true</code> and{" "}
        <code className="rounded bg-muted px-1">mysqldump</code> / <code className="rounded bg-muted px-1">mysql</code>{" "}
        on the server PATH. For PostgreSQL (including Supabase), use{" "}
        <strong className="font-medium">Supabase → Database → Backups</strong> or run{" "}
        <code className="rounded bg-muted px-1">pg_dump</code> / <code className="rounded bg-muted px-1">psql</code>{" "}
        from your machine.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold">Full database (.sql)</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Download is a plain <code className="rounded bg-muted px-1">mysqldump</code> of the application database (size
          capped at 250 MB for this endpoint). For large production databases, run{" "}
          <code className="rounded bg-muted px-1">mysqldump</code> on the database host.
        </p>
        <Button type="button" className="mt-4" variant="outline" disabled={dumpBusy} onClick={() => void downloadFullDump()}>
          {dumpBusy ? "Preparing…" : "Download full backup (.sql)"}
        </Button>
      </div>

      <div className="border-t border-border pt-8 dark:border-white/10">
        <h3 className="text-base font-semibold text-destructive">Restore full database</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This runs your SQL against the configured{" "}
          <code className="rounded bg-muted px-1">DATABASE_URL</code> (must be{" "}
          <code className="rounded bg-muted px-1">mysql://...</code>). It can destroy or overwrite data. Test on a copy
          first. Very large files may exceed request limits — use the <code className="rounded bg-muted px-1">mysql</code>{" "}
          client on the host for big restores.
        </p>
        <form className="mt-4 max-w-md space-y-4" onSubmit={(ev) => void onRestoreSubmit(ev)}>
          <div className="space-y-2">
            <Label htmlFor="sqlFile">SQL file</Label>
            <Input id="sqlFile" name="sqlFile" type="file" accept=".sql,text/plain" required />
          </div>
          <p className="text-xs text-muted-foreground">
            Type <code className="rounded bg-muted px-1">{CONFIRM}</code> in the box below to confirm you understand this
            replaces data in the live database connection.
          </p>
          <div className="space-y-2">
            <Label htmlFor="typedConfirm">Confirmation phrase</Label>
            <Input id="typedConfirm" name="typedConfirm" autoComplete="off" placeholder={CONFIRM} required />
          </div>
          <Button type="submit" variant="destructive" disabled={restoreBusy}>
            {restoreBusy ? "Restoring…" : "Upload and restore"}
          </Button>
        </form>
        {restoreMsg ? <p className="mt-4 text-sm text-muted-foreground">{restoreMsg}</p> : null}
      </div>
    </div>
  );
}
