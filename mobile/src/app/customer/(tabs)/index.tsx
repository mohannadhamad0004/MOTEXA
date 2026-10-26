import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { BlueprintPage, BlueprintSurface, Chip, HOME_HERO_OVERLAP, HomeHero, H1, HScroll, Icon, IconName, Mono, Press, SearchField, Section, Sub, Tag, TowTruck } from "../../../components/blueprint";
import { Button } from "../../../components/ui/Button";
import { Notice } from "../../../components/ui/Feedback";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { Text } from "../../../components/ui/Text";
import { CATALOG_GROUPS, labelOf } from "../../../core/constants/categories";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { carName } from "../../../features/catalog/catalogBits";
import { catalogService, currentCar } from "../../../features/catalog/catalogService";
import { HRow, MiniProductCard, ShopRow } from "../../../features/catalog/homeBits";
import { ActiveRequestCard, useActiveRequest } from "../../../features/requests/activeRequest";
import { useSessionUser } from "../../../features/shared/session";
import { M, useIgnition } from "../../../motion";
import { alpha } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

/** Loading / error state of one Home row. */
function RowState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useL();
  if (error)
    return (
      <View style={{ gap: 8, alignItems: "flex-start" }}>
        <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
        <Button variant="ghost" icon="refresh-outline" label={t("Retry", "إعادة المحاولة")} onPress={onRetry} />
      </View>
    );
  return loading ? <SkeletonList count={1} /> : null;
}

const greeting = (t: (en: string, ar: string) => string, name: string) => {
  const h = new Date().getHours();
  const hello = h < 12 ? t("Good morning", "صباح الخير") : h < 18 ? t("Good afternoon", "طاب يومك") : t("Good evening", "مساء الخير");
  return `${hello}, ${name}`;
};

