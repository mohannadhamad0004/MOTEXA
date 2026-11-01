// "My car in 3D": paint colours, the wing / roof-rack choice, and the real model files (models.ts). A model is downloaded ONCE
// from the backend (/api/3d/<file>) into the app's documents folder and read from there afterwards; the viewer gets it as base64.
import { Directory, File, Paths } from "expo-file-system";
import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { apiUrl } from "../../core/config/api";
import { CAR_MODELS } from "./models";

/** The 10 common paints of the colour step; silver is the default. */
export const CAR_COLORS: { hex: string; en: string; ar: string }[] = [
  { hex: "#f2f2ef", en: "White", ar: "أبيض" },
  { hex: "#1d1d20", en: "Black", ar: "أسود" },
  { hex: "#c3c7cc", en: "Silver", ar: "فضي" },
  { hex: "#7b8087", en: "Grey", ar: "رمادي" },
  { hex: "#c62828", en: "Red", ar: "أحمر" },
  { hex: "#1f6fd6", en: "Blue", ar: "أزرق" },
  { hex: "#1c2b4d", en: "Dark blue", ar: "أزرق داكن" },
  { hex: "#d9c4a1", en: "Beige", ar: "بيج" },
  { hex: "#2f7a4e", en: "Green", ar: "أخضر" },
  { hex: "#6b4a33", en: "Brown", ar: "بني" },
];
export const DEFAULT_COLOR = "#c3c7cc";

// ---- the extras chosen in the 3D page ----
// ponytail: kept for the session only (not on the account); add CustomerCar columns if it must survive a new login.
export type Look = { wing: boolean; rack: boolean };
let look: Look = { wing: false, rack: false };
const subs = new Set<() => void>();
export const setLook = (patch: Partial<Look>) => {
  look = { ...look, ...patch };
  subs.forEach((f) => f());
};
export const useLook = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => look,
    () => look
  );

// ---- model files ----
export const isModelFile = (k: unknown): k is string => typeof k === "string" && CAR_MODELS.some((m) => m.file === k);

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function modelBytes(file: string): Promise<ArrayBuffer> {
  const url = apiUrl(`/api/3d/${file}`);
  if (Platform.OS === "web") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`3D model ${res.status}`);
    return res.arrayBuffer();
  }
  // the file name changes with the model, so a file already on the phone is never stale
  const dir = new Directory(Paths.document, "car3d");
  dir.create({ idempotent: true, intermediates: true });
  const local = new File(dir, file);
  if (!local.exists) {
    const part = new File(dir, file + ".part");
    if (part.exists) part.delete();
    await File.downloadFileAsync(url, part);
    part.move(local); // only a complete download gets the real name
  }
  return local.arrayBuffer();
}

/** A model file as base64, read once per app session. */
const cache = new Map<string, Promise<string>>();
export function modelBase64(file: string): Promise<string> {
  let p = cache.get(file);
  if (!p) {
    p = modelBytes(file).then(toBase64);
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p;
}
