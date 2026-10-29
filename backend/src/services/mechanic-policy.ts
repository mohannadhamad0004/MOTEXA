import type { Request, Response, NextFunction } from "express";
import { prisma } from "../prisma.js";

export const SPECIALIZATIONS = [
  "PETROL_ENGINES",
  "DIESEL_ENGINES",
  "ELECTRIC_VEHICLES",
  "TRANSMISSION",
  "AUTO_ELECTRICAL",
  "SUSPENSION",
] as const;
export class MechanicError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function fail(status: number, message: string): never {
  throw new MechanicError(status, message);
}
export function text(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
export function completeProfile(p: {
  city: string | null;
  phoneNumber: string | null;
  specializations: string[];
  yearsOfExperience: number | null;
  experienceSummary: string | null;
  offersWorkshop: boolean;
  offersOnSite: boolean;
  offersOnline: boolean;
  workshopName: string | null;
  workshopAddress: string | null;
  coverageAreas: string[];
}) {
  if (
    !p.city ||
    !p.phoneNumber ||
    !p.specializations.length ||
    p.yearsOfExperience === null ||
    !p.experienceSummary
  )
    return false;
  if (!p.offersWorkshop && !p.offersOnSite && !p.offersOnline) return false;
  if (p.offersWorkshop && (!p.workshopName || !p.workshopAddress)) return false;
  if (p.offersOnSite && !p.coverageAreas.length) return false;
  return true;
}
/** Every service endpoint must apply this gate, not just hide buttons in the app. */
export async function requireVerifiedMechanic(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  const u = res.locals.authUser;
  if (!u || u.role !== "MECHANIC") {
    res
      .status(403)
      .json({ success: false, message: "Mechanic access required." });
    return;
  }
  const p = await prisma.mechanicProfile.findUnique({
    where: { userId: u.id },
    select: { verificationStatus: true },
  });
  if (p?.verificationStatus !== "VERIFIED") {
    res.status(403).json({
      success: false,
      message: "Mechanic approval is required before receiving services.",
    });
    return;
  }
  next();
}

/** Checks upload presence only; opening or interpreting documents is not required. */
export function completeDocuments(p: { offersWorkshop: boolean; documents: { kind: string }[] }) {
  const required = ["IDENTITY", "CERTIFICATE", ...(p.offersWorkshop ? ["WORKSHOP_PROOF"] : [])];
  return required.every(kind => p.documents.some(document => document.kind === kind));
}
