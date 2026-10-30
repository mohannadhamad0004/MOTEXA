import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../generated/prisma/client.js";
import { MIN_PHOTO_BYTES, PROVIDER_STORAGE_DIR, parseUpload } from "../uploads/providerFiles.js";

// Keyed by shop + stable seed key, NOT mutable product names or corrected part numbers.
export const PARTS_PHOTOS = [
  { email: "shop@motexa.test", seedKey: "70MAI-A400", filename: "70mai_A400_1440P.jpg" },
  { email: "shop.hebron@motexa.test", seedKey: "1987479107", filename: "bosch_1987479106_dot4_500ml.jpg" },
  { email: "shop.hebron@motexa.test", seedKey: "ATF-220-1L", filename: "mobil_ATF220_1L.jpg" },
  { email: "shop.ramallah@motexa.test", seedKey: "12972PRC2", filename: "philips_12972PRC2_H7_C2.jpg" },
  { email: "shop@motexa.test", seedKey: "TH-711200", filename: "thule_711200_wingbar_evo.jpg" },
] as const;

// Explicit src path also works when running the compiled seed from dist/seed.
export const PARTS_ASSET_DIR = fileURLToPath(new URL("../../src/seed/assets/parts/", import.meta.url));
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** Exclusive creation: never overwrite an existing runtime file, even one with our naming convention. */
export async function storeSeedPhoto(storageKey: string, bytes: Buffer, directory = PROVIDER_STORAGE_DIR) {
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, storageKey);
  try {
    await writeFile(destination, bytes, { flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (sha256(await readFile(destination)) !== sha256(bytes)) {
      throw new Error(`Seed photo storage conflict: ${storageKey}; existing file preserved.`);
    }
  }
}

type PhotoIO = {
  read: (filename: string) => Promise<Buffer>;
  store: (storageKey: string, bytes: Buffer) => Promise<void>;
};
const diskIO: PhotoIO = {
  read: (filename) => readFile(path.join(PARTS_ASSET_DIR, filename)),
  store: storeSeedPhoto,
};

/** Insert only. Neither filename, uploader id, hash nor size proves continuing seed ownership. */
export async function seedPartsPhoto(
  db: Pick<PrismaClient, "providerFile" | "$transaction">,
  target: { email: string; seedKey: string; productId: string; ownerUserId: string },
  io: PhotoIO = diskIO,
): Promise<"unmapped" | "missing" | "preserved" | "installed"> {
  const asset = PARTS_PHOTOS.find((entry) => entry.email === target.email && entry.seedKey === target.seedKey);
  if (!asset) return "unmapped";
  const where = { productId: target.productId, purpose: "PRODUCT_IMAGE" as const };
  if (await db.providerFile.findFirst({ where })) return "preserved";
  let bytes: Buffer;
  try {
    bytes = await io.read(asset.filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
  const parsed = parseUpload({ name: asset.filename, dataBase64: bytes.toString("base64") }, asset.filename);
  if ("error" in parsed) throw new Error(`${asset.filename}: ${parsed.error}`);
  if (parsed.file.mimeType !== "image/jpeg" || bytes.length < MIN_PHOTO_BYTES) {
    throw new Error(`${asset.filename}: expected a JPEG product photo of at least ${MIN_PHOTO_BYTES} bytes.`);
  }
  const { file } = parsed;
  // Product-scoped, content-addressed: retries reuse the bytes, never a random duplicate.
  const productHash = sha256(Buffer.from(target.productId));
  const storageKey = `seed-product-${productHash}-${file.sha256}.jpg`;
  try {
    await db.$transaction(async (tx) => {
      // The existing unique (productId, purpose) constraint arbitrates concurrent seeds/uploads.
      // Claim the row BEFORE writing bytes, so a losing installer writes no file.
      await tx.providerFile.create({ data: {
        ownerUserId: target.ownerUserId, ...where, visibility: "PUBLIC",
        originalName: file.originalName, mimeType: file.mimeType,
        sizeBytes: bytes.length, sha256: file.sha256, storageKey,
      } });
      await io.store(storageKey, bytes);
      await tx.auditLog.create({ data: {
        actorId: target.ownerUserId, action: "SEED_PARTS_PRODUCT_PHOTO_INSTALLED", targetId: target.productId,
        details: { filename: asset.filename, sha256: file.sha256, storageKey },
      } });
    });
    return "installed";
  } catch (error) {
    if ((error as { code?: string }).code === "P2002" && await db.providerFile.findFirst({ where })) {
      return "preserved";
    }
    // Disk writes cannot roll back with SQL. Keep any written content-addressed file for retry;
    // never delete a file that a concurrent run/upload might now reference.
    throw error;
  }
}
