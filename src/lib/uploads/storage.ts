import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { isBlobStoredRef } from "./blob-ref";
import { getUploadRoot } from "./root";

/**
 * When `BLOB_READ_WRITE_TOKEN` is set (e.g. on Vercel), uploads go to Vercel Blob
 * and the returned https URL is stored in the DB. Otherwise files use `UPLOAD_DIR` / `./uploads`.
 */
export function blobStorageEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN?.trim();
}

function toPosix(rel: string): string {
  return rel.replace(/\\/g, "/").replace(/^\/+/, "");
}

export async function saveUpload(relPosixPath: string, data: Buffer, contentType: string): Promise<string> {
  const pathname = toPosix(relPosixPath);
  if (blobStorageEnabled()) {
    const { url } = await put(pathname, data, {
      access: "public",
      contentType: contentType || "application/octet-stream",
      addRandomSuffix: false,
    });
    return url;
  }
  const base = getUploadRoot();
  const fullPath = path.join(base, ...pathname.split("/"));
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);
  return pathname;
}

export async function loadUpload(ref: string): Promise<Buffer | null> {
  const r = ref.trim();
  if (!r) return null;
  if (isBlobStoredRef(r)) {
    try {
      const res = await fetch(r);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  const fullPath = path.join(getUploadRoot(), ...r.split(/[/\\]/));
  try {
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

export async function removeUpload(ref: string): Promise<void> {
  const r = ref.trim();
  if (!r) return;
  if (isBlobStoredRef(r)) {
    try {
      await del(r);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await fs.unlink(path.join(getUploadRoot(), ...r.split(/[/\\]/)));
  } catch {
    /* ignore */
  }
}
