import path from "node:path";

export const MAX_LESSON_UPLOAD_BYTES = 15 * 1024 * 1024;

export function getUploadRoot(): string {
  const raw = process.env.UPLOAD_DIR?.trim();
  if (raw) return path.resolve(raw);
  return path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
}
