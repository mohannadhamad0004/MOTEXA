// Parts orders: a customer buys from ONE shop, cash only (pay at the shop, or cash on delivery by the owner himself).
// The server is the only source of prices, of who may change what, and of stock:
//   - prices are read from the products when the order is placed and copied into the lines;
//   - only the shop's own account moves its orders forward; the customer may cancel only while PLACED;
//   - Accept reserves stock (fails if not enough is free), Delivered / Picked up takes it out, Cancel / Reject releases it.
//     Stock and reservations never go below 0 (conditional SQL updates inside the same transaction).
// Every status change writes a system line in the order chat and a notification to the other side.
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { CITY_CENTRES, haversineKm, inBox } from "../geo.js";
import { hasPhoto } from "../uploads/providerFiles.js";
import { notify } from "./provider-onboarding.js";

export class OrderError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

export const ORDER_STATUSES = ["PLACED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "REJECTED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export const FINAL: OrderStatus[] = ["PICKED_UP", "DELIVERED", "CANCELLED", "REJECTED"];

/** What the shop may move an order to, from each status (fulfilment decides pickup vs delivery steps). */
export function shopNext(status: OrderStatus, fulfilment: "PICKUP" | "DELIVERY"): OrderStatus[] {
  const handOver: OrderStatus = fulfilment === "PICKUP" ? "READY_FOR_PICKUP" : "OUT_FOR_DELIVERY";
  switch (status) {
    case "PLACED":
      return ["ACCEPTED", "REJECTED"];
    case "ACCEPTED":
      return ["PREPARING", handOver, "CANCELLED"];
    case "PREPARING":
      return [handOver, "CANCELLED"];
    case "READY_FOR_PICKUP":
      return ["PICKED_UP", "CANCELLED"];
    case "OUT_FOR_DELIVERY":
      return ["DELIVERED", "CANCELLED"];
    default:
      return [];
  }
}
export const customerCanCancel = (status: OrderStatus) => status === "PLACED";

const LABEL: Record<OrderStatus, [string, string]> = {
  PLACED: ["Order placed", "تم إرسال الطلب"],
  ACCEPTED: ["Order accepted", "تم قبول الطلب"],
  PREPARING: ["Preparing your order", "جارٍ تجهيز الطلب"],
  READY_FOR_PICKUP: ["Ready for pickup", "جاهز للاستلام"],
  OUT_FOR_DELIVERY: ["Out for delivery", "في الطريق إليك"],
  PICKED_UP: ["Picked up", "تم الاستلام"],
  DELIVERED: ["Delivered", "تم التوصيل"],
  CANCELLED: ["Order cancelled", "تم إلغاء الطلب"],
  REJECTED: ["Order rejected", "تم رفض الطلب"],
};
const STAMP: Partial<Record<OrderStatus, keyof Prisma.PartsOrderUpdateInput>> = {
  ACCEPTED: "acceptedAt",
  PREPARING: "preparingAt",
  READY_FOR_PICKUP: "readyAt",
  OUT_FOR_DELIVERY: "outAt",
  PICKED_UP: "completedAt",
  DELIVERED: "completedAt",
  CANCELLED: "cancelledAt",
  REJECTED: "rejectedAt",
};

const MAX_LINES = 20;
const MAX_QTY = 99;
const MAX_OPEN_PER_SHOP = 5; // PLACED orders one customer may have waiting at one shop
const visibleProduct = { isHidden: false, shop: { verificationStatus: "APPROVED" as const }, ...hasPhoto };
const money = (n: number) => Math.round(n * 100) / 100;
const nearestArea = (p: { lat: number; lng: number }) =>
  Object.entries(CITY_CENTRES).reduce((best, [name, c]) => (!best || haversineKm(p, c) < best.km ? { name, km: haversineKm(p, c) } : best), null as { name: string; km: number } | null)?.name ?? null;

export type PlaceInput = {
  shopId: string;
  items: { productId: string; quantity: number }[];
  fulfilment: "PICKUP" | "DELIVERY";
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryNote?: string | null;
};

/** Checks the body shape (no database). */
export function parsePlace(body: any): PlaceInput {
  const shopId = typeof body?.shopId === "string" ? body.shopId : "";
  if (!shopId) throw new OrderError(400, "shopId is required.");
  if (!Array.isArray(body?.items) || !body.items.length || body.items.length > MAX_LINES) throw new OrderError(400, `An order has 1 to ${MAX_LINES} lines.`);
  const merged = new Map<string, number>();
  for (const it of body.items) {
    const id = typeof it?.productId === "string" ? it.productId : "";
    const q = it?.quantity;
    if (!id || !Number.isInteger(q) || q < 1 || q > MAX_QTY) throw new OrderError(400, `Each line needs a product and a quantity from 1 to ${MAX_QTY}.`);
    merged.set(id, Math.min(MAX_QTY, (merged.get(id) ?? 0) + q));
  }
  const fulfilment = body?.fulfilment;
  if (fulfilment !== "PICKUP" && fulfilment !== "DELIVERY") throw new OrderError(400, "fulfilment must be PICKUP or DELIVERY.");
  let deliveryLat: number | null = null;
  let deliveryLng: number | null = null;
  let deliveryNote: string | null = null;
  if (fulfilment === "DELIVERY") {
    deliveryLat = body?.deliveryLat;
    deliveryLng = body?.deliveryLng;
    if (typeof deliveryLat !== "number" || typeof deliveryLng !== "number" || !inBox(deliveryLat, deliveryLng)) throw new OrderError(400, "Pin the delivery location on the map (inside the area MOTEXA serves).");
    deliveryNote = typeof body?.deliveryNote === "string" && body.deliveryNote.trim() ? body.deliveryNote.trim().slice(0, 300) : null;
  }
  return { shopId, items: [...merged].map(([productId, quantity]) => ({ productId, quantity })), fulfilment, deliveryLat, deliveryLng, deliveryNote };
}

/** Places an order with the server's own prices. Throws OrderError (400 / 404 / 409) when it can't. */
export async function placeOrder(customerId: string, input: PlaceInput) {
  const shop = await prisma.partsShopProfile.findFirst({ where: { id: input.shopId, verificationStatus: "APPROVED" } });
  if (!shop) throw new OrderError(404, "Shop not found.");
  if (input.fulfilment === "DELIVERY" && !shop.deliveryEnabled) throw new OrderError(400, "This shop does not deliver. Choose pickup.");
  const waiting = await prisma.partsOrder.count({ where: { customerId, shopId: shop.id, status: "PLACED" } });
  if (waiting >= MAX_OPEN_PER_SHOP) throw new OrderError(409, "You already have several orders waiting at this shop. Wait for an answer first.");

  const products = await prisma.partsProduct.findMany({ where: { id: { in: input.items.map((i) => i.productId) }, shopId: shop.id, ...visibleProduct } });
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = input.items.map((i) => {
    const p = byId.get(i.productId);
    if (!p) throw new OrderError(404, "A part in your cart is no longer sold by this shop.");
    if (p.stock - p.reservedStock < i.quantity) throw new OrderError(409, `Only ${Math.max(0, p.stock - p.reservedStock)} left of ${p.name}.`);
    return { productId: p.id, name: p.name, partNumber: p.partNumber, unitPrice: Number(p.price), quantity: i.quantity };
  });
  const subtotal = money(lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0));
  const fee = input.fulfilment === "DELIVERY" && shop.deliveryFee !== null ? Number(shop.deliveryFee) : null;
  const point = input.fulfilment === "DELIVERY" ? { lat: input.deliveryLat as number, lng: input.deliveryLng as number } : null;

  const order = await prisma.$transaction(async (tx) => {
    const o = await tx.partsOrder.create({
      data: {
        customerId,
        shopId: shop.id,
        fulfilment: input.fulfilment,
        payment: input.fulfilment === "DELIVERY" ? "CASH_ON_DELIVERY" : "PAY_AT_SHOP",
        subtotal,
        deliveryFee: fee,
        total: money(subtotal + (fee ?? 0)),
        deliveryLat: point?.lat ?? null,
        deliveryLng: point?.lng ?? null,
        deliveryArea: point ? nearestArea(point) : null,
        deliveryNote: input.deliveryNote ?? null,
        customerReadAt: new Date(),
        items: { create: lines },
        messages: { create: { senderId: null, body: `${LABEL.PLACED[0]}||${LABEL.PLACED[1]}` } },
      },
    });
    await tx.auditLog.create({ data: { actorId: customerId, action: "PARTS_ORDER_PLACED", targetId: o.id, details: { shopId: shop.id, total: Number(o.total) } } });
    return o;
  });
  await notify([shop.userId], ["New order", "طلب جديد"], [`A customer ordered ${lines.length} ${lines.length === 1 ? "part" : "parts"}.`, `طلب زبون ${lines.length} قطعة.`]);
  return order;
}

