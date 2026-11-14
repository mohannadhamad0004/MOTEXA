// "⋮" menu actions for the Parts / Tow admin lists. Only actions that already exist (same API calls and screens as the old buttons);
// each builder returns the actions valid for the item's CURRENT state, in the order they should appear.
import { router, type Href } from "expo-router";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { adminAccessoryApi, type ListedAccessory } from "../accessory3d/api";
import { reviewAction, reviewRoute } from "../accessory3d/reviewState";
import { refreshRuntimeModels } from "../car3d/runtimeModels";
import { partsAdminService } from "../parts/partsService";
import { review, type AppStatus, type Kind } from "../provider/api";
import { threeDError } from "../vehicleCatalog/lifecycleText";
import { vehicleCatalog, type ModelImport } from "../vehicleCatalog/api";
import { modelApi, type Managed3DModel } from "../vehicleCatalog/modelApi";

type T = (en: string, ar: string) => string;
const go = (path: string) => router.push(path as Href);
const NOACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };

// ---------------------------------------------------------------- provider applications (parts shops, tow companies)
/** Open · Approve · Request changes · Reject. Suspend does not exist for shops / companies (no endpoint), so it is not offered. */
export function providerActions(t: T, kind: Kind, p: { id: string; status: AppStatus; pendingDocuments?: number }, reload: () => unknown): ItemAction[] {
  const open = () => go(`/dept/review/${kind === "TOW" ? "company" : "shop"}/${p.id}`);
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: open }];
  if (p.status === "PENDING") {
    const docs = p.pendingDocuments ?? 0;
    out.push({
      key: "approve", label: t("Approve", "موافقة"), icon: "checkmark-circle-outline", disabled: docs > 0,
      hint: docs > 0 ? t("Accept every required document first: open it.", "اقبل كل المستندات المطلوبة أولًا: افتح الطلب.") : undefined,
      confirm: { title: t("Approve this application?", "الموافقة على هذا الطلب؟"), message: t("The owner is notified and can start receiving requests.", "يُبلَّغ المالك ويمكنه البدء باستقبال الطلبات.") },
      success: t("Approved.", "تمت الموافقة."), run: async () => { await review.approve(kind, p.id); await reload(); },
      error: (e) => (e instanceof Error && /checklist/i.test(e.message) ? t("The approval checklist is not complete: open it to see what is missing.", "قائمة الموافقة غير مكتملة: افتح الطلب لمعرفة الناقص.") : e instanceof Error ? e.message : t("Could not approve.", "تعذّرت الموافقة.")),
    });
    out.push({ key: "changes", label: t("Request changes…", "طلب تعديلات…"), icon: "create-outline", hint: t("Pick what to fix on the review screen.", "اختر ما يجب إصلاحه في شاشة المراجعة."), run: open });
  }
  if (p.status === "PENDING" || p.status === "NEEDS_CHANGES")
    out.push({
      key: "reject", label: t("Reject", "رفض"), icon: "close-circle-outline", destructive: true,
      confirm: { title: t("Reject this application?", "رفض هذا الطلب؟"), message: t("This is final. The owner is told the reason.", "هذا القرار نهائي. يُبلَّغ المالك بالسبب."), reason: { label: t("Reason (sent to the owner)", "السبب (يُرسل للمالك)"), required: true }, confirmLabel: t("Reject", "رفض") },
      success: t("Rejected.", "تم الرفض."), run: async (reason) => { await review.reject(kind, p.id, reason ?? ""); await reload(); },
    });
  return out;
}

// ---------------------------------------------------------------- shop products (admin moderation)
type Prod = { id: string; name: string; hidden: boolean; hasPhoto?: boolean };
/** Open (details) · Add photo · Edit · Hide / Show again. Hiding needs a reason, like the old box. */
export function productActions(t: T, p: Prod, o: { toggleDetails: () => void; open: boolean; reload: () => unknown }): ItemAction[] {
  const out: ItemAction[] = [{ key: "open", label: o.open ? t("Hide details", "إخفاء التفاصيل") : t("Open details", "عرض التفاصيل"), icon: "document-text-outline", run: o.toggleDetails }];
  if (p.hasPhoto === false) out.push({ key: "photo", label: t("Add product photo", "إضافة صورة المنتج"), icon: "camera-outline", run: () => go(`/dept/edit/product/${p.id}`) });
  out.push({ key: "edit", label: t("Edit", "تعديل"), icon: "create-outline", run: () => go(`/dept/edit/product/${p.id}`) });
  if (p.hidden)
    out.push({ key: "show", label: t("Show again", "إظهار مرة أخرى"), icon: "eye-outline", success: t("Product shown.", "تم إظهار المنتج."), run: async () => { await partsAdminService.setProductVisibility(NOACTOR, p.id, { hidden: false }); await o.reload(); } });
  else
    out.push({
      key: "hide", label: t("Hide", "إخفاء"), icon: "eye-off-outline", destructive: true,
      confirm: { title: t("Hide this product?", "إخفاء هذا المنتج؟"), message: t("Customers stop seeing it until you show it again.", "يتوقف العملاء عن رؤيته إلى أن تعيد إظهاره."), reason: { label: t("Reason for hiding (required)", "سبب الإخفاء (مطلوب)"), required: true }, confirmLabel: t("Hide", "إخفاء") },
      success: t("Product hidden.", "تم إخفاء المنتج."), run: async (reason) => { await partsAdminService.setProductVisibility(NOACTOR, p.id, { hidden: true, reason: reason ?? "" }); await o.reload(); },
    });
  return out;
}

