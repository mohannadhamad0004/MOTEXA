// Catalogue sale + badge rules, shared by the customer list and detail (one place, unit-tested in tests/catalog-badges.test.ts).
import type { Prisma } from "../generated/prisma/client.js";

export type SaleFields = { price: Prisma.Decimal; compareAtPrice: Prisma.Decimal | null; saleStartsAt: Date | null; saleEndsAt: Date | null };
/** The "was" price while a sale runs: set, higher than price, and inside the optional window. Otherwise null. */
export const saleWas = (p: SaleFields, now = new Date()) =>
  p.compareAtPrice && p.compareAtPrice.gt(p.price) && (!p.saleStartsAt || p.saleStartsAt <= now) && (!p.saleEndsAt || now < p.saleEndsAt) ? Number(p.compareAtPrice) : null;
export const discountPct = (p: SaleFields) => {
  const was = saleWas(p);
  return was ? Math.round(((was - Number(p.price)) / was) * 100) : 0;
};
const NEW_DAYS = 14;
const LOW_STOCK_MAX = 3;
/** The one badge helper (list + detail): DISCOUNT %, SOLD_OUT, LOW_STOCK n (n <= 3), NEW (<= 14 days), CONDITION (used / refurbished). */
export const productBadges = (p: SaleFields & { stock: number; createdAt: Date; condition: string }) => {
  const b: { kind: "DISCOUNT" | "SOLD_OUT" | "LOW_STOCK" | "NEW" | "CONDITION"; value?: number | string }[] = [];
  if (p.stock <= 0) b.push({ kind: "SOLD_OUT" });
  const pct = discountPct(p);
  if (pct > 0) b.push({ kind: "DISCOUNT", value: pct });
  if (p.stock > 0 && p.stock <= LOW_STOCK_MAX) b.push({ kind: "LOW_STOCK", value: p.stock });
  if (Date.now() - p.createdAt.getTime() <= NEW_DAYS * 86_400_000) b.push({ kind: "NEW" });
  if (p.condition !== "NEW") b.push({ kind: "CONDITION", value: p.condition });
  return b;
};

