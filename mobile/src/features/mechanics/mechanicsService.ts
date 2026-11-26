// Mechanics for customers: REST clients for the public mechanic catalog, the customer's service requests and the
// mechanic's own inbox. The server only returns approved skills and public fields: a customer never gets a mechanic's
// phone, email or credentials, and a mechanic never gets the customer's email.

import { api } from "../shared/api";

/** The skills a mechanic can hold (same names as the signup form and the server's list). */
export const MECHANIC_SKILLS = ["Engine", "Brakes", "Electrical", "Diagnostics", "Air conditioning", "Transmission", "Suspension & steering", "Bodywork"] as const;

export type MechanicRow = {
  id: string;
  name: string;
  /** null for a mechanic who works on-site / online only */
  workshopName: string | null;
  city: string;
  /** approved skills only */
  skills: string[];
  yearsOfExperience: number | null;
  /** only with a position: straight-line km from the workshop point ("base") or from its city centre ("city") */
  distanceKm?: number | null;
  distanceSource?: "base" | "city" | null;
  /** a garage mechanic (first name only) and his garage; null for an independent mechanic */
  garage?: { id: string; name: string; nameAr: string | null } | null;
};
export type MechanicDetail = MechanicRow & { workshopAddress: string | null };
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

export type MechanicRequestStatus = "REQUESTED" | "ACCEPTED" | "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED" | "CANCELLED";
/** ON_SITE = the mechanic comes to the customer (a pin is required); WORKSHOP = the customer brings the car */
export type ServiceMode = "ON_SITE" | "WORKSHOP";
/** a live point (the mechanic's), stale after 3 minutes */
export type LivePoint = { lat: number; lng: number; at: string; stale: boolean };

