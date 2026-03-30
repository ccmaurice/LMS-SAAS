"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Button } from "@/components/ui/button";

type Props = {
  user: { id: string; name: string | null; email: string; image: string | null };
};

export function ProfileAvatarEditor({ user }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(user.image);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setImage(user.image);
  }, [user.id, user.image]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/auth/me/avatar", { method: "POST", body: fd, credentials: "include" });
      const data = (await res.json()) as { image?: string; error?: string };
      if (!res.ok) {
        toast.error(typeof data.error === "string" ? data.error : "Could not upload photo");
        return;
      }
      if (data.image) setImage(data.image);
      toast.success("Profile photo updated");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    if (!image) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/me/avatar", { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        toast.error("Could not remove photo");
        return;
      }
      setImage(null);
      toast.success("Profile photo removed");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const viewer = { ...user, image };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <UserAvatar key={image ?? "none"} user={viewer} size={88} className="ring-2 ring-border/80" />
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">Profile photo</p>
        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP, or GIF · max 2 MB. Shown in the header, school wall, and course chat.
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(ev) => void onFile(ev)}
          />
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Working…" : "Upload photo"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy || !image} onClick={() => void onRemove()}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}
