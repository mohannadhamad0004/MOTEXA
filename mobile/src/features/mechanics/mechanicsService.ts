// Mechanics for customers: REST clients for the public mechanic catalog, the customer's service requests and the
// mechanic's own inbox. The server only returns approved skills and public fields: a customer never gets a mechanic's
// phone, email or credentials, and a mechanic never gets the customer's email.

import { api } from "../shared/api";

/** The skills a mechanic can hold (same names as the signup form and the server's list). */
export const MECHANIC_SKILLS = ["Engine", "Brakes", "Electrical", "Diagnostics", "Air conditioning", "Transmission", "Suspension & steering", "Bodywork"] as const;

export type MechanicRow = {
  id: string;
  name: string;
  workshopName: string;
  city: string;
  /** approved skills only */
  skills: string[];
  yearsOfExperience: number | null;
  /** only with a position: straight-line km from the workshop point ("base") or from its city centre ("city") */
  distanceKm?: number | null;
  distanceSource?: "base" | "city" | null;
};
export type MechanicDetail = MechanicRow & { workshopAddress: string };
export type MechanicsPage = { mechanics: MechanicRow[]; page: number; total: number; hasMore: boolean };
export type MechanicFilters = { q?: string; city?: string; skill?: string; sort?: "nearest" | "name"; lat?: number; lng?: number; page?: number };

const qs = (params: Record<string, string | number | undefined>) => {
  const s = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
  return s ? `?${s}` : "";
};

export const mechanicCatalog = {
  async list(f: MechanicFilters = {}) {
    return api<MechanicsPage & { success: boolean }>("GET", `/catalog/mechanics${qs(f)}`);
  },
  async skills() {
    return (await api<{ skills: { key: string; count: number }[] }>("GET", "/catalog/mechanic-skills")).skills;
  },
  async get(id: string, from?: { lat: number; lng: number } | null) {
    return (await api<{ mechanic: MechanicDetail }>("GET", `/catalog/mechanics/${id}${qs({ lat: from?.lat, lng: from?.lng })}`)).mechanic;
  },
};

// ---- service requests ----

export type MechanicRequestStatus = "REQUESTED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED" | "CANCELLED";

type Base = {
  id: string;
  status: MechanicRequestStatus;
  skill: string | null;
  vehicle: { make: string; model: string; year: number | null };
  problemDescription: string;
  preferredTime: string | null;
  location: { text: string; point: { lat: number; lng: number } | null };
  /** typed by the customer; null unless they added one */
  contactPhone: string | null;
  declineReason: string | null;
  timeline: { status: MechanicRequestStatus; at: string }[];
  createdAt: string;
  updatedAt: string;
};
export type CustomerMechanicRequest = Base & {
  mechanic: { id: string; name: string; workshopName: string | null; city: string | null };
  canCancel: boolean;
};
export type MechanicSideRequest = Base & { customerName: string }; // never the email

export type MechanicRequestInput = {
  mechanicId: string;
  skill?: string;
  carMake: string;
  carModel: string;
  carYear?: number;
  problemDescription: string;
  preferredTime?: string;
  locationText: string;
  locationLat?: number;
  locationLng?: number;
  contactPhone?: string;
};

export const customerMechanicRequests = {
  async create(input: MechanicRequestInput) {
    return (await api<{ request: CustomerMechanicRequest }>("POST", "/requests/mechanic", input)).request;
  },
  async list() {
    return (await api<{ requests: CustomerMechanicRequest[] }>("GET", "/requests/mechanic/mine")).requests;
  },
  async get(id: string) {
    return (await api<{ request: CustomerMechanicRequest }>("GET", `/requests/mechanic/${id}`)).request;
  },
  async cancel(id: string) {
    return (await api<{ request: CustomerMechanicRequest }>("POST", `/requests/mechanic/${id}/cancel`, {})).request;
  },
};

export const mechanicInbox = {
  async list() {
    return (await api<{ requests: MechanicSideRequest[] }>("GET", "/mechanic/requests")).requests;
  },
  async get(id: string) {
    return (await api<{ request: MechanicSideRequest }>("GET", `/requests/mechanic/${id}`)).request;
  },
  async accept(id: string) {
    return (await api<{ request: MechanicSideRequest }>("POST", `/mechanic/requests/${id}/accept`, {})).request;
  },
  async decline(id: string, reason: string) {
    return (await api<{ request: MechanicSideRequest }>("POST", `/mechanic/requests/${id}/decline`, reason ? { reason } : {})).request;
  },
  async start(id: string) {
    return (await api<{ request: MechanicSideRequest }>("POST", `/mechanic/requests/${id}/start`, {})).request;
  },
  async complete(id: string) {
    return (await api<{ request: MechanicSideRequest }>("POST", `/mechanic/requests/${id}/complete`, {})).request;
  },
};

/** How often open request screens re-read the server while they are focused. */
export const REFRESH_MS = 15_000;
