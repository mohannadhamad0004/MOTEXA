// Client for the provider onboarding (tow companies and parts shops) and for the department review of those applications.
// Real backend only. Paths are relative to /api (core/config/api builds the URL).
import { api } from "../../core/config/api";

export type Kind = "TOW" | "PARTS";
export type AppStatus = "DRAFT" | "PENDING" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
export type DocStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type Doc = {
  id: string;
  kind: string;
  purpose: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string | null;
  status: DocStatus;
  reason: string | null;
  uri: string;
  createdAt: string;
};

export type TruckRow = { id: string; plate: string; type: string; make: string; model: string; year: number | null; baseLat?: number | null; baseLng?: number | null; locationAddress?: string | null; verification: string; documents: Doc[] };
export type TimelineEntry = { at: string; action: string; actor: string; details: any };
export type Info = Record<string, any>;

export type Application = {
  kind: Kind;
  id: string;
  status: AppStatus;
  rejectionReason: string | null;
  submittedAt: string | null;
  submissionVersion: number;
  flaggedFields: string[];
  owner: { fullName: string; email: string };
  info: Info;
  requiredDocuments: string[];
  documents: Doc[];
  trucks: TruckRow[];
  missing?: string[];
  checklist?: { key: string; ok: boolean; detail?: string }[];
  unreadMessages: number;
  timeline: TimelineEntry[];
};

export type Message = { id: string; from: "PROVIDER" | "ADMIN" | "SYSTEM"; author: string; body: string; at: string; attachments: { id: string; fileName: string; mimeType: string; uri: string }[] };
export type Attachment = { name: string; dataBase64: string };

// ---- the owner's side
export const onboarding = {
  get: () => api<{ application: Application }>("GET", "/provider/onboarding").then((r) => r.application),
  status: () => api<{ status: { kind: Kind; id: string; status: AppStatus; unreadMessages: number; unreadNotifications: number } }>("GET", "/provider/onboarding/status").then((r) => r.status),
  saveInfo: (info: Info) => api<{ application: Application }>("PUT", "/provider/onboarding/info", info).then((r) => r.application),
  upload: (d: { kind: string; name: string; dataBase64: string; expiresAt?: string | null }) => api<{ document: Doc }>("POST", "/provider/onboarding/documents", d).then((r) => r.document),
  remove: (id: string) => api("DELETE", `/provider/onboarding/documents/${id}`),
  submit: () => api<{ application: Application }>("POST", "/provider/onboarding/submit").then((r) => r.application),
  messages: () => api<{ messages: Message[]; unread: number }>("GET", "/provider/messages"),
  markRead: () => api("POST", "/provider/messages/read"),
  send: (body: string, attachment?: Attachment) => api<{ messages: Message[] }>("POST", "/provider/messages", { body, ...(attachment ? { attachment } : {}) }).then((r) => r.messages),
};

export const notifications = {
  list: () => api<{ unread: number; notifications: { id: string; title: string; body: string; readAt: string | null; createdAt: string }[] }>("GET", "/notifications"),
  readAll: () => api("POST", "/notifications/read-all"),
};

export async function register(input: { kind: Kind; fullName: string; businessName: string; email: string; phoneNumber: string; city: string; password: string; acceptTerms: true }) {
  // public endpoint: the shared client sends no token when none is stored
  return api<{ success: boolean; message: string }>("POST", "/auth/provider/register", input);
}

// ---- the department's side (kind picks /tow or /parts; the server checks the permission)
const base = (k: Kind) => `/admin/providers/${k === "TOW" ? "tow" : "parts"}`;
export type Tab = "NEW" | "NEEDS_CHANGES" | "APPROVED" | "REJECTED";
export type ListRow = { id: string; name: string; ownerName: string; city: string; status: AppStatus; submittedAt: string | null; documents: number; pendingDocuments: number; unreadMessages: number };
export type Thread = { id: string; name: string; status: AppStatus; last: string; lastFrom: string; at: string | null; unread: number };

export const review = {
  counts: (k: Kind) => api<{ counts: Record<Tab, number>; unreadMessages: number }>("GET", `${base(k)}/counts`),
  list: (k: Kind, tab: Tab) => api<{ applications: ListRow[] }>("GET", `${base(k)}/applications?tab=${tab}`).then((r) => r.applications),
  get: (k: Kind, id: string) => api<{ application: Application }>("GET", `${base(k)}/applications/${id}`).then((r) => r.application),
  decideDoc: (k: Kind, id: string, docId: string, d: { status: "ACCEPTED" } | { status: "REJECTED"; reason: string }) =>
    api<{ application: Application }>("PATCH", `${base(k)}/applications/${id}/documents/${docId}`, d).then((r) => r.application),
  approve: (k: Kind, id: string) => api<{ application: Application }>("POST", `${base(k)}/applications/${id}/approve`).then((r) => r.application),
  requestChanges: (k: Kind, id: string, d: { message: string; fields: string[]; documentIds: string[] }) =>
    api<{ application: Application }>("POST", `${base(k)}/applications/${id}/request-changes`, d).then((r) => r.application),
  reject: (k: Kind, id: string, reason: string) => api<{ application: Application }>("POST", `${base(k)}/applications/${id}/reject`, { reason }).then((r) => r.application),
  threads: (k: Kind) => api<{ threads: Thread[] }>("GET", `${base(k)}/threads`).then((r) => r.threads),
  messages: (k: Kind, id: string) => api<{ messages: Message[]; unread: number }>("GET", `${base(k)}/applications/${id}/messages`),
  markRead: (k: Kind, id: string) => api("POST", `${base(k)}/applications/${id}/messages/read`),
  send: (k: Kind, id: string, body: string, attachment?: Attachment) =>
    api<{ messages: Message[] }>("POST", `${base(k)}/applications/${id}/messages`, { body, ...(attachment ? { attachment } : {}) }).then((r) => r.messages),
};
