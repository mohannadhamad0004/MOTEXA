// One order, shop side = Detail: the customer's first name + area only (no phone: they share it in the chat if they want), how it is
// handed over, payment, the timeline and the items. ONE primary in the footer = the next step the server allows; other steps and
// Reject / Cancel (reason required, the customer sees it) are in ⋮. Chat and delivery map are entry rows.
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { GButton, Note, StatusChip } from "../../../../components/garage";
import type { ItemAction } from "../../../../components/ItemActionsMenu";
import { ManageEntry } from "../../../../components/manage/ManagePage";
import { Block, Facts, Loaded, Page } from "../../../../components/manage/Page";
import { cityLabel } from "../../../../core/constants/cities";
import { useL } from "../../../../core/hooks/useL";
import { useLoad } from "../../../../core/hooks/useLoad";
import { ORDER_REFRESH_MS, OrderStatus, shopOrders } from "../../../../features/orders/ordersService";
import { MoneyCard, OrderTimeline, orderTone, useOrderLabels } from "../../../../features/orders/orderBits";
import { useState } from "react";

export default function ShopOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const L = useOrderLabels();
  const state = useLoad(() => shopOrders.get(id), [id], ORDER_REFRESH_MS);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const o = state.data;
  const stepLabel: Partial<Record<OrderStatus, string>> = {
    ACCEPTED: t("Accept", "قبول"), PREPARING: t("Start preparing", "بدء التجهيز"), READY_FOR_PICKUP: t("Ready for pickup", "جاهز للاستلام"),
    OUT_FOR_DELIVERY: t("Out for delivery", "خرج للتوصيل"), PICKED_UP: t("Picked up", "تم الاستلام"), DELIVERED: t("Delivered", "تم التوصيل"),
  };
  const move = async (to: OrderStatus, why?: string) => {
    setBusy(true); setError(null);
    try { await shopOrders.move(id, to, why); await state.reload(); } catch (e) { setError((e as Error).message); throw e; } finally { setBusy(false); }
  };
  // the forward steps (Accept, Preparing, Ready / Out for delivery, Picked up / Delivered); the first is the page's primary
  const forward = (o?.next ?? []).filter((s) => s !== "REJECTED" && s !== "CANCELLED");
  const stop = o?.next.includes("REJECTED") ? "REJECTED" : o?.next.includes("CANCELLED") ? "CANCELLED" : null;
  const actions: ItemAction[] = [
    ...forward.slice(1).map((s) => ({ key: s, label: stepLabel[s] ?? L.status[s], icon: "arrow-forward-outline" as const, run: () => move(s) })),
    ...(stop ? [{ key: stop, destructive: true, icon: "close-circle-outline" as const, label: stop === "REJECTED" ? t("Reject order", "رفض الطلب") : t("Cancel order", "إلغاء الطلب"),
      confirm: { title: stop === "REJECTED" ? t("Reject this order?", "رفض هذا الطلب؟") : t("Cancel this order?", "إلغاء هذا الطلب؟"), confirmLabel: stop === "REJECTED" ? t("Reject", "رفض") : t("Cancel order", "إلغاء الطلب"),
        reason: { label: stop === "REJECTED" ? t("Why do you reject it? (the customer sees this)", "لماذا ترفضه؟ (يراه الزبون)") : t("Why do you cancel it? (the customer sees this)", "لماذا تلغيه؟ (يراه الزبون)"), required: true } },
      run: (reason?: string) => move(stop, reason) }] : []),
  ];
  const first = forward[0];
  return (
    <Page title={o ? o.customer.firstName : t("Order", "الطلب")} line={o ? `${L.fulfilment[o.fulfilment]} · ${o.id.slice(0, 8).toUpperCase()}` : undefined} actions={actions.length ? actions : undefined}
      onRefresh={() => void state.reload()} refreshing={false}
      footer={first ? <GButton icon="checkmark" label={stepLabel[first] ?? L.status[first]} busy={busy} disabled={busy} onPress={() => void move(first).catch(() => undefined)} /> : undefined}>
      <Loaded state={state}>{(o) => (
        <>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={orderTone(o.status)} label={L.status[o.status]} /></View>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          {o.status === "PLACED" ? <Note>{t("Accepting reserves the parts in your stock until the order is handed over or cancelled.", "القبول يحجز القطع في مخزونك حتى يتم التسليم أو الإلغاء.")}</Note> : null}
          <View style={{ gap: 8 }}>
            <ManageEntry icon="chatbubbles-outline" title={t("Chat with the customer", "محادثة الزبون")} sub={o.unread ? t(`${o.unread} new messages`, `${o.unread} رسائل جديدة`) : t("Agree on the time and place", "اتفق على الوقت والمكان")}
              onPress={() => router.push({ pathname: "/provider/parts/orders/chat/[id]", params: { id: o.id } })} />
            {o.fulfilment === "DELIVERY" ? <ManageEntry icon="map-outline" title={t("Delivery map", "خريطة التوصيل")} sub={o.status === "OUT_FOR_DELIVERY" ? t("Shares your location while open", "يشارك موقعك أثناء فتحها") : t("Route to the customer", "الطريق إلى الزبون")}
              onPress={() => router.push({ pathname: "/provider/parts/orders/map/[id]", params: { id: o.id } })} /> : null}
          </View>
          <Block title={L.fulfilment[o.fulfilment]}>
            <Facts rows={[[t("Customer", "الزبون"), o.customer.firstName], [t("Area", "المنطقة"), o.delivery?.area ? cityLabel(o.delivery.area, isArabic) : null], [t("Note", "ملاحظة"), o.delivery?.note], [t("Payment", "الدفع"), L.payment[o.payment]]]} />
          </Block>
          <Block title={t("Status", "الحالة")}><View style={{ paddingVertical: 10 }}><OrderTimeline o={o} /></View></Block>
          <View style={{ gap: 8 }}><MoneyCard o={o} /></View>
        </>
      )}</Loaded>
    </Page>
  );
}
