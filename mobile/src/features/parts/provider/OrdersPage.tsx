// The shop's orders = List (docs/guide/10-ui-system.md): search, ONE chip row New · Active · Done (real counts from the server),
// compact rows (customer, items, total, time), unread chat first, ⋮ = the next steps. Refreshed every 15 s while open.
// Delivery settings sit in the header ⋮.
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { FilterChips, ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { cityLabel } from "../../../core/constants/cities";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Bucket, ORDER_REFRESH_MS, shopOrders } from "../../orders/ordersService";
import { orderTone, useOrderLabels } from "../../orders/orderBits";
import { useInTabs } from "../../providerhub/inTabs";
import { fmtDateTime } from "../../requests/requestBits";
import { shopOrderActions } from "./shopActions";

const BUCKETS: Bucket[] = ["new", "active", "done"];

export default function ShopOrdersList() {
  const { t, isArabic } = useL();
  const L = useOrderLabels();
  const tabRoot = useInTabs();
  const params = useLocalSearchParams<{ bucket?: string }>();
  const [q, setQ] = useState("");
  const [bucket, setBucket] = useState<Bucket>((BUCKETS as string[]).includes(params.bucket ?? "") ? (params.bucket as Bucket) : "new");
  const list = useLoad(() => shopOrders.list(bucket), [bucket], ORDER_REFRESH_MS);
  const c = list.data?.counts;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows = (list.data?.orders ?? [])
    .filter((o) => { const hay = `${o.customer.firstName} ${o.id} ${o.items.map((i) => i.name).join(" ")}`.toLowerCase(); return words.every((w) => hay.includes(w)); })
    .sort((a, b) => Number(b.unread > 0) - Number(a.unread > 0) || b.updatedAt.localeCompare(a.updatedAt));
  return (
    <ManagePage title={t("Orders", "الطلبات")} back={!tabRoot} tabBar={tabRoot}
      line={c ? t(`${c.new} new · ${c.active} in progress`, `${c.new} جديدة · ${c.active} قيد التنفيذ`) : undefined}
      actions={[{ key: "delivery", label: t("Delivery settings", "إعدادات التوصيل"), icon: "bicycle-outline", run: () => router.push("/provider/parts/delivery" as Href) }]}
      search={{ value: q, onChange: setQ, placeholder: t("Customer, product or order", "العميل أو المنتج أو الطلب") }}
      filters={<FilterChips value={bucket} onChange={setBucket} filters={[
        { key: "new", label: t("New", "جديدة"), count: c?.new }, { key: "active", label: t("Active", "نشطة"), count: c?.active }, { key: "done", label: t("Done", "منتهية"), count: c?.done },
      ]} />}
      items={rows} keyOf={(o) => o.id}
      renderItem={(o) => <ManageRow
        title={[o.customer.firstName, o.delivery?.area ? cityLabel(o.delivery.area, isArabic) : null].filter(Boolean).join(" · ")}
        sub={[o.unread ? t(`${o.unread} new messages`, `${o.unread} رسائل جديدة`) : null, `${o.items.reduce((n, i) => n + i.quantity, 0)} ${t("items", "قطع")}`, formatPrice(o.total), L.fulfilment[o.fulfilment], fmtDateTime(o.updatedAt)].filter(Boolean).join(" · ")}
        status={{ label: L.status[o.status], tone: orderTone(o.status) }}
        onPress={() => router.push({ pathname: "/provider/parts/orders/[id]", params: { id: o.id } })}
        actions={shopOrderActions(t, o, (s) => L.status[s], list.reload)} />}
      loading={!list.data && !list.error} error={list.error} onRetry={() => void list.reload()}
      empty={{ text: q ? t("No order matches.", "لا يوجد طلب مطابق.") : bucket === "new" ? t("No new orders.", "لا توجد طلبات جديدة.") : bucket === "active" ? t("No orders in progress.", "لا توجد طلبات قيد التنفيذ.") : t("No finished orders yet.", "لا توجد طلبات منتهية بعد."), action: q ? { label: t("Clear search", "مسح البحث"), onPress: () => setQ("") } : undefined }}
      onRefresh={() => void list.reload()} refreshing={false} detailHint={t("Tap an order to open it.", "اضغط على طلب لفتحه.")} />
  );
}
