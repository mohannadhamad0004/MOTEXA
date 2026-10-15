import { Router } from "express";
import express from "express";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { requireAuth, requireCustomer, requirePartsProvider } from "../middleware/auth.middleware.js";

// Part inquiries: a customer asks a parts shop about one product; both sides exchange messages.
//  - /api/requests/part-inquiries/*   CUSTOMER, only their own inquiries.
//  - /api/parts/me/inquiries/*        PARTS_PROVIDER, only their own shop's inquiries.
// Privacy: a shop sees the customer's NAME and what they typed, never their email.
// Mounted after the global JSON parser (bodies are small).
const router = Router();

const MAX_OPEN_PER_SHOP = 5; // non-closed inquiries one customer may have with one shop
const MAX_BODY = 1000;
const STATUSES = ["OPEN", "ANSWERED", "CLOSED"] as const;

class HttpError extends Error {
  constructor(public code: number, message: string, public extra: object = {}) {
    super(message);
  }
}
const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const idParam = (v: unknown) => String(v);
const send = (res: any, e: unknown, label: string) => {
  if (e instanceof HttpError) return res.status(e.code).json({ success: false, message: e.message, ...e.extra });
  console.error(`${label}:`, e);
  return res.status(500).json({ success: false, message: "Internal server error." });
};
const log = (tx: Prisma.TransactionClient, actorId: string, action: string, targetId: string, details: object = {}) =>
  tx.auditLog.create({ data: { actorId, action, targetId, details } });

const customer = [requireAuth, requireCustomer, express.json()];
const shopSide = [requireAuth, requirePartsProvider, express.json()];

const inquiryInclude = {
  shop: { select: { id: true, shopName: true, city: true, verificationStatus: true } },
  customer: { select: { id: true, fullName: true } }, // never the email
  messages: { orderBy: { createdAt: "asc" as const } },
};
type InquiryRow = Prisma.PartInquiryGetPayload<{ include: typeof inquiryInclude }>;

const shapeMessages = (i: InquiryRow, viewer: "CUSTOMER" | "SHOP") =>
  i.messages.map((m) => {
    const from = m.senderId === i.customerId ? "CUSTOMER" : "SHOP";
    return { id: m.id, from, mine: from === viewer, body: m.body, createdAt: m.createdAt };
  });

const base = (i: InquiryRow) => ({
  id: i.id,
  status: i.status,
  quantity: i.quantity,
  product: { id: i.productId, name: i.productName, partNumber: i.productPartNumber },
  createdAt: i.createdAt,
  updatedAt: i.updatedAt,
  closedAt: i.closedAt,
});

const customerView = (i: InquiryRow, withMessages: boolean) => ({
  ...base(i),
  shop: { id: i.shop.id, name: i.shop.shopName, city: i.shop.city },
  lastMessage: i.messages.length ? i.messages[i.messages.length - 1].body.slice(0, 120) : null,
  ...(withMessages ? { messages: shapeMessages(i, "CUSTOMER") } : {}),
});

const shopView = (i: InquiryRow, withMessages: boolean) => ({
  ...base(i),
  customerName: i.customer.fullName,
  lastMessage: i.messages.length ? i.messages[i.messages.length - 1].body.slice(0, 120) : null,
  ...(withMessages ? { messages: shapeMessages(i, "SHOP") } : {}),
});

const statusFilter = (q: unknown) => {
  if (q === undefined || q === "") return undefined;
  if (typeof q !== "string" || !STATUSES.includes(q as never)) throw new HttpError(400, "Invalid status filter.");
  return q as (typeof STATUSES)[number];
};