type Tx = Prisma.TransactionClient;
const lineRows = (tx: Tx, orderId: string) => tx.partsOrderItem.findMany({ where: { orderId } });
async function reserve(tx: Tx, orderId: string) {
  for (const it of await lineRows(tx, orderId)) {
    if (!it.productId) throw new OrderError(409, `${it.name} is no longer sold.`);
    const n = await tx.$executeRaw`UPDATE "PartsProduct" SET "reservedStock" = "reservedStock" + ${it.quantity} WHERE "id" = ${it.productId} AND "stock" - "reservedStock" >= ${it.quantity}`;
    if (n !== 1) throw new OrderError(409, `Not enough stock of ${it.name} to accept this order.`);
  }
}
async function release(tx: Tx, orderId: string) {
  for (const it of await lineRows(tx, orderId))
    if (it.productId) await tx.$executeRaw`UPDATE "PartsProduct" SET "reservedStock" = GREATEST("reservedStock" - ${it.quantity}, 0) WHERE "id" = ${it.productId}`;
}
async function consume(tx: Tx, orderId: string) {
  for (const it of await lineRows(tx, orderId))
    if (it.productId) await tx.$executeRaw`UPDATE "PartsProduct" SET "stock" = GREATEST("stock" - ${it.quantity}, 0), "reservedStock" = GREATEST("reservedStock" - ${it.quantity}, 0) WHERE "id" = ${it.productId}`;
}

