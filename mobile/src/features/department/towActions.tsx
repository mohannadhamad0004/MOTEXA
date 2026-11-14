// "⋮" menu actions for the Tow admin lists (trucks, drivers, tow jobs, problem reports). Same API calls as the old buttons;
// each builder returns only the actions valid for the item's CURRENT state. Companies use providerActions (itemActions.tsx).
import { router, type Href } from "expo-router";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { adminDrivers, adminHistory, type AdminDriver } from "../tow/dispatchService";
import { towAdminService } from "../tow/towService";

type T = (en: string, ar: string) => string;
const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const reasonBox = (t: T, label?: string) => ({ label: label ?? t("Reason (required)", "السبب (مطلوب)"), required: true });

// ---------------------------------------------------------------- trucks
/** Open · Approve · Reject · Edit · Archive (out of service) / Restore. The server still enforces the truck checklist on Approve. */
export type TruckLike = { id: string; companyId?: string; verification: string; hasActiveJob?: boolean; archivedAt?: string | null };
/** archive = false for lists that do not know the truck's out-of-service state (the company review rows). */
export function truckActions(t: T, k: TruckLike, reload: () => unknown, archive = true): ItemAction[] {
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => go(`/dept/review/truck/${k.id}`) }];
  if (k.verification !== "APPROVED")
    out.push({
      key: "approve", label: t("Approve", "اعتماد"), icon: "checkmark-circle-outline",
      confirm: { title: t("Approve this truck?", "اعتماد هذه الشاحنة؟"), message: t("It can take jobs once approved.", "يمكنها استلام المهام بعد الاعتماد.") },
      success: t("Truck approved.", "تم اعتماد الشاحنة."), run: async () => { await towAdminService.decideTruck(NOACTOR, k.id, { approve: true }); await reload(); },
      error: (e) => (e instanceof Error && e.message ? e.message : t("Could not approve: open the truck to see what is missing.", "تعذّر الاعتماد: افتح الشاحنة لمعرفة الناقص.")),
    });
  if (k.verification !== "REJECTED")
    out.push({
      key: "reject", label: t("Reject", "رفض"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Reject this truck?", "رفض هذه الشاحنة؟"), message: t("The company is told the reason.", "تُبلَّغ الشركة بالسبب."), reason: reasonBox(t, t("Reason (sent to the company)", "السبب (يُرسل للشركة)")), confirmLabel: t("Reject", "رفض") },
      success: t("Truck rejected.", "تم رفض الشاحنة."), run: async (reason) => { await towAdminService.decideTruck(NOACTOR, k.id, { approve: false, reason: reason ?? "" }); await reload(); },
    });
  out.push({ key: "edit", label: t("Edit", "تعديل"), icon: "create-outline", run: () => go(`/dept/edit/truck/${k.id}${k.companyId ? `?companyId=${k.companyId}` : ""}`) });
  if (!archive) return out;
  if (k.archivedAt)
    out.push({ key: "restore", label: t("Restore (back in service)", "استعادة (عودة للخدمة)"), icon: "arrow-undo-outline", success: t("Truck restored.", "تمت استعادة الشاحنة."), run: async () => { await towAdminService.archiveTruck(NOACTOR, k.id, { archived: false }); await reload(); } });
  else
    out.push({
      key: "archive", label: t("Out of service", "إخراج من الخدمة"), icon: "archive-outline", destructive: true, disabled: k.hasActiveJob,
      hint: k.hasActiveJob ? t("The truck is on a job.", "الشاحنة في مهمة.") : undefined,
      confirm: { title: t("Take this truck out of service?", "إخراج هذه الشاحنة من الخدمة؟"), message: t("It is not deleted: its documents and history are kept and you can restore it.", "لا تُحذف: تبقى مستنداتها وسجلها ويمكنك استعادتها."), reason: reasonBox(t), confirmLabel: t("Take out of service", "إخراج من الخدمة") },
      success: t("Truck is out of service.", "الشاحنة خارج الخدمة."), run: async (reason) => { await towAdminService.archiveTruck(NOACTOR, k.id, { archived: true, reason: reason ?? "" }); await reload(); },
    });
  return out;
}