/** Adds a message and moves the status: shop reply -> ANSWERED, customer reply after an answer -> OPEN. Refuses a closed inquiry. */
async function addMessage(inquiryId: string, senderId: string, side: "CUSTOMER" | "SHOP", rawBody: unknown) {
  const body = text(rawBody, MAX_BODY + 1);
  if (!body) throw new HttpError(400, "A message is required.");
  if (body.length > MAX_BODY) throw new HttpError(400, `A message can have at most ${MAX_BODY} characters.`);
  await prisma.$transaction(async (tx) => {
    const next = side === "SHOP" ? "ANSWERED" : "OPEN";
    // Atomic: only a non-closed inquiry takes the message.
    const moved = await tx.partInquiry.updateMany({ where: { id: inquiryId, status: { not: "CLOSED" } }, data: { status: next } });
    if (!moved.count) throw new HttpError(409, "This inquiry is closed.");
    await tx.partInquiryMessage.create({ data: { inquiryId, senderId, body } });
    await log(tx, senderId, "PART_INQUIRY_REPLIED", inquiryId, { side });
  });
}

async function closeInquiry(inquiryId: string, actorId: string, side: "CUSTOMER" | "SHOP") {
  await prisma.$transaction(async (tx) => {
    const done = await tx.partInquiry.updateMany({
      where: { id: inquiryId, status: { not: "CLOSED" } },
      data: { status: "CLOSED", closedAt: new Date(), closedById: actorId },
    });
    if (!done.count) throw new HttpError(409, "This inquiry is already closed.");
    await log(tx, actorId, "PART_INQUIRY_CLOSED", inquiryId, { by: side });
  });
}

// =====================================================================
// Customer
// =====================================================================

router.post("/requests/part-inquiries", ...customer, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const productId = text(req.body?.productId, 64);
    if (!productId) throw new HttpError(400, "productId is required.");
    const quantity = req.body?.quantity === undefined ? 1 : req.body.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) throw new HttpError(400, "Quantity must be a whole number from 1 to 999.");
    const question = text(req.body?.question, MAX_BODY + 1);
    if (!question || question.length < 3) throw new HttpError(400, "Please write your question (at least 3 characters).");
    if (question.length > MAX_BODY) throw new HttpError(400, `A question can have at most ${MAX_BODY} characters.`);

    // Only a product a customer can see: not hidden, shop approved. Anything else looks like it does not exist.
    const product = await prisma.partsProduct.findFirst({
      where: { id: productId, isHidden: false, shop: { verificationStatus: "APPROVED" } },
      select: { id: true, name: true, partNumber: true, shopId: true },
    });
    if (!product) throw new HttpError(404, "Product not found.");

    const id = await prisma.$transaction(async (tx) => {
      const existing = await tx.partInquiry.findFirst({
        where: { customerId: me.id, productId: product.id, status: { not: "CLOSED" } },
        select: { id: true },
      });
      if (existing) throw new HttpError(409, "You already have an open question about this part.", { existingInquiryId: existing.id });
      const openWithShop = await tx.partInquiry.count({ where: { customerId: me.id, shopId: product.shopId, status: { not: "CLOSED" } } });
      if (openWithShop >= MAX_OPEN_PER_SHOP) throw new HttpError(409, `You already have ${MAX_OPEN_PER_SHOP} open questions with this shop. Close one first.`);
      const created = await tx.partInquiry.create({
        data: {
          customerId: me.id,
          shopId: product.shopId,
          productId: product.id,
          productName: product.name,
          productPartNumber: product.partNumber,
          quantity,
          messages: { create: { senderId: me.id, body: question } },
        },
      });
      await log(tx, me.id, "PART_INQUIRY_CREATED", created.id, { productId: product.id, quantity });
      return created.id;
    });
    const row = await prisma.partInquiry.findUniqueOrThrow({ where: { id }, include: inquiryInclude });
    return res.status(201).json({ success: true, inquiry: customerView(row, true) });
  } catch (e) {
    return send(res, e, "Part inquiry create error");
  }
});

router.get("/requests/part-inquiries", ...customer, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const status = statusFilter(req.query.status);
    const rows = await prisma.partInquiry.findMany({
      where: { customerId: me.id, ...(status ? { status } : {}) },
      include: inquiryInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return res.json({ success: true, inquiries: rows.map((r) => customerView(r, false)) });
  } catch (e) {
    return send(res, e, "Part inquiries list error");
  }
});