/** The shop owner moves his own order. `reason` is required for REJECTED / CANCELLED. */
export async function shopMove(shopUserId: string, orderId: string, to: OrderStatus, reason?: string | null) {
  const o = await prisma.partsOrder.findUnique({ where: { id: orderId }, include: { shop: { select: { userId: true } } } });
  if (!o || o.shop.userId !== shopUserId) throw new OrderError(404, "Order not found.");
  if (!shopNext(o.status, o.fulfilment).includes(to)) throw new OrderError(409, `This order is ${o.status.toLowerCase().replace(/_/g, " ")}; it can't move to ${to.toLowerCase().replace(/_/g, " ")}.`);
  const why = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null;
  if ((to === "REJECTED" || to === "CANCELLED") && !why) throw new OrderError(400, "Give the customer a reason.");
  const updated = await prisma.$transaction(async (tx) => {
    // the status moves only if nobody moved it meanwhile
    const claimed = await tx.partsOrder.updateMany({ where: { id: o.id, status: o.status }, data: { status: to } });
    if (claimed.count !== 1) throw new OrderError(409, "The order changed meanwhile. Refresh and try again.");
    let reserved = o.stockReserved;
    if (to === "ACCEPTED") {
      await reserve(tx, o.id);
      reserved = true;
    } else if ((to === "DELIVERED" || to === "PICKED_UP") && reserved) {
      await consume(tx, o.id);
      reserved = false;
    } else if ((to === "CANCELLED" || to === "REJECTED") && reserved) {
      await release(tx, o.id);
      reserved = false;
    }
    const done = FINAL.includes(to);
    const u = await tx.partsOrder.update({
      where: { id: o.id },
      data: {
        stockReserved: reserved,
        [STAMP[to] as string]: new Date(),
        ...(to === "REJECTED" ? { rejectReason: why } : {}),
        ...(to === "CANCELLED" ? { cancelReason: why, cancelledBy: "SHOP" } : {}),
        ...(done ? { courierLat: null, courierLng: null, courierAt: null } : {}),
      },
    });
    await tx.partsOrderMessage.create({ data: { orderId: o.id, senderId: null, body: `${LABEL[to][0]}${why ? `: ${why}` : ""}||${LABEL[to][1]}${why ? `: ${why}` : ""}` } });
    await tx.auditLog.create({ data: { actorId: shopUserId, action: "PARTS_ORDER_STATUS", targetId: o.id, details: { from: o.status, to } } });
    return u;
  });
  await notify([o.customerId], LABEL[to], [`Your parts order: ${LABEL[to][0].toLowerCase()}.`, `طلب القطع: ${LABEL[to][1]}.`]);
  return updated;
}

