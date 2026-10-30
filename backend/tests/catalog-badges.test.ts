import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../src/generated/prisma/client.js";
import { discountPct, productBadges, saleWas } from "../src/services/catalog-badges.js";

const D = (n: number) => new Prisma.Decimal(n);
const base = { price: D(80), compareAtPrice: null as Prisma.Decimal | null, saleStartsAt: null as Date | null, saleEndsAt: null as Date | null, stock: 10, createdAt: new Date(Date.now() - 60 * 86_400_000), condition: "NEW" };
const kinds = (p: typeof base) => productBadges(p).map((b) => `${b.kind}${b.value !== undefined ? ":" + b.value : ""}`);

test("no badges for an ordinary product", () => assert.deepEqual(kinds(base), []));
test("discount only while the sale runs and the was-price is higher", () => {
  assert.equal(saleWas({ ...base, compareAtPrice: D(100) }), 100);
  assert.equal(discountPct({ ...base, compareAtPrice: D(100) }), 20);
  assert.equal(saleWas({ ...base, compareAtPrice: D(70) }), null);
  assert.equal(saleWas({ ...base, compareAtPrice: D(100), saleEndsAt: new Date(Date.now() - 1000) }), null);
  assert.equal(saleWas({ ...base, compareAtPrice: D(100), saleStartsAt: new Date(Date.now() + 86_400_000) }), null);
  assert.deepEqual(kinds({ ...base, compareAtPrice: D(100) }), ["DISCOUNT:20"]);
});
test("stock badges", () => {
  assert.deepEqual(kinds({ ...base, stock: 0 }), ["SOLD_OUT"]);
  assert.deepEqual(kinds({ ...base, stock: 3 }), ["LOW_STOCK:3"]);
  assert.deepEqual(kinds({ ...base, stock: 4 }), []);
});
test("new (<= 14 days) and condition", () => {
  assert.deepEqual(kinds({ ...base, createdAt: new Date() }), ["NEW"]);
  assert.deepEqual(kinds({ ...base, condition: "USED" }), ["CONDITION:USED"]);
});
