import { router } from "expo-router";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition } from "react-native-reanimated";
import {
  BlueprintPage,
  BottomSheet,
  Chip,
  HeroConfig,
  Icon,
  Odometer,
  OptionSheet,
  PartsScene,
  PrimaryButton,
  Press,
  SearchField,
  TOW_HERO_OVERLAP,
  TowHero,
} from "../../components/blueprint";
import { Button } from "../../components/ui/Button";
import { EmptyState, Notice } from "../../components/ui/Feedback";
import { Input } from "../../components/ui/Input";
import { SkeletonList } from "../../components/ui/Skeleton";
import { Text } from "../../components/ui/Text";
import { useL } from "../../core/hooks/useL";
import { closeMs, M } from "../../motion";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { ProductCard, carName } from "./catalogBits";
import { CatalogProduct, PartSort, catalogService, fitMemory } from "./catalogService";
import { ActiveFilters, FilterSheet } from "./FilterSheet";
import { PartFilters, countFilters, filterMemory, filterParams } from "./filters";

/**
 * The customer's product list: search, filters (bottom sheet), sort, "Fits my car", Load more and pull-to-refresh. Used by
 * the Parts tab (with the compact Parts hero), a category screen and a shop page, which only differ in the hero, the
 * title and what the list is limited to.
 */