export default function CustomerHome() {
  const { c, row, align } = useTheme();
  const user = useSessionUser();
  const { t, isArabic } = useL();
  const ig = useIgnition("home");
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // "Fits my car" lives in session memory; read it again every time Home comes back into view.
  const [, setSeen] = useState(0);
  useFocusEffect(useCallback(() => setSeen((n) => n + 1), []));
  const car = currentCar();
  const carKey = car ? `${car.make}|${car.model}|${car.year}` : "";

  const fit = useLoad(() => (car ? catalogService.searchParts({ make: car.make, model: car.model, year: car.year }) : Promise.resolve(null)), [carKey]);
  const recent = useLoad(() => catalogService.searchParts({ sort: "newest" }), []);
  const shops = useLoad(() => catalogService.getShops(), []);
  const { active, reload: reloadActive } = useActiveRequest();

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([fit.reload(), recent.reload(), shops.reload(), reloadActive()]);
    setRefreshing(false);
  };

  const openPart = (id: string) => router.push(`/customer/parts/${id}`);
  const fitItems = fit.data?.products.slice(0, 10) ?? [];
  const recentItems = recent.data?.products.slice(0, 10) ?? [];
  const shopItems = (shops.data ?? []).filter((s) => s.productCount > 0);
  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;
  const carChip = car ? [carName({ make: car.make, model: car.model, year: "" }), car.year].filter(Boolean).join(" · ") : t("Set your car", "حدّد سيارتك");

  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  const tile = (icon: IconName, no: string, title: string, sub: string, onPress: () => void) => (
    <View style={{ flex: 1 }}>
      <Press
        accessibilityLabel={title}
        onPress={onPress}
        style={{ minHeight: 144, justifyContent: "space-between", borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, padding: 16 }}
      >
        <View style={[row, { justifyContent: "space-between", alignItems: "flex-start" }]}>
          <Icon name={icon} size={24} color={c.bronze} />
          <Mono>{no}</Mono>
        </View>
        <View>
          <Text style={[{ color: c.ink, fontSize: 16, fontWeight: "700" }, align]}>{title}</Text>
          <Text style={[{ color: c.soft, fontSize: 12, marginTop: 2 }, align]}>{sub}</Text>
        </View>
      </Press>
    </View>
  );

  return (
    <BlueprintPage
      tabs
      ignition={ig}
      overlap={HOME_HERO_OVERLAP}
      contentDelay={840}
      refreshing={refreshing}
      onRefresh={refresh}
      top={
        <HomeHero
          play={ig}
          greeting={greeting(t, firstName)}
          carLabel={carChip}
          onCar={() => router.navigate({ pathname: "/customer/parts", params: { fit: "1" } })}
          active={active && active.index !== undefined && active.labels ? { who: active.who, stage: active.stage, steps: active.labels.length, index: active.index, onPress: () => router.push(active.href as never) } : null}
          primary={{ label: t("Request a tow", "اطلب سحب"), icon: "tow", onPress: () => router.navigate("/customer/tow") }}
          secondary={{ label: t("Find parts", "ابحث عن قطع"), icon: "parts", onPress: () => router.navigate("/customer/parts") }}
        />
      }
    >
      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder={t("Search parts or part numbers", "ابحث عن قطع أو أرقام قطع")}
        onSubmit={() => router.navigate({ pathname: "/customer/parts", params: q.trim() ? { q: q.trim() } : {} })}
      />

      <View style={{ marginTop: 16 }}>
        <Press accessibilityLabel={t("Request a tow", "اطلب سحب")} onPress={() => router.navigate("/customer/tow")}>
          <BlueprintSurface style={{ borderRadius: 20, minHeight: 136, padding: 16 }}>
            <View style={[row, { flex: 1, alignItems: "center", gap: 8 }]}>
              <View style={{ flex: 1, minWidth: 0, alignSelf: "stretch", justifyContent: "space-between" }}>
                <Tag color={c.bronzeLight} align={isArabic ? "right" : "left"}>TOW / 02</Tag>
                <View>
                  <Text numberOfLines={2} style={[{ color: c.cream, fontSize: 21, fontWeight: "700", lineHeight: isArabic ? 29 : 25 }, align]}>{t("Request a tow", "اطلب سحب")}</Text>
                  <Text numberOfLines={2} style={[{ color: alpha(c.cream, 0.7), fontSize: 13, marginTop: 2 }, align]}>{t("Nearest available truck by GPS", "أقرب شاحنة متاحة عبر GPS")}</Text>
                </View>
              </View>
              <View style={{ width: 118, height: 70 }}>
                <TowTruck />
              </View>
              <Icon name="arrow" size={20} color={c.bronzeLight} />
            </View>
          </BlueprintSurface>
        </Press>
      </View>

      <View style={[row, { gap: 12, marginTop: 12 }]}>
        {tile("parts", "03", t("Buy parts", "شراء قطع"), t("From verified shops", "من محلات موثّقة"), () => router.navigate("/customer/parts"))}
        {tile("mech", "04", t("Find a mechanic", "ابحث عن ميكانيكي"), t("Verified by MOTEXA", "موثّق من موتكسا"), () => router.navigate("/customer/mechanics"))}
      </View>

      <View
        style={[row, { height: 56, marginTop: 12, alignItems: "center", justifyContent: "space-between", borderRadius: 18, borderWidth: 1, borderStyle: "dashed", borderColor: c.line, paddingHorizontal: 16 }]}
      >
        <View style={[row, { alignItems: "center", gap: 8 }]}>
          <Icon name="spark" size={16} color={c.soft} />
          <Text style={{ color: c.soft, fontSize: 14, fontWeight: "600" }}>{t("AI diagnosis", "تشخيص بالذكاء الاصطناعي")}</Text>
        </View>
        <Text style={{ color: c.soft, fontSize: 12 }}>{t("Coming soon", "قريباً")}</Text>
      </View>

      {car ? (
        <Section n={num()} title={`${t("Parts that fit your", "قطع تناسب")} ${carName(car)}`}>
          {fitItems.length ? (
            <HRow>
              {fitItems.map((p) => (
                <MiniProductCard key={p.id} p={p} onPress={() => openPart(p.id)} />
              ))}
            </HRow>
          ) : fit.loading || fit.error ? (
            <RowState loading={fit.loading} error={fit.error} onRetry={fit.reload} />
          ) : (
            <Notice icon="information-circle-outline">{t("No parts match this car yet.", "لا توجد قطع مطابقة لهذه السيارة بعد.")}</Notice>
          )}
        </Section>
      ) : (
        <View style={{ marginTop: 24 }}>
          <Button variant="ghost" icon="car-outline" label={t("Set your car to see parts that fit it", "حدّد سيارتك لعرض القطع المناسبة لها")} onPress={() => router.navigate({ pathname: "/customer/parts", params: { fit: "1" } })} />
        </View>
      )}

      <Section n={num()} title={t("Recently added", "أضيف مؤخراً")}>
        {recentItems.length ? (
          <HRow>
            {recentItems.map((p) => (
              <MiniProductCard key={p.id} p={p} onPress={() => openPart(p.id)} />
            ))}
          </HRow>
        ) : recent.loading || recent.error ? (
          <RowState loading={recent.loading} error={recent.error} onRetry={recent.reload} />
        ) : (
          <Notice icon="cube-outline">{t("No parts are available yet.", "لا توجد قطع متاحة بعد.")}</Notice>
        )}
      </Section>

      <Section n={num()} title={t("Shop by category", "تسوق حسب الفئة")}>
        <HScroll>
          {CATALOG_GROUPS.map((g) => (
            <Chip key={g.key} label={labelOf(g, isArabic)} onPress={() => router.push(`/customer/category/${g.key}`)} />
          ))}
          <Chip label={t("All categories", "كل الفئات")} on onPress={() => router.push("/customer/categories")} />
        </HScroll>
      </Section>

      <Section n={num()} title={t("Shops on MOTEXA", "محلات على موتكسا")}>
        {shopItems.length ? (
          shopItems.map((s) => <ShopRow key={s.id} s={s} onPress={() => router.push(`/customer/shops/${s.id}`)} />)
        ) : shops.loading || shops.error ? (
          <RowState loading={shops.loading} error={shops.error} onRetry={shops.reload} />
        ) : (
          <Notice icon="storefront-outline">{t("No shops yet.", "لا توجد متاجر بعد.")}</Notice>
        )}
      </Section>

      <Press
        accessibilityLabel={t("My requests", "طلباتي")}
        onPress={() => router.push("/customer/requests")}
        style={[row, { marginTop: 32, minHeight: 56, alignItems: "center", gap: 12, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, paddingHorizontal: 16 }]}
      >
        <Icon name="list" size={20} color={c.bronze} />
        <Text style={[{ flex: 1, color: c.ink, fontSize: 14, fontWeight: "600" }, align]}>{t("My requests", "طلباتي")}</Text>
        <Icon name="chev" size={16} color={c.soft} />
      </Press>
    </BlueprintPage>
  );
}
