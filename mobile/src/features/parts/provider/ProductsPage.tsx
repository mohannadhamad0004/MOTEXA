import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, EmptyState, ErrorState, GButton, GText, Note, SkeletonRows, StatusChip } from "../../../components/garage";
import { ItemRow } from "../../../components/ItemActionsMenu";
import { shopProductActions } from "./shopActions";
import { SearchBar } from "../../../components/ui/Input";
import { ProviderLayout } from "../../../components/layout/ProviderLayout";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { asActor, useSessionUser } from "../../../core/session/session";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";
import { partsShopService } from "../partsService";

type Filter = "" | "low" | "out" | "photo";
const SERVER: Record<Filter, string> = { "": "", low: "low", out: "out", photo: "" };

/**
 * The shop's products as one list: search, All / Low stock / Sold out (plus No photo, reached from Home), one card per product
 * with its photo, price, stock and whether customers can see it. One main action: Add product.
 * `mode` keeps the old Inventory / Fitment routes working: they are the same list.
 */
export default function ProductsPage(_props: { mode?: "products" | "inventory" | "fitment" }) {
  const { t } = useL();
  const user = useSessionUser();
  const { row, align } = useGarageTheme();
  const params = useLocalSearchParams<{ filter?: string }>();
  const [filter, setFilter] = useState<Filter>(((["low", "out", "photo"] as string[]).includes(params.filter ?? "") ? params.filter : "") as Filter);
  useEffect(() => {
    if (params.filter && (["low", "out", "photo"] as string[]).includes(params.filter)) setFilter(params.filter as Filter);
  }, [params.filter]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const state = useLoad(() => partsShopService.getMyInventory(asActor(user), { page, q, stock: SERVER[filter] }), [user.id, page, q, filter]);
  const set = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };
  const shown = (state.data?.products ?? []).filter((p) => filter !== "photo" || !p.imageUri);
  const chips: [Filter, string][] = [["", t("All", "الكل")], ["low", t("Low stock", "مخزون منخفض")], ["out", t("Sold out", "نفدت")], ["photo", t("No photo", "بلا صورة")]];

  return (
    <ProviderLayout area="parts" title={t("Products", "المنتجات")} onRefresh={state.reload} refreshing={state.loading && !!state.data}>
      <GButton icon="add" label={t("Add product", "إضافة منتج")} onPress={() => router.push("/provider/parts/new" as Href)} />
      <View style={{ height: 12 }} />
      <SearchBar value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder={t("Name, brand or part number", "الاسم أو العلامة أو رقم القطعة")} />
      <View style={[row, { flexWrap: "wrap", gap: 8, marginVertical: 12 }]}>
        {chips.map(([k, label]) => <Chip key={k || "all"} label={label} on={filter === k} onPress={() => set(k)} />)}
      </View>
      {state.error && !state.data ? <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} /> : null}
      {!state.data && !state.error ? <SkeletonRows count={4} /> : null}
      {state.data && !shown.length ? <EmptyState photo="empty.search" text={t("No matching products. Add a product or change the filter.", "لا توجد منتجات مطابقة. أضف منتجًا أو غيّر الفلتر.")} /> : null}
      <View style={{ gap: 10 }}>
        {shown.map((p) => {
          const free = Math.max(0, p.stock - (p.reservedStock ?? 0));
          return (
            <ItemRow key={p.id} title={p.name} subtitle={p.partNumber} onPress={() => router.push(`/provider/parts/${p.id}` as Href)} actions={shopProductActions(t, p, state.reload)}>
              <View style={[row, { alignItems: "center", gap: 12 }]}>
                {p.imageUri ? <Image source={{ uri: p.imageUri }} style={{ width: 64, height: 64, borderRadius: gShape.small }} contentFit="cover" /> : <View style={{ width: 64, height: 64, borderRadius: gShape.small, backgroundColor: "rgba(128,128,128,0.2)" }} />}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <GText numberOfLines={2} style={[gType.label, { fontWeight: "800" }, align]}>{p.name}</GText>
                  <GText soft numberOfLines={1} style={[gType.caption, align]}>{[p.brand, p.partNumber].filter(Boolean).join(" · ")}</GText>
                  <GText style={[gType.caption, { fontWeight: "700" }, align]}>{formatPrice(p.price)}</GText>
                </View>
              </View>
              <View style={[row, { flexWrap: "wrap", gap: 6, marginTop: 8 }]}>
                <StatusChip tone={free === 0 ? "danger" : free <= 3 ? "warning" : "success"} label={free === 0 ? t("Sold out", "نفدت") : t(`${free} in stock`, `${free} متوفر`)} />
                <StatusChip tone={p.customerVisible ? "success" : "neutral"} label={p.customerVisible ? t("Visible", "ظاهر") : p.hidden ? t("Hidden by MOTEXA", "مخفي بواسطة موتكسا") : !p.imageUri ? t("Needs a photo", "يحتاج صورة") : t("Not visible", "غير ظاهر")} />
              </View>
            </ItemRow>
          );
        })}
      </View>
      {state.data && (page > 1 || state.data.hasMore) ? (
        <View style={[row, { gap: 10, marginTop: 12 }]}>
          <GButton flex variant="secondary" label={t("Previous", "السابق")} disabled={page === 1} onPress={() => setPage((v) => v - 1)} />
          <GButton flex variant="secondary" label={t("Next", "التالي")} disabled={!state.data.hasMore} onPress={() => setPage((v) => v + 1)} />
        </View>
      ) : null}
      {filter === "photo" ? <Note icon="information-circle-outline">{t("Shows the products on this page that have no photo.", "يعرض منتجات هذه الصفحة التي بلا صورة.")}</Note> : null}
    </ProviderLayout>
  );
}
