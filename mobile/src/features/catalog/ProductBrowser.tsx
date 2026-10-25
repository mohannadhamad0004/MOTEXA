import { router } from "expo-router";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import { BlueprintPage, Chip, HeroConfig, HStrip, Odometer, PageTitle, SearchField, Sub, Tag } from "../../components/blueprint";
import { closeMs, M } from "../../motion";
import { useTheme } from "../../theme/useTheme";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, Notice } from "../../components/ui/Feedback";
import { Input } from "../../components/ui/Input";
import { SkeletonList } from "../../components/ui/Skeleton";
import { useL } from "../../core/hooks/useL";
import { ProductCard } from "./catalogBits";
import { CatalogProduct, PartSort, catalogService, fitMemory } from "./catalogService";
import { ActiveFilters, FilterSheet } from "./FilterSheet";
import { PartFilters, countFilters, filterMemory, filterParams } from "./filters";

/**
 * The customer's product list: search, "Fits my car", filters, sort, Load more and pull-to-refresh. Used by the Parts
 * tab, a category screen and a shop page, which only differ in the hero, the title and what the list is limited to.
 */
export function ProductBrowser({
  hero,
  title,
  sub,
  topExtra,
  afterSearch,
  category,
  group,
  shopId,
  initialQ,
  initialSort,
  initialFit,
  tabs = false,
  ignition = false,
  emptyText,
}: {
  /** hero without the right-hand result count (added here once the real count is known) */
  hero: HeroConfig;
  title: ReactNode;
  sub?: string;
  /** shown between the title and the search box (a shop's details) */
  topExtra?: ReactNode;
  /** shown under the chips row (the Parts tab puts its category tabs here) */
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
  /** first entry of the Parts tab (see useIgnition) */
  ignition?: boolean;
  emptyText?: string;
}) {
  const { t, isArabic } = useL();
  const { c } = useTheme();
  const [q, setQ] = useState(initialQ ?? "");
  // "Fits my car" values live in memory for the app session, so they survive leaving this screen.
  const [make, setMake] = useState(fitMemory.make);
  const [model, setModel] = useState(fitMemory.model);
  const [year, setYear] = useState(fitMemory.year);
  const [showFit, setShowFit] = useState(!!(fitMemory.make || fitMemory.model || fitMemory.year));
  const [sort, setSort] = useState<PartSort>("relevance");
  const [showSort, setShowSort] = useState(false);
  const [filters, setFilters] = useState<PartFilters>(filterMemory.current);
  const [sheetOpen, setSheetOpen] = useState(false);
  const applyFilters = (f: PartFilters) => {
    filterMemory.current = f;
    setFilters(f);
    setSheetOpen(false);
  };
  const activeCount = countFilters(filters);

  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState<number | null>(null);
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

  const SORTS: { key: PartSort; label: string }[] = [
    { key: "relevance", label: t("Relevance", "الأكثر صلة") },
    { key: "price_asc", label: t("Price: low to high", "السعر: من الأقل إلى الأعلى") },
    { key: "price_desc", label: t("Price: high to low", "السعر: من الأعلى إلى الأقل") },
    { key: "newest", label: t("Newest", "الأحدث") },
  ];
  // the result count is an odometer: digits roll when the count changes
  const resultsLabel =
    total === null ? undefined : (
      <View style={{ flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 6 }}>
        <Odometer value={total} size={12} color={c.bronzeLight} />
        <Tag color={c.bronzeLight}>{total === 1 ? t("result", "نتيجة") : t("results", "نتيجة")}</Tag>
      </View>
    );
  // first results ever shown cascade in; later result sets crossfade and reposition
  const firstBatch = useRef(true);
  useEffect(() => {
    if (items.length) firstBatch.current = false;
  }, [items.length]);
  // "Fits my car" just switched on: the check sweeps in row by row for a moment
  const prevFit = useRef(false);
  const sweepUntil = useRef(0);
  if (fitOn && !prevFit.current) sweepUntil.current = Date.now() + 1500;
  prevFit.current = fitOn;
  const sweeping = fitOn && Date.now() < sweepUntil.current;

  return (
    <BlueprintPage tabs={tabs} ignition={ignition} refreshing={refreshing} onRefresh={() => run(1, "refresh")} hero={{ ...hero, tr: hero.tr ?? resultsLabel }}>
      {typeof title === "string" ? <PageTitle>{title}</PageTitle> : title}
      {sub ? <Sub>{sub}</Sub> : null}
      {topExtra}
      <SearchField style={{ marginTop: 24 }} value={q} onChangeText={setQ} placeholder={t("Name, brand or part number", "الاسم أو الماركة أو رقم القطعة")} />

      <View style={{ marginTop: 16 }}>
        <HStrip>
          <Chip
            check
            on={fitOn}
            icon={fitOn ? "check" : "car"}
            label={fitOn ? `${t("Fits", "تناسب")} ${make.trim()}${model.trim() ? " " + model.trim() : ""}${year.trim() ? " " + year.trim() : ""}` : t("Fits my car", "تناسب سيارتي")}
            onPress={() => setShowFit(!showFit)}
          />
          <Chip check on={activeCount > 0} icon="filter" label={activeCount ? `${t("Filters", "التصفية")} (${activeCount})` : t("Filters", "التصفية")} onPress={() => setSheetOpen(true)} />
          <Chip label={`${t("Sort", "ترتيب")}${sort !== "relevance" ? ": " + SORTS.find((s) => s.key === sort)!.label : ""}`} trailing="down" on={showSort} onPress={() => setShowSort(!showSort)} />
        </HStrip>
      </View>
      {showSort ? (
        <View style={{ marginTop: 12 }}>
          <HStrip>
            {SORTS.map((s) => (
              <Chip
                key={s.key}
                label={s.label}
                on={sort === s.key}
                onPress={() => {
                  setSort(s.key);
                  setShowSort(false);
                }}
              />
            ))}
          </HStrip>
        </View>
      ) : null}

      {showFit && (
        <Card style={{ marginTop: 16, marginBottom: 0 }}>
          <Input label={t("Make", "الشركة المصنعة")} value={make} onChangeText={setMake} placeholder="Toyota" autoCapitalize="words" />
          <Input label={t("Model", "الطراز")} value={model} onChangeText={setModel} placeholder="Corolla" autoCapitalize="words" />
          <Input label={t("Year", "السنة")} value={year} onChangeText={setYear} placeholder="2016" keyboardType="number-pad" maxLength={4} />
          {fitHint ? <Notice tone="accent" icon="information-circle-outline">{fitHint}</Notice> : null}
          <Button variant="ghost" icon="close-circle-outline" label={t("Clear", "مسح")} onPress={clearFit} disabled={!make && !model && !year} />
        </Card>
      )}

      {afterSearch ? <View style={{ marginTop: 12 }}>{afterSearch}</View> : null}
      <View style={{ marginTop: 12 }}>
        <ActiveFilters value={filters} onChange={applyFilters} />
      </View>

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
          {error ? <Notice tone="danger" icon="alert-circle-outline">{error}</Notice> : null}
          {items.map((p, k) => {
            const early = k < 8;
            const cascading = early && firstBatch.current;
            return (
              <Animated.View
                key={p.id}
                entering={early && !firstBatch.current ? FadeIn.duration(M.chip) : undefined}
                exiting={early ? FadeOut.duration(closeMs(M.chip)) : undefined}
                layout={early ? LinearTransition.duration(M.detail) : undefined}
              >
                <ProductCard
                  p={p}
                  showShop={!shopId}
                  car={fitOn ? { make, model, year } : null}
                  cascade={cascading ? k : undefined}
                  sweep={early && sweeping ? k : undefined}
                  onPress={() => router.push(`/customer/parts/${p.id}`)}
                />
              </Animated.View>
            );
          })}
          {hasMore && (
            <View style={{ marginTop: 16 }}>
              <Button label={loadingMore ? t("Loading…", "جارٍ التحميل…") : t("Load more", "تحميل المزيد")} variant="ghost" icon="chevron-down-outline" disabled={loadingMore} onPress={() => run(page + 1, "more")} />
            </View>
          )}
        </>
      )}
      <FilterSheet visible={sheetOpen} value={filters} category={category} group={group} onApply={applyFilters} onClose={() => setSheetOpen(false)} />
    </BlueprintPage>
  );
}
