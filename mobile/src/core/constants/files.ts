import { API_URL } from "../config/api";

// File helpers shared by the tow and parts services.
// Server files are referenced by relative paths such as "/files/public/<id>" or "/files/private/<id>".
// Anything else a form holds (file://, content://, ...) is a freshly picked local file.

/** True for a path the API returned (already stored); false for a local file the user just picked. */
export const isServerFile = (uri?: string | null) => !!uri && (uri.startsWith("/files/") || uri.startsWith(API_URL + "/files/"));

/** Public images (truck photo, product image) can be shown with a plain URL. */
export const publicImageUrl = (path?: string | null) => (path ? (path.startsWith("/") ? API_URL + path : path) : null);

/** Reads a local image into base64 (no data-URL prefix). The server decides the real type from the bytes. */
export async function localFileToBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });
}

export const fileNameOf = (uri: string, fallback: string) => decodeURIComponent(uri.split("?")[0].split("/").pop() || "") || fallback;

/** YYYY-MM-DD and a real calendar date. Empty is allowed by the callers. */
export function isRealDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/**
 * DEV ONLY. The dev seed (backend/src/seed/test-accounts.ts, placeholderPng) writes every product picture as a 96x96 letter
 * tile. In a development build such a tile is treated like "no photo" so the category illustration shows instead. In a
 * production build nothing is ever hidden because of its size: every real upload is shown.
 */
export const SEED_TILE_SIZE = 96;
export const isDevSeedTile = (width: number, height: number) => __DEV__ && width === SEED_TILE_SIZE && height === SEED_TILE_SIZE;
