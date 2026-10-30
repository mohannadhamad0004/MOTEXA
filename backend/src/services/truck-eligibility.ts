import type { Prisma } from "../generated/prisma/client.js";

// MOTEXA rule: a truck with an EXPIRED required document gets no NEW towing work. It affects that truck only: the truck is not
// deleted or archived, the company stays approved, and the company's other trucks are unaffected. Jobs already accepted keep
// running (see releaseTruck in tow-requests.routes.ts: the truck just does not become available again until renewed).
//
// The documents are the real ones the schema stores for a truck (ProviderFile.expiresAt on these purposes). A document with no
// expiry date never expires. A document is expired from the day AFTER its expiry date (the date itself is still valid).

export const TRUCK_DOC_PURPOSES = ["TRUCK_REGISTRATION", "TRUCK_INSURANCE", "TRUCK_OPERATING_LICENSE"] as const;

/** Start of today (UTC): an expiry date before this is expired. */
export const startOfToday = (now = new Date()) => {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/** Prisma filter for a truck that HAS an expired document. */
export const hasExpiredDocument = (now = new Date()): Prisma.TruckWhereInput => ({
  files: { some: { purpose: { in: [...TRUCK_DOC_PURPOSES] }, expiresAt: { lt: startOfToday(now) } } },
});

/** Prisma filter for a truck with NO expired document (the document half of "eligible for new work"). */
export const noExpiredDocument = (now = new Date()): Prisma.TruckWhereInput => ({ NOT: hasExpiredDocument(now) });

/** The truck's expired documents, from rows already loaded. */
export const expiredDocuments = <T extends { purpose: string; expiresAt: Date | null }>(files: T[], now = new Date()) =>
  files.filter((f) => (TRUCK_DOC_PURPOSES as readonly string[]).includes(f.purpose) && f.expiresAt !== null && f.expiresAt < startOfToday(now));

export const DOCUMENTS_EXPIRED_MESSAGE = "This truck's documents have expired, so it cannot take new work until they are renewed. The company and its other trucks are not affected.";