/** The customer cancels his own order, only while it is still PLACED (nothing is reserved yet). */
export async function customerCancel(customerId: string, orderId: string, reason?: string | null) {
  const o = await prisma.partsOrder.findUnique({ where: { id: orderId }, include: { shop: { select: { userId: true } } } });
  if (!o || o.customerId !== customerId) throw new OrderError(404, "Order not found.");
  if (!customerCanCancel(o.status)) throw new OrderError(409, "The shop already accepted this order. Ask the shop in the chat.");
  const why = typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 300) : null;
  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.partsOrder.updateMany({ where: { id: o.id, status: "PLACED" }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: why, cancelledBy: "CUSTOMER" } });
    if (claimed.count !== 1) throw new OrderError(409, "The order changed meanwhile. Refresh and try again.");
    await tx.partsOrderMessage.create({ data: { orderId: o.id, senderId: null, body: `${LABEL.CANCELLED[0]} by the customer||${LABEL.CANCELLED[1]} من الزبون` } });
    await tx.auditLog.create({ data: { actorId: customerId, action: "PARTS_ORDER_CANCELLED", targetId: o.id, details: {} } });
    return tx.partsOrder.findUniqueOrThrow({ where: { id: o.id } });
  });
  await notify([o.shop.userId], ["Order cancelled", "تم إلغاء طلب"], ["The customer cancelled an order.", "ألغى الزبون طلبًا."]);
  return updated;
}

/** The owner's live position while the order is OUT_FOR_DELIVERY (rounded to ~1 m; ignored more often than every 5 s). */
export async function courierPing(shopUserId: string, orderId: string, lat: unknown, lng: unknown) {
  if (typeof lat !== "number" || typeof lng !== "number" || !inBox(lat, lng)) throw new OrderError(400, "Invalid location.");
  const o = await prisma.partsOrder.findUnique({ where: { id: orderId }, include: { shop: { select: { userId: true } } } });
  if (!o || o.shop.userId !== shopUserId) throw new OrderError(404, "Order not found.");
  if (o.status !== "OUT_FOR_DELIVERY") throw new OrderError(409, "Live location is shared only while the order is out for delivery.");
  if (o.courierAt && Date.now() - o.courierAt.getTime() < 5000) return o;
  return prisma.partsOrder.update({ where: { id: o.id }, data: { courierLat: Math.round(lat * 1e5) / 1e5, courierLng: Math.round(lng * 1e5) / 1e5, courierAt: new Date() } });
}

/** A live point is shown only while fresh (the owner's screen sends one every ~10 s). */
export const LIVE_MS = 2 * 60_000;
export const livePoint = (o: { status: string; courierLat: number | null; courierLng: number | null; courierAt: Date | null }) =>
  o.status === "OUT_FOR_DELIVERY" && o.courierLat !== null && o.courierLng !== null && o.courierAt && Date.now() - o.courierAt.getTime() < LIVE_MS
    ? { lat: o.courierLat, lng: o.courierLng, at: o.courierAt.toISOString() }
    : null;
