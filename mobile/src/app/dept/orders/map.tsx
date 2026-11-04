import { router } from "expo-router";
import { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Card, EmptyState, ErrorState, GarageHero, GaragePage, GIcon, GText, Note, SkeletonBlock, Tap } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { TRACK_REFRESH_MS, adminOrders } from "../../../features/orders/ordersService";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "../../../features/shared/maps";
import { RouteSummary, useRoute } from "../../../features/shared/useRoute";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

/**
 * Active deliveries (parts admins): every order OUT_FOR_DELIVERY on our map: the owner's live point (when his delivery screen is
 * open) and the customer's pin. Tap a delivery for its road route with distance + time. Refreshed every 10 s.
 */
export default function AdminActiveDeliveries() {
  const { g, shadow, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const { height } = useWindowDimensions();
  const state = useLoad(() => adminOrders.active(), [], TRACK_REFRESH_MS);
  const [sel, setSel] = useState<string | null>(null);
  const list = state.data ?? [];
  const chosen = list.find((o) => o.id === sel) ?? null;
  const dest = (o: (typeof list)[number]) => (o.delivery?.lat != null && o.delivery.lng != null ? { lat: o.delivery.lat, lng: o.delivery.lng } : null);
  const from = chosen ? (chosen.live ?? (chosen.shop.lat != null && chosen.shop.lng != null ? { lat: chosen.shop.lat, lng: chosen.shop.lng } : null)) : null;
  const { route, loading } = useRoute(chosen ? `admin:${chosen.id}` : null, from, chosen ? dest(chosen) : null, 50);

  const pins: ServicePin[] = list.flatMap((o) => [
    ...(o.live ? [{ id: `c:${o.id}`, name: o.shop.name, lat: o.live.lat, lng: o.live.lng, kind: "tow" as const, dim: false, color: "#B5541C" }] : []),
    ...(dest(o) ? [{ id: `d:${o.id}`, name: o.customer.firstName, lat: dest(o)!.lat, lng: dest(o)!.lng, kind: "hq" as const, dim: false }] : []),
  ]);
  const fit: [number, number][] = route?.coords ?? pins.map((p) => [p.lat, p.lng] as [number, number]);

  return (
    <GaragePage
      onRefresh={state.reload}
      hero={<GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept/orders" as never))} title={t("Active deliveries", "التوصيلات الجارية")} line={state.data ? `${list.length} ${t("out for delivery", "قيد التوصيل")}` : undefined} />}
    >
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonBlock height={Math.round(height * 0.45)} radius={gShape.card} /> : null}
      {state.data ? (
        list.length ? (
          <View style={{ gap: 12 }}>
            {MAPS_AVAILABLE ? (
              <View style={{ height: Math.round(height * 0.45), borderRadius: gShape.card, overflow: "hidden" }}>
                <ServiceMap
                  height={Math.round(height * 0.45)}
                  pins={pins}
                  selectedId={chosen ? (chosen.live ? `c:${chosen.id}` : `d:${chosen.id}`) : null}
                  me={null}
                  route={route ? { coords: route.coords, dashed: route.kind === "line", key: `admin:${chosen?.id}:${route.kind}` } : null}
                  fit={fit}
                  fitKey={`admin:${sel ?? "-"}:${route ? route.kind : "-"}:${list.length}`}
                  pad={{ top: 0, bottom: 0, left: 0, right: 0 }}
                  onSelect={(pid) => setSel(pid.slice(2))}
                  onBackground={() => setSel(null)}
                />
              </View>
            ) : (
              <Note>{t("The map is not available on this platform.", "الخريطة غير متاحة على هذه المنصة.")}</Note>
            )}
            {chosen ? <RouteSummary route={route} loading={loading} /> : null}
            {list.map((o) => (
              <Tap key={o.id} label={o.shop.name} onPress={() => setSel(o.id === sel ? null : o.id)} style={[{ padding: 12, borderRadius: gShape.card, backgroundColor: o.id === sel ? g.tint : g.card, gap: 4 }, shadow(1)]}>
                <View style={[row, { alignItems: "center", gap: 8 }]}>
                  <GIcon name="bicycle-outline" size={18} />
                  <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{o.shop.name}</GText>
                  <GText style={[gType.caption, { color: o.live ? g.success : g.soft, fontWeight: "700" }]}>{o.live ? t("Live", "مباشر") : t("No live point", "لا موقع مباشر")}</GText>
                </View>
                <GText soft style={[gType.caption, align]}>{`${o.customer.firstName}${o.delivery?.area ? ` · ${cityLabel(o.delivery.area, isArabic)}` : ""}`}</GText>
                <Tap label={t("Open order", "فتح الطلب")} onPress={() => router.push({ pathname: "/dept/orders/[id]", params: { id: o.id } })} style={[row, { minHeight: 44, alignItems: "center", gap: 4 }]}>
                  <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{t("Open order", "فتح الطلب")}</GText>
                  <GIcon name="chevron-forward" size={14} flip />
                </Tap>
              </Tap>
            ))}
          </View>
        ) : (
          <Card>
            <EmptyState photo="empty.requests" text={t("No delivery is in progress.", "لا يوجد توصيل جارٍ.")} />
          </Card>
        )
      ) : null}
    </GaragePage>
  );
}
