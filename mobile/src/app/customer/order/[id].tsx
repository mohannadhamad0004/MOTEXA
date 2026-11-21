import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Badge, Card, ErrorState, Field, GarageHero, GaragePage, GButton, GText, ListRow, Note, Section, SkeletonBlock, StatusChip } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { CustomerOrder, ORDER_REFRESH_MS, customerOrders } from "../../../features/orders/ordersService";
import { MoneyCard, OrderTimeline, orderTone, useOrderLabels } from "../../../features/orders/orderBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const shortId = (id: string) => id.slice(0, 8).toUpperCase();

/** One order: status + timeline (refreshed every 15 s while open), how it is handed over, payment, money, chat, track, cancel. */
export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const L = useOrderLabels();
  const [o, setO] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/customer/requests"));

  const load = useCallback(async () => {
    try {
      setO(await customerOrders.get(id));
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
  const cancel = async () => {
    setBusy(true);
    try {
      setO(await customerOrders.cancel(id, reason.trim() || undefined));
      setConfirm(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="detail" onBack={back} title={t("Your order", "طلبك")} line={o ? `${(isArabic && o.shop.nameAr) || o.shop.name} · ${shortId(o.id)}` : shortId(id)}>
          {o ? <StatusChip tone={orderTone(o.status)} label={L.status[o.status]} /> : null}
        </GarageHero>
      }
    >
      {error && !o ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!o && !error ? <SkeletonBlock height={220} radius={gShape.card} /> : null}
      {o ? (
        <>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          {o.status === "OUT_FOR_DELIVERY" ? (
            <GButton icon="navigate" label={t("Track the delivery", "تتبع التوصيل")} onPress={() => router.push({ pathname: "/customer/order/track/[id]", params: { id: o.id } })} style={{ marginBottom: 12 }} />
          ) : null}

          <Card>
            <OrderTimeline o={o} />
          </Card>

          <Card style={{ marginTop: 12 }} pad={12}>
            <ListRow icon="chatbubbles-outline" title={t("Chat with the shop", "محادثة المتجر")} sub={t("Agree on the time and place", "اتفق على الوقت والمكان")} end={o.unread ? <Badge label={String(o.unread)} /> : undefined} onPress={() => router.push({ pathname: "/customer/order/chat/[id]", params: { id: o.id } })} />
          </Card>

          <Section title={L.fulfilment[o.fulfilment]}>
            <Card pad={12}>
              {o.fulfilment === "PICKUP" ? (
                <>
                  <ListRow icon="storefront-outline" title={(isArabic && o.shop.nameAr) || o.shop.name} sub={[cityLabel(o.shop.city, isArabic), o.shop.address].filter(Boolean).join(" · ")} />
                  {o.shop.hours ? <ListRow divider icon="time-outline" title={t("Opening hours", "ساعات العمل")} sub={o.shop.hours} /> : null}
                  {o.shop.lat !== null ? <ListRow divider icon="map-outline" title={t("View on map", "عرض على الخريطة")} onPress={() => router.push({ pathname: "/customer/parts/map", params: { focus: o.shop.id } })} /> : null}
                </>
              ) : (
                <>
                  <ListRow icon="location-outline" title={o.delivery?.area ? cityLabel(o.delivery.area, isArabic) : t("Your pin on the map", "دبوسك على الخريطة")} sub={o.delivery?.note ?? undefined} />
                  {o.delivery?.lat != null ? <ListRow divider icon="map-outline" title={t("View on map", "عرض على الخريطة")} onPress={() => router.push({ pathname: "/customer/order/track/[id]", params: { id: o.id } })} /> : null}
                </>
              )}
              <ListRow divider icon="cash-outline" title={L.payment[o.payment]} />
            </Card>
          </Section>

          <Section title={t("Items", "القطع")}>
            <MoneyCard o={o} />
          </Section>

          {o.canCancel ? (
            <View style={{ marginTop: 20, gap: 10 }}>
              {confirm ? (
                <Card>
                  <GText style={[gType.label, align]}>{t("Cancel this order?", "هل تريد إلغاء هذا الطلب؟")}</GText>
                  <View style={{ marginTop: 10 }}>
                    <Field label={t("Reason (optional)", "السبب (اختياري)")} value={reason} onChangeText={setReason} maxLength={300} />
                  </View>
                  <View style={[row, { gap: 10 }]}>
                    <GButton flex variant="secondary" label={t("Keep it", "إبقاؤه")} onPress={() => setConfirm(false)} />
                    <GButton flex variant="danger" label={t("Yes, cancel", "نعم، ألغِ")} busy={busy} onPress={() => void cancel()} />
                  </View>
                </Card>
              ) : (
                <GButton variant="danger" label={t("Cancel order", "إلغاء الطلب")} onPress={() => setConfirm(true)} />
              )}
              <GText soft style={[gType.caption, align]}>{t("You can cancel until the shop accepts.", "يمكنك الإلغاء حتى يقبل المتجر.")}</GText>
            </View>
          ) : null}
        </>
      ) : null}
    </GaragePage>
  );
}
