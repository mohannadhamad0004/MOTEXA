// Open tow offers that nobody answered in time (TOW_OFFER_MINUTES, default 3).
//  - "Nearest available": the job is re-offered to the next nearest FREE driver that was not tried yet (possibly another company);
//    when nobody is left it ends like the others.
//  - "Choose a company" / "Choose a driver": it ends (CANCELLED by SYSTEM, reason TIMEOUT); the customer is told and can choose
//    another company or driver.
// Every change is audited and notified. Runs every 20 s while the server is up, and can be called directly (tests).
import { prisma } from "../prisma.js";
import { notify } from "./provider-onboarding.js";
import { freeDriversNear } from "./tow-cards.js";
import { newDeadline } from "./tow-dispatch.js";

const B = (en: string, ar: string) => [en, ar] as [string, string];

export async function sweepOffers(now = new Date()) {
  const due = await prisma.towRequest.findMany({ where: { status: "REQUESTED", offerExpiresAt: { lt: now } }, include: { driver: { select: { userId: true } }, company: { select: { userId: true } } }, take: 50 });
  let changed = 0;
  for (const r of due) {
    const tried = [...new Set([...r.triedDriverIds, ...(r.driverId ? [r.driverId] : [])])];
    if (r.choiceMode === "NEAREST" && r.pickupLat !== null && r.pickupLng !== null) {
      const next = (await freeDriversNear({ lat: r.pickupLat, lng: r.pickupLng })).find((d) => !tried.includes(d.id));
      if (next) {
        const moved = await prisma.towRequest.updateMany({
          where: { id: r.id, status: "REQUESTED", driverId: r.driverId, offerExpiresAt: { lt: now } },
          data: { driverId: next.id, companyId: next._companyId, triedDriverIds: tried, offerExpiresAt: newDeadline() },
        });
        if (!moved.count) continue;
        changed++;
        await prisma.auditLog.create({ data: { actorId: null, action: "TOW_OFFER_REOFFERED", targetId: r.id, details: { from: r.driverId, to: next.id } } });
        const nd = await prisma.towDriver.findUniqueOrThrow({ where: { id: next.id }, select: { userId: true, company: { select: { userId: true } } } });
        await notify([r.customerId], B("We offered your tow to another driver", "عرضنا طلبك على سائق آخر"), B("The first driver did not answer in time.", "لم يردّ السائق الأول في الوقت المناسب."));
        await notify([...new Set([nd.userId, nd.company.userId])], B("New tow job", "مهمة سحب جديدة"), B("Open MOTEXA to accept or decline.", "افتح موتكسا للقبول أو الرفض."));
        if (r.driver) await notify([r.driver.userId], B("A job expired", "انتهت مهلة مهمة"), B("You did not answer in time, so it moved to another driver.", "لم تردّ في الوقت المناسب فانتقلت إلى سائق آخر."));
        continue;
      }
    }
    const ended = await prisma.towRequest.updateMany({
      where: { id: r.id, status: "REQUESTED", offerExpiresAt: { lt: now } },
      data: { status: "CANCELLED", cancelledAt: now, cancelledBy: "SYSTEM", cancelReason: "TIMEOUT", triedDriverIds: tried },
    });
    if (!ended.count) continue;
    changed++;
    await prisma.auditLog.create({ data: { actorId: null, action: "TOW_OFFER_TIMED_OUT", targetId: r.id, details: { driverId: r.driverId, mode: r.choiceMode } } });
    await notify([r.customerId], B("Nobody accepted in time", "لم يقبل أحد في الوقت المناسب"), B("Choose another company or driver, or try Nearest available.", "اختر شركة أو سائقًا آخر، أو جرّب «الأقرب المتاح»."));
    await notify([...new Set([r.company.userId, ...(r.driver ? [r.driver.userId] : [])])], B("A tow request expired", "انتهت مهلة طلب سحب"), B("It was not accepted in time.", "لم يُقبل في الوقت المناسب."));
  }
  return changed;
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startOfferSweeper() {
  if (timer) return;
  timer = setInterval(() => void sweepOffers().catch((e) => console.error("Offer sweep error:", e)), 20_000);
  timer.unref();
}
