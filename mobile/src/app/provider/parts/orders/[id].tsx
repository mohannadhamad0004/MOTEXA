import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Badge, Card, ErrorState, Field, GarageHero,  GButton, ListRow, Note, Section, SkeletonBlock, StatusChip } from "../../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../../components/layout/ProviderLayout";
import { cityLabel } from "../../../../core/constants/cities";
import { useL } from "../../../../core/hooks/useL";
import { ORDER_REFRESH_MS, OrderStatus, ShopOrder, shopOrders } from "../../../../features/orders/ordersService";
import { MoneyCard, OrderTimeline, orderTone, useOrderLabels } from "../../../../features/orders/orderBits";
import { gShape, useGarageTheme } from "../../../../theme/garage";

/**
 * One order, shop side: the customer's first name + area only (no phone: they share it in the chat if they want), how it is
 * handed over, payment, money, the timeline and the next steps the server allows. Reject / Cancel need a reason.
 */
export default function ShopOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { row } = useGarageTheme();
  const { t, isArabic } = useL();
  const L = useOrderLabels();
  const [o, setO] = useState<ShopOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [stop, setStop] = useState<"REJECTED" | "CANCELLED" | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    try {
      setO(await shopOrders.get(id));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, ORDER_REFRESH_MS);
      return () => clearInterval(h);
    }, [load])
  );
  const move = async (to: OrderStatus, why?: string) => {
    setBusy(to);
    setError(null);
    try {
      setO(await shopOrders.move(id, to, why));
      setStop(null);
      setReason("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  // the forward steps (Accept, Preparing, Ready / Out for delivery, Picked up / Delivered); Reject / Cancel separately
  const forward = (o?.next ?? []).filter((s) => s !== "REJECTED" && s !== "CANCELLED");
  const stopKind = o?.next.includes("REJECTED") ? "REJECTED" : o?.next.includes("CANCELLED") ? "CANCELLED" : null;
  const stepLabel: Partial<Record<OrderStatus, string>> = {
    ACCEPTED: t("Accept", "قبول"),
    PREPARING: t("Start preparing", "بدء التجهيز"),
    READY_FOR_PICKUP: t("Ready for pickup", "جاهز للاستلام"),
    OUT_FOR_DELIVERY: t("Out for delivery", "خرج للتوصيل"),
    PICKED_UP: t("Picked up", "تم الاستلام"),
    DELIVERED: t("Delivered", "تم التوصيل"),
  };

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/parts/orders"))} title={o ? o.customer.firstName : t("Order", "الطلب")} line={o ? `${L.fulfilment[o.fulfilment]} · ${o.id.slice(0, 8).toUpperCase()}` : undefined}>
          {o ? <StatusChip tone={orderTone(o.status)} label={L.status[o.status]} /> : null}
        </GarageHero>
      }
    >
      {error && !o ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!o && !error ? <SkeletonBlock height={220} radius={gShape.card} /> : null}
      {o ? (
        <>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          {forward.length ? (
            <View style={{ gap: 10, marginBottom: 12 }}>
              {forward.map((s, i) => (
                <GButton key={s} variant={i === 0 ? "primary" : "secondary"} label={stepLabel[s] ?? L.status[s]} busy={busy === s} disabled={!!busy} onPress={() => void move(s)} />
              ))}
            </View>
          ) : null}
          {o.status === "PLACED" ? <Note>{t("Accepting reserves the parts in your stock until the order is handed over or cancelled.", "القبول يحجز القطع في مخزونك حتى يتم التسليم أو الإلغاء.")}</Note> : null}

          <Card pad={12} style={{ marginTop: 4 }}>
            <ListRow icon="chatbubbles-outline" title={t("Chat with the customer", "محادثة الزبون")} sub={t("Agree on the time and place", "اتفق على الوقت والمكان")} end={o.unread ? <Badge label={String(o.unread)} /> : undefined} onPress={() => router.push({ pathname: "/provider/parts/orders/chat/[id]", params: { id: o.id } })} />
            {o.fulfilment === "DELIVERY" ? (
              <ListRow divider icon="map-outline" title={t("Delivery map", "خريطة التوصيل")} sub={o.status === "OUT_FOR_DELIVERY" ? t("Shares your location while open", "يشارك موقعك أثناء فتحها") : t("Route to the customer", "الطريق إلى الزبون")} onPress={() => router.push({ pathname: "/provider/parts/orders/map/[id]", params: { id: o.id } })} />
            ) : null}
          </Card>

          <Section title={t("Status", "الحالة")}>
            <Card>
              <OrderTimeline o={o} />
            </Card>
          </Section>

          <Section title={L.fulfilment[o.fulfilment]}>
            <Card pad={12}>
              <ListRow icon="person-outline" title={o.customer.firstName} sub={o.delivery?.area ? cityLabel(o.delivery.area, isArabic) : undefined} />
              {o.delivery?.note ? <ListRow divider icon="document-text-outline" title={t("Note", "ملاحظة")} sub={o.delivery.note} /> : null}
              <ListRow divider icon="cash-outline" title={L.payment[o.payment]} />
            </Card>
          </Section>

          <Section title={t("Items", "القطع")}>
            <MoneyCard o={o} />
          </Section>

          {stopKind ? (
            <View style={{ marginTop: 20 }}>
              {stop ? (
                <Card>
                  <Field label={stop === "REJECTED" ? t("Why do you reject it? (the customer sees this)", "لماذا ترفضه؟ (يراه الزبون)") : t("Why do you cancel it? (the customer sees this)", "لماذا تلغيه؟ (يراه الزبون)")} value={reason} onChangeText={setReason} maxLength={300} multiline />
                  <View style={[row, { gap: 10 }]}>
                    <GButton flex variant="secondary" label={t("Back", "رجوع")} onPress={() => setStop(null)} />
                    <GButton flex variant="danger" label={stop === "REJECTED" ? t("Reject", "رفض") : t("Cancel order", "إلغاء الطلب")} disabled={!reason.trim()} busy={busy === stop} onPress={() => void move(stop, reason.trim())} />
                  </View>
                </Card>
              ) : (
                <GButton variant="danger" label={stopKind === "REJECTED" ? t("Reject order", "رفض الطلب") : t("Cancel order", "إلغاء الطلب")} onPress={() => setStop(stopKind)} />
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </GaragePage>
  );
}
