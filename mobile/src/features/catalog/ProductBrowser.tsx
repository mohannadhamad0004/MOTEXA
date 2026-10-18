import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, Notice } from "../../components/ui/Feedback";
import { Input, SearchBar } from "../../components/ui/Input";
import { useL } from "../../core/hooks/useL";
import { Screen } from "../../components/layout/Screen";
import { router } from "expo-router";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Chip, ChipRow, ProductCard } from "./catalogBits";
import { CatalogProduct, PartSort, catalogService, fitMemory } from "./catalogService";
import { ActiveFilters, FilterSheet } from "./FilterSheet";
import { PartFilters, countFilters, filterMemory, filterParams } from "./filters";

/**
 * The customer's product list: search, "Fits my car", sort, Load more and pull-to-refresh. Used by the Parts tab and by a
 * category screen, which only differ in the header and in the category or group the list is limited to.
 */
export function ProductBrowser({
  header,
  afterSearch,
  category,
  group,
  shopId,
  initialQ,
  initialSort,
  initialFit,
  tabs = false,
  emptyText,
}: {
  header: ReactNode;
  /** shown right under the search box (the Parts tab puts its category chips here) */
  afterSearch?: ReactNode;
  category?: string | null;
  group?: string | null;
  shopId?: string | null;
  initialQ?: string;
  /** from a link such as "See all" on Home */
  initialSort?: PartSort;
  /** open the "Fits my car" form (the Home link "Set your car") */
  initialFit?: boolean;
  tabs?: boolean;
  emptyText?: string;
}) {
  const { t, row } = useL();
  const [q, setQ] = useState(initialQ ?? "");
  // "Fits my car" values live in memory for the app session, so they survive leaving this screen.
  const [make, setMake] = useState(fitMemory.make);
  const [model, setModel] = useState(fitMemory.model);
  const [year, setYear] = useState(fitMemory.year);
  const [showFit, setShowFit] = useState(!!(fitMemory.make || fitMemory.model || fitMemory.year));
  const [sort, setSort] = useState<PartSort>("relevance");
  const [filters, setFilters] = useState<PartFilters>(filterMemory.current);
  const [sheetOpen, setSheetOpen] = useState(false);
  const applyFilters = (f: PartFilters) => {
    filterMemory.current = f;
    setFilters(f);
    setSheetOpen(false);
  };
  const activeCount = countFilters(filters);

  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0); // ignore answers of searches that were replaced by a newer one

  useEffect(() => {
    if (initialSort) setSort(initialSort);
  }, [initialSort]);
  useEffect(() => {
    if (initialFit) setShowFit(true);
  }, [initialFit]);

  // A query coming from the Home search box.
  useEffect(() => {
    if (typeof initialQ === "string") setQ(initialQ);
  }, [initialQ]);

  const yearOk = year.trim() === "" || /^\d{4}$/.test(year.trim());
  const modelOrYearWithoutMake = !make.trim() && (!!model.trim() || !!year.trim());
  const fitHint = modelOrYearWithoutMake
    ? t("Enter the make first.", "أدخل الشركة المصنعة أولًا.")
    : !yearOk
      ? t("The year must be 4 digits, e.g. 2016.", "يجب أن تتكون السنة من 4 أرقام، مثل 2016.")
      : null;
  const fitOn = !!make.trim() && yearOk;

  const run = useCallback(
    async (pageNo: number, mode: "replace" | "more" | "refresh") => {
      const mine = ++seq.current;
      if (mode === "more") setLoadingMore(true);
      else if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const r = await catalogService.searchParts({
          q,
          ...(fitOn ? { make, model, year: year.trim() } : {}),
          ...(category ? { category } : {}),
          ...(group ? { group } : {}),
          ...(shopId ? { shopId } : {}),
          ...filterParams(filters),
          sort,
          page: pageNo,
        });
        if (mine !== seq.current) return;
        setItems((cur) => (mode === "more" ? [...cur, ...r.products] : r.products));
        setPage(r.page);
        setTotal(r.total);
        setHasMore(r.hasMore);
      } catch (e: any) {
        if (mine === seq.current) setError(e.message);
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [q, make, model, year, fitOn, sort, category, group, shopId, filters]
  );

  // Search as the user types, after a short pause.
  useEffect(() => {
    fitMemory.make = make;
    fitMemory.model = model;
    fitMemory.year = year;
    const h = setTimeout(() => run(1, "replace"), 350);
    return () => clearTimeout(h);
  }, [run, make, model, year]);

  const clearFit = () => {
    setMake("");
    setModel("");
    setYear("");
  };

  return (
    <Screen tabs={tabs} refreshing={refreshing} onRefresh={() => run(1, "refresh")}>
      {header}
      <SearchBar value={q} onChange={setQ} placeholder={t("Name, brand or part number", "الاسم أو الماركة أو رقم القطعة")} />
      {afterSearch}

      <View style={{ marginBottom: 14, gap: 10 }}>
        <Button
          variant={fitOn ? "primary" : "ghost"}
          icon="car-outline"
          label={fitOn ? `${t("Fits my car", "تناسب سيارتي")}: ${make.trim()}${model.trim() ? " " + model.trim() : ""}${year.trim() ? " " + year.trim() : ""}` : t("Fits my car", "تناسب سيارتي")}
          onPress={() => setShowFit(!showFit)}
        />
        <Button
          variant={activeCount ? "primary" : "ghost"}
          icon="options-outline"
          label={activeCount ? `${t("Filters", "التصفية")} (${activeCount})` : t("Filters", "التصفية")}
          onPress={() => setSheetOpen(true)}
        />
      </View>
      {showFit && (
        <Card>
          <Input label={t("Make", "الشركة المصنعة")} value={make} onChangeText={setMake} placeholder="Toyota" autoCapitalize="words" />
          <Input label={t("Model", "الطراز")} value={model} onChangeText={setModel} placeholder="Corolla" autoCapitalize="words" />
          <Input label={t("Year", "السنة")} value={year} onChangeText={setYear} placeholder="2016" keyboardType="number-pad" maxLength={4} />
          {fitHint ? <Notice tone="accent" icon="information-circle-outline">{fitHint}</Notice> : null}
          <Button variant="ghost" icon="close-circle-outline" label={t("Clear", "مسح")} onPress={clearFit} disabled={!make && !model && !year} />
        </Card>
      )}

      <ActiveFilters value={filters} onChange={applyFilters} />

      <ChipRow>
        <Chip label={t("Relevance", "الأكثر صلة")} on={sort === "relevance"} onPress={() => setSort("relevance")} />
        <Chip label={t("Price: low to high", "السعر: من الأقل إلى الأعلى")} on={sort === "price_asc"} onPress={() => setSort("price_asc")} />
        <Chip label={t("Price: high to low", "السعر: من الأعلى إلى الأقل")} on={sort === "price_desc"} onPress={() => setSort("price_desc")} />
        <Chip label={t("Newest", "الأحدث")} on={sort === "newest"} onPress={() => setSort("newest")} />
      </ChipRow>

      {loading && !items.length ? (
        <SkeletonList />
      ) : error && !items.length ? (
        <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
          <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
          <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run(1, "replace")} />
        </View>
      ) : !items.length ? (
        <EmptyState
          icon="cube-outline"
          text={fitOn || q.trim() || activeCount ? t("No parts match your search.", "لا توجد قطع مطابقة لبحثك.") : (emptyText ?? t("No parts are available yet.", "لا توجد قطع متاحة بعد."))}
        />
      ) : (
        <>
          <View style={[row, { marginBottom: 10 }]}>
            <Notice icon="cube-outline">{`${total} ${total === 1 ? t("part", "قطعة") : t("parts", "قطع")}`}</Notice>
          </View>
          {error ? <Notice tone="danger" icon="alert-circle-outline">{error}</Notice> : null}
          {items.map((p) => (
            <ProductCard key={p.id} p={p} showShop={!shopId} car={fitOn ? { make, model, year } : null} onPress={() => router.push(`/customer/parts/${p.id}`)} />
          ))}
          {hasMore && (
            <Button label={loadingMore ? t("Loading…", "جارٍ التحميل…") : t("Load more", "تحميل المزيد")} variant="ghost" icon="chevron-down-outline" disabled={loadingMore} onPress={() => run(page + 1, "more")} />
          )}
        </>
      )}
      <FilterSheet visible={sheetOpen} value={filters} category={category} group={group} onApply={applyFilters} onClose={() => setSheetOpen(false)} />
    </Screen>
  );
}
