import { errorBody } from "../services/error-codes.js";
import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireCustomer, requirePartsAdmin, requirePartsProvider } from "../middleware/auth.middleware.js";
import { requireApprovedProvider } from "../services/provider-onboarding.js";
import { notify } from "../services/provider-onboarding.js";
import { FINAL, ORDER_STATUSES, OrderError, OrderStatus, courierPing, customerCanCancel, customerCancel, livePoint, parsePlace, placeOrder, shopMove, shopNext } from "../services/parts-orders.js";

// Parts orders (cash only; pickup or the owner delivers himself). Rules live in services/parts-orders.ts.
//  - /api/catalog/orders/*        CUSTOMER, only their own orders.
//  - /api/parts/me/orders/*       PARTS_PROVIDER of an approved shop, only that shop's orders.
//  - /api/parts/admin/orders/*    Parts admins, read only.
// Privacy: the shop sees the customer's FIRST name, the area and (delivery) the pin + note; never the email or phone.
// Mounted before the global JSON parser, so each write route parses its own (small) body.
const router = Router();
const json = express.json({ limit: "16kb" });
const customer = [requireAuth, requireCustomer, json];
const shopSide = [requireAuth, requirePartsProvider, requireApprovedProvider, json];
const admin = [requireAuth, requirePartsAdmin];

const send = (res: any, e: unknown, label: string) => {
  if (e instanceof OrderError) return res.status(e.code).json(errorBody(e.message));
  console.error(`${label}:`, e);
  return res.status(500).json(errorBody("Internal server error."));
};
const id = (v: unknown) => String(v);
const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;
const num = (v: Prisma.Decimal | null) => (v === null ? null : Number(v));
const BUCKET: Record<string, OrderStatus[]> = {
  new: ["PLACED"],
  active: ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"],
  done: [...FINAL],
};

const include = {
  items: true,
  shop: { select: { id: true, userId: true, shopName: true, shopNameAr: true, city: true, address: true, locationAddress: true, workingHours: true, baseLat: true, baseLng: true } },
  customer: { select: { id: true, fullName: true } },
} satisfies Prisma.PartsOrderInclude;
type Row = Prisma.PartsOrderGetPayload<{ include: typeof include }>;

/** Unread = chat lines from the other side (not status lines) after the viewer last opened the chat. */
async function unreadOf(orderIds: string[], side: "customer" | "shop") {
  if (!orderIds.length) return new Map<string, number>();
  const orders = await prisma.partsOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, customerId: true, customerReadAt: true, shopReadAt: true } });
  const out = new Map<string, number>();
  for (const o of orders) {
    const since = side === "customer" ? o.customerReadAt : o.shopReadAt;
    const n = await prisma.partsOrderMessage.count({
      where: { orderId: o.id, senderId: side === "customer" ? { not: null, notIn: [o.customerId] } : o.customerId, ...(since ? { createdAt: { gt: since } } : {}) },
    });
    out.set(o.id, n);
  }
  return out;
}

const common = (o: Row, unread: number) => ({
  id: o.id,
  status: o.status,
  fulfilment: o.fulfilment,
  payment: o.payment,
  subtotal: Number(o.subtotal),
  deliveryFee: num(o.deliveryFee), // null = agreed with the shop
  total: Number(o.total),
  items: o.items.map((i) => ({ id: i.id, productId: i.productId, name: i.name, partNumber: i.partNumber, unitPrice: Number(i.unitPrice), quantity: i.quantity })),
  delivery: o.fulfilment === "DELIVERY" ? { lat: o.deliveryLat, lng: o.deliveryLng, area: o.deliveryArea, note: o.deliveryNote } : null,
  rejectReason: o.rejectReason,
  cancelReason: o.cancelReason,
  cancelledBy: o.cancelledBy,
  live: livePoint(o),
  timeline: { placedAt: o.createdAt, acceptedAt: o.acceptedAt, preparingAt: o.preparingAt, readyAt: o.readyAt, outAt: o.outAt, completedAt: o.completedAt, cancelledAt: o.cancelledAt, rejectedAt: o.rejectedAt },
  unread,
  updatedAt: o.updatedAt,
});
const shopInfo = (o: Row) => ({
  id: o.shop.id,
  name: o.shop.shopName,
  nameAr: o.shop.shopNameAr,
  city: o.shop.city,
  address: o.shop.locationAddress ?? o.shop.address,
  hours: o.shop.workingHours,
  // the shop's own point (rounded ~110 m like everywhere else for customers)
  lat: o.shop.baseLat === null ? null : Math.round(o.shop.baseLat * 1000) / 1000,
  lng: o.shop.baseLng === null ? null : Math.round(o.shop.baseLng * 1000) / 1000,
});
const forCustomer = (o: Row, unread = 0) => ({ ...common(o, unread), shop: shopInfo(o), canCancel: customerCanCancel(o.status) });
// The customer's delivery pin and note are the shop's only while the order is open; afterwards just the area stays.
const forShop = (o: Row, unread = 0) => ({
  ...common(o, unread),
  ...(o.fulfilment === "DELIVERY" && FINAL.includes(o.status) ? { delivery: { lat: null, lng: null, area: o.deliveryArea, note: null } } : {}),
  customer: { firstName: firstName(o.customer.fullName) },
  // the shop's exact point, for the owner's own route
  shopPoint: o.shop.baseLat !== null && o.shop.baseLng !== null ? { lat: o.shop.baseLat, lng: o.shop.baseLng } : null,
  next: shopNext(o.status, o.fulfilment),
});
const forAdmin = (o: Row) => ({ ...common(o, 0), shop: shopInfo(o), customer: { firstName: firstName(o.customer.fullName) } });

