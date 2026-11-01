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
  IconButton,
  Sheet,
  StickyActionBar,
  Tap,
  cardBadges,
  fitLine,
} from "../../../components/garage";
import { isDevSeedTile } from "../../../core/constants/files";
import { findCategory, labelOf } from "../../../core/constants/categories";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService, fitStatus, fitsCar } from "../../../features/catalog/catalogService";
import { openMyCarPicker, useMyCar } from "../../../features/catalog/myCar";
import { addToCart, cartCount, useCart } from "../../../features/orders/cart";
import { QtyStepper } from "../../../features/orders/orderBits";
import { usePartLabels } from "../../../features/catalog/partAttrs";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

/** Up to 8 similar visible parts: same category (or the same shop when the part has none), never this one. Hidden when none. */
function Similar({ category, shopId, currentId }: { category: string | null; shopId: string; currentId: string }) {
  const { t } = useL();
  const state = useLoad(() => catalogService.searchParts(category ? { category } : { shopId }), [category, shopId]);
  const { car } = useMyCar();
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
  const { car } = useMyCar();
  // buying: quantity (up to the units the shop can still sell), one shop per cart
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [otherShop, setOtherShop] = useState(false);
  const buy = (replace = false) => {
    const p = state.data;
    if (!p) return;
    const r = addToCart({ id: p.shop.id, name: p.shop.name }, { productId: p.id, name: p.name, partNumber: p.partNumber, price: p.price, imageUri: p.imageUri, max: Math.max(1, p.available ?? 1) }, qty, replace);
    if (r === "other-shop") return setOtherShop(true);
    setOtherShop(false);
    router.push("/customer/cart");
  };
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
            <IconButton icon="chatbubble-ellipses-outline" label={t("Ask the shop", "اسأل المتجر")} onPress={() => router.push({ pathname: "/customer/inquiry/new", params: { productId: p.id } })} />
            <GButton flex icon="bag-add-outline" label={soldOut ? t("Sold out", "نفدت الكمية") : t("Buy", "شراء")} disabled={soldOut} onPress={() => buy()} />
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
          // never a fit the data does not support: FITS (a fitment row), UNIVERSAL (shop's flag), else no claim
          const status = car ? fitStatus(p, car) : null;
          const fl = status && car ? fitLine(status, car, true, isArabic) : null;
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
                  {fl ? <StatusChip tone={fl.tone === "soft" ? "neutral" : fl.tone} icon={fl.icon} label={fl.text} /> : null}
                </View>
                {!soldOut ? (
                  <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 12 }]}>
                    <GText style={[gType.label, align]}>{t("Quantity", "الكمية")}</GText>
                    <QtyStepper value={qty} max={Math.max(1, p.available ?? 1)} onChange={setQty} />
                  </View>
                ) : null}
                {cart && cart.shopId === p.shop.id ? (
                  <Tap label={t("View cart", "عرض السلة")} onPress={() => router.push("/customer/cart")} style={[row, { minHeight: 44, alignItems: "center", gap: 6, marginTop: 4 }]}>
                    <GIcon name="bag-outline" size={16} />
                    <GText style={[gType.caption, { fontWeight: "800", color: g.accentText }]}>{`${t("View cart", "عرض السلة")} (${cartCount(cart)})`}</GText>
                  </Tap>
                ) : null}
                {!car ? (
                  <Tap label={t("Check if it fits your car", "تحقق إن كانت تناسب سيارتك")} onPress={openMyCarPicker} style={[row, { minHeight: 44, alignItems: "center", gap: 6, marginTop: 6 }]}>
                    <GIcon name="car-sport-outline" size={16} />
                    <GText style={[gType.caption, { fontWeight: "800", color: g.accentText }]}>{t("Check if it fits your car", "تحقق إن كانت تناسب سيارتك")}</GText>
                  </Tap>
                ) : null}
              </Card>

              {status === "UNKNOWN" || status === "NOT_LISTED" ? (
                <View style={{ marginTop: 12 }}>
                  <Note icon="help-circle-outline">{status === "UNKNOWN" ? t("The shop has not listed which cars this part fits. Ask the shop to confirm.", "لم يحدد المتجر السيارات المناسبة لهذه القطعة. اسأل المتجر للتأكيد.") : t("Your car is not on this part's list. Check the list below or ask the shop.", "سيارتك غير مدرجة في قائمة هذه القطعة. راجع القائمة أدناه أو اسأل المتجر.")}</Note>
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
                {p.isUniversal ? (
                  <Card soft style={{ marginBottom: p.fitments.length ? 10 : 0 }}>
                    <View style={[row, { alignItems: "center", gap: 8 }]}>
                      <GIcon name="globe-outline" size={18} />
                      <GText style={[gType.bodySm, { flex: 1 }, align]}>{t("Universal: the shop says it fits any car.", "عامة: يقول المتجر إنها تناسب أي سيارة.")}</GText>
                    </View>
                  </Card>
                ) : null}
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
                ) : p.isUniversal ? null : (
                  <Card soft>
                    <GText soft style={[gType.bodySm, align]}>{t("No fitment listed", "لا يوجد توافق محدد")}</GText>
                  </Card>
                )}
              </Section>

              <Sheet
                visible={otherShop}
                onClose={() => setOtherShop(false)}
                closeLabel={t("Close", "إغلاق")}
                title={t("Start a new cart?", "بدء سلة جديدة؟")}
                footer={
                  <View style={[row, { gap: 10 }]}>
                    <GButton flex variant="secondary" label={t("Keep my cart", "إبقاء سلتي")} onPress={() => setOtherShop(false)} />
                    <GButton flex label={t("New cart", "سلة جديدة")} onPress={() => buy(true)} />
                  </View>
                }
              >
                <GText style={[gType.body, align]}>
                  {t(
                    `Your cart has parts from ${cart?.shopName ?? ""}. An order goes to one shop, so starting a new cart removes them.`,
                    `سلتك فيها قطع من ${cart?.shopName ?? ""}. الطلب يذهب إلى متجر واحد، لذا بدء سلة جديدة يزيلها.`
                  )}
                </GText>
              </Sheet>

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
