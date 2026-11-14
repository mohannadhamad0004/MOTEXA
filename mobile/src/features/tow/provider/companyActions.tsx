// "⋮" menu actions for the TOW COMPANY owner's lists (drivers, trucks, jobs). Same API calls as the old buttons; only actions valid for the
// item's CURRENT state. There is no endpoint to remove a driver (only to take one offline), so "Remove" is offered for trucks only.
import { router, type Href } from "expo-router";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { companyTowRequests, type CompanyTowRequest } from "../../requests/requestsService";
import { companyDispatch, type CompanyDriver } from "../dispatchService";
import { towFleetService, type Truck } from "../towService";

type T = (en: string, ar: string) => string;
const go = (path: string) => router.push(path as Href);
const ACTOR = { id: "", email: "", fullName: "", role: "TOW_PROVIDER" } as never; // the server uses the token (see towFleetService)

/** Open job · Edit · Change truck · Set offline / Set online · Send sign-in code again. */
export function companyDriverActions(t: T, d: CompanyDriver, o: { reload: () => unknown; edit?: () => void; changeTruck?: () => void }): ItemAction[] {
  const out: ItemAction[] = [];
  if (d.job) out.push({ key: "job", label: t("Open current job", "فتح المهمة الحالية"), icon: "navigate-outline", run: () => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id: d.job!.id } }) });
  if (o.edit) out.push({ key: "edit", label: t("Edit", "تعديل"), icon: "create-outline", run: o.edit });
  if (o.changeTruck) out.push({ key: "truck", label: t("Change truck", "تغيير الشاحنة"), icon: "car-outline", run: o.changeTruck });
  if (d.offline)
    out.push({ key: "online", label: t("Set online", "تعيين كمتصل"), icon: "play-circle-outline", success: t("Driver is online.", "السائق متصل."), run: async () => { await companyDispatch.updateDriver(d.id, { offline: false }); await o.reload(); } });
  else
    out.push({
      key: "offline", label: t("Set offline", "تعيين كغير متصل"), icon: "pause-circle-outline", destructive: true,
      confirm: { title: t("Set this driver offline?", "تعيين هذا السائق كغير متصل؟"), message: t("Customers cannot choose him and he gets no new jobs until you set him online again.", "لا يستطيع الزبائن اختياره ولا يصله عمل جديد حتى تعيده متصلًا."), confirmLabel: t("Set offline", "تعيين كغير متصل") },
      success: t("Driver is offline.", "السائق غير متصل."), run: async () => { await companyDispatch.updateDriver(d.id, { offline: true }); await o.reload(); },
    });
  if (!d.isOwner) out.push({ key: "code", label: t("Send sign-in code again", "إرسال رمز الدخول مرة أخرى"), icon: "mail-outline", success: t("Sign-in code sent.", "تم إرسال رمز الدخول."), run: async () => { await companyDispatch.invite(d.id); await o.reload(); } });
  return out;
}

/** Open · Edit · Out of service / Set available (approved trucks) · Remove. Both the status change and Remove are refused while the truck is on a job. */
export function companyTruckActions(t: T, x: Truck, o: { reload: () => unknown; edit: () => void }): ItemAction[] {
  const onJob = { disabled: x.hasActiveJob, hint: x.hasActiveJob ? t("The truck is on a job.", "الشاحنة في مهمة.") : undefined };
  const out: ItemAction[] = [
    { key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => go(`/provider/tow/${x.id}`) },
    { key: "edit", label: t("Edit", "تعديل"), icon: "create-outline", ...onJob, run: o.edit },
  ];
  if (x.verification === "APPROVED") {
    if (x.operational === "AVAILABLE")
      out.push({
        key: "oos", label: t("Out of service", "خارج الخدمة"), icon: "pause-circle-outline", destructive: true, ...onJob,
        confirm: { title: t("Take this truck out of service?", "إخراج هذه الشاحنة من الخدمة؟"), message: t("Customers cannot choose it until you set it available again.", "لا يستطيع الزبائن اختيارها حتى تعيدها متاحة."), confirmLabel: t("Out of service", "خارج الخدمة") },
        success: t("Truck is out of service.", "الشاحنة خارج الخدمة."), run: async () => { await towFleetService.setOperational(ACTOR, x.id, "OUT_OF_SERVICE"); await o.reload(); },
      });
    else
      out.push({ key: "available", label: t("Set available", "تعيين كمتاح"), icon: "play-circle-outline", ...onJob, success: t("Truck is available.", "الشاحنة متاحة."), run: async () => { await towFleetService.setOperational(ACTOR, x.id, "AVAILABLE"); await o.reload(); } });
  }
  out.push({
    key: "remove", label: t("Remove", "إزالة"), icon: "trash-outline", destructive: true, ...onJob,
    confirm: { title: t("Remove this truck?", "إزالة هذه الشاحنة؟"), message: t(`${x.plate} and its documents are removed from your fleet.`, `تُزال ${x.plate} ومستنداتها من أسطولك.`), confirmLabel: t("Remove truck", "إزالة الشاحنة") },
    success: t("Truck removed.", "تمت إزالة الشاحنة."), run: async () => { await towFleetService.removeTruck(ACTOR, x.id); await o.reload(); },
  });
  return out;
}

