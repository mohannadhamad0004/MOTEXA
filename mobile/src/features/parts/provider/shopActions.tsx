// "⋮" menu actions for the Parts SHOP owner's lists (products, 3D requests). Same API calls as the old buttons / screens; only actions valid
// for the item's CURRENT state. Owners cannot hide a listing (moderation only) and the server has no "available" switch: a product is
// sold out when its stock is 0, so "Mark available" asks for the new stock.
import { router, type Href } from "expo-router";
import type { ItemAction } from "../../../components/ItemActionsMenu";
import { formatPrice } from "../../../core/constants/money";
import { shopAccessoryApi, typesForCategory, type KitPart } from "../../accessory3d/api";
import type { Provider3dProduct } from "../../provider/portal/types";
import { shopOrders, type OrderStatus, type ShopOrder } from "../../orders/ordersService";
import { shopInquiries } from "../../requests/requestsService";
import { partsShopService, type Product } from "../partsService";

type T = (en: string, ar: string) => string;
const go = (path: string) => router.push(path as Href);
const ACTOR = { id: "", email: "", fullName: "", role: "PARTS_PROVIDER" } as never; // the server uses the token (see partsShopService)

/** Open · Edit · Mark sold out / Mark available · Change stock · Request 3D · Delete. */
export function shopProductActions(t: T, p: Product, reload: () => unknown): ItemAction[] {
  const reserved = p.reservedStock ?? 0;
  const setStock = async (v?: string) => { await partsShopService.setStock(ACTOR, p.id, Number(v)); await reload(); };
  const stockBox = (label: string, initial: string) => ({ label, required: true, numeric: true, initial });
  const out: ItemAction[] = [
    { key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => go(`/provider/parts/${p.id}`) },
    { key: "edit", label: t("Edit", "تعديل"), icon: "create-outline", run: () => go(`/provider/parts/products/edit/${p.id}`) },
  ];
  if (p.stock > 0)
    out.push({
      key: "soldout", label: t("Mark sold out", "تحديد كنافد"), icon: "remove-circle-outline", disabled: reserved > 0,
      hint: reserved > 0 ? t(`${reserved} reserved by accepted orders.`, `${reserved} محجوزة لطلبات مقبولة.`) : undefined,
      confirm: { title: t("Mark as sold out?", "تحديد المنتج كنافد؟"), message: t(`Stock goes from ${p.stock} to 0 and customers see it as sold out.`, `يصبح المخزون 0 بدل ${p.stock} ويراه العملاء نافدًا.`), confirmLabel: t("Mark sold out", "تحديد كنافد") },
      success: t("Marked as sold out.", "تم تحديده كنافد."), run: () => setStock("0"),
    });
  else
    out.push({
      key: "available", label: t("Mark available…", "تحديد كمتوفر…"), icon: "checkmark-circle-outline",
      confirm: { title: t("Mark as available?", "تحديد المنتج كمتوفر؟"), message: t("Enter how many are in stock now.", "أدخل الكمية المتوفرة الآن."), reason: stockBox(t("Stock", "المخزون"), "1"), confirmLabel: t("Save", "حفظ") },
      success: t("Marked as available.", "تم تحديده كمتوفر."), run: setStock,
    });
  out.push({
    key: "stock", label: t("Change stock…", "تغيير المخزون…"), icon: "layers-outline",
    confirm: { title: t("Change stock", "تغيير المخزون"), message: reserved ? t(`Cannot go below ${reserved}: reserved by accepted orders.`, `لا يمكن أن يقل عن ${reserved}: محجوزة لطلبات مقبولة.`) : undefined, reason: stockBox(t("Stock", "المخزون"), String(p.stock)), confirmLabel: t("Save", "حفظ") },
    success: t("Stock updated.", "تم تحديث المخزون."), run: setStock,
  });
  if (typesForCategory(p.category).length) out.push({ key: "3d", label: t("Request 3D model", "طلب نموذج ثلاثي الأبعاد"), icon: "cube-outline", run: () => go(`/provider/parts/accessory-3d/${p.id}`) });
  out.push({
    key: "delete", label: t("Delete", "حذف"), icon: "trash-outline", destructive: true,
    confirm: { title: t("Delete this product?", "حذف هذا المنتج؟"), message: t(`${p.name} (${formatPrice(p.price)}) and its photo are deleted for good. This cannot be undone.`, `يُحذف ${p.name} (${formatPrice(p.price)}) وصورته نهائيًا ولا يمكن التراجع.`), confirmLabel: t("Delete", "حذف") },
    success: t("Product deleted.", "تم حذف المنتج."), run: async () => { await partsShopService.removeProduct(ACTOR, p.id); await reload(); },
  });
  return out;
}