/** Chat lines in the shape of the app's chat screen: shop owner = PROVIDER, customer = ADMIN, status lines = SYSTEM. */
async function chatOf(orderId: string, customerId: string) {
  const rows = await prisma.partsOrderMessage.findMany({ where: { orderId }, orderBy: { createdAt: "asc" }, include: { sender: { select: { fullName: true } } }, take: 500 });
  return rows.map((m) => ({
    id: m.id,
    from: m.senderId === null ? "SYSTEM" : m.senderId === customerId ? "ADMIN" : "PROVIDER",
    author: m.senderId === null ? "MOTEXA" : m.senderId === customerId ? firstName(m.sender?.fullName ?? "") : m.sender?.fullName ?? "",
    body: m.body,
    at: m.createdAt.toISOString(),
    attachments: [] as never[],
  }));
}
const chatBody = (body: any) => {
  if (body?.attachment) throw new OrderError(400, "Attachments are not supported in order chats.");
  const t = typeof body?.body === "string" ? body.body.trim() : "";
  if (!t) throw new OrderError(400, "Write a message.");
  if (t.length > 1000) throw new OrderError(400, "A message can be at most 1000 characters.");
  return t;
};

// =====================================================================
// Customer
// =====================================================================
router.post("/catalog/orders", ...customer, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const o = await placeOrder(me.id, parsePlace(req.body));
    const row = await prisma.partsOrder.findUniqueOrThrow({ where: { id: o.id }, include });
    return res.status(201).json({ success: true, order: forCustomer(row) });
  } catch (e) {
    return send(res, e, "Place order error");
  }
});

router.get("/catalog/orders", ...customer, async (_req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const rows = await prisma.partsOrder.findMany({ where: { customerId: me.id }, include, orderBy: { updatedAt: "desc" }, take: 100 });
    const unread = await unreadOf(rows.map((r) => r.id), "customer");
    return res.json({ success: true, orders: rows.map((r) => forCustomer(r, unread.get(r.id) ?? 0)) });
  } catch (e) {
    return send(res, e, "My orders error");
  }
});

