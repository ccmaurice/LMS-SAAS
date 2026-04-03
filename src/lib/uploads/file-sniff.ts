/**
 * Verifies the first bytes of a buffer match the declared MIME (mitigates extension / Content-Type spoofing).
 */
export function bufferMatchesDeclaredMime(buf: Buffer, mime: string): boolean {
  if (buf.length === 0) return false;
  const m = mime.toLowerCase().split(";")[0]!.trim();

  switch (m) {
    case "application/pdf":
      return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";

    case "image/png":
      return (
        buf.length >= 8 &&
        buf[0] === 0x89 &&
        buf[1] === 0x50 &&
        buf[2] === 0x4e &&
        buf[3] === 0x47 &&
        buf[4] === 0x0d &&
        buf[5] === 0x0a &&
        buf[6] === 0x1a &&
        buf[7] === 0x0a
      );

    case "image/jpeg":
      return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

    case "image/gif":
      return (
        buf.length >= 6 &&
        (buf.subarray(0, 6).toString("ascii") === "GIF87a" || buf.subarray(0, 6).toString("ascii") === "GIF89a")
      );

    case "image/webp":
      return (
        buf.length >= 12 &&
        buf.subarray(0, 4).toString("ascii") === "RIFF" &&
        buf.subarray(8, 12).toString("ascii") === "WEBP"
      );

    case "video/mp4":
    case "video/quicktime":
      return buf.length >= 12 && buf.subarray(4, 8).toString("ascii") === "ftyp";

    case "video/webm":
      return buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;

    case "text/plain":
    case "text/markdown":
      if (buf.includes(0)) return false;
      return true;

    default:
      return false;
  }
}
