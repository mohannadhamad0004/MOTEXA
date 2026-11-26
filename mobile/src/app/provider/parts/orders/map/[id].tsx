// The owner's delivery map = Detail with the map as its body: the customer's pin and the road route from where he is (or from the
// shop before he leaves); the ONE primary is the next delivery step. While the order is OUT_FOR_DELIVERY and this screen is open, his
// location is sent every ~10 s (foreground only) so the customer can follow; it stops when delivered or when the screen closes.
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { GButton, Note, StatusChip } from "../../../../../components/garage";
import { Loaded, Page } from "../../../../../components/manage/Page";
import { useL } from "../../../../../core/hooks/useL";
import { useLoad } from "../../../../../core/hooks/useLoad";
import { ORDER_REFRESH_MS, OrderStatus, shopOrders } from "../../../../../features/orders/ordersService";
import { OrderMap, orderTone, useOrderLabels, useShareLocation } from "../../../../../features/orders/orderBits";

export default function ShopDeliveryMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useOrderLabels();
  const { height } = useWindowDimensions();
  const state = useLoad(() => shopOrders.get(id), [id], ORDER_REFRESH_MS);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const o = state.data;
  const sharing = o?.status === "OUT_FOR_DELIVERY";
  const { me, meFresh, problem, canOpenSettings, openSettings } = useShareLocation(id, sharing, (p) => shopOrders.ping(id, p));
  const move = async (to: OrderStatus) => {
    setBusy(true); setError(null);
    try { await shopOrders.move(id, to); await state.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const step = (o?.next ?? []).find((s) => s === "OUT_FOR_DELIVERY" || s === "DELIVERED");
  return (
    <Page title={t("Delivery map", "خريطة التوصيل")} line={o ? `${o.customer.firstName}${o.delivery?.note ? ` · ${o.delivery.note}` : ""}` : undefined}
      actions={problem && canOpenSettings ? [{ key: "settings", label: t("Open Settings", "فتح الإعدادات"), icon: "settings-outline", run: () => void openSettings() }] : undefined}
      footer={step ? <GButton icon="checkmark" label={step === "OUT_FOR_DELIVERY" ? t("Leave now: out for delivery", "انطلق الآن: خرج للتوصيل") : t("Delivered, cash received", "تم التوصيل واستلام النقد")} busy={busy} disabled={busy} onPress={() => void move(step)} /> : undefined}>
      <Loaded state={state}>{(o) => (
        <View style={{ gap: 12 }}>
          <View style={{ alignSelf: "flex-start" }}><StatusChip tone={orderTone(o.status)} label={L.status[o.status]} /></View>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          {problem ? <Note tone="danger" icon="location-outline">{problem}</Note> : null}
          {sharing && me ? <Note icon="radio-outline">{t("Sharing your location with the customer while this screen is open.", "تتم مشاركة موقعك مع الزبون أثناء فتح هذه الشاشة.")}</Note> : null}
          <OrderMap orderId={o.id} height={Math.round(height * 0.5)} delivery={o.delivery?.lat != null && o.delivery.lng != null ? { lat: o.delivery.lat, lng: o.delivery.lng } : null} shop={o.shopPoint} courier={null} me={me} meFresh={meFresh} />
        </View>
      )}</Loaded>
    </Page>
  );
}
