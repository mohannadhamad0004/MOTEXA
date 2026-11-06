import { SearchBar } from "../../../components/ui/Input";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { Badge, EmptyState, ErrorState, GarageHero,  GIcon, GText, SkeletonRows, StatusChip, Tabs, Tap } from "../../../components/garage";
import { ProviderLayout as GaragePage } from "../../../components/layout/ProviderLayout";
import { cityLabel } from "../../../core/constants/cities";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { Bucket, ORDER_REFRESH_MS, ShopOrder, shopOrders } from "../../../features/orders/ordersService";
import { orderTone, useOrderLabels } from "../../../features/orders/orderBits";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

/** The shop's orders: New / Active / Done with real counts and unread chat badges; refreshed every 15 s while open. */
export default function ShopOrdersList() {
  const { g, shadow, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const L = useOrderLabels();
  const [q,setQ]=useState("");
  const [bucket, setBucket] = useState<Bucket>("new");
  const [data, setData] = useState<{ orders: ShopOrder[]; counts: Record<Bucket, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await shopOrders.list(bucket));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, [bucket]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const h = setInterval(load, ORDER_REFRESH_MS);
      return () => clearInterval(h);
    }, [load])
  );

  return (
    <GaragePage
      onRefresh={load}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/provider/parts"))}
          title={t("Orders", "الطلبات")}
          line={data ? t(`${data.counts.new} new · ${data.counts.active} in progress`, `${data.counts.new} جديدة · ${data.counts.active} قيد التنفيذ`) : undefined}
          action={{ icon: "bicycle-outline", label: t("Delivery settings", "إعدادات التوصيل"), onPress: () => router.push("/provider/parts/delivery") }}
        />
      }
    >
      <SearchBar value={q} onChange={setQ} placeholder={t("Customer, product or order","?????? ?? ?????? ?? ?????")}/>
      <Tabs
        value={bucket}
        onChange={(k) => {
          setData(null);
          setBucket(k);
        }}
        options={[
          { key: "new", label: t("New", "جديدة"), count: data?.counts.new },
          { key: "active", label: t("Active", "نشطة"), count: data?.counts.active },
          { key: "done", label: t("Done", "منتهية"), count: data?.counts.done },
        ]}
      />
      <View style={{ marginTop: 16, gap: 12 }}>
        {!data && !error ? (
          <SkeletonRows count={4} />
        ) : error && !data ? (
          <ErrorState text={error} onRetry={load} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !data!.orders.length ? (
          <EmptyState photo="empty.requests" text={bucket === "new" ? t("No new orders.", "لا توجد طلبات جديدة.") : bucket === "active" ? t("No orders in progress.", "لا توجد طلبات قيد التنفيذ.") : t("No finished orders yet.", "لا توجد طلبات منتهية بعد.")} />
        ) : (
          data!.orders.filter(o=>!q.trim()||`${o.customer.firstName} ${o.id} ${o.items.map(i=>i.name).join(" ")}`.toLowerCase().includes(q.trim().toLowerCase())).map((o) => (
            <Tap key={o.id} label={`${o.customer.firstName}, ${L.status[o.status]}`} onPress={() => router.push({ pathname: "/provider/parts/orders/[id]", params: { id: o.id } })} style={[{ padding: 14, borderRadius: gShape.card, backgroundColor: g.card, gap: 6 }, shadow(1)]}>
              <View style={[row, { alignItems: "center", gap: 8 }]}>
                <GIcon name={o.fulfilment === "DELIVERY" ? "bicycle-outline" : "storefront-outline"} size={18} />
                <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>
                  {[o.customer.firstName, o.delivery?.area ? cityLabel(o.delivery.area, isArabic) : null].filter(Boolean).join(" · ")}
                </GText>
                {o.unread ? <Badge label={`${o.unread} ${t("new", "جديدة")}`} /> : null}
              </View>
              <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${o.items.reduce((n, i) => n + i.quantity, 0)} ${t("items", "قطع")} · ${formatPrice(o.total)} · ${L.fulfilment[o.fulfilment]}`}</GText>
              <View style={[row, { alignItems: "center", justifyContent: "space-between" }]}>
                <StatusChip tone={orderTone(o.status)} label={L.status[o.status]} />
                <GText soft style={[gType.tiny, { writingDirection: "ltr" }]}>{fmtDateTime(o.updatedAt)}</GText>
              </View>
            </Tap>
          ))
        )}
      </View>
    </GaragePage>
  );
}
