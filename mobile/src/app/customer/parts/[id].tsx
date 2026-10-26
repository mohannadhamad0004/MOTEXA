import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { isDevSeedTile } from "../../../core/constants/files";
import { View } from "react-native";
import { Image } from "expo-image";
import { BackButton, BlueprintPage, BlueprintSurface, COMPACT_OVERLAP, Tag, CategoryAssembly, Icon, InspectionCheck, Mono, Panel, Pill, Press, RoundIcon, Rise, Row, Section, Stamp, StickyActionBar, assemblyForCategory } from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { Text } from "../../../components/ui/Text";
import { findCategory, labelOf } from "../../../core/constants/categories";
import { formatPrice } from "../../../core/constants/money";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { ProductCard } from "../../../features/catalog/catalogBits";
import { catalogService, currentCar, fitsCar } from "../../../features/catalog/catalogService";
import { usePartLabels } from "../../../features/catalog/partAttrs";
import { M } from "../../../motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeroStatusBar } from "../../../components/blueprint";
import { alpha } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

/** Compact dark detail hero (150 px): part number and category tags, the category assembly in the middle. */
function DetailHero({ tl, tr, art }: { tl?: string; tr?: string; art: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { c, isArabic } = useTheme();
  useHeroStatusBar();
  return (
    <BlueprintSurface style={{ height: insets.top + 160 }}>
      <View style={{ position: "absolute", left: 20, right: 20, top: insets.top + 18, flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", gap: 12 }}>
        <View style={[{ flexShrink: 1 }, isArabic ? { marginRight: 52 } : { marginLeft: 52 }]}>{tl ? <Tag color={alpha(c.cream, 0.7)} align={isArabic ? "right" : "left"}>{tl}</Tag> : null}</View>
        <View style={{ maxWidth: "40%" }}>{tr ? <Tag color={c.bronzeLight} align={isArabic ? "left" : "right"}>{tr}</Tag> : null}</View>
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, top: insets.top + 40, bottom: 34, alignItems: "center" }}>
        <View style={{ height: "100%", aspectRatio: 1.6 }}>{art}</View>
      </View>
      <BackButton fallback="/customer/parts" />
    </BlueprintSurface>
  );
}

// the name, price and fitment badge reveal after the hero assembly (about 700 ms)
const REVEAL = 480;

/** Up to 6 more visible parts of the same shop. Hidden when there are none (or the call fails). */
function OtherFromShop({ shopId, currentId, n }: { shopId: string; currentId: string; n: string }) {
  const { t } = useL();
  const state = useLoad(() => catalogService.searchParts({ shopId }), [shopId]);
  const car = currentCar();
  const others = (state.data?.products ?? []).filter((x) => x.id !== currentId).slice(0, 6);
  if (!others.length) return null;
  return (
    <Section n={n} title={t("Other parts from this shop", "قطع أخرى من هذا المتجر")}>
      {others.map((x) => (
        <ProductCard key={x.id} p={x} showShop={false} car={car} onPress={() => router.push(`/customer/parts/${x.id}`)} />
      ))}
    </Section>
  );
}

export default function CustomerPartDetail() {
  const { c, row, align } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const state = useLoad(() => catalogService.getPart(id), [id]);
  const [photoOk, setPhotoOk] = useState(true);
  const car = currentCar();
  const labels = usePartLabels();
  const p = state.data;
  const cat = findCategory(p?.category);
  const carShort = car ? car.model || car.make : "";

  return (
    <BlueprintPage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      footer={
        p ? (
          <StickyActionBar
            price={formatPrice(p.price)}
            icon="chat"
            label={t("Ask the shop", "اسأل المتجر")}
            onPress={() => router.push({ pathname: "/customer/inquiry/new", params: { productId: p.id } })}
          />
        ) : undefined
      }
      overlap={COMPACT_OVERLAP}
      top={<DetailHero tl={p ? `PART NO. ${p.partNumber}` : undefined} tr={cat ? labelOf(cat, isArabic) : undefined} art={p ? <CategoryAssembly key={p.id} kind={assemblyForCategory(p.category)} assemble delay={M.grid / 2} /> : null} />}
    >
      <Async state={state}>
        {(p) => {
          const mine = car ? p.fitments.find((f) => fitsCar({ fitments: [f] }, car)) : undefined;
          const others = p.fitments.filter((f) => f !== mine);
          const fits = car ? fitsCar(p, car) : null;
          return (
            <>
              <Rise i={0} delay={REVEAL}>
                <Mono>{`${p.brand} · ${p.partNumber}`}</Mono>
                <Text style={[{ color: c.ink, fontSize: 32, fontWeight: "700", lineHeight: isArabic ? 42 : 35, marginTop: 8 }, align]}>{p.name}</Text>
              </Rise>
              <Rise i={0} delay={REVEAL + M.stagger}>
                <Text style={[{ color: c.ink, fontSize: 28, fontWeight: "700", marginTop: 8, writingDirection: "ltr" }, align]}>{formatPrice(p.price)}</Text>
              </Rise>
              <Rise i={0} delay={REVEAL + 2 * M.stagger} style={[row, { flexWrap: "wrap", gap: 8, marginTop: 16 }]}>
                {fits === true ? <Pill icon={<InspectionCheck size={14} color={c.bronze} delay={REVEAL + 3 * M.stagger + M.entrance} />}>{`${t("Fits your", "تناسب")} ${carShort}`}</Pill> : null}
                {fits === false && p.fitments.length === 0 ? (
                  <Pill icon={<Icon name="alert" size={14} color={c.soft} />}>{t("Fitment not listed", "التوافق غير محدد")}</Pill>
                ) : null}
                {fits === false && p.fitments.length > 0 ? (
                  <Pill tone="danger" icon={<Icon name="alert" size={14} color={c.danger} />}>
                    {`${t("Does not fit your", "لا تناسب")} ${carShort}`}
                  </Pill>
                ) : null}
                <Pill tone={p.stock === "OUT" ? "danger" : p.stock === "LOW" ? "warning" : undefined} icon={<Icon name="box" size={14} color={p.stock === "OUT" ? c.danger : p.stock === "LOW" ? c.warning : c.bronze} />}>
                  {p.stock === "OUT" ? t("Out of stock", "نفد المخزون") : p.stock === "LOW" ? t("Low stock", "مخزون منخفض") : t("In stock", "متوفر")}
                </Pill>
                <Pill icon={<Icon name="spark" size={14} color={c.bronze} />}>{labels.condition[p.condition]}</Pill>
              </Rise>

              {p.imageUri && photoOk ? (
                <View style={{ marginTop: 24, aspectRatio: 1.5, borderRadius: 20, overflow: "hidden", backgroundColor: c.pill }}>
                  <Image
                    source={{ uri: p.imageUri }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={M.detail}
                    onError={() => setPhotoOk(false)}
                    // dev builds only: the dev seed letter tile (96 px) is not a photo, see isDevSeedTile
                    onLoad={(e) => isDevSeedTile(e.source.width, e.source.height) && setPhotoOk(false)}
                  />
                </View>
              ) : null}

              {fits === false ? (
                <View style={{ marginTop: 16 }}>
                  <Notice tone="accent" icon="alert-circle-outline">{p.fitments.length === 0 ? t("The shop has not listed which cars this part fits. Ask the shop to confirm.", "لم يحدد المتجر السيارات المناسبة لهذه القطعة. اسأل المتجر للتأكيد.") : t("This part may not fit your car. Check the list below or ask the shop.", "قد لا تناسب هذه القطعة سيارتك. راجع القائمة أدناه أو اسأل المتجر.")}</Notice>
                </View>
              ) : null}

              <Section n="01" title={t("Part details", "تفاصيل القطعة")}>
                <View style={{ borderStartWidth: 2, borderStartColor: c.bronze, paddingStart: 12 }}>
                <Row label={t("Brand", "الماركة")} value={p.brand} />
                <Row label={t("Part number", "رقم القطعة")} value={p.partNumber} mono />
                <Row label={t("Condition", "الحالة")} value={labels.condition[p.condition]} />
                <Row label={t("Category", "الفئة")} value={cat ? labelOf(cat, isArabic) : undefined} />
                {p.partType ? <Row label={t("Type", "النوع")} value={labels.type[p.partType]} /> : null}
                {p.description ? <Text style={[{ color: c.ink, fontSize: 14, lineHeight: 22, marginTop: 16 }, align]}>{p.description}</Text> : null}
                </View>
              </Section>

              <Section n="02" title={t("Compatibility", "التوافق")}>
                {mine ? (
                  <Panel bronze style={{ marginBottom: 4 }}>
                    <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 10 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[{ color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{`${mine.make} ${mine.model}`}</Text>
                        <Mono>{`${mine.yearFrom}–${mine.yearTo}${mine.trim ? ` · ${mine.trim}` : ""}`}</Mono>
                      </View>
                      <Pill icon={<InspectionCheck size={14} color={c.bronze} />}>{t("Your car", "سيارتك")}</Pill>
                    </View>
                  </Panel>
                ) : null}
                {others.length ? (
                  others.map((f, i) => <Row key={i} label={`${f.make} ${f.model}`} value={`${f.yearFrom}–${f.yearTo}${f.trim ? ` · ${f.trim}` : ""}`} mono />)
                ) : !mine ? (
                  <Text style={[{ color: c.soft, fontSize: 14 }, align]}>{t("No fitment listed", "لا يوجد توافق محدد")}</Text>
                ) : null}
              </Section>

              <Section n="03" title={t("Shop", "المحل")}>
                <Press
                  accessibilityLabel={p.shop.name}
                  onPress={() => router.push(`/customer/shops/${p.shop.id}`)}
                  style={[row, { alignItems: "center", gap: 16, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, padding: 16 }]}
                >
                  <RoundIcon icon="shop" size={48} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{p.shop.name}</Text>
                    <View style={[row, { alignItems: "center", gap: 4, marginTop: 2 }]}>
                      <Icon name="pin" size={14} color={c.soft} />
                      <Text numberOfLines={1} style={{ color: c.soft, fontSize: 13 }}>{p.shop.city}</Text>
                    </View>
                  </View>
                  <Stamp label={t("Verified", "موثّق")} />
                </Press>
              </Section>

              <OtherFromShop n="04" shopId={p.shop.id} currentId={p.id} />
            </>
          );
        }}
      </Async>
    </BlueprintPage>
  );
}