const myOrder = async (res: any, orderId: string) => {
  const me = res.locals.authUser as { id: string };
  const o = await prisma.partsOrder.findFirst({ where: { id: orderId, customerId: me.id }, include });
  if (!o) throw new OrderError(404, "Order not found.");
  return o;
};
router.get("/catalog/orders/:id", ...customer, async (req, res) => {
  try {
    const o = await myOrder(res, id(req.params.id));
    const unread = await unreadOf([o.id], "customer");
    return res.json({ success: true, order: forCustomer(o, unread.get(o.id) ?? 0) });
  } catch (e) {
    return send(res, e, "Order error");
  }
});
router.post("/catalog/orders/:id/cancel", ...customer, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    await customerCancel(me.id, id(req.params.id), req.body?.reason);
    return res.json({ success: true, order: forCustomer(await myOrder(res, id(req.params.id))) });
  } catch (e) {
    return send(res, e, "Cancel order error");
  }
});
router.get("/catalog/orders/:id/messages", ...customer, async (req, res) => {
  try {
    const o = await myOrder(res, id(req.params.id));
    const unread = await unreadOf([o.id], "customer");
    return res.json({ success: true, messages: await chatOf(o.id, o.customerId), unread: unread.get(o.id) ?? 0 });
  } catch (e) {
    return send(res, e, "Order chat error");
  }
});
router.post("/catalog/orders/:id/messages", ...customer, async (req, res) => {
  try {
    const o = await myOrder(res, id(req.params.id));
    const body = chatBody(req.body);
    await prisma.partsOrderMessage.create({ data: { orderId: o.id, senderId: o.customerId, body } });
    await prisma.partsOrder.update({ where: { id: o.id }, data: { customerReadAt: new Date() } });
    await notify([o.shop.userId], ["New order message", "رسالة جديدة في طلب"], [`${firstName(o.customer.fullName)}: ${body.slice(0, 80)}`, `${firstName(o.customer.fullName)}: ${body.slice(0, 80)}`]);
    return res.json({ success: true, messages: await chatOf(o.id, o.customerId) });
  } catch (e) {
    return send(res, e, "Order chat error");
  }
});
router.post("/catalog/orders/:id/read", ...customer, async (req, res) => {
  try {
    const o = await myOrder(res, id(req.params.id));
    await prisma.partsOrder.update({ where: { id: o.id }, data: { customerReadAt: new Date() } });
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Order read error");
  }
});

// =====================================================================
// Shop owner
// =====================================================================
const ownOrder = async (res: any, orderId: string) => {
  const me = res.locals.authUser as { id: string };
  const o = await prisma.partsOrder.findFirst({ where: { id: orderId, shop: { userId: me.id } }, include });
  if (!o) throw new OrderError(404, "Order not found.");
  return o;
};

router.get("/parts/me/orders", ...shopSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const bucket = typeof req.query.bucket === "string" && BUCKET[req.query.bucket] ? req.query.bucket : "new";
    const where = { shop: { userId: me.id } };
    const [rows, ...counts] = await Promise.all([
      prisma.partsOrder.findMany({ where: { ...where, status: { in: BUCKET[bucket] } }, include, orderBy: { updatedAt: "desc" }, take: 100 }),
      ...Object.values(BUCKET).map((s) => prisma.partsOrder.count({ where: { ...where, status: { in: s } } })),
    ]);
    const unread = await unreadOf(rows.map((r) => r.id), "shop");
    return res.json({
      success: true,
      counts: Object.fromEntries(Object.keys(BUCKET).map((k, i) => [k, counts[i]])),
      orders: rows.map((r) => forShop(r, unread.get(r.id) ?? 0)),
    });
  } catch (e) {
    return send(res, e, "Shop orders error");
  }
});
router.get("/parts/me/orders/:id", ...shopSide, async (req, res) => {
  try {
    const o = await ownOrder(res, id(req.params.id));
    const unread = await unreadOf([o.id], "shop");
    return res.json({ success: true, order: forShop(o, unread.get(o.id) ?? 0) });
  } catch (e) {
    return send(res, e, "Shop order error");
  }
});
router.post("/parts/me/orders/:id/status", ...shopSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const to = req.body?.to;
    if (!ORDER_STATUSES.includes(to)) return res.status(400).json({ success: false, message: "Unknown status." });
    await shopMove(me.id, id(req.params.id), to, req.body?.reason);
    return res.json({ success: true, order: forShop(await ownOrder(res, id(req.params.id))) });
  } catch (e) {
    return send(res, e, "Order status error");
  }
});
router.post("/parts/me/orders/:id/location", ...shopSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    await courierPing(me.id, id(req.params.id), req.body?.lat, req.body?.lng);
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Courier location error");
  }
});
router.get("/parts/me/orders/:id/messages", ...shopSide, async (req, res) => {
  try {
    const o = await ownOrder(res, id(req.params.id));
    const unread = await unreadOf([o.id], "shop");
    return res.json({ success: true, messages: await chatOf(o.id, o.customerId), unread: unread.get(o.id) ?? 0 });
  } catch (e) {
    return send(res, e, "Order chat error");
  }
});
router.post("/parts/me/orders/:id/messages", ...shopSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const o = await ownOrder(res, id(req.params.id));
    const body = chatBody(req.body);
    await prisma.partsOrderMessage.create({ data: { orderId: o.id, senderId: me.id, body } });
    await prisma.partsOrder.update({ where: { id: o.id }, data: { shopReadAt: new Date() } });
    await notify([o.customerId], ["New message from the shop", "رسالة جديدة من المتجر"], [`${o.shop.shopName}: ${body.slice(0, 80)}`, `${o.shop.shopNameAr || o.shop.shopName}: ${body.slice(0, 80)}`]);
    return res.json({ success: true, messages: await chatOf(o.id, o.customerId) });
  } catch (e) {
    return send(res, e, "Order chat error");
  }
});
router.post("/parts/me/orders/:id/read", ...shopSide, async (req, res) => {
  try {
    const o = await ownOrder(res, id(req.params.id));
    await prisma.partsOrder.update({ where: { id: o.id }, data: { shopReadAt: new Date() } });
    return res.json({ success: true });
  } catch (e) {
    return send(res, e, "Order read error");
  }
});