// ---------------------------------------------------------------- 3D accessory requests / models
/** Opens the Accessory fits screen on the first car that has a 3D model (the screen shows the part on that car). */
const openOnCar = (t: T, a: ListedAccessory, step: "preview" | "review") => async () => {
  const full = await adminAccessoryApi.get(a.id);
  const target = full.review.targets.find((x) => x.has3d);
  if (!target) throw new Error(t("None of this part's cars has a 3D model yet.", "لا توجد سيارة من سيارات هذه القطعة لها نموذج ثلاثي الأبعاد بعد."));
  const next = step === "review" ? reviewAction(full.review, target) : null;
  go(reviewRoute(a.id, target, next === "partMap" ? "parts" : "fits"));
};
/** Open · Preview on car · Review / approve fit · Unpublish / Reactivate · Delete (= discard the private 3D model, the task history stays). */
export function accessoryActions(t: T, a: ListedAccessory, reload: () => unknown): ItemAction[] {
  const act = (action: "unpublish" | "reactivate" | "discard-candidate") => async () => { await adminAccessoryApi.act(a.id, action); await reload(); };
  const err = (e: unknown) => threeDError(e, t);
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => go(`/dept/accessory3d/${a.id}`) }];
  if (a.hasModel) out.push({ key: "preview", label: t("Preview on car", "معاينة على السيارة"), icon: "car-sport-outline", run: openOnCar(t, a, "preview"), error: err });
  if (a.hasModel && a.status === "READY_FOR_FINAL_REVIEW") out.push({ key: "fit", label: t("Review / approve fit", "مراجعة / اعتماد التركيب"), icon: "construct-outline", run: openOnCar(t, a, "review"), error: err });
  if (a.status === "PUBLISHED" && !a.deactivatedAt)
    out.push({
      key: "unpublish", label: t("Unpublish", "إلغاء النشر"), icon: "eye-off-outline", destructive: true,
      confirm: { title: t("Unpublish this model?", "إلغاء نشر هذا النموذج؟"), message: t("Customers stop seeing this part on their cars. You can reactivate it later.", "يتوقف العملاء عن رؤية هذه القطعة على سياراتهم. يمكنك إعادة تفعيلها لاحقًا."), confirmLabel: t("Unpublish", "إلغاء النشر") },
      success: t("Unpublished.", "تم إلغاء النشر."), run: act("unpublish"), error: err,
    });
  if (a.status === "PUBLISHED" && a.deactivatedAt)
    out.push({ key: "reactivate", label: t("Reactivate", "إعادة التفعيل"), icon: "eye-outline", success: t("Reactivated.", "تمت إعادة التفعيل."), run: act("reactivate"), error: err });
  if (a.hasModel && a.status !== "PUBLISHED" && a.status !== "GENERATING")
    out.push({
      key: "delete", label: t("Discard 3D model", "استبعاد النموذج ثلاثي الأبعاد"), icon: "trash-outline", destructive: true,
      confirm: { title: t("Discard this 3D model?", "استبعاد هذا النموذج ثلاثي الأبعاد؟"), message: t("Only the private 3D model file is discarded. The accessory request and its task history stay.", "يُستبعد ملف النموذج الخاص فقط. يبقى طلب الإكسسوار وسجل المهمة."), confirmLabel: t("Discard", "استبعاد") },
      success: t("3D model discarded.", "تم استبعاد النموذج."), run: act("discard-candidate"), error: err,
    });
  return out;
}

