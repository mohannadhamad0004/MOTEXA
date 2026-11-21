// "⋮" menu of a row in the mechanic's inbox: the same four steps as the request screen, only the one the CURRENT status allows
// (REQUESTED: Accept / Decline · ACCEPTED: Start · IN_PROGRESS: Complete). The server has no mechanic-side cancel, so none is offered.
import { router, type Href } from "expo-router";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { mechanicInbox, type MechanicRequestStatus } from "./mechanicsService";

export function inboxActions(t: (en: string, ar: string) => string, r: { id: string; status: MechanicRequestStatus }, reload: () => unknown): ItemAction[] {
  const step = (fn: (id: string) => Promise<unknown>) => async () => { await fn(r.id); await reload(); };
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => router.push(`/mechanic/requests/${r.id}` as Href) }];
  if (r.status === "REQUESTED") {
    out.push({ key: "accept", label: t("Accept", "قبول"), icon: "checkmark-circle-outline", confirm: { title: t("Accept this request?", "قبول هذا الطلب؟"), message: t("The customer is told, and you see the exact address and phone.", "يُبلَّغ الزبون، ويظهر لك العنوان الدقيق والهاتف.") }, success: t("Request accepted.", "تم قبول الطلب."), run: step(mechanicInbox.accept) });
    out.push({
      key: "decline", label: t("Decline", "رفض"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Decline this request?", "رفض هذا الطلب؟"), message: t("The customer is told you cannot take it.", "يُبلَّغ الزبون أنك لا تستطيع تنفيذه."), reason: { label: t("Reason (optional)", "السبب (اختياري)") }, confirmLabel: t("Decline", "رفض") },
      success: t("Request declined.", "تم رفض الطلب."), run: async (reason) => { await mechanicInbox.decline(r.id, reason ?? ""); await reload(); },
    });
  }
  if (r.status === "ACCEPTED") out.push({ key: "start", label: t("Start job", "ابدأ العمل"), icon: "play-outline", confirm: { title: t("Start this job?", "بدء هذا العمل؟") }, success: t("Job started.", "بدأ العمل."), run: step(mechanicInbox.start) });
  if (r.status === "IN_PROGRESS") out.push({ key: "complete", label: t("Complete job", "إنهاء العمل"), icon: "flag-outline", confirm: { title: t("Mark this job as done?", "تأكيد إنهاء هذا العمل؟") }, success: t("Job completed.", "تم إنهاء العمل."), run: step(mechanicInbox.complete) });
  return out;
}