/** Open · Assign / Reassign driver (a FREE one, until the driver is on the way) · Decline (new request) · Cancel job (accepted / on the way). */
export function companyJobActions(t: T, r: CompanyTowRequest, o: { reload: () => unknown }): ItemAction[] {
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => router.push({ pathname: "/provider/tow/dispatch/[id]", params: { id: r.id } }) }];
  if (r.canReassign)
    out.push({
      key: "assign", label: r.driver ? t("Reassign driver…", "تحويل إلى سائق آخر…") : t("Assign driver…", "إسناد إلى سائق…"), icon: "person-add-outline",
      confirm: {
        title: r.driver ? t("Transfer to another free driver", "التحويل إلى سائق متاح آخر") : t("Assign to a free driver", "الإسناد إلى سائق متاح"),
        message: r.driver ? t("The current truck is freed; the customer is told and sees the new driver's card; the new driver accepts with his own truck.", "تُحرَّر الشاحنة الحالية ويُبلَّغ الزبون ويرى بطاقة السائق الجديد، ويقبل السائق الجديد بشاحنته.") : undefined,
        choices: async () => (await companyDispatch.drivers()).filter((d) => d.status === "FREE" && d.id !== r.driver?.id).map((d) => ({ id: d.id, label: d.truck ? `${d.name} · ${d.truck.plate}` : d.name })),
        choicesEmpty: t("No other driver is free right now.", "لا يوجد سائق آخر متاح الآن."),
        confirmLabel: r.driver ? t("Transfer", "تحويل") : t("Assign", "إسناد"),
      },
      success: r.driver ? t("Job transferred.", "تم تحويل المهمة.") : t("Driver assigned.", "تم إسناد السائق."), run: async (_why, driverId) => { await companyDispatch.assign(r.id, driverId ?? ""); await o.reload(); },
    });
  if (r.status === "REQUESTED")
    out.push({
      key: "decline", label: t("Decline request…", "رفض الطلب…"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Decline this request?", "رفض هذا الطلب؟"), message: t("The customer sees the reason.", "يرى الزبون السبب."), reason: { label: t("Reason (the customer sees this)", "السبب (يراه الزبون)"), required: true }, confirmLabel: t("Decline", "رفض") },
      success: t("Request declined.", "تم رفض الطلب."), run: async (reason) => { await companyTowRequests.decline(r.id, reason ?? ""); await o.reload(); },
    });
  if (r.status === "ACCEPTED" || r.status === "EN_ROUTE")
    out.push({
      key: "cancel", label: t("Cancel job…", "إلغاء المهمة…"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Cancel this job?", "إلغاء هذه المهمة؟"), message: t("The customer sees the reason.", "يرى الزبون السبب."), reason: { label: t("Reason (the customer sees this)", "السبب (يراه الزبون)"), required: true }, confirmLabel: t("Cancel the job", "إلغاء المهمة") },
      success: t("Job cancelled.", "تم إلغاء المهمة."), run: async (reason) => { await companyTowRequests.cancel(r.id, reason ?? ""); await o.reload(); },
    });
  return out;
}
