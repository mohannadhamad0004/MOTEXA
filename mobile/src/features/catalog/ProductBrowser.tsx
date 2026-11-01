import { router } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Chip, EmptyState, ErrorState, GaragePage, GButton, GIcon, GText, Grid, IconButton, Note, OptionSheet, ProductCard, SearchBar, SkeletonCards, Tap } from "../../components/garage";
import { findCategory, labelOf } from "../../core/constants/categories";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";
import { carName } from "./catalogBits";
import { CatalogProduct, PartSort, appendDistinct, catalogService } from "./catalogService";
import { ActiveFilters, FilterSheet } from "./FilterSheet";
import { Car, openMyCarPicker, saveMyCar, useMyCar } from "./myCar";
import { useVehicleList } from "./VehiclePicker";
import { matchVehicle } from "./vehicleMatch";
import { EMPTY_FILTERS, PartFilters, countFilters, filterMemory, filterParams } from "./filters";

/** What a page hero may show: the real result count, the car, and the "Fits my car" switch. */
export type BrowserState = {
  total: number | null;
  car: { make: string; model: string; year: string; trim: string } | null;
  fitOn: boolean;
  /** the list is filtered by another car the customer searched for (not their own) */
  browsing: boolean;
  /** turn "Fits my car" on / off (opens the car sheet when no car is set) */
  setFit: (on: boolean) => void;
  openCar: () => void;
};

/**
 * The customer product list: search, filters (bottom sheet), sort, "Fits my car", Load more and pull-to-refresh. Used by
 * the Parts tab and a category screen, which only differ in the hero and what the list is limited to.
 */