const ownInquiry = async (res: any, id: string) => {
  const me = res.locals.authUser as { id: string };
  const row = await prisma.partInquiry.findFirst({ where: { id, customerId: me.id }, include: inquiryInclude });
  if (!row) throw new HttpError(404, "Inquiry not found.");
  return row;
};

router.get("/requests/part-inquiries/:id", ...customer, async (req, res) => {
  try {
    return res.json({ success: true, inquiry: customerView(await ownInquiry(res, idParam(req.params.id)), true) });
  } catch (e) {
    return send(res, e, "Part inquiry error");
  }
});

router.post("/requests/part-inquiries/:id/messages", ...customer, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const inq = await ownInquiry(res, idParam(req.params.id));
    await addMessage(inq.id, me.id, "CUSTOMER", req.body?.body);
    return res.status(201).json({ success: true, inquiry: customerView(await ownInquiry(res, inq.id), true) });
  } catch (e) {
    return send(res, e, "Part inquiry message error");
  }
});

router.patch("/requests/part-inquiries/:id/close", ...customer, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const inq = await ownInquiry(res, idParam(req.params.id));
    await closeInquiry(inq.id, me.id, "CUSTOMER");
    return res.json({ success: true, inquiry: customerView(await ownInquiry(res, inq.id), true) });
  } catch (e) {
    return send(res, e, "Part inquiry close error");
  }
});

// =====================================================================
// Parts shop
// =====================================================================

async function myShopId(res: any) {
  const me = res.locals.authUser as { id: string };
  const shop = await prisma.partsShopProfile.findUnique({ where: { userId: me.id }, select: { id: true, verificationStatus: true } });
  if (!shop) throw new HttpError(404, "No parts shop is linked to this account.");
  return shop;
}
const shopInquiry = async (res: any, id: string) => {
  const shop = await myShopId(res);
  const row = await prisma.partInquiry.findFirst({ where: { id, shopId: shop.id }, include: inquiryInclude });
  if (!row) throw new HttpError(404, "Inquiry not found.");
  return { shop, row };
};

router.get("/parts/me/inquiries", ...shopSide, async (req, res) => {
  try {
    const shop = await myShopId(res);
    const status = statusFilter(req.query.status);
    const rows = await prisma.partInquiry.findMany({
      where: { shopId: shop.id, ...(status ? { status } : {}) },
      include: inquiryInclude,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return res.json({ success: true, inquiries: rows.map((r) => shopView(r, false)) });
  } catch (e) {
    return send(res, e, "Shop inquiries list error");
  }
});

router.get("/parts/me/inquiries/:id", ...shopSide, async (req, res) => {
  try {
    const { row } = await shopInquiry(res, idParam(req.params.id));
    return res.json({ success: true, inquiry: shopView(row, true) });
  } catch (e) {
    return send(res, e, "Shop inquiry error");
  }
});

router.post("/parts/me/inquiries/:id/messages", ...shopSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const { shop, row } = await shopInquiry(res, idParam(req.params.id));
    if (shop.verificationStatus === "REJECTED") throw new HttpError(403, "Your shop application was rejected. You cannot reply to inquiries.");
    await addMessage(row.id, me.id, "SHOP", req.body?.body);
    return res.status(201).json({ success: true, inquiry: shopView((await shopInquiry(res, row.id)).row, true) });
  } catch (e) {
    return send(res, e, "Shop inquiry message error");
  }
});

router.patch("/parts/me/inquiries/:id/close", ...shopSide, async (req, res) => {
  try {
    const me = res.locals.authUser as { id: string };
    const { row } = await shopInquiry(res, idParam(req.params.id));
    await closeInquiry(row.id, me.id, "SHOP");
    return res.json({ success: true, inquiry: shopView((await shopInquiry(res, row.id)).row, true) });
  } catch (e) {
    return send(res, e, "Shop inquiry close error");
  }
});

export default router;
