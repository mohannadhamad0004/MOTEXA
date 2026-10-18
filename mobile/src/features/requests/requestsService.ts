// Requests v1: REST clients for part inquiries ("Ask the shop") and tow requests.
// customerRequests* are used by the CUSTOMER app, providerInquiries / providerTowRequests by the shop and the
// tow company. The server scopes every call to the caller, hides the customer's email from providers and the
// plate / provider phone from customers.

import { api } from "../shared/api";
import type { TruckType } from "../tow/towService";

// ---- part inquiries ----

export type InquiryStatus = "OPEN" | "ANSWERED" | "CLOSED";

export type ThreadMessage = { id: string; from: "CUSTOMER" | "SHOP"; mine: boolean; body: string; createdAt: string };

export type InquirySummary = {
  id: string;
  status: InquiryStatus;
  quantity: number;
  product: { id: string | null; name: string; partNumber: string };
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lastMessage: string | null;
  messages?: ThreadMessage[];
};
export type CustomerInquiry = InquirySummary & { shop: { id: string; name: string; city: string } };
export type ShopInquiry = InquirySummary & { customerName: string };

/** The server's 409 for "you already have this question open" carries the thread to open instead. */
export const existingIdOf = (e: any, key: "existingInquiryId" | "existingRequestId"): string | null => (e?.status === 409 && e?.data?.[key]) || null;

export const customerInquiries = {
  async create(input: { productId: string; quantity: number; question: string }) {
    return (await api<{ inquiry: CustomerInquiry }>("POST", "/requests/part-inquiries", input)).inquiry;
  },
  async list() {
    return (await api<{ inquiries: CustomerInquiry[] }>("GET", "/requests/part-inquiries")).inquiries;
  },
  async get(id: string) {
    return (await api<{ inquiry: CustomerInquiry }>("GET", `/requests/part-inquiries/${id}`)).inquiry;
  },
  async reply(id: string, body: string) {
    return (await api<{ inquiry: CustomerInquiry }>("POST", `/requests/part-inquiries/${id}/messages`, { body })).inquiry;
  },
  async close(id: string) {
    return (await api<{ inquiry: CustomerInquiry }>("PATCH", `/requests/part-inquiries/${id}/close`)).inquiry;
  },
};

export const shopInquiries = {
  async list(status?: InquiryStatus) {
    return (await api<{ inquiries: ShopInquiry[] }>("GET", `/parts/me/inquiries${status ? `?status=${status}` : ""}`)).inquiries;
  },
  async get(id: string) {
    return (await api<{ inquiry: ShopInquiry }>("GET", `/parts/me/inquiries/${id}`)).inquiry;
  },
  async reply(id: string, body: string) {
    return (await api<{ inquiry: ShopInquiry }>("POST", `/parts/me/inquiries/${id}/messages`, { body })).inquiry;
  },
  async close(id: string) {
    return (await api<{ inquiry: ShopInquiry }>("PATCH", `/parts/me/inquiries/${id}/close`)).inquiry;
  },
};

// ---- tow requests ----

export type TowStatus = "REQUESTED" | "ACCEPTED" | "DECLINED" | "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const TOW_PROBLEMS = ["WONT_START", "ACCIDENT", "FLAT_TIRE", "OVERHEATING", "OUT_OF_FUEL", "OTHER"] as const;
export type TowProblem = (typeof TOW_PROBLEMS)[number];

type TowBase = {
  id: string;
  status: TowStatus;
  pickupAddress: string;
  dropoffAddress: string;
  contactPhone: string;
  vehicle: { make: string; model: string; year: number | null };
  problemType: TowProblem;
  /** map points of the trip; only the customer and the receiving company ever get them */
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  notes: string | null;
  declineReason: string | null;
  cancelReason: string | null;
  cancelledBy: "CUSTOMER" | "COMPANY" | null;
  timeline: { status: TowStatus; at: string }[];
  createdAt: string;
  updatedAt: string;
};
type AssignedTruck = { type: TruckType; make: string | null; model: string | null; year: number | null };

export type CustomerTowRequest = TowBase & {
  company: { id: string; name: string; city: string };
  truck: AssignedTruck | null; // never a plate
  canCancel: boolean;
};
export type CompanyTowRequest = TowBase & {
  customerName: string; // never the email
  truck: (AssignedTruck & { id: string | null; plateNumber: string | null }) | null;
};

export type TowRequestInput = {
  companyId: string;
  pickupAddress: string;
  dropoffAddress: string;
  contactPhone: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | null;
  problemType: TowProblem;
  notes: string;
  pickupLat?: number | null;
  pickupLng?: number | null;
  dropoffLat?: number | null;
  dropoffLng?: number | null;
};

export const customerTowRequests = {
  async create(input: TowRequestInput) {
    return (await api<{ request: CustomerTowRequest }>("POST", "/requests/tow", input)).request;
  },
  async list() {
    return (await api<{ requests: CustomerTowRequest[] }>("GET", "/requests/tow")).requests;
  },
  async get(id: string) {
    return (await api<{ request: CustomerTowRequest }>("GET", `/requests/tow/${id}`)).request;
  },
  async cancel(id: string, reason: string) {
    return (await api<{ request: CustomerTowRequest }>("PATCH", `/requests/tow/${id}/cancel`, { reason })).request;
  },
};

export const companyTowRequests = {
  async list(status?: TowStatus) {
    return (await api<{ requests: CompanyTowRequest[] }>("GET", `/tow/me/requests${status ? `?status=${status}` : ""}`)).requests;
  },
  async get(id: string) {
    return (await api<{ request: CompanyTowRequest }>("GET", `/tow/me/requests/${id}`)).request;
  },
  async accept(id: string, truckId: string) {
    return (await api<{ request: CompanyTowRequest }>("PATCH", `/tow/me/requests/${id}/accept`, { truckId })).request;
  },
  async decline(id: string, reason: string) {
    return (await api<{ request: CompanyTowRequest }>("PATCH", `/tow/me/requests/${id}/decline`, { reason })).request;
  },
  async setStatus(id: string, status: "EN_ROUTE" | "IN_PROGRESS" | "COMPLETED") {
    return (await api<{ request: CompanyTowRequest }>("PATCH", `/tow/me/requests/${id}/status`, { status })).request;
  },
  async cancel(id: string, reason: string) {
    return (await api<{ request: CompanyTowRequest }>("PATCH", `/tow/me/requests/${id}/cancel`, { reason })).request;
  },
};
