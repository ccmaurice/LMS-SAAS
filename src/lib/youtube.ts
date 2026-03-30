/** Returns embed URL for same-origin iframe, or null if not a recognized YouTube link. */
export function youtubeEmbedSrc(url: string): string | null {
  const s = url.trim();
  if (!s) return null;
  try {
    const u = new URL(s, "https://www.youtube.com");
    const host = u.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && isYoutubeId(id) ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (!host.includes("youtube.com") && !host.includes("youtube-nocookie.com")) {
      return null;
    }

    if (u.pathname.startsWith("/watch")) {
      const id = u.searchParams.get("v");
      return id && isYoutubeId(id) ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.split("/").filter(Boolean)[1];
      return id && isYoutubeId(id) ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/").filter(Boolean)[1];
      return id && isYoutubeId(id) ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function isYoutubeId(id: string): boolean {
  return /^[\w-]{11}$/.test(id);
}
