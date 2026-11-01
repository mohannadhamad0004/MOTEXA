// Tow drivers and live jobs: the driver's own jobs (/driver), the company's drivers, assignment and live map (/tow/me),
// the free drivers a customer may pick, and the tow admins' read-only active jobs.
import { api } from "../shared/api";
import type { DriverLive, TowProblem, TowStatus } from "../requests/requestsService";
import type { TruckType } from "./towService";

export type DriverStatus = "FREE" | "BUSY" | "OFFLINE" | "NO_TRUCK";
export type DriverStep = "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED";
type P = { lat: number; lng: number };

/** One job as the driver, his company and tow admins see it. */
export type TowJob = {
  id: string;
  status: TowStatus;
  arrivedAt: string | null;
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
  times: { acceptedAt: string | null; enRouteAt: string | null; arrivedAt: string | null; inProgressAt: string | null; completedAt: string | null; cancelledAt: string | null };
};
export type DriverMe = {
  id: string;
  name: string;
  phone: string;
  company: string;
  status: DriverStatus;
  offline: boolean;
  truck: { id: string; plate: string; type: TruckType; make: string; model: string } | null;
};
export type CompanyDriver = {
  id: string;
  name: string;
  email: string;
  isOwner: boolean;
  phone: string;
  offline: boolean;
  status: DriverStatus;
  truck: { id: string; plate: string; type: TruckType } | null;
  job: { id: string; status: TowStatus; customerFirstName: string } | null;
  live: DriverLive | null;
};
export type FreeDriver = { id: string; firstName: string; truck: { type: TruckType; make: string; model: string } | null };
export type NewDriver = { fullName?: string; email?: string; password?: string; phone: string; truckId?: string | null; self?: boolean };

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
  updateDriver: (id: string, d: { phone?: string; truckId?: string | null; offline?: boolean }) => api("PATCH", `/tow/me/drivers/${id}`, d),
  assign: (requestId: string, driverId: string) => api("POST", `/tow/me/requests/${requestId}/assign`, { driverId }),
  live: () => api<{ jobs: TowJob[] }>("GET", "/tow/me/live").then((r) => r.jobs),
};

export const freeDriversOf = (companyId: string) => api<{ drivers: FreeDriver[] }>("GET", `/catalog/tow/companies/${companyId}/drivers`).then((r) => r.drivers);

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
    [t("Towing", "جارٍ السحب"), j.times.inProgressAt],
    [t("Completed", "مكتمل"), j.times.completedAt],
  ];
  return s;
}
