// "Work with MOTEXA" (docs/agents/AUTH-REDESIGN.md, stage B): a signed-in CUSTOMER applies to become a provider. The application is
// the existing DRAFT profile (MechanicProfile / TowCompanyProfile / PartsShopProfile) attached to their own account; the role stays
// CUSTOMER until the admin of that department approves it, and only that approval promotes it (one role per account).
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { FINAL as FINAL_ORDER } from "./parts-orders.js";

export const APPLY_KINDS = { mechanic: "MECHANIC", tow: "TOW", parts: "PARTS", garage: "GARAGE" } as const;
export type ApplyKind = (typeof APPLY_KINDS)[keyof typeof APPLY_KINDS];
export const ROLE_FOR: Record<ApplyKind, "MECHANIC" | "TOW_PROVIDER" | "PARTS_PROVIDER" | "GARAGE_OWNER"> = { MECHANIC: "MECHANIC", TOW: "TOW_PROVIDER", PARTS: "PARTS_PROVIDER", GARAGE: "GARAGE_OWNER" };

/** The applications of an account, as { kind, status } (empty for most customers). */
export async function applicationsOf(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      mechanicProfile: { select: { verificationStatus: true } },
      towCompanyProfile: { select: { verificationStatus: true } },
      partsShopProfile: { select: { verificationStatus: true } },
      garageProfile: { select: { verificationStatus: true } },
    },
  });
  const out: { kind: ApplyKind; status: string }[] = [];
  if (u?.mechanicProfile) out.push({ kind: "MECHANIC", status: u.mechanicProfile.verificationStatus });
  if (u?.towCompanyProfile) out.push({ kind: "TOW", status: u.towCompanyProfile.verificationStatus });
  if (u?.partsShopProfile) out.push({ kind: "PARTS", status: u.partsShopProfile.verificationStatus });
  if (u?.garageProfile) out.push({ kind: "GARAGE", status: u.garageProfile.verificationStatus });
  return out;
}

/** A customer's open tow / mechanic requests and parts orders: they would be cut off from them once the account becomes a provider. */
export async function activeCustomerWork(userId: string) {
  const [tow, mechanic, orders] = await Promise.all([
    prisma.towRequest.count({ where: { customerId: userId, status: { in: ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"] } } }),
    prisma.mechanicRequest.count({ where: { customerId: userId, status: { in: ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] } } }),
    prisma.partsOrder.count({ where: { customerId: userId, status: { notIn: FINAL_ORDER } } }),
  ]);
  return tow + mechanic + orders;
}
export const ACTIVE_WORK_APPLY = "Finish or cancel your active requests and orders before applying.";
export const ACTIVE_WORK_APPROVE = "The applicant still has an active request or order as a customer. Approve it after that ends.";

/** null = the approval may go ahead; otherwise why not (a customer applicant who still has open requests or orders). */
export async function approvalBlocked(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return u?.role === "CUSTOMER" && (await activeCustomerWork(userId)) > 0 ? ACTIVE_WORK_APPROVE : null;
}

/**
 * Inside the approving admin's transaction: a CUSTOMER applicant becomes MECHANIC / TOW_PROVIDER / PARTS_PROVIDER. Their sessions end
 * (sessionVersion), so the next sign-in lands in the provider area. Accounts that already have a provider role are left alone.
 */
export async function promoteApplicant(tx: Prisma.TransactionClient, userId: string, kind: ApplyKind, actorId: string) {
  const role = ROLE_FOR[kind];
  const r = await tx.user.updateMany({ where: { id: userId, role: "CUSTOMER" }, data: { role, sessionVersion: { increment: 1 } } });
  if (r.count) await tx.auditLog.create({ data: { actorId, action: "ROLE_PROMOTED", targetId: userId, details: { from: "CUSTOMER", to: role, kind } } });
}
