// Tow drivers and live jobs: the driver's own jobs (/driver), the company's drivers, assignment and live map (/tow/me),
// the free drivers a customer may pick, and the tow admins' read-only active jobs.
import { api } from "../shared/api";
import type { DriverLive, TowProblem, TowStatus } from "../requests/requestsService";
import type { TruckType } from "./towService";

export type DriverStatus = "FREE" | "BUSY" | "OFFLINE" | "NO_TRUCK" | "UNAPPROVED";
export type DriverApproval = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
export type Rating = { avg: number | null; count: number };
export type DriverStep = "EN_ROUTE" | "ARRIVED" | "LOADING" | "IN_PROGRESS" | "DELIVERED" | "COMPLETED";
type P = { lat: number; lng: number };

/** One job as the driver, his company and tow admins see it. */
export type TowJob = {
  id: string;
  status: TowStatus;
  stage?: string;
  arrivedAt: string | null;
  loadingAt?: string | null;
  deliveredAt?: string | null;
  customer: { firstName: string };
  contactPhone: string;
  vehicle: { make: string; model: string; year: number | null };
  problemType: TowProblem;
  notes: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickup: P | null;
  dropoff: P | null;
  company: { id: string; name: string; base: P | null };
  driver: { id: string; name: string; live: DriverLive | null } | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  times: { acceptedAt: string | null; enRouteAt: string | null; arrivedAt: string | null; loadingAt?: string | null; deliveredAt?: string | null; inProgressAt: string | null; completedAt: string | null; cancelledAt: string | null };
};
export type DriverMe = {
  id: string;
  name: string;
  phone: string;
  company: string;
  status: DriverStatus;
  offline: boolean;
  approval?: DriverApproval;
  approvalReason?: string | null;
  truck: { id: string; plate: string; type: TruckType; make: string; model: string } | null;
};
export type CompanyDriver = {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  phone: string;
  licenceNumber: string | null;
  approval: DriverApproval;
  approvalReason: string | null;
  photoUri: string | null;
  licenceUri: string | null;
  rating: Rating;
  offline: boolean;
  status: DriverStatus;
  truck: { id: string; plate: string; type: TruckType } | null;
  job: { id: string; status: TowStatus; customerFirstName: string } | null;
  live: DriverLive | null;
};
/** A driver as a customer may see him (never a phone). `pin` is rounded to ~110 m and is his truck's base, not a live position. */
export type DriverCardData = {
  id: string;
  name: string;
  photoUri: string | null;
  rating: Rating;
  completedTows: number;
  truck: { type: TruckType; make: string; model: string; photoUri: string | null; plate: string } | null;
  company: { id: string; name: string; city: string; verified: boolean; rating: Rating };
};
export type NearbyDriver = DriverCardData & { pin: { lat: number; lng: number } | null; distanceKm: number | null };
export type FreeDriver = NearbyDriver;
/** A photo as picked: base64 JPEG. */
export type Upload = { dataBase64: string; name?: string };
export type NewDriver = { fullName?: string; email?: string; password?: string; phone: string; licenceNumber: string; licencePhoto: Upload; photo?: Upload; truckId?: string | null; self?: boolean };
export type AdminDriver = { id: string; name: string; email: string; phone: string; licenceNumber: string | null; approval: DriverApproval; approvalReason: string | null; createdAt: string; company: { id: string; name: string }; photoUri: string | null; licenceUri: string | null };
export type ChatMessage = { id: string; body: string; at: string; mine: boolean; from: "CUSTOMER" | "DRIVER" };

export const driverApi = {
  me: () => api<{ driver: DriverMe; jobs: TowJob[] }>("GET", "/driver/me"),
  setOffline: (offline: boolean) => api("PUT", "/driver/me/availability", { offline }),
  job: (id: string) => api<{ job: TowJob }>("GET", `/driver/jobs/${id}`).then((r) => r.job),
  accept: (id: string) => api<{ job: TowJob }>("POST", `/driver/jobs/${id}/accept`).then((r) => r.job),
  decline: (id: string, reason: string) => api("POST", `/driver/jobs/${id}/decline`, { reason }),
  move: (id: string, to: DriverStep) => api<{ job: TowJob }>("POST", `/driver/jobs/${id}/status`, { to }).then((r) => r.job),
  cancel: (id: string, reason: string) => api<{ job: TowJob }>("POST", `/driver/jobs/${id}/cancel`, { reason }).then((r) => r.job),
  ping: (id: string, p: P) => api("POST", `/driver/jobs/${id}/location`, p),
};

export const companyDispatch = {
  drivers: () => api<{ drivers: CompanyDriver[] }>("GET", "/tow/me/drivers").then((r) => r.drivers),
  addDriver: (d: NewDriver) => api("POST", "/tow/me/drivers", d),
  invite: (id: string) => api("POST", `/tow/me/drivers/${id}/invite`),
  updateDriver: (id: string, d: { phone?: string; truckId?: string | null; offline?: boolean; licenceNumber?: string; licencePhoto?: Upload; photo?: Upload }) => api("PATCH", `/tow/me/drivers/${id}`, d),
  assign: (requestId: string, driverId: string) => api("POST", `/tow/me/requests/${requestId}/assign`, { driverId }),
  live: () => api<{ jobs: TowJob[] }>("GET", "/tow/me/live").then((r) => r.jobs),
};

