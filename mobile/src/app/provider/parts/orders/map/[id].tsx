import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { ErrorState, GarageHero, GaragePage, GButton, Note, SkeletonBlock, StatusChip } from "../../../../../components/garage";
import { useL } from "../../../../../core/hooks/useL";
import { ORDER_REFRESH_MS, OrderStatus, ShopOrder, shopOrders } from "../../../../../features/orders/ordersService";
import { OrderMap, orderTone, useOrderLabels, useShareLocation } from "../../../../../features/orders/orderBits";
import { gShape } from "../../../../../theme/garage";

/**
 * The owner's delivery map: the customer's pin and the road route from where he is (or from the shop before he leaves), distance
 * + time and the status buttons. While the order is OUT_FOR_DELIVERY and this screen is open, his location is sent every ~10 s
 * (foreground only) so the customer can follow; it stops when the order is delivered or the screen closes.
 */
export default function ShopDeliveryMap() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useOrderLabels();
  const { height } = useWindowDimensions();
  const [o, setO] = useState<ShopOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OrderStatus | null>(null);
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
  const sharing = o?.status === "OUT_FOR_DELIVERY";
  const { me, meFresh, problem, canOpenSettings, openSettings } = useShareLocation(id, sharing, (p) => shopOrders.ping(id, p));
  const move = async (to: OrderStatus) => {
    setBusy(to);
    try {
      setO(await shopOrders.move(id, to));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  const delivery = o?.delivery?.lat != null && o.delivery.lng != null ? { lat: o.delivery.lat, lng: o.delivery.lng } : null;
  const steps = (o?.next ?? []).filter((s) => s === "OUT_FOR_DELIVERY" || s === "DELIVERED");

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate({ pathname: "/provider/parts/orders/[id]", params: { id } }))} title={t("Delivery map", "خريطة التوصيل")} line={o ? `${o.customer.firstName}${o.delivery?.note ? ` · ${o.delivery.note}` : ""}` : undefined}>
          {o ? <StatusChip tone={orderTone(o.status)} label={L.status[o.status]} /> : null}
        </GarageHero>
      }
    >
      {error && !o ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!o && !error ? <SkeletonBlock height={Math.round(height * 0.55)} radius={gShape.card} /> : null}
      {o ? (
        <View style={{ gap: 12 }}>
          {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
          {problem ? <Note tone="danger" icon="location-outline">{problem}</Note> : null}
          {problem && canOpenSettings ? <GButton variant="secondary" icon="settings-outline" label={t("Open Settings", "فتح الإعدادات")} onPress={() => void openSettings()} /> : null}
          {sharing && me ? <Note icon="radio-outline">{t("Sharing your location with the customer while this screen is open.", "تتم مشاركة موقعك مع الزبون أثناء فتح هذه الشاشة.")}</Note> : null}
          <OrderMap orderId={o.id} height={Math.round(height * 0.5)} delivery={delivery} shop={o.shopPoint} courier={null} me={me} meFresh={meFresh} />
          {steps.map((s) => (
            <GButton key={s} label={s === "OUT_FOR_DELIVERY" ? t("Leave now: out for delivery", "انطلق الآن: خرج للتوصيل") : t("Delivered, cash received", "تم التوصيل واستلام النقد")} busy={busy === s} disabled={!!busy} onPress={() => void move(s)} />
          ))}
        </View>
      ) : null}
    </GaragePage>
  );
}
