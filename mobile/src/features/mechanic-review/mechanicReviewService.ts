// Real REST client for admin mechanic-application review (backend: /api/mechanic-review).
// The backend enforces SUPER_ADMIN or ADMIN + MANAGE_MECHANICS; the mobile gate is UX only.
import { api } from "../shared/api";

export type ReviewStatus = "PENDING_REVIEW" | "NEEDS_CORRECTION" | "MANUAL_REVIEW" | "READY_FOR_AUTHORITY" | "REJECTED";
export type Observation =
  | "NOT_REVIEWED" | "INFORMATION_MATCHES" | "MISSING_INFORMATION" | "DOCUMENT_UNREADABLE" | "EXPIRED" | "MANUAL_REVIEW_REQUIRED";
export const OBSERVATIONS: Observation[] = [
  "INFORMATION_MATCHES", "MISSING_INFORMATION", "DOCUMENT_UNREADABLE", "EXPIRED", "MANUAL_REVIEW_REQUIRED",
];

export type ApplicationRow = {
  id: string;
  applicantName: string;
  email: string;
  accountStatus: string;
  workshopName: string;
  skills: string[];
  submittedAt: string;
  reviewStatus: ReviewStatus;
};

export type Skill = { id: string; name: string; status: "PENDING" | "APPROVED" | "REJECTED"; rejectionReason: string | null };

export type ApplicationDetail = {
  id: string;
  reviewStatus: ReviewStatus;
  reviewReason: string | null;
  submittedAt: string;
  account: { fullName: string; email: string; status: string };
  profile: { phone: string; city: string };
  workshop: { name: string; address: string; preReview: Observation; preReviewNote: string | null };
  licence: {
    number: string; holderName: string; issuingAuthority: string;
    issueDate: string | null; expiryDate: string | null; preReview: Observation; preReviewNote: string | null;
  };
  skills: Skill[];
  documents: { id: string; kind: "LICENCE" | "CERTIFICATE"; title: string; mimeType: string; sizeBytes: number }[];
  authorization: { accepted: boolean; acceptedAt: string | null };
  history: { at: string; actor: string; action: string; reason: string | null; skill: string | null; observation: string | null }[];
};

export const mechanicReviewService = {
  list: (status: ReviewStatus | "ALL", q: string) =>
    api<{ applications: ApplicationRow[] }>(
      "GET",
      `/mechanic-review?${status !== "ALL" ? `status=${status}&` : ""}${q.trim() ? `q=${encodeURIComponent(q.trim())}` : ""}`
    ).then((r) => r.applications),
  get: (id: string) => api<{ application: ApplicationDetail }>("GET", `/mechanic-review/${id}`).then((r) => r.application),
  review: (id: string, action: "NEEDS_CORRECTION" | "MANUAL_REVIEW" | "READY_FOR_AUTHORITY" | "REJECT", reason?: string) =>
    api("PATCH", `/mechanic-review/${id}/review`, { action, reason }),
  reviewSkill: (id: string, skillId: string, status: "APPROVED" | "REJECTED", reason?: string) =>
    api("PATCH", `/mechanic-review/${id}/skills/${skillId}`, { status, reason }),
  preReview: (id: string, target: "PROFESSIONAL" | "WORKSHOP", observation: Observation, note?: string) =>
    api("PATCH", `/mechanic-review/${id}/pre-review`, { target, observation, note }),
};
