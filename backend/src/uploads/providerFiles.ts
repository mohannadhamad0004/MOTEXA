import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// DEV STORAGE: provider files live on local disk, outside any static route. They are only reachable through
// /api/files/* (looked up by id in ProviderFile). Replace with object storage before production.
export const PROVIDER_STORAGE_DIR = path.resolve(process.cwd(), "storage", "provider-files");
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
// base64 text is ~4/3 of the bytes; reject oversized strings before decoding them.
const MAX_BASE64_CHARS = Math.ceil((MAX_FILE_BYTES * 4) / 3) + 8;

/** Decide the type from the actual bytes (never from what the client declares). JPEG and PNG only. */
export function sniffImage(buf: Buffer): { mime: "image/jpeg" | "image/png"; ext: "jpg" | "png" } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  return null;
}

export type ParsedUpload = {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  originalName: string;
  sha256: string;
};

const cleanName = (v: unknown, fallback: string) => {
  const base = typeof v === "string" ? v.split(/[\\/]/).pop() ?? "" : "";
  const name = base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
  return name || fallback;
};

/** Validates one { name, dataBase64 } upload. Returns the parsed file or a message for a 400. */
export function parseUpload(input: unknown, fallbackName: string): { file: ParsedUpload } | { error: string } {
  const o = input as { name?: unknown; dataBase64?: unknown } | null;
  if (!o || typeof o !== "object" || typeof o.dataBase64 !== "string" || !o.dataBase64) return { error: "File data is missing." };
  if (o.dataBase64.length > MAX_BASE64_CHARS) return { error: "Each file must be a JPEG or PNG image of at most 5 MB." };
  const buffer = Buffer.from(o.dataBase64, "base64");
  if (!buffer.length || buffer.length > MAX_FILE_BYTES) return { error: "Each file must be a JPEG or PNG image of at most 5 MB." };
  const type = sniffImage(buffer);
  if (!type) return { error: "Only JPEG and PNG images are accepted." };
  return {
    file: {
      buffer,
      mimeType: type.mime,
      ext: type.ext,
      originalName: cleanName(o.name, `file.${type.ext}`),
      sha256: createHash("sha256").update(buffer).digest("hex"),
    },
  };
}

/** Optional expiry: empty/missing = none; otherwise YYYY-MM-DD and a real calendar date. */
export function parseExpiry(v: unknown): { date: Date | null } | { error: string } {
  if (v === undefined || v === null || v === "") return { date: null };
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { error: "Expiry date must use YYYY-MM-DD." };
  const d = new Date(`${v}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { error: "Expiry date is not a real calendar date." };
  return { date: d };
}

export async function storeFile(file: ParsedUpload): Promise<string> {
  const storageKey = `${randomUUID()}.${file.ext}`;
  await mkdir(PROVIDER_STORAGE_DIR, { recursive: true });
  await writeFile(path.join(PROVIDER_STORAGE_DIR, storageKey), file.buffer);
  return storageKey;
}

/** Deletes exactly one stored file. Never throws if it is already gone; never touches anything else. */
export async function removeStoredFile(storageKey: string): Promise<void> {
  try {
    await unlink(path.join(PROVIDER_STORAGE_DIR, path.basename(storageKey)));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") console.error("Could not delete stored file:", e);
  }
}

export const removeStoredFiles = (keys: string[]) => Promise.all(keys.map(removeStoredFile));

/** Relative API path for a file row; the mobile client prepends its API base URL. */
export const filePath = (f: { id: string; visibility: "PUBLIC" | "PRIVATE" }) =>
  `/files/${f.visibility === "PUBLIC" ? "public" : "private"}/${f.id}`;

export const TOW_PURPOSES = ["TRUCK_PHOTO", "TRUCK_REGISTRATION", "TRUCK_INSURANCE", "TOW_COMPANY_DOCUMENT"] as const;
export const PARTS_PURPOSES = ["PRODUCT_IMAGE", "PARTS_SHOP_DOCUMENT"] as const;
