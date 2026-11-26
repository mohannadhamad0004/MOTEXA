// POST /api/apply/:kind (mechanic | tow | parts | garage): a signed-in CUSTOMER starts a provider application = the DRAFT profile on their own
// account, then fills it in with the existing wizards (/mechanics/me, /provider/onboarding). Never changes the role: only the approval
// by that department's admin does (services/applications.ts promoteApplicant).
// Body: acknowledgeProviderAccount: true + acceptTerms: true; tow / parts / garage also businessName, phone, city (required by the profile).
import express, { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { canonicalCity } from "../cities.js";
import { ACTIVE_WORK_APPLY, APPLY_KINDS, activeCustomerWork, applicationsOf } from "../services/applications.js";

const router = Router();
const PHONE = /^\+?[0-9 ()-]{8,24}$/;

router.post("/apply/:kind", requireAuth, express.json(), async (req, res) => {
  const bad = (status: number, code: string, message: string) => res.status(status).json({ success: false, code, message });
  try {
    const kind = APPLY_KINDS[String(req.params.kind) as keyof typeof APPLY_KINDS];
    if (!kind) return bad(404, "UNKNOWN_KIND", "Choose mechanic, garage, tow company or parts shop.");
    const me = res.locals.authUser as { id: string; role: string };
    if (me.role !== "CUSTOMER") return bad(403, "CUSTOMERS_ONLY", "Only a customer account can apply to work with MOTEXA.");
    const b = req.body ?? {};
    if (b.acknowledgeProviderAccount !== true || b.acceptTerms !== true)
      return bad(400, "CONFIRM_REQUIRED", "Confirm that this account becomes a provider account after approval, and accept the terms.");

    const existing = await applicationsOf(me.id);
    const same = existing.find((a) => a.kind === kind);
    if (same) return res.json({ success: true, application: same, created: false }); // already applied: open it
    if (existing.some((a) => a.status !== "REJECTED")) return bad(409, "ALREADY_APPLIED", "You already have an application. One account can apply for one kind of work.");
    if (await activeCustomerWork(me.id)) return bad(409, "ACTIVE_WORK", ACTIVE_WORK_APPLY);

    let targetId: string;
    if (kind === "MECHANIC") {
      targetId = (await prisma.mechanicProfile.create({ data: { userId: me.id, specializations: [], verificationStatus: "DRAFT", termsAcceptedAt: new Date() }, select: { id: true } })).id;
    } else {
      const businessName = typeof b.businessName === "string" ? b.businessName.trim().slice(0, 120) : "";
      const phone = typeof b.phone === "string" ? b.phone.trim().slice(0, 24) : "";
      const city = canonicalCity(b.city);
      if (businessName.length < 2) return bad(400, "BUSINESS_NAME_INVALID", "Enter the business name.");
      if (!PHONE.test(phone)) return bad(400, "PHONE_INVALID", "Enter a valid phone number.");
      if (!city) return bad(400, "CITY_NOT_IN_LIST", "Choose your city from the list.");
      const { fullName } = await prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { fullName: true } });
      const common = { userId: me.id, ownerName: fullName, phone, city, verificationStatus: "DRAFT" as const };
      targetId =
        kind === "TOW"
          ? (await prisma.towCompanyProfile.create({ data: { ...common, companyName: businessName }, select: { id: true } })).id
          : kind === "GARAGE"
            ? (await prisma.garageProfile.create({ data: { ...common, garageName: businessName }, select: { id: true } })).id
            : (await prisma.partsShopProfile.create({ data: { ...common, shopName: businessName }, select: { id: true } })).id;
    }
    await prisma.auditLog.create({ data: { actorId: me.id, action: "APPLICATION_STARTED", targetId, details: { kind } } });
    return res.status(201).json({ success: true, application: { kind, status: "DRAFT" }, created: true });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return bad(409, "ALREADY_APPLIED", "You already have an application. One account can apply for one kind of work.");
    console.error("Apply error:", e);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
});

export default router;
