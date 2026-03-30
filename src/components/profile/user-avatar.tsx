"use client";

import { useState } from "react";
import { orgUserAvatarDisplayUrl } from "@/lib/profile/avatar-url";
import { cn } from "@/lib/utils";

export function UserAvatar({
  user,
  size = 36,
  className,
}: {
  user: { id: string; name: string | null; email: string; image: string | null };
  size?: number;
  className?: string;
}) {
  const src = orgUserAvatarDisplayUrl(user);
  const [broken, setBroken] = useState(false);
  const initials = (user.name?.trim() || user.email).slice(0, 2).toUpperCase();
  const showImg = Boolean(src && !broken);
  const imgSrc = src ?? undefined;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-semibold text-muted-foreground ring-1 ring-border/60",
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.32) }}
      suppressHydrationWarning
    >
      {showImg && imgSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic user URLs (Google or same-origin API)
        <img src={imgSrc} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  );
}