// ---------------------------------------------------------------- drivers
/** Approve · Request changes · Reject · Edit · Suspend. There is no driver detail screen, so there is no "Open". Edit opens the inline editor of the row. */
export function driverActions(t: T, d: AdminDriver, o: { reload: () => unknown; edit: () => void }): ItemAction[] {
  const review = (decision: "APPROVE" | "REJECT" | "SUSPEND" | "REQUEST_CHANGES") => async (reason?: string) => { await adminDrivers.review(d.id, decision, reason); await o.reload(); };
  const sees = t("The company and the driver see it.", "تراه الشركة والسائق.");
  const out: ItemAction[] = [];
  if (d.approval !== "APPROVED")
    out.push({
      key: "approve", label: t("Approve", "اعتماد"), icon: "checkmark-circle-outline", disabled: !d.licenceUri, hint: !d.licenceUri ? t("No licence photo yet.", "لا توجد صورة رخصة بعد.") : undefined,
      confirm: { title: t("Approve this driver?", "اعتماد هذا السائق؟"), message: t("The company and the driver are notified.", "تُبلَّغ الشركة والسائق.") },
      success: t("Driver approved.", "تم اعتماد السائق."), run: review("APPROVE"),
    });
  if (d.approval === "PENDING") {
    out.push({
      key: "changes", label: t("Request changes", "طلب تعديل"), icon: "create-outline",
      confirm: { title: t("Request changes?", "طلب تعديل؟"), message: sees, reason: reasonBox(t, t("What should be fixed (required)", "ما الذي يجب إصلاحه (مطلوب)")), confirmLabel: t("Send request", "إرسال الطلب") },
      success: t("Changes requested.", "تم طلب التعديل."), run: review("REQUEST_CHANGES"),
    });
    out.push({
      key: "reject", label: t("Reject", "رفض"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Reject this driver?", "رفض هذا السائق؟"), message: sees, reason: reasonBox(t), confirmLabel: t("Reject", "رفض") },
      success: t("Driver rejected.", "تم رفض السائق."), run: review("REJECT"),
    });
  }
  out.push({ key: "edit", label: t("Edit", "تعديل"), icon: "create-outline", run: o.edit });
  if (d.approval === "APPROVED")
    out.push({
      key: "suspend", label: t("Suspend", "إيقاف"), icon: "pause-circle-outline", destructive: true,
      confirm: { title: t("Suspend this driver?", "إيقاف هذا السائق؟"), message: sees, reason: reasonBox(t), confirmLabel: t("Suspend", "إيقاف") },
      success: t("Driver suspended.", "تم إيقاف السائق."), run: review("SUSPEND"),
    });
  return out;
}

// ---------------------------------------------------------------- tow jobs
const OPEN_JOB = ["REQUESTED", "ACCEPTED", "EN_ROUTE", "IN_PROGRESS"];
/** Open · Cancel with reason (only while the job is still open). */
export function towJobActions(t: T, j: { id: string; status: string }, reload: () => unknown): ItemAction[] {
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => router.push({ pathname: "/dept/tows/[id]", params: { id: j.id } }) }];
  if (OPEN_JOB.includes(j.status))
    out.push({
      key: "cancel", label: t("Cancel job…", "إلغاء المهمة…"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Cancel this job?", "إلغاء هذه المهمة؟"), message: t("The truck is released. The customer, the driver and the company are told the reason.", "تُحرَّر الشاحنة ويُبلَّغ الزبون والسائق والشركة بالسبب."), reason: reasonBox(t, t("Reason (at least 3 characters)", "السبب (3 أحرف على الأقل)")), confirmLabel: t("Cancel the job", "إلغاء المهمة") },
      success: t("Job cancelled.", "تم إلغاء المهمة."), run: async (reason) => { await adminHistory.cancel(j.id, reason ?? ""); await reload(); },
    });
  return out;
}

// ---------------------------------------------------------------- problem reports
/** Open the job · Close the report (only while it is open). */
export function reportActions(t: T, r: { id: string; closedAt: string | null; job: { id: string } }, reload: () => unknown): ItemAction[] {
  const out: ItemAction[] = [{ key: "open", label: t("Open the job", "فتح المهمة"), icon: "open-outline", run: () => router.push({ pathname: "/dept/tows/[id]", params: { id: r.job.id } }) }];
  if (!r.closedAt) out.push({ key: "close", label: t("Close report", "إغلاق البلاغ"), icon: "checkmark-circle-outline", success: t("Report closed.", "تم إغلاق البلاغ."), run: async () => { await adminHistory.closeReport(r.id); await reload(); } });
  return out;
}
