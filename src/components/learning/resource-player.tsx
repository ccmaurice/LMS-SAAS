"use client";

import { useEffect, useRef } from "react";
import type { LearningResourceKind } from "@/generated/prisma/enums";

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

const reportVideoProgress = debounce((resourceId: string, percent: number, positionSec: number) => {
  void fetch(`/api/learning-resources/${resourceId}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ percent, positionSec }),
  });
}, 1200);

export function ResourcePlayer({
  resourceId,
  kind,
  externalUrl,
  hasFile,
  mimeType,
}: {
  resourceId: string;
  kind: LearningResourceKind;
  externalUrl: string | null;
  hasFile: boolean;
  mimeType: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => {
      const d = el.duration;
      if (!d || !Number.isFinite(d)) return;
      const pct = (el.currentTime / d) * 100;
      reportVideoProgress(resourceId, Math.min(100, pct), el.currentTime);
    };
    el.addEventListener("timeupdate", onTime);
    return () => el.removeEventListener("timeupdate", onTime);
  }, [resourceId]);

  if (kind === "LINK" && externalUrl) {
    const yt =
      externalUrl.includes("youtube.com/watch") || externalUrl.includes("youtu.be/")
        ? externalUrl
        : null;
    if (yt) {
      const id = yt.includes("youtu.be/")
        ? yt.split("/").pop()?.split("?")[0]
        : new URL(yt).searchParams.get("v");
      if (id) {
        return (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-black">
            <iframe
              title="Video"
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${id}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        );
      }
    }
    return (
      <LinkOut href={externalUrl} />
    );
  }

  if ((kind === "VIDEO" || mimeType?.startsWith("video/")) && hasFile) {
    const src = `/api/learning-resources/${resourceId}/file`;
    return (
      <video ref={videoRef} src={src} controls className="w-full max-h-[480px] rounded-lg border border-border bg-black" />
    );
  }

  if (kind === "PDF" && hasFile) {
    return (
      <a
        href={`/api/learning-resources/${resourceId}/file`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Open PDF
      </a>
    );
  }

  if (hasFile) {
    return (
      <a
        href={`/api/learning-resources/${resourceId}/file`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        Download
      </a>
    );
  }

  return <p className="text-sm text-muted-foreground">No preview available.</p>;
}

function LinkOut({ href }: { href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
      Open resource →
    </a>
  );
}