// ---------------------------------------------------------------- vehicle 3D models
/** Preview · Edit details · Replace model · Review part map · Hide / Show · Delete. */
export function modelActions(t: T, m: Managed3DModel, reload: () => unknown): ItemAction[] {
  const err = (e: unknown) => threeDError(e, t), refresh = async () => { await refreshRuntimeModels(); await reload(); };
  const out: ItemAction[] = [
    { key: "preview", label: t("Preview", "معاينة"), icon: "cube-outline", disabled: m.bytes === null, hint: m.bytes === null ? t("The model file is missing.", "ملف النموذج مفقود.") : undefined, run: () => go(`/dept/3d/vehicles/${m.key}?preview=1`) },
    { key: "edit", label: t("Edit details", "تعديل التفاصيل"), icon: "create-outline", run: () => go(`/dept/3d/vehicles/${m.key}?edit=1`) },
    { key: "replace", label: t("Replace model", "استبدال النموذج"), icon: "swap-horizontal-outline", run: () => go(`/dept/3d/add?generationId=${m.generationId}`) },
    { key: "map", label: t("Review part map", "مراجعة خريطة القطع"), icon: "git-network-outline", run: () => go(`/dept/accessory-zones?key=${m.key}&mode=parts`) },
  ];
  if (m.published)
    out.push({
      key: "hide", label: t("Hide from customers", "إخفاء عن العملاء"), icon: "eye-off-outline", destructive: true, disabled: !m.current,
      confirm: { title: t("Hide this model?", "إخفاء هذا النموذج؟"), message: t("Customers lose the 3D view of this car until you show it again.", "يفقد العملاء العرض ثلاثي الأبعاد لهذه السيارة إلى أن تعيد إظهاره."), confirmLabel: t("Hide", "إخفاء") },
      success: t("Hidden from customers.", "تم الإخفاء عن العملاء."), run: async () => { await modelApi.publication(m.key, m.revision, false, false); await refresh(); }, error: err,
    });
  else if (m.reviewRequired)
    out.push({ key: "show", label: t("Show to customers…", "إظهار للعملاء…"), icon: "eye-outline", disabled: !m.current, hint: t("Preview and approve the changed shape first.", "عاين الشكل المعدّل واعتمده أولًا."), run: () => go(`/dept/3d/vehicles/${m.key}?preview=1`) });
  else
    out.push({ key: "show", label: t("Show to customers", "إظهار للعملاء"), icon: "eye-outline", disabled: !m.current, success: t("Shown to customers.", "تم الإظهار للعملاء."), run: async () => { await modelApi.publication(m.key, m.revision, true, false); await refresh(); }, error: err });
  out.push({
    key: "delete", label: t("Delete", "حذف"), icon: "trash-outline", destructive: true,
    confirm: {
      title: t("Delete this 3D model?", "حذف هذا النموذج ثلاثي الأبعاد؟"), confirmLabel: t("Delete permanently", "حذف نهائي"),
      message: async () => {
        const i = await modelApi.deleteImpact(m.key);
        const rows: [keyof typeof i, string, string][] = [["garageCars", "Customer Garage cars lose the 3D view", "سيارات العملاء تفقد العرض ثلاثي الأبعاد"], ["shopAccessories", "Shop accessories for this car can no longer be shown on it", "إكسسوارات المتاجر لهذه السيارة لن تظهر عليها"], ["accessoryFits", "Accessory fits are deleted", "تُحذف تركيبات الإكسسوارات"], ["partMaps", "Its part map is deleted", "تُحذف خريطة قطعه"], ["zones", "Its fitting zones are deleted", "تُحذف مناطق التركيب"], ["imports", "Its import record is deleted", "يُحذف سجل استيراده"]];
        const lines = rows.filter(([k]) => Number(i[k]) > 0).map(([k, en, ar]) => `• ${t(en, ar)}: ${i[k]}`);
        return [i.published ? t("Customers see this model now: it disappears for them at once.", "يرى العملاء هذا النموذج الآن وسيختفي عنهم فورًا.") : t("This model is not shown to customers.", "هذا النموذج غير ظاهر للعملاء."), ...lines, t("The GLB file and these records are deleted permanently. This cannot be undone.", "يُحذف ملف GLB وهذه السجلات نهائيًا ولا يمكن التراجع.")].join("\n");
      },
    },
    success: t("3D model deleted.", "تم حذف النموذج."), run: async () => { await modelApi.deleteModel(m.key); await refresh(); }, error: err,
  });
  return out;
}

/** A 3D model import that is not a catalog model yet: Open (continue / review) · Retry (failed) · Discard (not published). */
export function importActions(t: T, r: ModelImport, reload: () => unknown): ItemAction[] {
  const err = (e: unknown) => threeDError(e, t);
  const out: ItemAction[] = [{ key: "open", label: r.status === "DISCARDED" ? t("View import", "عرض الاستيراد") : t("Open", "فتح"), icon: "open-outline", run: () => go(`/dept/vehicles/imports/${r.id}`) }];
  if (r.status === "FAILED") out.push({ key: "retry", label: t("Retry import", "إعادة محاولة الاستيراد"), icon: "refresh-outline", success: t("Import restarted.", "أُعيد تشغيل الاستيراد."), run: async () => { await vehicleCatalog.retry(r.id); await reload(); }, error: err });
  if (!["PUBLISHED", "DISCARDED"].includes(r.status))
    out.push({
      key: "discard", label: t("Discard import", "استبعاد الاستيراد"), icon: "trash-outline", destructive: true,
      confirm: { title: t("Discard this import?", "استبعاد هذا الاستيراد؟"), message: t("The unpublished import and its private prepared files are discarded. Its source history is kept for audit.", "يُستبعد الاستيراد غير المنشور وملفاته المجهّزة الخاصة. يبقى سجل المصدر للتدقيق."), confirmLabel: t("Discard", "استبعاد") },
      success: t("Import discarded.", "تم استبعاد الاستيراد."), run: async () => { await vehicleCatalog.discard(r.id); await reload(); }, error: err,
    });
  return out;
}
