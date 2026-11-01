import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Card, ErrorState, GarageHero, GaragePage, GText, ListRow, Note, Section, SkeletonBlock, StatusChip } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { adminOrders } from "../../../features/orders/ordersService";
import { MoneyCard, OrderMap, OrderTimeline, orderTone, useOrderLabels } from "../../../features/orders/orderBits";
import { bi } from "../../../features/provider/labels";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

/** One order, read only for parts admins: timeline, shop, customer first name + area, money, the map and the chat transcript. */
export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { g, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const L = useOrderLabels();
  const state = useLoad(() => adminOrders.get(id), [id], 15000);
  const o = state.data?.order ?? null;
  const delivery = o?.delivery?.lat != null && o.delivery.lng != null ? { lat: o.delivery.lat, lng: o.delivery.lng } : null;
  const shop = o?.shop.lat != null && o.shop.lng != null ? { lat: o.shop.lat, lng: o.shop.lng } : null;

  return (
    <GaragePage
      onRefresh={state.reload}
      hero={
        <GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept/orders" as never))} title={o ? o.shop.name : t("Order", "الطلب")} line={o ? `${o.customer.firstName} · ${o.id.slice(0, 8).toUpperCase()}` : undefined}>
          {o ? <StatusChip tone={orderTone(o.status)} label={L.status[o.status]} /> : null}
        </GarageHero>
      }
    >
      {state.error && !o ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!o && !state.error ? <SkeletonBlock height={220} radius={gShape.card} /> : null}
      {o ? (
        <>
          <Note icon="eye-outline">{t("Read only. Only the shop moves its orders; the customer can cancel before it is accepted.", "للقراءة فقط. المتجر وحده يغيّر حالة طلباته؛ والزبون يمكنه الإلغاء قبل القبول.")}</Note>
          <Section title={t("Status", "الحالة")}>
            <Card>
              <OrderTimeline o={o} />
            </Card>
          </Section>
          <Section title={L.fulfilment[o.fulfilment]}>
            <Card pad={12}>
              <ListRow icon="storefront-outline" title={o.shop.name} sub={cityLabel(o.shop.city, isArabic)} />
              <ListRow divider icon="person-outline" title={o.customer.firstName} sub={o.delivery?.area ? cityLabel(o.delivery.area, isArabic) : undefined} />
              <ListRow divider icon="cash-outline" title={L.payment[o.payment]} />
            </Card>
          </Section>
          {o.fulfilment === "DELIVERY" ? (
            <Section title={t("Map", "الخريطة")}>
              <OrderMap orderId={o.id} height={260} delivery={delivery} shop={shop} courier={o.live ? { lat: o.live.lat, lng: o.live.lng } : null} />
            </Section>
          ) : null}
          <Section title={t("Items", "القطع")}>
            <MoneyCard o={o} />
          </Section>
          <Section title={t("Order chat", "محادثة الطلب")}>
            <Card>
              {state.data!.messages.map((m, i) => (
                <View key={m.id} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: g.line }}>
                  <View style={[row, { justifyContent: "space-between", gap: 8 }]}>
                    <GText style={[gType.caption, { fontWeight: "800", color: m.from === "SYSTEM" ? g.soft : g.ink }]}>{m.from === "SYSTEM" ? "MOTEXA" : m.from === "PROVIDER" ? t("Shop", "المتجر") : t("Customer", "الزبون")}</GText>
                    <GText soft style={[gType.tiny, { writingDirection: "ltr" }]}>{fmtDateTime(m.at)}</GText>
                  </View>
                  <GText style={[gType.bodySm, align]}>{bi(isArabic, m.body)}</GText>
                </View>
              ))}
            </Card>
          </Section>
        </>
      ) : null}
    </GaragePage>
  );
}
