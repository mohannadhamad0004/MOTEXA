// Order flow against the dev database (like password-reset-db.test.ts): a real visible product, the test customer and two shop
// owners. Everything it creates is deleted and the product's stock is put back at the end.
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/prisma.js";
import { hasPhoto } from "../src/uploads/providerFiles.js";
import { customerCancel, parsePlace, placeOrder, shopMove } from "../src/services/parts-orders.js";

const started = new Date();
const orders: string[] = [];
let customerId = "";
let ownerId = "";
let otherOwnerId = "";
let product: { id: string; shopId: string; price: number; stock: number; reservedStock: number };

const stockNow = async () => prisma.partsProduct.findUniqueOrThrow({ where: { id: product.id }, select: { stock: true, reservedStock: true } });
const place = async (quantity: number, extra: object = {}) => {
  const o = await placeOrder(customerId, parsePlace({ shopId: product.shopId, items: [{ productId: product.id, quantity, ...extra }], fulfilment: "PICKUP" }));
  orders.push(o.id);
  return o;
};
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 0;
  } catch (e: any) {
    return e.code ?? -1;
  }
};

before(async () => {
  customerId = (await prisma.user.findUniqueOrThrow({ where: { email: "customer@motexa.test" } })).id;
  const p = await prisma.partsProduct.findFirstOrThrow({
    where: { isHidden: false, shop: { verificationStatus: "APPROVED" }, ...hasPhoto, stock: { gte: 3 } },
    include: { shop: { select: { userId: true } } },
  });
  product = { id: p.id, shopId: p.shopId, price: Number(p.price), stock: p.stock, reservedStock: p.reservedStock };
  ownerId = p.shop.userId;
  otherOwnerId = (await prisma.partsShopProfile.findFirstOrThrow({ where: { id: { not: p.shopId } } })).userId;
});

after(async () => {
  await prisma.partsOrder.deleteMany({ where: { id: { in: orders } } });
  await prisma.partsProduct.update({ where: { id: product.id }, data: { stock: product.stock, reservedStock: product.reservedStock } });
  await prisma.notification.deleteMany({ where: { userId: { in: [customerId, ownerId] }, createdAt: { gte: started } } });
  await prisma.auditLog.deleteMany({ where: { targetId: { in: orders } } });
  await prisma.$disconnect();
});

test("place -> accept -> ready -> picked up: server price, stock reserved then taken out", async () => {
  const o = await place(2, { unitPrice: 0.01 }); // a price sent by the client is ignored
  assert.equal(o.status, "PLACED");
  assert.equal(Number(o.total), Math.round(product.price * 2 * 100) / 100);
  const s0 = await stockNow();
  await shopMove(ownerId, o.id, "ACCEPTED");
  assert.deepEqual(await stockNow(), { stock: s0.stock, reservedStock: s0.reservedStock + 2 });
  await shopMove(ownerId, o.id, "READY_FOR_PICKUP");
  assert.equal(await code(shopMove(ownerId, o.id, "DELIVERED")), 409); // a pickup order is never "delivered"
  await shopMove(ownerId, o.id, "PICKED_UP");
  assert.deepEqual(await stockNow(), { stock: s0.stock - 2, reservedStock: s0.reservedStock });
});

test("permissions: another shop can't touch the order, the customer can't cancel after accept", async () => {
  const o = await place(1);
  assert.equal(await code(shopMove(otherOwnerId, o.id, "ACCEPTED")), 404);
  await shopMove(ownerId, o.id, "ACCEPTED");
  assert.equal(await code(customerCancel(customerId, o.id)), 409);
  assert.equal(await code(shopMove(ownerId, o.id, "CANCELLED")), 400); // a reason is required
  const before = await stockNow();
  await shopMove(ownerId, o.id, "CANCELLED", "Customer did not come");
  assert.equal((await stockNow()).reservedStock, before.reservedStock - 1); // released
});

test("customer cancels while placed; a cancelled order can't be accepted", async () => {
  const o = await place(1);
  await customerCancel(customerId, o.id, "Changed my mind");
  assert.equal(await code(shopMove(ownerId, o.id, "ACCEPTED")), 409);
});

test("stock never goes below 0: the second accept of the same free units fails and changes nothing", async () => {
  const s = await stockNow();
  const free = s.stock - s.reservedStock;
  assert.equal(await code(place(free + 1)), free + 1 > 99 ? 400 : 409); // more than is free can't even be ordered
  const a = await place(Math.min(free, 99));
  const b = await place(Math.min(free, 99));
  await shopMove(ownerId, a.id, "ACCEPTED");
  assert.equal(await code(shopMove(ownerId, b.id, "ACCEPTED")), 409);
  assert.equal((await prisma.partsOrder.findUniqueOrThrow({ where: { id: b.id } })).status, "PLACED"); // rolled back
  await shopMove(ownerId, b.id, "REJECTED", "Out of stock");
  await shopMove(ownerId, a.id, "CANCELLED", "Test");
  assert.deepEqual(await stockNow(), s);
});
