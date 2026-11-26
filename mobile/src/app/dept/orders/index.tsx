import { router } from "expo-router";
import { useState } from "react";
import { FilterChips, ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { type OrderStatus, adminOrders } from "../../../features/orders/ordersService";
import { orderTone, useOrderLabels } from "../../../features/orders/orderBits";
import { fmtDateTime } from "../../../features/requests/requestBits";

/** one chip row (max ~5): the order statuses grouped by what they mean for the admin */
const GROUPS: { key: string; en: string; ar: string; of: OrderStatus[] | null }[] = [
  { key: "ALL", en: "All", ar: "الكل", of: null },
  { key: "NEW", en: "New", ar: "جديدة", of: ["PLACED"] },
  { key: "ACTIVE", en: "In progress", ar: "قيد التنفيذ", of: ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "PICKED_UP"] },
  { key: "DONE", en: "Delivered", ar: "تم التسليم", of: ["DELIVERED"] },
  { key: "STOPPED", en: "Cancelled", ar: "ملغاة", of: ["CANCELLED", "REJECTED"] },
];
const OPEN: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "PICKED_UP"];

/** Parts admins: every order (read only), what is still moving first; the active-deliveries map is in ⋮. */
export default function AdminOrdersList() {
  const { t } = useL();
  const L = useOrderLabels();
  const [group, setGroup] = useState("ALL"), [q, setQ] = useState("");
  const state = useLoad(() => adminOrders.list(undefined), [], 15000);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = (state.data ?? []).filter(o => { const hay = `${o.shop.name} ${o.customer.firstName}`.toLowerCase(); return words.every(w => hay.includes(w)); });
  const g = GROUPS.find(x => x.key === group)!;
  const rows = matching.filter(o => !g.of || g.of.includes(o.status))
    .sort((a, b) => Number(OPEN.includes(b.status)) - Number(OPEN.includes(a.status)) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const moving = (state.data ?? []).filter(o => OPEN.includes(o.status)).length;
  return (
    <ManagePage title={t("Parts orders", "طلبات القطع")} line={state.data ? t(`${state.data.length} orders · ${moving} in progress`, `${state.data.length} طلب · ${moving} قيد التنفيذ`) : undefined}
      actions={[{ key: "map", label: t("Active deliveries", "التوصيلات الجارية"), icon: "map-outline", run: () => router.push("/dept/orders/map") }]}
      search={{ value: q, onChange: setQ, placeholder: t("Search shop or customer", "ابحث عن متجر أو عميل") }}
      filters={<FilterChips value={group} onChange={setGroup} filters={GROUPS.map(x => ({ key: x.key, label: t(x.en, x.ar), count: state.data ? matching.filter(o => !x.of || x.of.includes(o.status)).length : undefined }))} />}
      items={rows} keyOf={o => o.id}
      renderItem={o => <ManageRow title={`${o.shop.name} · ${formatPrice(o.total)}`} status={{ label: L.status[o.status], tone: orderTone(o.status) }}
        sub={[o.customer.firstName, `${o.items.reduce((n, i) => n + i.quantity, 0)} ${t("items", "قطع")}`, L.fulfilment[o.fulfilment], fmtDateTime(o.updatedAt)].join(" · ")}
        onPress={() => router.push({ pathname: "/dept/orders/[id]", params: { id: o.id } })} />}
      loading={!state.data && !state.error} error={state.error} onRetry={() => void state.reload()}
      empty={{ text: q || group !== "ALL" ? t("No orders here.", "لا توجد طلبات هنا.") : t("No orders yet.", "لا توجد طلبات بعد."), action: q || group !== "ALL" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setGroup("ALL"); } } : undefined }}
      onRefresh={() => void state.reload()} refreshing={state.loading && !!state.data}
      detailHint={t("Tap an order to see it.", "اضغط على طلب لعرضه.")} />
  );
}