export function ProductBrowser({
  hero,
  partsHero,
  title,
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
  /** hero of a category / shop page (the Parts tab uses `partsHero`) */
  hero?: HeroConfig;
  /** the compact Parts hero (tab) */
  partsHero?: boolean;
  title?: ReactNode;
  /** shown between the title and the search box (a shop's details) */
  topExtra?: ReactNode;
  /** shown under the search row (the Parts tab puts its category tabs here) */
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
  /** first entry of the Parts tab (see useIgnition) */
  ignition?: boolean;
  emptyText?: string;
}) {
  const { t, isArabic, row, align } = useL();
  const { c } = useTheme();
  const [q, setQ] = useState(initialQ ?? "");
  // "Fits my car" values live in memory for the app session, so they survive leaving this screen.
  const [make, setMake] = useState(fitMemory.make);
  const [model, setModel] = useState(fitMemory.model);
  const [year, setYear] = useState(fitMemory.year);
  const [fitEnabled, setFitEnabled] = useState(true);
  const [carOpen, setCarOpen] = useState(false);
  const [draft, setDraft] = useState({ make: "", model: "", year: "" });
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

  const yearOk = year.trim() === "" || /^\d{4}$/.test(year.trim());
  const carSet = !!make.trim() && yearOk;
  const fitOn = fitEnabled && carSet;
  const car = carSet ? { make, model, year } : null;

  const openCar = () => {
    setDraft({ make, model, year });
    setCarOpen(true);
  };
  useEffect(() => {
    if (!initialFit) return;
    if (carSet) setFitEnabled(true);
    else openCar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFit]);

  // the car sheet: same rules as before (make first, 4-digit year)
  const dYearOk = draft.year.trim() === "" || /^\d{4}$/.test(draft.year.trim());
  const dNeedsMake = !draft.make.trim() && (!!draft.model.trim() || !!draft.year.trim());
  const dHint = dNeedsMake ? t("Enter the make first.", "أدخل الشركة المصنعة أولًا.") : !dYearOk ? t("The year must be 4 digits, e.g. 2016.", "يجب أن تتكون السنة من 4 أرقام، مثل 2016.") : null;
  const saveCar = () => {
    setMake(draft.make);
    setModel(draft.model);
    setYear(draft.year);
    setFitEnabled(!!draft.make.trim());
    setCarOpen(false);
  };
  const clearCar = () => {
    setMake("");
    setModel("");
    setYear("");
    setCarOpen(false);
  };
  const onFitPress = () => {
    if (!carSet) openCar();
    else setFitEnabled(!fitEnabled);
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

  const SORTS: { key: PartSort; label: string }[] = [
    { key: "relevance", label: t("Relevance", "الأكثر صلة") },
    { key: "price_asc", label: t("Price: low to high", "السعر: من الأقل إلى الأعلى") },
    { key: "price_desc", label: t("Price: high to low", "السعر: من الأعلى إلى الأقل") },
    { key: "newest", label: t("Newest", "الأحدث") },
  ];
  const sortLabel = SORTS.find((s) => s.key === sort)!.label;

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

  // ---- Parts hero: REAL values only ----
  const soft = alpha(c.cream, 0.82);
  const lineText = { color: soft, fontSize: 14 } as const;
  const heroLine = (
    <View style={[row, { alignItems: "center", flexWrap: "wrap", columnGap: 5 }]}>
      {total === null ? (
        <Text style={lineText}>{t("Looking for parts…", "جارٍ البحث عن قطع…")}</Text>
      ) : total === 0 ? (
        <Text style={lineText}>{fitOn && !q.trim() && !activeCount && !category && !group && !shopId ? t("No parts fit your car yet", "لا توجد قطع تناسب سيارتك بعد") : t("No parts found", "لا توجد قطع")}</Text>
      ) : (
        <>
          <Odometer value={total} size={14} color={c.cream} />
          <Text style={lineText}>
            {fitOn && car ? `${total === 1 ? t("part fits your", "قطعة تناسب") : t("parts fit your", "قطع تناسب")} ${carName(car)}` : total === 1 ? t("part available", "قطعة متاحة") : t("parts available", "قطع متاحة")}
          </Text>
        </>
      )}
    </View>
  );
  const top = partsHero ? (
    <TowHero
      play={ignition}
      tag="PARTS / 03"
      title={t("Parts", "القطع")}
      line={heroLine}
      hint={carSet ? undefined : t("Set your car to see what fits it", "حدّد سيارتك لترى ما يناسبها")}
      primary={carSet ? { label: t("Fits my car", "تناسب سيارتي"), icon: "car", active: fitOn, onPress: onFitPress } : { label: t("Set your car", "حدّد سيارتك"), icon: "car", onPress: openCar }}
      secondary={carSet ? { label: t("Change car", "تغيير السيارة"), onPress: openCar } : undefined}
      scene={(k, p) => <PartsScene key={k} play={p} />}
    />
  ) : undefined;

  const filterButton = (
    <Press
      accessibilityLabel={t("Filters", "التصفية")}
      onPress={() => setSheetOpen(true)}
      style={{ width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: activeCount ? c.btn : c.line, backgroundColor: activeCount ? c.btn : "transparent", alignItems: "center", justifyContent: "center" }}
    >
      <Icon name="filter" size={20} color={activeCount ? c.btnFg : c.ink} />
      {activeCount ? (
        <View style={{ position: "absolute", top: -6, end: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.bronze, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#fff", fontSize: 10, fontWeight: "700" }}>{String(activeCount)}</Text>
        </View>
      ) : null}
    </Press>
  );

  return (
    <BlueprintPage
      tabs={tabs}
      ignition={ignition}
      overlap={partsHero ? TOW_HERO_OVERLAP : undefined}
      refreshing={refreshing}
      onRefresh={() => run(1, "refresh")}
      top={top}
      hero={partsHero ? undefined : hero}
    >
      {!partsHero && typeof title === "string" ? <Text style={[{ color: c.ink, fontSize: 30, fontWeight: "700", lineHeight: isArabic ? 40 : 34 }, align]}>{title}</Text> : !partsHero ? title : null}
      {topExtra}
      <View style={[row, { alignItems: "center", gap: 10, marginTop: partsHero ? 0 : 16 }]}>
        <View style={{ flex: 1 }}>
          <SearchField compact style={{ height: 46, borderRadius: 14, backgroundColor: "transparent" }} value={q} onChangeText={setQ} placeholder={t("Name, brand or part number", "الاسم أو الماركة أو رقم القطعة")} />
        </View>
        {filterButton}
      </View>
      {!partsHero ? (
        <View style={[row, { marginTop: 10 }]}>
          <Chip check icon="car" label={carSet ? t("Fits my car", "تناسب سيارتي") : t("Set your car", "حدّد سيارتك")} on={fitOn} onPress={onFitPress} />
        </View>
      ) : null}

      {afterSearch ? <View style={{ marginTop: 10 }}>{afterSearch}</View> : null}

      <View style={[row, { marginTop: 12, alignItems: "center", justifyContent: "space-between" }]}>
        <View style={[row, { alignItems: "center", gap: 4 }]}>
          {total !== null ? <Odometer value={total} size={13} color={c.soft} /> : null}
          <Text style={{ color: c.soft, fontSize: 13 }}>{total === 1 ? t("part", "قطعة") : t("parts", "قطع")}</Text>
        </View>
        <Press accessibilityLabel={t("Sort", "ترتيب")} onPress={() => setSortOpen(true)} style={[row, { minHeight: 40, alignItems: "center", gap: 4, paddingHorizontal: 4 }]}>
          <Text style={{ color: c.ink, fontSize: 13, fontWeight: "600" }}>{sort === "relevance" ? t("Sort", "ترتيب") : sortLabel}</Text>
          <Icon name="down" size={14} color={c.soft} />
        </Press>
      </View>
      <ActiveFilters value={filters} onChange={applyFilters} />

      <View style={{ marginTop: 2 }}>
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
            text={fitOn || q.trim() || activeCount ? t("No parts match your current search, filters or car.", "لا توجد قطع مطابقة للبحث أو التصفية أو السيارة الحالية.") : (emptyText ?? t("No parts are available yet.", "لا توجد قطع متاحة بعد."))}
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
                    car={fitOn ? car : null}
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
      </View>

      <FilterSheet visible={sheetOpen} value={filters} category={category} group={group} onApply={applyFilters} onClose={() => setSheetOpen(false)} />
      <OptionSheet visible={sortOpen} onClose={() => setSortOpen(false)} title={t("Sort by", "ترتيب حسب")} value={sort} options={SORTS} onSelect={(k) => { setSort(k); setSortOpen(false); }} />
      <BottomSheet
        visible={carOpen}
        onClose={() => setCarOpen(false)}
        title={t("Your car", "سيارتك")}
        footer={
          <View style={[row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <PrimaryButton variant="outline" label={t("Clear", "مسح")} disabled={!carSet && !draft.make && !draft.model && !draft.year} onPress={clearCar} />
            </View>
            <View style={{ flex: 1.4 }}>
              <PrimaryButton label={t("Show parts that fit", "عرض القطع المناسبة")} disabled={!draft.make.trim() || !!dHint} onPress={saveCar} />
            </View>
          </View>
        }
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Input label={t("Make", "الشركة المصنعة")} value={draft.make} onChangeText={(v) => setDraft({ ...draft, make: v })} placeholder="Toyota" autoCapitalize="words" />
          <Input label={t("Model", "الطراز")} value={draft.model} onChangeText={(v) => setDraft({ ...draft, model: v })} placeholder="Corolla" autoCapitalize="words" />
          <Input label={t("Year", "السنة")} value={draft.year} onChangeText={(v) => setDraft({ ...draft, year: v })} placeholder="2016" keyboardType="number-pad" maxLength={4} />
          {dHint ? <Notice tone="accent" icon="information-circle-outline">{dHint}</Notice> : null}
        </View>
      </BottomSheet>
    </BlueprintPage>
  );
}
