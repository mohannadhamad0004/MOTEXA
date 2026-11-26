// The shop's products = List (docs/guide/10-ui-system.md): search, ONE chip row (All · Sold out · Low stock · No photo, counts from the
// shop summary), compact rows with the photo, price, free stock and whether customers can see it; sold out first; ⋮ per row.
// "Add product" is an entry row above the list. The old Inventory / Fitment routes are this same list.
import { Image } from "expo-image";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../../components/manage/ManagePage";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { asActor, useSessionUser } from "../../../core/session/session";
import { gShape, useGarageTheme } from "../../../theme/garage";
import { portalApi } from "../../provider/portal/api";
import { useInTabs } from "../../providerhub/inTabs";
import { partsShopService, type Product } from "../partsService";
import { shopProductActions } from "./shopActions";

type Filter = "" | "low" | "out" | "photo";
const SERVER: Record<Filter, string> = { "": "", low: "low", out: "out", photo: "" };
const FILTERS: Filter[] = ["", "out", "low", "photo"];

function Thumb({ uri }: { uri?: string | null }) {
  const { g } = useGarageTheme();
  return uri ? <Image source={{ uri }} style={{ width: 40, height: 40, borderRadius: gShape.small - 4, backgroundColor: g.cardSoft }} contentFit="cover" />
    : <View style={{ width: 40, height: 40, borderRadius: gShape.small - 4, backgroundColor: g.cardSoft }} />;
}

export default function ProductsPage({ mode = "products" }: { mode?: "products" | "inventory" | "fitment" }) {
  const { t } = useL();
  const user = useSessionUser();
  const tabRoot = useInTabs();
  const params = useLocalSearchParams<{ filter?: string }>();
  const fromUrl = (FILTERS as string[]).includes(params.filter ?? "") ? (params.filter as Filter) : "";
  const [filter, setFilter] = useState<Filter>(fromUrl);
  useEffect(() => { if (params.filter && (FILTERS as string[]).includes(params.filter)) setFilter(params.filter as Filter); }, [params.filter]);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Product[]>([]);
  const state = useLoad(() => partsShopService.getMyInventory(asActor(user), { page, q, stock: SERVER[filter] }), [user.id, page, q, filter]);
  const summary = useLoad(() => portalApi.summary("parts"), [user.id]);
  // pages add up while scrolling; a new search / filter starts again at page 1
  useEffect(() => { if (state.data) setItems((prev) => (page === 1 ? state.data!.products : [...prev, ...state.data!.products.filter((p) => !prev.some((x) => x.id === p.id))])); }, [state.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const restart = () => { setPage(1); };
  const m = summary.data?.metrics;
  const free = (p: Product) => Math.max(0, p.stock - (p.reservedStock ?? 0));
  const shown = items.filter((p) => filter !== "photo" || !p.imageUri).sort((a, b) => Number(free(a) > 0) - Number(free(b) > 0));
  const reload = () => { setPage(1); void state.reload(); void summary.reload(); };
  const title = mode === "inventory" ? t("Inventory", "المخزون") : mode === "fitment" ? t("Fitment", "التوافق") : t("Products", "المنتجات");
  return (
    <ManagePage title={title} back={!tabRoot} tabBar={tabRoot}
      line={m ? t(`${m.products ?? 0} products · ${m.visibleProducts ?? 0} visible to customers`, `${m.products ?? 0} منتجات · ${m.visibleProducts ?? 0} ظاهرة للزبائن`) : undefined}
      search={{ value: q, onChange: (v) => { setQ(v); restart(); }, placeholder: t("Name, brand or part number", "الاسم أو العلامة أو رقم القطعة") }}
      filters={<FilterChips value={filter} onChange={(f) => { setFilter(f); restart(); }} filters={[
        { key: "", label: t("All", "الكل"), count: m?.products }, { key: "out", label: t("Sold out", "نفدت"), count: m?.outOfStock },
        { key: "low", label: t("Low stock", "مخزون منخفض"), count: m?.lowStock }, { key: "photo", label: t("No photo", "بلا صورة"), count: m?.missingPhotos },
      ]} />}
      above={<ManageEntry icon="add-circle-outline" title={t("Add product", "إضافة منتج")} onPress={() => router.push("/provider/parts/new" as Href)} />}
      items={shown} keyOf={(p) => p.id}
      renderItem={(p) => {
        const n = free(p);
        return <ManageRow title={p.name} leading={<Thumb uri={p.imageUri} />}
          sub={[formatPrice(p.price), n === 0 ? t("Sold out", "نفدت") : t(`${n} in stock`, `${n} متوفر`), p.partNumber].filter(Boolean).join(" · ")}
          status={p.customerVisible ? { label: t("Visible", "ظاهر"), tone: "success" } : { label: p.hidden ? t("Hidden by MOTEXA", "مخفي بواسطة موتكسا") : !p.imageUri ? t("Needs a photo", "يحتاج صورة") : t("Not visible", "غير ظاهر"), tone: p.hidden ? "danger" : "warning" }}
          onPress={() => router.push(`/provider/parts/products/${p.id}` as Href)} actions={shopProductActions(t, p, reload)} />;
      }}
      loading={!state.data && !state.error && !items.length} error={state.error} onRetry={reload}
      empty={{ text: q || filter ? t("No matching products.", "لا توجد منتجات مطابقة.") : t("No products yet. Add your first part.", "لا توجد منتجات بعد. أضف قطعتك الأولى."),
        action: q || filter ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setFilter(""); restart(); } } : { label: t("Add product", "إضافة منتج"), onPress: () => router.push("/provider/parts/new" as Href) } }}
      onEndReached={() => { if (state.data?.hasMore && !state.loading) setPage((v) => v + 1); }} loadingMore={state.loading && page > 1}
      onRefresh={reload} refreshing={false} detailHint={t("Tap a product to open it.", "اضغط على منتج لفتحه.")} />
  );
}