// delivery settings: on/off, fee (null = agreed with the customer), area note
router.get("/parts/me/delivery", ...shopSide, async (_req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const s = await prisma.partsShopProfile.findUnique({ where: { userId: me.id }, select: { deliveryEnabled: true, deliveryFee: true, deliveryAreaNote: true } });
    if (!s) throw new OrderError(404, "No parts shop is linked to this account.");
    return res.json({ success: true, delivery: { enabled: s.deliveryEnabled, fee: num(s.deliveryFee), areaNote: s.deliveryAreaNote } });
  } catch (e) {
    return send(res, e, "Delivery settings error");
  }
});
router.put("/parts/me/delivery", ...shopSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const b = req.body ?? {};
    if (typeof b.enabled !== "boolean") throw new OrderError(400, "enabled must be true or false.");
    const fee = b.fee === null || b.fee === undefined || b.fee === "" ? null : Number(b.fee);
    if (fee !== null && (!Number.isFinite(fee) || fee < 0 || fee > 10_000)) throw new OrderError(400, "The delivery fee must be a number from 0 to 10000, or empty (agreed with the customer).");
    const areaNote = typeof b.areaNote === "string" && b.areaNote.trim() ? b.areaNote.trim().slice(0, 300) : null;
    const s = await prisma.partsShopProfile.update({
      where: { userId: me.id },
      data: { deliveryEnabled: b.enabled, deliveryFee: fee === null ? null : Math.round(fee * 100) / 100, deliveryAreaNote: areaNote },
      select: { deliveryEnabled: true, deliveryFee: true, deliveryAreaNote: true },
    });
    return res.json({ success: true, delivery: { enabled: s.deliveryEnabled, fee: num(s.deliveryFee), areaNote: s.deliveryAreaNote } });
  } catch (e) {
    return send(res, e, "Delivery settings error");
  }
});

// =====================================================================
// Parts admins (read only)
// =====================================================================
router.get("/parts/admin/orders", ...admin, async (req, res) => {
  try {
    const status = typeof req.query.status === "string" && ORDER_STATUSES.includes(req.query.status as OrderStatus) ? (req.query.status as OrderStatus) : null;
    const rows = await prisma.partsOrder.findMany({ where: status ? { status } : {}, include, orderBy: { updatedAt: "desc" }, take: 200 });
    return res.json({ success: true, orders: rows.map(forAdmin) });
  } catch (e) {
    return send(res, e, "Admin orders error");
  }
});
router.get("/parts/admin/orders/active-deliveries", ...admin, async (_req, res) => {
  try {
    const rows = await prisma.partsOrder.findMany({ where: { status: "OUT_FOR_DELIVERY" }, include, orderBy: { outAt: "desc" }, take: 200 });
    return res.json({ success: true, orders: rows.map(forAdmin) });
  } catch (e) {
    return send(res, e, "Active deliveries error");
  }
});
router.get("/parts/admin/orders/:id", ...admin, async (req, res) => {
  try {
    const o = await prisma.partsOrder.findUnique({ where: { id: id(req.params.id) }, include });
    if (!o) throw new OrderError(404, "Order not found.");
    return res.json({ success: true, order: forAdmin(o), messages: await chatOf(o.id, o.customerId) });
  } catch (e) {
    return send(res, e, "Admin order error");
  }
});

export default router;
