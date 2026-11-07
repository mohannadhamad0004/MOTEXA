import {mkdirSync,readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {REPO_ROOT} from "./vehicle3d-catalog.js";
import {fail} from "./vehicle3d-validation.js";
export const PRIVATE_3D_DIR = path.join(REPO_ROOT, "backend/storage/vehicle3d");
export const VIEWS = ["front", "rear", "left", "right"] as const;
export type PhotoView = typeof VIEWS[number];
const missing = (): never => fail("SUBMISSION_NOT_FOUND", "Submission not found.", 404);
export function privatePath(key: string) {
  if (!/^[a-f0-9-]{36}\.(jpg|glb)$/.test(key)) return fail("INVALID_STORAGE_KEY", "Private asset is unavailable.", 404);
  return path.join(PRIVATE_3D_DIR, key);
}
export function storePrivate(bytes: Buffer, ext: "jpg" | "glb", reservedKey?:string) {
  mkdirSync(PRIVATE_3D_DIR, { recursive: true });
  const key = reservedKey ?? `${randomUUID()}.${ext}`;
  if(!key.endsWith(`.${ext}`))return fail("INVALID_STORAGE_KEY","Private asset is unavailable.",404);
  writeFileSync(privatePath(key), bytes, { flag: "wx" });
  return key;
}
export const removePrivate = (key: string | null) => { if (key) { try { unlinkSync(privatePath(key)); } catch {} } };
/** Only a job's persisted generated UUID key can identify preparation leftovers. */
export function removeImportPreparation(key:unknown){
 if(typeof key!=="string"||!/^[a-f0-9-]{36}\.glb$/.test(key))return;
 removePrivate(key);try{unlinkSync(path.join(PRIVATE_3D_DIR,key+".config.json"));}catch{}
}
