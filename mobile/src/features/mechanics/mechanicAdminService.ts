// Mechanics admin: supervise mechanic requests (backend/src/routes/mechanics-admin.routes.ts). Real data; the list never carries the
// address or phone; the detail shows them only while the job is active (same rule as the mechanic).
import { api } from "../shared/api";
import type { MechanicRequestStatus } from "./mechanicsService";

export type AdminRequestRow = {
  id: string;
  status: MechanicRequestStatus;
  active: boolean;
  skill: string | null;
  vehicle: { make: string; model: string; year: number | null };
  customerName: string;
  mechanic: { id: string; name: string; workshopName: string | null; city: string | null };
  /** the car's city (from the pin, else the mechanic's city) */
  city: string | null;
  timeline: { status: MechanicRequestStatus; at: string }[];
  cancelReason: string | null;
  cancelledBy: string | null;
  updatedAt: string;
  createdAt: string;
};
export type AdminRequestDetail = AdminRequestRow & {
  problemDescription: string;
  preferredTime: string | null;
  declineReason: string | null;
  location: { text: string | null; point: { lat: number; lng: number } | null; area?: string | null; approximate?: boolean };
  contactPhone: string | null;
};
export type AdminStats = { activeRequests: number; waiting: number; accepted: number; inProgress: number; pendingApplications: number; verifiedMechanics: number };

export const ACTIVE_STATUSES = ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] as const;
export const HISTORY_STATUSES = ["COMPLETED", "DECLINED", "CANCELLED"] as const;

export const mechanicAdmin = {
  stats: () => api<{ stats: AdminStats }>("GET", "/admin/mechanics/stats").then((r) => r.stats),
  list: (scope: "active" | "history", status = "", q = "") =>
    api<{ requests: AdminRequestRow[] }>("GET", `/admin/mechanics/requests?scope=${scope}${status ? `&status=${status}` : ""}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ""}`).then((r) => r.requests),
  get: (id: string) => api<{ request: AdminRequestDetail }>("GET", `/admin/mechanics/requests/${id}`).then((r) => r.request),
  cancel: (id: string, reason: string) => api("POST", `/admin/mechanics/requests/${id}/cancel`, { reason }),
};
