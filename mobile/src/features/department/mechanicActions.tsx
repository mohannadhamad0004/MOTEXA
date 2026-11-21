// "⋮" menu actions of the Mechanics Admin's application list (the same decision endpoint as the review screen).
// Only what the server allows in the CURRENT status: PENDING -> Approve / Request completion / Reject; VERIFIED -> Suspend;
// SUSPENDED -> Reactivate. Approve is disabled until the interview is PASSED (the server also wants the identity document viewed:
// its message is shown in the toast). There is no endpoint to delete a mechanic or to message one from here, so neither is offered.
import { router, type Href } from "expo-router";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { mechanicApi, type MechanicProfile } from "../../components/mechanic-api";

type T = (en: string, ar: string) => string;
export type MechanicApplicationRow = { userId: string; verificationStatus: string; interviewResult: string | null; user: { fullName: string } };

export function mechanicApplicationActions(t: T, p: MechanicApplicationRow, o: { open: () => unknown; reload: () => unknown }): ItemAction[] {
  const decide = async (action: string, notes = "") => {
    // the decision needs the application's current version: read it now, so a stale list row cannot overwrite a newer submission
    const { profile } = await mechanicApi<{ profile: MechanicProfile }>("/api/mechanics/admin/" + p.userId);
    await mechanicApi("/api/mechanics/admin/" + p.userId + "/decision", "POST", { action, notes, submissionVersion: profile.submissionVersion });
    await o.reload();
  };
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => { void o.open(); } }];
  const reason = (label: string) => ({ label, required: true });
  if (p.verificationStatus === "PENDING") {
    const passed = p.interviewResult === "PASSED";
    out.push({
      key: "approve", label: t("Approve", "اعتماد"), icon: "checkmark-circle-outline", disabled: !passed,
      hint: passed ? undefined : t("Record a passed interview first: open the application.", "سجّل مقابلة ناجحة أولًا: افتح الطلب."),
      confirm: { title: t("Approve this mechanic?", "اعتماد هذا الميكانيكي؟"), message: t("The mechanic becomes visible to customers and can receive requests.", "يظهر الميكانيكي للزبائن ويمكنه استقبال الطلبات.") },
      success: t("Approved.", "تم الاعتماد."), run: () => decide("APPROVE"),
    });
    out.push({
      key: "changes", label: t("Request changes…", "طلب استكمال…"), icon: "create-outline",
      confirm: { title: t("Ask for changes?", "طلب استكمال؟"), message: t("The mechanic is told what to complete.", "يُبلَّغ الميكانيكي بما يجب استكماله."), reason: reason(t("What to complete (min. 5 characters)", "ما يجب استكماله (٥ أحرف على الأقل)")), confirmLabel: t("Send", "إرسال") },
      success: t("Changes requested.", "تم طلب الاستكمال."), run: (r) => decide("NEEDS_COMPLETION", r ?? ""),
    });
    out.push({
      key: "reject", label: t("Reject", "رفض"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Reject this application?", "رفض هذا الطلب؟"), message: t("This is final. The mechanic is told the reason.", "هذا القرار نهائي. يُبلَّغ الميكانيكي بالسبب."), reason: reason(t("Reason (min. 5 characters)", "السبب (٥ أحرف على الأقل)")), confirmLabel: t("Reject", "رفض") },
      success: t("Rejected.", "تم الرفض."), run: (r) => decide("REJECT", r ?? ""),
    });
  }
  if (p.verificationStatus === "VERIFIED")
    out.push({
      key: "suspend", label: t("Suspend…", "تعليق…"), icon: "pause-circle-outline", destructive: true,
      confirm: { title: t("Suspend this mechanic?", "تعليق هذا الميكانيكي؟"), message: t("They disappear from the catalog and cannot answer requests until reactivated.", "يختفي من الدليل ولا يستطيع الرد على الطلبات إلى أن تعيد تفعيله."), reason: reason(t("Reason (min. 5 characters)", "السبب (٥ أحرف على الأقل)")), confirmLabel: t("Suspend", "تعليق") },
      success: t("Suspended.", "تم التعليق."), run: (r) => decide("SUSPEND", r ?? ""),
    });
  if (p.verificationStatus === "SUSPENDED")
    out.push({
      key: "reactivate", label: t("Reactivate", "إعادة التفعيل"), icon: "play-circle-outline",
      confirm: { title: t("Reactivate this mechanic?", "إعادة تفعيل هذا الميكانيكي؟"), message: t("They become visible to customers again.", "يظهر للزبائن من جديد.") },
      success: t("Reactivated.", "تمت إعادة التفعيل."), run: () => decide("REACTIVATE"),
    });
  if (p.verificationStatus === "VERIFIED" || p.verificationStatus === "SUSPENDED")
    out.push({ key: "requests", label: t("View their requests", "عرض طلباتهم"), icon: "list-outline", run: () => router.push(`/dept/requests?seg=requests&q=${encodeURIComponent(p.user.fullName)}` as Href) });
  return out;
}
