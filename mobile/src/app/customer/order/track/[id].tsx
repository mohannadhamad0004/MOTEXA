import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { useWindowDimensions } from "react-native";
import { ErrorState, GarageHero, GaragePage, Note, SkeletonBlock, StatusChip } from "../../../../components/garage";
import { useL } from "../../../../core/hooks/useL";
import { CustomerOrder, TRACK_REFRESH_MS, customerOrders } from "../../../../features/orders/ordersService";
import { OrderMap, orderTone, useOrderLabels } from "../../../../features/orders/orderBits";
import { gShape } from "../../../../theme/garage";

/**
 * Delivery tracking on our map: your pin, the shop, and, while the order is out for delivery and the owner's delivery screen is
 * open, his live point with the road route + distance / time. Refreshed every 10 s while this screen is open.
 */
export default function CustomerOrderTrack() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useL();
  const L = useOrderLabels();
  const { height } = useWindowDimensions();
  const [o, setO] = useState<CustomerOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      const h = setInterval(load, TRACK_REFRESH_MS);
      return () => clearInterval(h);
    }, [load])
  );
  const back = () => (router.canGoBack() ? router.back() : router.navigate({ pathname: "/customer/order/[id]", params: { id } }));
  const delivery = o?.delivery?.lat != null && o.delivery.lng != null ? { lat: o.delivery.lat, lng: o.delivery.lng } : null;
  const shop = o?.shop.lat != null && o.shop.lng != null ? { lat: o.shop.lat, lng: o.shop.lng } : null;

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero variant="detail" onBack={back} title={t("Track the delivery", "تتبع التوصيل")} line={o ? o.shop.name : undefined}>
          {o ? <StatusChip tone={orderTone(o.status)} label={L.status[o.status]} /> : null}
        </GarageHero>
      }
    >
      {error && !o ? <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!o && !error ? <SkeletonBlock height={Math.round(height * 0.55)} radius={gShape.card} /> : null}
      {o ? (
        <>
          {o.status === "OUT_FOR_DELIVERY" && !o.live ? (
            <Note icon="time-outline">{t("Waiting for the shop owner's live location. It appears while his delivery screen is open.", "بانتظار موقع صاحب المتجر المباشر. يظهر أثناء فتح شاشة التوصيل لديه.")}</Note>
          ) : null}
          {o.status !== "OUT_FOR_DELIVERY" ? <Note>{t("Live tracking starts when the order is out for delivery.", "يبدأ التتبع المباشر عندما يخرج الطلب للتوصيل.")}</Note> : null}
          <OrderMap orderId={o.id} height={Math.round(height * 0.55)} delivery={delivery} shop={shop} courier={o.live ? { lat: o.live.lat, lng: o.live.lng } : null} />
        </>
      ) : null}
    </GaragePage>
  );
}
