// Customer Parts landing pieces (garage style): section header, quick category cards, approved-shop cards and the closing strip.
// Real data only: group list from the catalogue, shops from GET /catalog/shops (approved only), nothing invented.
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Icon } from "../../components/blueprint";
import { GIcon, GText, Photo, PrivatePhoto, Rail, Section, SkeletonBlock, Tap } from "../../components/garage";
import { privateImageSource } from "../../core/config/api";
import { CATALOG_GROUPS, findCategory, labelOf } from "../../core/constants/categories";
import { cityLabel } from "../../core/constants/cities";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import type { PhotoKey } from "../../theme/photos";
import { useTheme } from "../../theme/useTheme";
import { CatalogShopRow, catalogService } from "./catalogService";

/** Section title with an optional action on the end side. */
export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return <Section title={title} action={action && onAction ? { label: action, onPress: onAction } : undefined} style={{ marginBottom: -12 }} />;
}

/** The catalogue groups as photo cards (tap again to clear), plus a real "See all" to the categories screen. */
export function QuickCategories({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  const { g, shadow } = useGarageTheme();
  const { t, isArabic } = useL();
  return (
    <Section title={t("Shop by category", "تسوق حسب الفئة")} action={{ label: t("See all", "عرض الكل"), onPress: () => router.push("/customer/categories") }} style={{ marginTop: 20 }}>
      <Rail gap={10}>
        {CATALOG_GROUPS.map((cg) => {
          const on = value === cg.key;
          return (
            <Tap
              key={cg.key}
              label={labelOf(cg, isArabic)}
              onPress={() => onChange(on ? null : cg.key)}
              style={[{ width: 104, borderRadius: gShape.card, padding: 6, backgroundColor: on ? g.accent : g.card, borderWidth: 1.5, borderColor: on ? g.accent : "transparent" }, shadow(1)]}
            >
              <Photo k={("category." + cg.key) as PhotoKey} radius={16} style={{ width: "100%", aspectRatio: 1 }} />
              <GText numberOfLines={2} style={[gType.tiny, { fontWeight: "700", textAlign: "center", marginTop: 6, minHeight: 30, color: on ? g.onAccent : g.ink }]}>{labelOf(cg, isArabic)}</GText>
            </Tap>
          );
        })}
      </Rail>
    </Section>
  );
}

/** Storefront photo (login-gated, fetched with the token). Falls back to a shop icon. Never mirrored. */
export function ShopPhoto({ uri, height }: { uri: string | null; height: number }) {
  const { c } = useTheme();
  const [src, setSrc] = useState<{ uri: string; headers: { Authorization: string } } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (uri) privateImageSource(uri).then(setSrc);
  }, [uri]);
  const show = !!uri && !failed;
  return (
    <View style={{ height, backgroundColor: c.pill, alignItems: "center", justifyContent: "center" }}>
      {show && src ? <Image source={src} style={{ width: "100%", height: "100%" }} contentFit="cover" onError={() => setFailed(true)} /> : null}
      {!show ? <Icon name="shop" size={30} color={c.soft} /> : null}
    </View>
  );
}

function ShopCard({ s }: { s: CatalogShopRow }) {
  const { g, shadow, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const name = (isArabic && s.nameAr) || s.name;
  const sub = [s.brandName, s.branchName].filter(Boolean).join(" · ");
  const cats = s.categories.slice(0, 2).map((k) => labelOf(findCategory(k), isArabic)).filter(Boolean);
  return (
    <Tap label={name} onPress={() => router.push(`/customer/shops/${s.id}`)} style={[{ width: 236, borderRadius: gShape.card, backgroundColor: g.card, padding: 8 }, shadow(1)]}>
      <PrivatePhoto uri={s.storefrontUri} fallback="service.parts" radius={16} style={{ width: "100%", height: 108 }} />
      <View style={{ padding: 8, gap: 2 }}>
        <View style={[row, { alignItems: "center", gap: 6 }]}>
          <GText numberOfLines={1} style={[gType.label, { flex: 1, fontWeight: "800" }, align]}>{name}</GText>
          <GIcon name="shield-checkmark" size={16} color={g.success} />
        </View>
        {sub ? <GText numberOfLines={1} style={[gType.caption, { color: g.accentText, fontWeight: "700" }, align]}>{sub}</GText> : null}
        <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${cityLabel(s.city, isArabic)} · ${s.productCount} ${s.productCount === 1 ? t("part", "قطعة") : t("parts", "قطع")}`}</GText>
        {cats.length ? <GText soft numberOfLines={1} style={[gType.caption, align]}>{cats.join(" · ")}</GText> : null}
      </View>
    </Tap>
  );
}

/** Approved shops, busiest first (the server order). Hidden when there are none; a quiet retry when the call fails. */
export function ShopsStrip() {
  const { g } = useGarageTheme();
  const { t } = useL();
  const state = useLoad(() => catalogService.getShops(), []);
  const shops = state.data ?? [];
  if (!state.loading && !state.error && !shops.length) return null;
  return (
    <Section title={t("Parts shops", "متاجر القطع")} action={{ label: t("Map", "الخريطة"), onPress: () => router.push("/customer/parts/map") }}>
      {state.loading && !state.data ? (
        <Rail>
          {[0, 1].map((k) => <SkeletonBlock key={k} width={236} height={200} radius={gShape.card} />)}
        </Rail>
      ) : state.error ? (
        <Tap label={t("Retry", "إعادة المحاولة")} onPress={state.reload} style={{ minHeight: 44, justifyContent: "center" }}>
          <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{t("Couldn't load shops. Tap to retry.", "تعذّر تحميل المتاجر. اضغط لإعادة المحاولة.")}</GText>
        </Tap>
      ) : (
        <Rail>
          {shops.map((s) => <ShopCard key={s.id} s={s} />)}
        </Rail>
      )}
    </Section>
  );
}

/** Closing strip: only what is true of the MOTEXA marketplace. */
export function BrandStrip() {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  return (
    <View style={[row, { marginTop: 28, borderRadius: gShape.card, backgroundColor: g.tint, paddingVertical: 16, paddingHorizontal: 16, alignItems: "center", gap: 14 }]}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: g.accent, alignItems: "center", justifyContent: "center" }}>
        <GText style={{ color: g.onAccent, fontSize: 20, fontWeight: "800" }}>M</GText>
      </View>
      <View style={{ flex: 1 }}>
        <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("Parts from approved shops.", "قطع من متاجر معتمدة.")}</GText>
        <GText soft style={[gType.caption, align, { marginTop: 2 }]}>{t("Ask a shop about any part, right in MOTEXA.", "اسأل المتجر عن أي قطعة مباشرة داخل موتكسا.")}</GText>
      </View>
    </View>
  );
}