export const freeDriversOf = (companyId: string) => api<{ drivers: FreeDriver[] }>("GET", `/catalog/tow/companies/${companyId}/drivers`).then((r) => r.drivers);
export const nearbyDrivers = (p: { lat: number; lng: number } | null) => api<{ drivers: NearbyDriver[] }>("GET", `/catalog/tow/drivers${p ? `?lat=${p.lat}&lng=${p.lng}` : ""}`).then((r) => r.drivers);

/** Chat of one job. `base` = "/requests/tow/:id" (customer), "/driver/jobs/:id" (driver) or "/tow/me/requests/:id" (company, read only). */
export const jobChat = {
  list: (base: string) => api<{ messages: ChatMessage[]; canPost: boolean }>("GET", `${base}/messages`),
  send: (base: string, body: string) => api<{ message: ChatMessage }>("POST", `${base}/messages`, { body }),
};
export const customerAfter = {
  review: (id: string, stars: number, comment: string) => api("POST", `/requests/tow/${id}/review`, { stars, comment }),
  report: (id: string, body: string) => api("POST", `/requests/tow/${id}/report`, { body }),
};

export const adminDrivers = {
  list: (status?: DriverApproval) => api<{ drivers: AdminDriver[] }>("GET", `/admin/tow/drivers${status ? `?status=${status}` : ""}`).then((r) => r.drivers),
  review: (id: string, decision: "APPROVE" | "REJECT" | "SUSPEND", reason?: string) => api("POST", `/admin/tow/drivers/${id}/review`, { decision, reason }),
};

export type AdminJobRow = TowJob & { cancelledBy: string | null; distanceMeters: number | null; openReports: number };
export type AdminJobDetail = TowJob & { cancelledBy: string | null; choiceMode: string | null; distanceMeters: number | null; trail: { lat: number; lng: number; at: string }[]; reports: { id: string; body: string; closedAt: string | null; createdAt: string }[]; review: { stars: number; comment: string | null } | null };
export type AdminReport = { id: string; body: string; createdAt: string; closedAt: string | null; job: { id: string; status: TowStatus; company: string; driver: string | null; customerFirstName: string } };
export type CompanyStats = { total: number; completed: number; cancelled: number; declined: number; open: number; timeouts: number; distanceKm: number; rating: Rating; drivers: { id: string; name: string; completed: number; rating: Rating }[] };
export type JobFilters = { status?: string; companyId?: string; driverId?: string; from?: string; to?: string };

export const companyStatsApi = { get: () => api<{ stats: CompanyStats }>("GET", "/tow/me/stats").then((r) => r.stats) };

export const adminHistory = {
  list: (f: JobFilters) => api<{ jobs: AdminJobRow[] }>("GET", `/admin/tow/jobs?${Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&")}`).then((r) => r.jobs),
  job: (id: string) => api<{ job: AdminJobDetail }>("GET", `/admin/tow/jobs/${id}`).then((r) => r.job),
  cancel: (id: string, reason: string) => api("POST", `/admin/tow/jobs/${id}/cancel`, { reason }),
  reports: (open: boolean) => api<{ reports: AdminReport[] }>("GET", `/admin/tow/reports${open ? "?open=1" : ""}`).then((r) => r.reports),
  closeReport: (id: string) => api("POST", `/admin/tow/reports/${id}/close`, {}),
};

export const adminTows = {
  active: () => api<{ jobs: TowJob[] }>("GET", "/admin/tow/active-jobs").then((r) => r.jobs),
  job: (id: string) => api<{ job: TowJob }>("GET", `/admin/tow/jobs/${id}`).then((r) => r.job),
};

/** "live" or "last seen 14:02" for a driver point. */
export const liveLabel = (l: DriverLive | null, t: (en: string, ar: string) => string) => {
  if (!l) return t("No location yet", "لا يوجد موقع بعد");
  if (!l.stale) return t("Live", "مباشر");
  const d = new Date(l.at);
  const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return t(`Last seen ${hhmm}`, `آخر ظهور ${hhmm}`);
};

/** Driver job steps, labelled for the timeline / buttons. */
export function jobSteps(j: TowJob, t: (en: string, ar: string) => string) {
  const s: [string, string | null][] = [
    [t("Accepted", "تم القبول"), j.times.acceptedAt],
    [t("On the way", "في الطريق"), j.times.enRouteAt],
    [t("Arrived", "وصل"), j.times.arrivedAt],
    [t("Loading", "التحميل"), j.times.loadingAt ?? null],
    [t("Towing", "جارٍ السحب"), j.times.inProgressAt],
    [t("Delivered", "تم التسليم"), j.times.deliveredAt ?? null],
    [t("Completed", "مكتمل"), j.times.completedAt],
  ];
  return s;
}
