"use client";

import { useState } from "react";
import { platformAvatarDisplayUrl } from "@/lib/profile/avatar-url";
import { cn } from "@/lib/utils";

export function PlatformAvatar({
  email,
  image,
  size = 36,
  className,
}: {
  email: string;
  image: string | null;
  size?: number;
  className?: string;
}) {
  const src = platformAvatarDisplayUrl(image);
  const [broken, setBroken] = useState(false);
  const initials = email.slice(0, 2).toUpperCase();
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imgSrc} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span aria-hidden>{initials}</span>
      )}
    </div>
  );
}
