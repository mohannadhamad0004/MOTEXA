import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Chip, EmptyState, ErrorState, GarageHero, GaragePage, GIcon, GText, IconButton, Rail, SkeletonRows, StatusChip, Tap } from "../../../components/garage";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { OrderStatus, adminOrders } from "../../../features/orders/ordersService";
import { orderTone, useOrderLabels } from "../../../features/orders/orderBits";
import { fmtDateTime } from "../../../features/requests/requestBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const FILTERS: (OrderStatus | null)[] = [null, "PLACED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "PICKED_UP", "DELIVERED", "CANCELLED", "REJECTED"];

/** Parts admins: every order (read only) with status, shop and time; filter by status; the active-deliveries map. */
export default function AdminOrdersList() {
  const { g, shadow, row, align } = useGarageTheme();
  const { t } = useL();
  const L = useOrderLabels();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const state = useLoad(() => adminOrders.list(status ?? undefined), [status], 15000);

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={
        <GarageHero variant="detail" onBack={() => (router.canGoBack() ? router.back() : router.navigate("/dept"))} title={t("Parts orders", "طلبات القطع")} line={state.data ? `${state.data.length} ${t("orders", "طلبات")}` : undefined}>
          <View style={[row, { marginTop: 4 }]}>
            <IconButton icon="map-outline" label={t("Active deliveries", "التوصيلات الجارية")} onPress={() => router.push("/dept/orders/map")} />
          </View>
        </GarageHero>
      }
    >
      <Rail gap={8}>
        {FILTERS.map((s) => (
          <Chip key={s ?? "all"} label={s ? L.status[s] : t("All", "الكل")} on={status === s} onPress={() => setStatus(s)} />
        ))}
      </Rail>
      <View style={{ marginTop: 16, gap: 12 }}>
        {state.loading && !state.data ? (
          <SkeletonRows count={4} />
        ) : state.error && !state.data ? (
          <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !state.data?.length ? (
          <EmptyState photo="empty.requests" text={t("No orders.", "لا توجد طلبات.")} />
        ) : (
          state.data.map((o) => (
            <Tap key={o.id} label={`${o.shop.name}, ${L.status[o.status]}`} onPress={() => router.push({ pathname: "/dept/orders/[id]", params: { id: o.id } })} style={[{ padding: 14, borderRadius: gShape.card, backgroundColor: g.card, gap: 6 }, shadow(1)]}>
              <View style={[row, { alignItems: "center", gap: 8 }]}>
                <GIcon name={o.fulfilment === "DELIVERY" ? "bicycle-outline" : "storefront-outline"} size={18} />
                <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", flex: 1 }, align]}>{o.shop.name}</GText>
                <GText style={[gType.label, { fontWeight: "800", writingDirection: "ltr" }]}>{formatPrice(o.total)}</GText>
              </View>
              <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${o.customer.firstName} · ${o.items.reduce((n, i) => n + i.quantity, 0)} ${t("items", "قطع")} · ${L.fulfilment[o.fulfilment]}`}</GText>
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
