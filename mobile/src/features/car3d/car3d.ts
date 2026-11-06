// "My car in 3D": paint colours, the shop-accessory Adjust type, and the real model files (models.ts). A model is downloaded ONCE
// from the backend (/api/3d/<file>) into the app's documents folder and read from there afterwards; the viewer gets it as base64.
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { apiUrl } from "../../core/config/api";
import { CAR_MODELS, modelFile } from "./models";
import { ACCESSORY_FILE } from "./modelConfig";

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

/** A shop accessory's hand-fit ("Adjust"): metres / radians / factor on top of the automatic fit; saved per customer + product. */
export type FitAdjust = { x: number; y: number; z: number; rx: number; ry: number; s: number };
export const NO_ADJUST: FitAdjust = { x: 0, y: 0, z: 0, rx: 0, ry: 0, s: 1 };

// ---- model files ----
/** Published shop accessories: content-addressed names under /api/3d/accessories/ (the server serves them only while PUBLISHED). */
export const isAccessoryFile = (k: unknown): k is string => typeof k === "string" && ACCESSORY_FILE.test(k);
export const isModelFile = (k: unknown): k is string => typeof k === "string" && (isAccessoryFile(k) || CAR_MODELS.some((m) => modelFile(m) === k));

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
  const flat = file.replace(/\//g, "_"); // "accessories/x.glb" -> one flat file name
  const local = new File(dir, flat);
  if (!local.exists) {
    const part = new File(dir, flat + ".part");
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
