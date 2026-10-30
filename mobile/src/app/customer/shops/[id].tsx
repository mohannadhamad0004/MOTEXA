import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Chip, ErrorState, GButton, GIcon, GText, Grid, IconButton, PrivatePhoto, ProductCard, Rail, SkeletonBlock, StatusChip, Tap } from "../../../components/garage";
import { ALL_CATEGORIES, labelOf } from "../../../core/constants/categories";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { carName } from "../../../features/catalog/catalogBits";
import { CatalogProduct, catalogService, currentCar, fitMemory } from "../../../features/catalog/catalogService";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const CARD_W = 152; // two cards and a peek of the third at 390 px, so the row reads as scrollable

/**
 * A shop: storefront photo header, identity card (name, place, hours, verified + View on map), the shop's own category tabs,
 * the product panel (a row, "View all" turns it into the grid) and a MOTEXA strip. All values are real.
 */
export default function CustomerShop() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { g, shadow, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const insets = useSafeAreaInsets();
  const shopState = useLoad(() => catalogService.getShop(id), [id]);
  const shop = shopState.data?.shop;
  const cats = ALL_CATEGORIES.filter((x) => shop?.categories.includes(x.key));
  const hasPoint = !!shop && shop.baseLat !== null && shop.baseLng !== null;
  const place = shop ? [cityLabel(shop.city, isArabic), shop.address].filter(Boolean).join(" · ") : "";
  const kicker = shop ? [shop.brandName, shop.branchName].filter(Boolean).join(" · ") : "";
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/customer/parts"));

  // the shop's products, from the same paged endpoint as the Parts tab (category filter is server-side)
  const [cat, setCat] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [broken, setBroken] = useState<string[]>([]);
  const dropBroken = useCallback((id: string) => setBroken((b) => (b.includes(id) ? b : [...b, id])), []);
  // the vehicle chosen on the Parts tab (kept in memory for the session); filtering is server-side, together with category and paging
  const [carTick, setCarTick] = useState(0);
  const car = currentCar();
  const carKey = car ? `${car.make}|${car.model}|${car.year}|${carTick}` : "";
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const load = useCallback(
    async (pageNo: number) => {
      const mine = ++seq.current;
      if (pageNo === 1) setLoading(true);
      else setMore(true);
      setError(null);
      try {
        const r = await catalogService.searchParts({ shopId: id, ...(cat ? { category: cat } : {}), ...(car ? { make: car.make, model: car.model, year: car.year, trim: car.trim } : {}), sort: "newest", page: pageNo });
        if (mine !== seq.current) return;
        setItems((cur) => (pageNo === 1 ? r.products : [...cur, ...r.products]));
        setPage(r.page);
        setHasMore(r.hasMore);
      } catch (e: any) {
        if (mine === seq.current) setError(e.message);
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setMore(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, cat, carKey]
  );
  useEffect(() => {
    load(1);
  }, [load]);


  return (
    <View style={{ flex: 1, backgroundColor: g.page }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        {/* storefront photo header */}
        <View style={{ height: insets.top + 220, borderBottomLeftRadius: gShape.hero, borderBottomRightRadius: gShape.hero, overflow: "hidden", backgroundColor: g.heroTone }}>
          <PrivatePhoto uri={shop?.storefrontUri} fallback="service.parts" radius={0} style={{ width: "100%", height: "100%" }} />
          <View style={[row, { position: "absolute", top: insets.top + 8, left: 20, right: 20 }]}>
            <IconButton icon="arrow-back" label={t("Back", "رجوع")} onPress={back} flip />
          </View>
        </View>

        {/* identity: name + place + hours, verified + map */}
        <View style={{ paddingHorizontal: 20, marginTop: -40 }}>
          <Card>
            {shopState.error && !shop ? (
              <ErrorState text={shopState.error} onRetry={shopState.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
            ) : !shop ? (
              <View style={{ gap: 8 }}>
                <SkeletonBlock width="70%" height={24} />
                <SkeletonBlock width="50%" height={14} />
              </View>
            ) : (
              <>
                {kicker ? <GText numberOfLines={1} style={[gType.caption, { color: g.accentText, fontWeight: "800" }, align]}>{kicker}</GText> : null}
                <GText accessibilityRole="header" numberOfLines={2} style={[{ fontSize: 22, lineHeight: 30, fontWeight: "800" }, align]}>{(isArabic && shop.nameAr) || shop.name}</GText>
                {place ? (
                  <View style={[row, { alignItems: "center", gap: 6, marginTop: 4 }]}>
                    <GIcon name="location-outline" size={15} color={g.soft} />
                    <GText soft numberOfLines={2} style={[gType.caption, { flex: 1 }, align]}>{place}</GText>
                  </View>
                ) : null}
                {shop.workingHours ? (
                  <View style={[row, { alignItems: "center", gap: 6, marginTop: 4 }]}>
                    <GIcon name="time-outline" size={15} color={g.soft} />
                    <GText soft numberOfLines={2} style={[gType.caption, { flex: 1 }, align]}>{shop.workingHours}</GText>
                  </View>
                ) : null}
                <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" }]}>
                  <StatusChip tone="success" icon="shield-checkmark" label={t("Verified by MOTEXA", "موثّق من موتكسا")} />
                  {hasPoint ? <GButton variant="secondary" icon="map-outline" label={t("View on map", "عرض على الخريطة")} onPress={() => router.push({ pathname: "/customer/parts/map", params: { focus: shop.id } })} style={{ minHeight: 44 }} /> : null}
                </View>
              </>
            )}
          </Card>
        </View>

        {/* the shop's own categories */}
        {cats.length > 1 ? (
          <View style={{ marginTop: 14, paddingHorizontal: 20 }}>
            <Rail gap={8}>
              <Chip label={t("All", "الكل")} on={cat === null} onPress={() => setCat(null)} />
              {cats.map((x) => (
                <Chip key={x.key} icon={x.icon as never} label={labelOf(x, isArabic)} on={cat === x.key} onPress={() => setCat(x.key)} />
              ))}
            </Rail>
          </View>
        ) : null}

        {/* product panel */}
        <View style={[{ marginHorizontal: 20, marginTop: 14, borderRadius: gShape.cardLg, backgroundColor: g.cardSoft, padding: 20 }, shadow(1)]}>
          <View style={[row, { alignItems: "center", justifyContent: "space-between", marginBottom: 10 }]}>
            <GText style={[gType.title, align, { flexShrink: 1 }]}>{t("Available parts", "القطع المتاحة")}</GText>
            {items.length > 0 ? (
              <Tap label={all ? t("Show less", "عرض أقل") : t("View all", "عرض الكل")} onPress={() => setAll(!all)} style={[row, { minHeight: 44, alignItems: "center", gap: 2 }]}>
                <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{all ? t("Show less", "عرض أقل") : t("View all", "عرض الكل")}</GText>
                {all ? null : <GIcon name="chevron-forward" size={14} flip />}
              </Tap>
            ) : null}
          </View>

          {car ? (
            <View style={[row, { alignItems: "center", gap: 6, marginBottom: 10 }]}>
              <View style={{ flexShrink: 1 }}>
                <Chip icon="car-sport" on label={`${t("Parts for", "قطع تناسب")} ${carName(car)}`} />
              </View>
              <Tap label={t("Clear vehicle", "إزالة المركبة")} onPress={() => { fitMemory.make = ""; fitMemory.model = ""; fitMemory.year = ""; setCarTick((n) => n + 1); }} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                <GIcon name="close" size={16} color={g.soft} />
              </Tap>
            </View>
          ) : null}

          {loading && !items.length ? (
            <Rail>
              {[0, 1, 2].map((k) => <SkeletonBlock key={k} width={CARD_W} height={230} radius={gShape.card} />)}
            </Rail>
          ) : error && !items.length ? (
            <ErrorState text={error} onRetry={() => load(1)} retryLabel={t("Retry", "إعادة المحاولة")} />
          ) : !items.length ? (
            <GText soft style={[gType.bodySm, { paddingVertical: 18, textAlign: "center" }]}>
              {car ? `${t("No compatible parts found for", "لا توجد قطع متوافقة مع")} ${carName(car)}.` : cat ? t("No parts in this category.", "لا توجد قطع في هذه الفئة.") : t("This shop has not listed any products yet.", "لم يعرض هذا المتجر أي منتجات بعد.")}
            </GText>
          ) : all ? (
            <>
              <Grid>
                {items.filter((p) => !broken.includes(p.id)).map((p) => <ProductCard key={p.id} p={p} car={car} onBroken={dropBroken} onPress={() => router.push(`/customer/parts/${p.id}`)} />)}
              </Grid>
              {hasMore ? (
                <View style={{ marginTop: 14 }}>
                  <GButton variant="secondary" icon="chevron-down-outline" label={more ? t("Loading…", "جارٍ التحميل…") : t("Load more", "تحميل المزيد")} disabled={more} onPress={() => load(page + 1)} />
                </View>
              ) : null}
            </>
          ) : (
            <Rail>
              {items.filter((p) => !broken.includes(p.id)).map((p) => <ProductCard key={p.id} compact p={p} width={CARD_W} car={car} onBroken={dropBroken} onPress={() => router.push(`/customer/parts/${p.id}`)} />)}
            </Rail>
          )}
        </View>

        {/* MOTEXA strip */}
        <Tap label={t("MOTEXA Parts", "قطع موتكسا")} onPress={() => router.navigate("/customer/parts")} style={[row, { marginHorizontal: 20, marginTop: 14, minHeight: 76, borderRadius: gShape.card, backgroundColor: g.tint, alignItems: "center", paddingHorizontal: 16, gap: 12 }]}>
          <View style={{ flex: 1 }}>
            <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("MOTEXA Parts", "قطع موتكسا")}</GText>
            <GText soft style={[gType.caption, align, { marginTop: 2 }]}>{t("Find the right part for your car.", "اعثر على القطعة المناسبة لسيارتك.")}</GText>
          </View>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: g.accent, alignItems: "center", justifyContent: "center" }}>
            <GIcon name="arrow-forward" size={16} color={g.onAccent} flip />
          </View>
        </Tap>
      </ScrollView>
    </View>
  );
}