type Base = {
  id: string;
  status: MechanicRequestStatus;
  serviceMode: ServiceMode | null;
  skill: string | null;
  vehicle: { make: string; model: string; year: number | null };
  problemDescription: string;
  preferredTime: string | null;
  /** For a mechanic, until they accept: text = null, area = nearest city, point rounded to ~1 km, approximate = true. */
  location: { text: string | null; point: { lat: number; lng: number } | null; area?: string | null; approximate?: boolean };
  /** typed by the customer; null unless they added one */
  contactPhone: string | null;
  declineReason: string | null;
  /** why MOTEXA (admin) cancelled the request; cancelledBy = "ADMIN" | "CUSTOMER" */
  cancelReason: string | null;
  cancelledBy: string | null;
  timeline: { status: MechanicRequestStatus; at: string }[];
  /** a request to a garage (or to a garage mechanic): his garage */
  garage: { id: string; name: string; nameAr: string | null } | null;
  assignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CustomerMechanicRequest = Base & {
  /** null while a garage request waits for the owner to assign one of his mechanics */
  mechanic: { id: string; name: string; workshopName: string | null; city: string | null; garageMechanic?: boolean } | null;
  /** the mechanic's live point, only while he is on the way / has arrived */
  live: LivePoint | null;
  canCancel: boolean;
};
/** the mechanic's (and the garage owner's / admin's) view: exact location only during the active job */
export type MechanicSideRequest = Base & { customerName: string; mechanicName: string | null; mechanicUserId: string | null; live: LivePoint | null }; // never the email

export type MechanicRequestInput = {
  /** exactly one of the two */
  mechanicId?: string;
  garageId?: string;
  serviceMode: ServiceMode;
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
  async enRoute(id: string) {
    return (await api<{ request: MechanicSideRequest }>("POST", `/mechanic/requests/${id}/en-route`, {})).request;
  },
  async arrived(id: string) {
    return (await api<{ request: MechanicSideRequest }>("POST", `/mechanic/requests/${id}/arrived`, {})).request;
  },
  /** his position during an active on-site job (job screen open, ~every 10 s) */
  ping: (id: string, p: { lat: number; lng: number }) => api("POST", `/mechanic/requests/${id}/location`, p),
};

// ---- garage mechanics: Online switch + point while Online ----
export type GarageMechanicStatus = "FREE" | "BUSY" | "OFFLINE" | "UNAPPROVED";
export type StaffApproval = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type Duty = { id: string; garage: { id: string; name: string; nameAr: string | null }; skills: string[]; offline: boolean; approval: StaffApproval; approvalReason: string | null; status: GarageMechanicStatus; live: LivePoint | null };
export const mechanicDuty = {
  /** null for an independent mechanic (no garage, no Online switch) */
  get: () => api<{ duty: Duty | null }>("GET", "/mechanic/me/duty").then((r) => r.duty),
  setOffline: (offline: boolean) => api("PUT", "/mechanic/me/availability", { offline }),
  ping: (p: { lat: number; lng: number }) => api<{ stored: boolean }>("POST", "/mechanic/me/location", p),
};

// ---- garages (customers) ----
export type GarageCard = {
  id: string; name: string; nameAr: string | null; city: string; services: string[]; workingHours: string | null; open24h: boolean;
  /** rounded to ~100 m */
  pin: { lat: number; lng: number } | null; mechanicsCount: number; freeCount: number; distanceKm?: number | null; distanceSource?: "base" | "city" | null;
};
export type GarageDetail = GarageCard & { description: string | null; address: string | null; mechanics: { id: string; name: string; skills: string[]; free: boolean; photoUri: string | null }[] };
export const garageCatalog = {
  list: (f: { q?: string; city?: string; skill?: string; lat?: number; lng?: number } = {}) => api<{ garages: GarageCard[] }>("GET", `/catalog/garages${qs(f)}`).then((r) => r.garages),
  get: (id: string, from?: { lat: number; lng: number } | null) => api<{ garage: GarageDetail }>("GET", `/catalog/garages/${id}${qs({ lat: from?.lat, lng: from?.lng })}`).then((r) => r.garage),
};

// ---- garage owner ----
export type GarageStaff = {
  id: string; userId: string; name: string; email: string; phone: string; skills: string[]; garage: { id: string; name: string };
  approval: StaffApproval; approvalReason: string | null; offline: boolean; status: GarageMechanicStatus; photoUri: string | null; idUri: string | null;
  job: { id: string; status: MechanicRequestStatus; customerFirstName: string } | null; live: LivePoint | null; createdAt: string;
};
export type GarageMe = {
  garage: { id: string; name: string; nameAr: string | null; phone: string; city: string; address: string | null; description: string | null; workingHours: string | null; open24h: boolean; services: string[]; base: { lat: number; lng: number } | null };
  counts: { mechanics: number; free: number; busy: number; offline: number; unapproved: number; toAssign: number; activeJobs: number };
};
export type Suggestion = { id: string; name: string; skills: string[]; distanceKm: number | null; source: "live" | "base" | "none" };
export type Upload = { dataBase64: string; name?: string };
export const garageOwner = {
  me: () => api<GarageMe>("GET", "/garage/me"),
  update: (b: { description?: string; workingHours?: string; open24h?: boolean; services?: string[] }) => api("PATCH", "/garage/me", b),
  mechanics: () => api<{ mechanics: GarageStaff[] }>("GET", "/garage/me/mechanics").then((r) => r.mechanics),
  add: (b: { fullName: string; email: string; phone: string; skills: string[]; idPhoto: Upload; photo?: Upload }) => api<{ mechanicId: string }>("POST", "/garage/me/mechanics", b),
  edit: (id: string, b: { phone?: string; skills?: string[]; idPhoto?: Upload; photo?: Upload }) => api("PATCH", `/garage/me/mechanics/${id}`, b),
  invite: (id: string) => api("POST", `/garage/me/mechanics/${id}/invite`),
  requests: (scope: "open" | "history" = "open") => api<{ requests: MechanicSideRequest[] }>("GET", `/garage/me/requests?scope=${scope}`).then((r) => r.requests),
  request: (id: string) => api<{ request: MechanicSideRequest; suggestions: Suggestion[] }>("GET", `/garage/me/requests/${id}`),
  assign: (id: string, mechanicId: string) => api("POST", `/garage/me/requests/${id}/assign`, { mechanicId }),
  decline: (id: string, reason: string) => api("POST", `/garage/me/requests/${id}/decline`, { reason }),
  live: () => api<{ base: { lat: number; lng: number } | null; mechanics: GarageStaff[]; jobs: MechanicSideRequest[] }>("GET", "/garage/me/live"),
};

// ---- mechanics admins: garage mechanics + the live map ----
export const adminGarages = {
  mechanics: (approval: StaffApproval | "ALL" = "PENDING") => api<{ mechanics: GarageStaff[] }>("GET", `/admin/garages/mechanics?approval=${approval}`).then((r) => r.mechanics),
  review: (id: string, decision: "APPROVE" | "REJECT" | "REQUEST_CHANGES" | "SUSPEND", reason?: string) => api("POST", `/admin/garages/mechanics/${id}/review`, { decision, reason }),
  live: () => api<{ mechanics: GarageStaff[]; jobs: MechanicSideRequest[] }>("GET", "/admin/mechanics/live"),
};

/** How often open request screens re-read the server while they are focused. */
export const REFRESH_MS = 15_000;
