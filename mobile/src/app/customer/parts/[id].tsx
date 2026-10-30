import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Badge,
  Card,
  ErrorState,
  Gallery,
  GarageHero,
  GaragePage,
  GButton,
  GIcon,
  GText,
  ListRow,
  Note,
  PrivatePhoto,
  ProductCard,
  Rail,
  Section,
  SkeletonBlock,
  StatusChip,
  StickyActionBar,
  cardBadges,
} from "../../../components/garage";
import { isDevSeedTile } from "../../../core/constants/files";
import { findCategory, labelOf } from "../../../core/constants/categories";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService, currentCar, fitsCar } from "../../../features/catalog/catalogService";
import { usePartLabels } from "../../../features/catalog/partAttrs";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

/** Up to 8 similar visible parts: same category (or the same shop when the part has none), never this one. Hidden when none. */
function Similar({ category, shopId, currentId }: { category: string | null; shopId: string; currentId: string }) {
  const { t } = useL();
  const state = useLoad(() => catalogService.searchParts(category ? { category } : { shopId }), [category, shopId]);
  const car = currentCar();
  const others = (state.data?.products ?? []).filter((x) => x.id !== currentId).slice(0, 8);
  if (!others.length) return null;
  return (
    <Section title={t("Similar parts", "قطع مشابهة")}>
      <Rail>
        {others.map((x) => (
          <ProductCard key={x.id} p={x} compact width={164} car={car} onPress={() => router.push(`/customer/parts/${x.id}`)} />
        ))}
      </Rail>
    </Section>
  );
}