export function ProductBrowser({
  hero,
  footerExtra,
  topExtra,
  afterSearch,
  category,
  group,
  shopId,
  initialQ,
  initialSort,
  initialFit,
  tabs = false,
  entry,
  emptyText,
}: {
  /** the page hero, given the live list state */
  hero?: (s: BrowserState) => ReactNode;
  /** shown after the product list */
  footerExtra?: ReactNode;
  /** shown above the search row */
  topExtra?: ReactNode;
  /** shown under the search row (the Parts tab puts its category groups here) */
  afterSearch?: ReactNode;
  category?: string | null;
  group?: string | null;
  shopId?: string | null;
  initialQ?: string;
  /** from a link such as "See all" on Home */
  initialSort?: PartSort;
  /** from the Home link "Set your car": open the car sheet (or switch the fit on) */
  initialFit?: boolean;
  tabs?: boolean;
  /** main tab key for the first-visit entrance */
  entry?: string;
  emptyText?: string;
}) {
  const { t, row, align, isArabic } = useL();
  const { g } = useGarageTheme();
  const [q, setQ] = useState(initialQ ?? "");
  // the account's car (shared by every screen) and, from a search like "elantra 2018", another car being browsed
  const { car: myCar } = useMyCar();
  const [browse, setBrowse] = useState<Car | null>(null);
  const [fitEnabled, setFitEnabled] = useState(true);
  const vehicles = useVehicleList().list;
  const [sort, setSort] = useState<PartSort>("relevance");
  const [sortOpen, setSortOpen] = useState(false);
  const [filters, setFilters] = useState<PartFilters>(filterMemory.current);
  const [sheetOpen, setSheetOpen] = useState(false);
  const applyFilters = (f: PartFilters) => {
    filterMemory.current = f;
    setFilters(f);
    setSheetOpen(false);
  };
  const activeCount = countFilters(filters);

  const [items, setItems] = useState<CatalogProduct[]>([]);
  // products whose photo could not be shown are dropped from the list (never replaced by a drawing)
  const [broken, setBroken] = useState<string[]>([]);
  const dropBroken = useCallback((id: string) => setBroken((b) => (b.includes(id) ? b : [...b, id])), []);
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
  // A query coming from the Home search box.
  useEffect(() => {
    if (typeof initialQ === "string") setQ(initialQ);
  }, [initialQ]);

  const car = browse ?? myCar;
  const carSet = !!car;
  const fitOn = fitEnabled && carSet;
  const { make = "", model = "", year = "", trim = "" } = fitOn && car ? car : {};

  const openCar = openMyCarPicker;
  // a newly saved car is the one shown (any browsed car is dropped), with the fit on
  const myKey = myCar ? `${myCar.make}|${myCar.model}|${myCar.year}` : "";
  useEffect(() => {
    if (!myKey) return;
    setBrowse(null);
    setFitEnabled(true);
  }, [myKey]);
  useEffect(() => {
    if (!initialFit) return;
    if (carSet) setFitEnabled(true);
    else openCar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFit]);
  const onFitPress = () => {
    if (!carSet) openCar();
    else setFitEnabled(!fitEnabled);
  };
  // "Fits my car" off; a browsed car is simply dropped
  const clearCar = () => (browse ? setBrowse(null) : setFitEnabled(false));

  // car-aware search: "corolla 2016" / "كورولا 2016" offers that car as a filter (my car is not changed)
  const hit = useMemo(() => (vehicles && q.trim() ? matchVehicle(q, vehicles) : null), [q, vehicles]);
  const hitCar: Car | null = hit ? { make: hit.v.make, model: hit.v.model, year: hit.year ? String(hit.year) : "", trim: "" } : null;
  const hitIsActive = !!hitCar && !!car && fitOn && hitCar.make === car.make && hitCar.model === car.model && (!hitCar.year || hitCar.year === car.year);
  const carLabel = (c: Car) => {
    const v = vehicles?.find((x) => x.make === c.make && x.model === c.model);
    const name = v && isArabic ? `${v.makeAr} ${v.modelAr}` : `${c.make} ${c.model}`;
    return c.year ? `${name} ${c.year}` : name;
  };
  const applyHit = () => {
    if (!hit || !hitCar) return;
    setBrowse(hitCar);
    setFitEnabled(true);
    setQ(hit.rest);
  };
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const setAsMine = async () => {
    if (!browse?.year) return;
    setSaveErr(null);
    try {
      await saveMyCar({ make: browse.make, model: browse.model, year: Number(browse.year) });
    } catch (e: any) {
      setSaveErr(e.message);
    }
  };

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
          ...(fitOn ? { make, model, year: year.trim(), trim: trim.trim() } : {}),
          ...(category ? { category } : {}),
          ...(group ? { group } : {}),
          ...(shopId ? { shopId } : {}),
          ...filterParams(filters),
          sort,
          page: pageNo,
        });
        if (mine !== seq.current) return;
        setItems((cur) => (mode === "more" ? appendDistinct(cur, r.products) : r.products));
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
    [q, make, model, year, trim, fitOn, sort, category, group, shopId, filters]
  );

  // Search as the user types, after a short pause.
  useEffect(() => {
    const h = setTimeout(() => run(1, "replace"), 350);
    return () => clearTimeout(h);
  }, [run]);

  const SORTS: { key: PartSort; label: string }[] = [
    { key: "relevance", label: t("Relevance", "الأكثر صلة") },
    { key: "price_asc", label: t("Price: low to high", "السعر: من الأقل إلى الأعلى") },
    { key: "price_desc", label: t("Price: high to low", "السعر: من الأعلى إلى الأقل") },
    { key: "newest", label: t("Newest", "الأحدث") },
    { key: "discount", label: t("Biggest discount", "أكبر خصم") },
  ];
  const sortLabel = SORTS.find((s) => s.key === sort)!.label;

  const visibleItems = items.filter((p) => !broken.includes(p.id));
  // with a car: grouped by category (in the order the results bring them)
  const groups = useMemo(() => {
    if (!fitOn) return null;
    const by = new Map<string, CatalogProduct[]>();
    for (const p of visibleItems) by.set(p.category ?? "", [...(by.get(p.category ?? "") ?? []), p]);
    return [...by.entries()];
  }, [fitOn, visibleItems]);

  return (
    <GaragePage
      tabs={tabs}
      entry={entry}
      refreshing={refreshing}
      onRefresh={() => run(1, "refresh")}
      hero={hero?.({ total, car: fitOn ? car : myCar, browsing: fitOn && !!browse, fitOn, setFit: (on) => (on && !myCar ? openCar() : (setBrowse(null), setFitEnabled(on))), openCar })}
    >
      {topExtra}
      <View style={[row, { alignItems: "center", gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <SearchBar value={q} onChangeText={setQ} placeholder={t("Search parts, OEM, brand", "ابحث عن قطعة أو رقم أو ماركة")} />
        </View>
        <IconButton icon="options-outline" label={t("Filters", "التصفية")} onPress={() => setSheetOpen(true)} tone={activeCount ? "accent" : "card"} badge={activeCount || undefined} />
      </View>
      {hitCar && !hitIsActive ? (
        <View style={[row, { marginTop: 10 }]}>
          <Chip icon="search" label={`${t("Show parts for", "عرض قطع")} ${carLabel(hitCar)}`} onPress={applyHit} />
        </View>
      ) : null}
      <View style={[row, { marginTop: 12, alignItems: "center", gap: 8, flexWrap: "wrap" }]}>
        {fitOn && car ? (
          <>
            <View style={{ flexShrink: 1 }}>
              <Chip icon="car-sport" label={`${t("Parts for", "قطع تناسب")} ${carLabel(car)}`} on onPress={browse ? undefined : openCar} />
            </View>
            <Tap label={t("Clear vehicle", "إزالة المركبة")} onPress={clearCar} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
              <GIcon name="close" size={18} color={g.soft} />
            </Tap>
            {browse?.year ? <GButton variant="ghost" icon="car-sport-outline" label={t("Set as my car", "اجعلها سيارتي")} onPress={() => void setAsMine()} style={{ minHeight: 44 }} /> : null}
          </>
        ) : (
          <Chip icon="car-sport-outline" label={carSet ? `${t("Show parts for", "عرض قطع")} ${carLabel(car!)}` : t("Find parts for your car", "ابحث عن قطع لسيارتك")} onPress={carSet ? onFitPress : openCar} />
        )}
      </View>
      {saveErr ? <Note tone="danger" icon="alert-circle-outline">{saveErr}</Note> : null}

      {afterSearch ? <View style={{ marginTop: 8 }}>{afterSearch}</View> : null}

      <View style={[row, { marginTop: 18, alignItems: "center", justifyContent: "space-between" }]}>
        <GText soft style={[gType.caption, { fontWeight: "700" }]}>{total !== null ? `${total} ${total === 1 ? t("part", "قطعة") : t("parts", "قطع")}` : " "}</GText>
        <Tap label={t("Sort", "ترتيب")} onPress={() => setSortOpen(true)} style={[row, { minHeight: 44, alignItems: "center", gap: 4, paddingHorizontal: 4 }]}>
          <GIcon name="swap-vertical-outline" size={16} />
          <GText style={[gType.caption, { fontWeight: "800", color: g.accentText }]}>{sort === "relevance" ? t("Sort", "ترتيب") : sortLabel}</GText>
        </Tap>
      </View>
      <ActiveFilters value={filters} onChange={applyFilters} />

      <View style={{ marginTop: 10 }}>
        {loading && !items.length ? (
          <SkeletonCards />
        ) : error && !items.length ? (
          <ErrorState text={error} onRetry={() => run(1, "replace")} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !visibleItems.length ? (
          <EmptyState
            photo="empty.search"
            text={fitOn && car && !q.trim() && !activeCount && !category && !group && !shopId ? `${t("No compatible parts found for", "لا توجد قطع متوافقة مع")} ${carName(car)}.` : fitOn || q.trim() || activeCount ? t("No parts match your current search, filters or car.", "لا توجد قطع مطابقة للبحث أو التصفية أو السيارة الحالية.") : (emptyText ?? t("No parts are available yet.", "لا توجد قطع متاحة بعد."))}
            action={activeCount ? { label: t("Clear filters", "مسح التصفية"), onPress: () => applyFilters(EMPTY_FILTERS) } : undefined}
          />
        ) : (
          <>
            {error ? <Note tone="danger" icon="alert-circle-outline">{error}</Note> : null}
            {groups ? (
              groups.map(([cat, list]) => (
                <View key={cat || "none"} style={{ marginTop: 8 }}>
                  <GText style={[gType.title, align, { marginBottom: 10 }]}>{cat ? labelOf(findCategory(cat), isArabic) || t("Other parts", "قطع أخرى") : t("Other parts", "قطع أخرى")}</GText>
                  <Grid>
                    {list.map((p) => (
                      <ProductCard key={p.id} p={p} car={car} mine={!browse} onBroken={dropBroken} onPress={() => router.push(`/customer/parts/${p.id}`)} />
                    ))}
                  </Grid>
                </View>
              ))
            ) : (
              <Grid>
                {visibleItems.map((p) => (
                  <ProductCard key={p.id} p={p} car={null} onBroken={dropBroken} onPress={() => router.push(`/customer/parts/${p.id}`)} />
                ))}
              </Grid>
            )}
            {hasMore && (
              <View style={{ marginTop: 16 }}>
                <GButton variant="secondary" icon="chevron-down-outline" label={loadingMore ? t("Loading…", "جارٍ التحميل…") : t("Load more", "تحميل المزيد")} disabled={loadingMore} onPress={() => run(page + 1, "more")} />
              </View>
            )}
          </>
        )}
      </View>

      {footerExtra}

      <FilterSheet visible={sheetOpen} value={filters} category={category} group={group} onApply={applyFilters} onClose={() => setSheetOpen(false)} />
      <OptionSheet visible={sortOpen} onClose={() => setSortOpen(false)} closeLabel={t("Close", "إغلاق")} title={t("Sort by", "ترتيب حسب")} value={sort} options={SORTS} onSelect={(k) => { setSort(k); setSortOpen(false); }} />
    </GaragePage>
  );
}