/** 3D requests (one row per product): Open · Edit draft · Delete draft (a draft part only; a submitted request is never deleted here). */
export function shop3dActions(t: T, p: Provider3dProduct, typeLabel: (type: Provider3dProduct["parts"][number]["type"]) => string, reload: () => unknown): ItemAction[] {
  const drafts = p.parts.filter((x) => x.status === "DRAFT");
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => go(`/provider/parts/accessory-3d/${p.id}`) }];
  if (p.parts.some((x) => x.hasModel)) out.push({ key: "preview", label: t("Preview 3D / View on car", "معاينة ثلاثية الأبعاد / عرض على سيارة"), icon: "car-sport-outline", run: () => go(`/provider/parts/3d/preview/${p.id}`) });
  out.push({ key: "product", label: t("Product details", "تفاصيل المنتج"), icon: "document-text-outline", run: () => go(`/provider/parts/${p.id}`) });
  if (drafts.length) out.push({ key: "edit", label: t("Edit draft", "تعديل المسودة"), icon: "create-outline", run: () => go(`/provider/parts/accessory-3d/${p.id}`) });
  for (const x of drafts)
    out.push({
      key: `del-${x.part}`, label: drafts.length > 1 ? t(`Delete draft: ${typeLabel(x.type)}`, `حذف المسودة: ${typeLabel(x.type)}`) : t("Delete draft", "حذف المسودة"), icon: "trash-outline", destructive: true,
      confirm: { title: t("Delete this draft?", "حذف هذه المسودة؟"), message: t("The 3D request draft and its photos are deleted. The product stays.", "تُحذف مسودة الطلب وصورها. يبقى المنتج."), confirmLabel: t("Delete draft", "حذف المسودة") },
      success: t("Draft deleted.", "تم حذف المسودة."), run: async () => { await shopAccessoryApi.remove(p.id, x.part as KitPart); await reload(); },
    });
  return out;
}

// ---------------------------------------------------------------- orders / questions (gap lists)
/** Open · the forward steps the server allows now (Accept, Start preparing, Ready…) · Reject / Cancel with a reason. */
export function shopOrderActions(t: T, o: ShopOrder, statusLabel: (s: OrderStatus) => string, reload: () => unknown): ItemAction[] {
  const stepLabel: Partial<Record<OrderStatus, string>> = { ACCEPTED: t("Accept", "قبول"), PREPARING: t("Start preparing", "بدء التجهيز"), READY_FOR_PICKUP: t("Ready for pickup", "جاهز للاستلام"), OUT_FOR_DELIVERY: t("Out for delivery", "خرج للتوصيل"), PICKED_UP: t("Picked up", "تم الاستلام"), DELIVERED: t("Delivered", "تم التوصيل") };
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => router.push({ pathname: "/provider/parts/orders/[id]", params: { id: o.id } }) }];
  for (const s of o.next.filter((x) => x !== "REJECTED" && x !== "CANCELLED"))
    out.push({
      key: s, label: stepLabel[s] ?? statusLabel(s), icon: "arrow-forward-circle-outline",
      confirm: s === "ACCEPTED" ? { title: t("Accept this order?", "قبول هذا الطلب؟"), message: t("Accepting reserves the parts in your stock until the order is handed over or cancelled.", "القبول يحجز القطع في مخزونك حتى يتم التسليم أو الإلغاء.") } : undefined,
      success: t("Order updated.", "تم تحديث الطلب."), run: async () => { await shopOrders.move(o.id, s); await reload(); },
    });
  const stop = o.next.includes("REJECTED") ? "REJECTED" : o.next.includes("CANCELLED") ? "CANCELLED" : null;
  if (stop)
    out.push({
      key: "stop", label: stop === "REJECTED" ? t("Reject order", "رفض الطلب") : t("Cancel order", "إلغاء الطلب"), icon: "close-circle-outline", destructive: true,
      confirm: { title: stop === "REJECTED" ? t("Reject this order?", "رفض هذا الطلب؟") : t("Cancel this order?", "إلغاء هذا الطلب؟"), message: t("The customer is told the reason.", "يُبلَّغ الزبون بالسبب."), reason: { label: t("Reason (required)", "السبب (مطلوب)"), required: true }, confirmLabel: stop === "REJECTED" ? t("Reject", "رفض") : t("Cancel order", "إلغاء الطلب") },
      success: stop === "REJECTED" ? t("Order rejected.", "تم رفض الطلب.") : t("Order cancelled.", "تم إلغاء الطلب."), run: async (reason) => { await shopOrders.move(o.id, stop, reason); await reload(); },
    });
  return out;
}

/** Open · Close the question (only while it is not closed). */
export function shopInquiryActions(t: T, q: { id: string; status: string }, reload: () => unknown): ItemAction[] {
  const out: ItemAction[] = [{ key: "open", label: t("Open", "فتح"), icon: "open-outline", run: () => go(`/provider/parts/inquiries/${q.id}`) }];
  if (q.status !== "CLOSED")
    out.push({
      key: "close", label: t("Close question", "إغلاق السؤال"), icon: "checkmark-done-outline",
      confirm: { title: t("Close this question?", "إغلاق هذا السؤال؟"), message: t("The question is marked as closed.", "يُعلَّم السؤال كمغلق.") },
      success: t("Question closed.", "تم إغلاق السؤال."), run: async () => { await shopInquiries.close(q.id); await reload(); },
    });
  return out;
}
