// "⋮" menu of the super admin's administrator list. Endpoints that exist: PATCH /admin-invitations/:id/status (ACTIVE <-> SUSPENDED)
// and PATCH /admin-invitations/:id/revoke (a pending invitation). No endpoint to delete an administrator or to resend an invitation.
import type { ItemAction } from "../../components/ItemActionsMenu";
import { api } from "../../core/config/api";

export function adminAccountActions(t: (en: string, ar: string) => string, a: { id: string; name: string; status: "active" | "suspended" | "invited" }, o: { open: () => void; reload: () => unknown }): ItemAction[] {
  const out: ItemAction[] = [];
  if (a.status !== "invited") out.push({ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: o.open });
  if (a.status === "active")
    out.push({
      key: "suspend", label: t("Suspend", "تعليق"), icon: "pause-circle-outline", destructive: true,
      confirm: { title: t("Suspend this administrator?", "تعليق هذا الأدمن؟"), message: t("They cannot sign in or manage anything until reactivated.", "لا يستطيع تسجيل الدخول أو الإدارة إلى أن تعيد تفعيله."), confirmLabel: t("Suspend", "تعليق") },
      success: t("Administrator suspended.", "تم تعليق الأدمن."), run: async () => { await api("PATCH", `/admin-invitations/${a.id}/status`, { status: "SUSPENDED" }); await o.reload(); },
    });
  if (a.status === "suspended")
    out.push({ key: "reactivate", label: t("Reactivate", "إعادة التفعيل"), icon: "play-circle-outline", confirm: { title: t("Reactivate this administrator?", "إعادة تفعيل هذا الأدمن؟") }, success: t("Administrator reactivated.", "تمت إعادة تفعيل الأدمن."), run: async () => { await api("PATCH", `/admin-invitations/${a.id}/status`, { status: "ACTIVE" }); await o.reload(); } });
  if (a.status === "invited")
    out.push({
      key: "revoke", label: t("Revoke invitation", "إلغاء الدعوة"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Revoke this invitation?", "إلغاء هذه الدعوة؟"), message: t("The link stops working. You can invite them again later.", "يتوقف الرابط عن العمل. يمكنك دعوته مجددًا لاحقًا."), confirmLabel: t("Revoke invitation", "إلغاء الدعوة") },
      success: t("Invitation revoked.", "تم إلغاء الدعوة."), run: async () => { await api("PATCH", `/admin-invitations/${a.id}/revoke`); await o.reload(); },
    });
  return out;
}