export default function CustomerPartDetail() {
  const { g, row, align } = useGarageTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const state = useLoad(() => catalogService.getPart(id), [id]);
  const [photoOk, setPhotoOk] = useState(true);
  const car = currentCar();
  const labels = usePartLabels();
  const p = state.data;
  const cat = findCategory(p?.category);
  const soldOut = p?.stock === "OUT";
  const back = () => (router.canGoBack() ? router.back() : router.navigate("/customer/parts"));

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={<GarageHero variant="detail" onBack={back} title={p ? p.name : t("Part", "القطعة")} line={p ? `${p.brand} · ${p.partNumber}` : undefined} />}
      bottom={
        p ? (
          <StickyActionBar note={soldOut ? t("Sold out. You can still look at the details.", "نفدت الكمية. يمكنك الاطلاع على التفاصيل.") : undefined}>
            <View style={{ justifyContent: "center", paddingHorizontal: 4 }}>
              <GText style={{ fontSize: 20, lineHeight: 26, fontWeight: "800", color: g.accentText, writingDirection: "ltr" }}>{formatPrice(p.price)}</GText>
            </View>
            <GButton flex icon="chatbubble-ellipses-outline" label={t("Ask the shop", "اسأل المتجر")} disabled={soldOut} onPress={() => router.push({ pathname: "/customer/inquiry/new", params: { productId: p.id } })} />
          </StickyActionBar>
        ) : undefined
      }
    >
      {state.error && !p ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !p ? (
        <View style={{ gap: 12 }}>
          <SkeletonBlock height={340} radius={gShape.cardLg} />
          <SkeletonBlock width="60%" height={22} />
          <SkeletonBlock width="40%" height={22} />
        </View>
      ) : (
        (() => {
          const mine = car ? p.fitments.find((f) => fitsCar({ fitments: [f] }, car)) : undefined;
          const fits = car ? fitsCar(p, car) : null;
          const old = p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null;
          const badges = cardBadges(p.badges, isArabic, 4);
          const stock = { IN: ["success", t("In stock", "متوفر")], LOW: ["warning", t("Low stock", "كمية محدودة")], OUT: ["danger", t("Out of stock", "نفدت الكمية")] }[p.stock] as ["success" | "warning" | "danger", string];
          return (
            <>
              {p.imageUri && photoOk ? (
                <Gallery
                  uris={[p.imageUri]}
                  label={p.name}
                  onFail={() => setPhotoOk(false)}
                  // dev builds only: the dev seed letter tile (96 px) is not a photo, see isDevSeedTile
                  onPhoto={(s) => isDevSeedTile(s.width, s.height) && setPhotoOk(false)}
                />
              ) : null}

              <Card style={{ marginTop: 14 }}>
                {badges.length ? (
                  <View style={[row, { gap: 6, flexWrap: "wrap", marginBottom: 10 }]}>
                    {badges.map((b) => (
                      <Badge key={b.label} label={b.label} tone={b.tone} />
                    ))}
                  </View>
                ) : null}
                <View style={[row, { alignItems: "baseline", gap: 10, flexWrap: "wrap" }]}>
                  <GText style={{ fontSize: 28, lineHeight: 36, fontWeight: "800", color: g.accentText, writingDirection: "ltr" }}>{formatPrice(p.price)}</GText>
                  {old ? <GText soft style={{ fontSize: 16, textDecorationLine: "line-through", writingDirection: "ltr" }}>{formatPrice(old)}</GText> : null}
                </View>
                <View style={[row, { gap: 6, flexWrap: "wrap", marginTop: 10 }]}>
                  <StatusChip tone={stock[0]} label={stock[1]} icon="cube-outline" />
                  <StatusChip tone="neutral" label={labels.condition[p.condition]} icon="sparkles-outline" />
                  {fits === true ? <StatusChip tone="success" icon="checkmark-circle" label={t("Fits your car", "تناسب سيارتك")} /> : null}
                  {fits === false ? <StatusChip tone="danger" icon="alert-circle-outline" label={p.fitments.length ? t("May not fit your car", "قد لا تناسب سيارتك") : t("Fitment not listed", "التوافق غير محدد")} /> : null}
                </View>
              </Card>

              {fits === false ? (
                <View style={{ marginTop: 12 }}>
                  <Note icon="alert-circle-outline">{p.fitments.length === 0 ? t("The shop has not listed which cars this part fits. Ask the shop to confirm.", "لم يحدد المتجر السيارات المناسبة لهذه القطعة. اسأل المتجر للتأكيد.") : t("This part may not fit your car. Check the list below or ask the shop.", "قد لا تناسب هذه القطعة سيارتك. راجع القائمة أدناه أو اسأل المتجر.")}</Note>
                </View>
              ) : null}

              <Section title={t("Part details", "تفاصيل القطعة")}>
                <Card pad={12}>
                  <ListRow icon="pricetag-outline" title={t("Brand", "الماركة")} end={<GText style={gType.label}>{p.brand}</GText>} />
                  <ListRow divider icon="barcode-outline" title={t("Part number", "رقم القطعة")} end={<GText selectable style={[gType.label, { writingDirection: "ltr" }]}>{p.partNumber}</GText>} />
                  <ListRow divider icon="sparkles-outline" title={t("Condition", "الحالة")} end={<GText style={gType.label}>{labels.condition[p.condition]}</GText>} />
                  {cat ? <ListRow divider icon="grid-outline" title={t("Category", "الفئة")} end={<GText style={gType.label}>{labelOf(cat, isArabic)}</GText>} /> : null}
                  {p.partType ? <ListRow divider icon="ribbon-outline" title={t("Type", "النوع")} end={<GText style={gType.label}>{labels.type[p.partType]}</GText>} /> : null}
                  {p.warrantyMonths ? <ListRow divider icon="shield-checkmark-outline" title={t("Warranty", "الضمان")} end={<GText style={gType.label}>{t(`${p.warrantyMonths} months`, `${p.warrantyMonths} شهر`)}</GText>} /> : null}
                </Card>
                {p.description ? <GText style={[gType.body, align, { marginTop: 12 }]}>{p.description}</GText> : null}
              </Section>

              <Section title={t("Fits these cars", "تناسب هذه السيارات")}>
                {p.fitments.length ? (
                  <Card pad={0} style={{ overflow: "hidden" }}>
                    <View style={[row, { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: g.tint }]}>
                      <GText soft style={[gType.tiny, { fontWeight: "800", flex: 1.4 }, align]}>{t("Car", "السيارة")}</GText>
                      <GText soft style={[gType.tiny, { fontWeight: "800", flex: 1 }, align]}>{t("Years", "السنوات")}</GText>
                      <GText soft style={[gType.tiny, { fontWeight: "800", flex: 1 }, align]}>{t("Engine", "المحرك")}</GText>
                    </View>
                    {p.fitments.map((f, i) => {
                      const me = f === mine;
                      return (
                        <View key={i} style={[row, { alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: g.line, backgroundColor: me ? g.cardSoft : undefined }]}>
                          <View style={[row, { flex: 1.4, alignItems: "center", gap: 6 }]}>
                            {me ? <GIcon name="checkmark-circle" size={16} color={g.success} /> : null}
                            <GText numberOfLines={2} style={[gType.caption, { fontWeight: "700", flexShrink: 1 }, align]}>{`${f.make} ${f.model}`}</GText>
                          </View>
                          <GText style={[gType.caption, { flex: 1, writingDirection: "ltr" }, align]}>{`${f.yearFrom}–${f.yearTo}`}</GText>
                          <GText soft numberOfLines={2} style={[gType.caption, { flex: 1 }, align]}>{f.trim || "—"}</GText>
                        </View>
                      );
                    })}
                  </Card>
                ) : (
                  <Card soft>
                    <GText soft style={[gType.bodySm, align]}>{t("No fitment listed", "لا يوجد توافق محدد")}</GText>
                  </Card>
                )}
              </Section>

              <Section title={t("Sold by", "يبيعها")}>
                <Card onPress={() => router.push(`/customer/shops/${p.shop.id}`)} label={p.shop.name} pad={12}>
                  <View style={[row, { alignItems: "center", gap: 12 }]}>
                    <PrivatePhoto uri={null} fallback="service.parts" radius={16} style={{ width: 56, height: 56 }} />
                    <View style={{ flex: 1 }}>
                      <GText numberOfLines={2} style={[gType.label, { fontWeight: "800" }, align]}>{p.shop.name}</GText>
                      <View style={[row, { alignItems: "center", gap: 4, marginTop: 2 }]}>
                        <GIcon name="location-outline" size={14} color={g.soft} />
                        <GText soft numberOfLines={1} style={gType.caption}>{p.shop.city}</GText>
                      </View>
                    </View>
                    <StatusChip tone="success" icon="shield-checkmark" label={t("Verified", "موثّق")} />
                  </View>
                </Card>
              </Section>

              <Similar category={p.category} shopId={p.shop.id} currentId={p.id} />
            </>
          );
        })()
      )}
    </GaragePage>
  );
}
