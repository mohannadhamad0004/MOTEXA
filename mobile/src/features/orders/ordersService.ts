// Parts orders: REST client for the customer (/catalog/orders), the shop owner (/parts/me/orders) and parts admins
// (/parts/admin/orders). Prices, totals and allowed steps always come from the server.
import { api } from "../shared/api";
import type { Message } from "../provider/api";

export type OrderStatus = "PLACED" | "ACCEPTED" | "PREPARING" | "READY_FOR_PICKUP" | "OUT_FOR_DELIVERY" | "PICKED_UP" | "DELIVERED" | "CANCELLED" | "REJECTED";
export type Fulfilment = "PICKUP" | "DELIVERY";
export type LivePoint = { lat: number; lng: number; at: string };

type Base = {
  id: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  payment: "CASH_ON_DELIVERY" | "PAY_AT_SHOP";
  subtotal: number;
  /** null = agreed with the shop */
  deliveryFee: number | null;
  total: number;
  items: { id: string; productId: string | null; name: string; partNumber: string; unitPrice: number; quantity: number }[];
  delivery: { lat: number | null; lng: number | null; area: string | null; note: string | null } | null;
  rejectReason: string | null;
  cancelReason: string | null;
  cancelledBy: "CUSTOMER" | "SHOP" | null;
  /** the owner's position while out for delivery and his screen is open (null otherwise) */
  live: LivePoint | null;
  timeline: { placedAt: string; acceptedAt: string | null; preparingAt: string | null; readyAt: string | null; outAt: string | null; completedAt: string | null; cancelledAt: string | null; rejectedAt: string | null };
  unread: number;
  updatedAt: string;
};
export type ShopRef = { id: string; name: string; nameAr: string | null; city: string; address: string | null; hours: string | null; lat: number | null; lng: number | null };
export type CustomerOrder = Base & { shop: ShopRef; canCancel: boolean };
export type ShopOrder = Base & { customer: { firstName: string }; shopPoint: { lat: number; lng: number } | null; next: OrderStatus[] };
export type AdminOrder = Base & { shop: ShopRef; customer: { firstName: string } };
export type Bucket = "new" | "active" | "done";
export type DeliverySettings = { enabled: boolean; fee: number | null; areaNote: string | null };
export type PlaceOrder = { shopId: string; items: { productId: string; quantity: number }[]; fulfilment: Fulfilment; deliveryLat?: number; deliveryLng?: number; deliveryNote?: string };

type Chat = { messages: Message[]; unread: number };

export const customerOrders = {
  place: (b: PlaceOrder) => api<{ order: CustomerOrder }>("POST", "/catalog/orders", b).then((r) => r.order),
  list: () => api<{ orders: CustomerOrder[] }>("GET", "/catalog/orders").then((r) => r.orders),
  get: (id: string) => api<{ order: CustomerOrder }>("GET", `/catalog/orders/${id}`).then((r) => r.order),
  cancel: (id: string, reason?: string) => api<{ order: CustomerOrder }>("POST", `/catalog/orders/${id}/cancel`, { reason }).then((r) => r.order),
  messages: (id: string) => api<Chat>("GET", `/catalog/orders/${id}/messages`),
  send: (id: string, body: string) => api<{ messages: Message[] }>("POST", `/catalog/orders/${id}/messages`, { body }).then((r) => r.messages),
  read: (id: string) => api("POST", `/catalog/orders/${id}/read`),
};

export const shopOrders = {
  list: (bucket: Bucket) => api<{ orders: ShopOrder[]; counts: Record<Bucket, number> }>("GET", `/parts/me/orders?bucket=${bucket}`),
  get: (id: string) => api<{ order: ShopOrder }>("GET", `/parts/me/orders/${id}`).then((r) => r.order),
  move: (id: string, to: OrderStatus, reason?: string) => api<{ order: ShopOrder }>("POST", `/parts/me/orders/${id}/status`, { to, reason }).then((r) => r.order),
  ping: (id: string, p: { lat: number; lng: number }) => api("POST", `/parts/me/orders/${id}/location`, p),
  messages: (id: string) => api<Chat>("GET", `/parts/me/orders/${id}/messages`),
  send: (id: string, body: string) => api<{ messages: Message[] }>("POST", `/parts/me/orders/${id}/messages`, { body }).then((r) => r.messages),
  read: (id: string) => api("POST", `/parts/me/orders/${id}/read`),
  delivery: () => api<{ delivery: DeliverySettings }>("GET", "/parts/me/delivery").then((r) => r.delivery),
  saveDelivery: (d: DeliverySettings) => api<{ delivery: DeliverySettings }>("PUT", "/parts/me/delivery", d).then((r) => r.delivery),
};

export const adminOrders = {
  list: (status?: OrderStatus) => api<{ orders: AdminOrder[] }>("GET", `/parts/admin/orders${status ? `?status=${status}` : ""}`).then((r) => r.orders),
  active: () => api<{ orders: AdminOrder[] }>("GET", "/parts/admin/orders/active-deliveries").then((r) => r.orders),
  get: (id: string) => api<{ order: AdminOrder; messages: Message[] }>("GET", `/parts/admin/orders/${id}`),
};

/** Orders poll this often while their screen is open (status + chat); the live courier point is refreshed faster on the map. */
export const ORDER_REFRESH_MS = 15_000;
export const TRACK_REFRESH_MS = 10_000;
