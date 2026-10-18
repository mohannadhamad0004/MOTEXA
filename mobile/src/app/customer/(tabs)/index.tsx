import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { Notice } from "../../../components/ui/Feedback";
import { SearchBar } from "../../../components/ui/Input";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { carName } from "../../../features/catalog/catalogBits";
import { catalogService, currentCar } from "../../../features/catalog/catalogService";
import { HRow, MiniProductCard, RowHeader, ShopTile } from "../../../features/catalog/homeBits";
import { CATALOG_GROUPS, labelOf } from "../../../core/constants/categories";
import { useSessionUser } from "../../../features/shared/session";

type IconName = keyof typeof Ionicons.glyphMap;

/** Loading, error and empty states shared by the Home rows. `empty` = nothing to show (the section is then hidden or says so). */
function RowState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry: () => void }) {
  const { t } = useL();
  if (error) {
    return (
      <View style={{ gap: 8, alignItems: "flex-start" }}>
        <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
        <Button variant="ghost" icon="refresh-outline" label={t("Retry", "إعادة المحاولة")} onPress={onRetry} />
      </View>
    );
  }
  return loading ? <SkeletonList count={1} /> : null;
}

export default function CustomerHome() {
  const { c: col } = useTheme();
  const user = useSessionUser();
  const { t, row, align, isArabic } = useL();
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // "Fits my car" lives in session memory; read it again every time Home comes back into view.
  const [, setSeen] = useState(0);
  useFocusEffect(useCallback(() => setSeen((n) => n + 1), []));
  const car = currentCar();
  const carKey = car ? `${car.make}|${car.model}|${car.year}` : "";

  const fit = useLoad(
    () => (car ? catalogService.searchParts({ make: car.make, model: car.model, year: car.year }) : Promise.resolve(null)),
    [carKey]
  );
  const recent = useLoad(() => catalogService.searchParts({ sort: "newest" }), []);
  const shops = useLoad(() => catalogService.getShops(), []);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([fit.reload(), recent.reload(), shops.reload()]);
    setRefreshing(false);
  };

  const openPart = (id: string) => router.push(`/customer/parts/${id}`);
  const fitItems = fit.data?.products.slice(0, 10) ?? [];
  const recentItems = recent.data?.products.slice(0, 10) ?? [];
  const shopItems = (shops.data ?? []).filter((s) => s.productCount > 0);

  const action = (icon: IconName, title: string, text: string, onPress: () => void) => (
    <Card label={title} onPress={onPress}>
      <View style={[row, { alignItems: "center", gap: 14 }]}>
        <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: col.accentSoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={26} color={col.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[{ color: col.text, fontSize: 17, fontWeight: "800" }, align]}>{title}</Text>
          <Text numberOfLines={2} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3, lineHeight: 18 }, align]}>{text}</Text>
        </View>
        <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
      </View>
    </Card>
  );

  return (
    <Screen tabs refreshing={refreshing} onRefresh={refresh}>
      <Header brand="MOTEXA" title={`${t("Hello", "مرحبًا")}, ${user.fullName}`} subtitle={t("What do you need today?", "ماذا تحتاج اليوم؟")} />
      <SearchBar value={q} onChange={setQ} placeholder={t("Search parts by name or part number", "ابحث عن قطعة بالاسم أو رقم القطعة")} />
      <Button
        icon="search-outline"
        label={t("Search parts", "ابحث عن القطع")}
        onPress={() => router.navigate({ pathname: "/customer/parts", params: q.trim() ? { q: q.trim() } : {} })}
      />

      {/* 2. Parts that fit the customer's car (only with a car set) */}
      {car ? (
        <>
          <RowHeader
            title={`${t("Parts that fit your", "قطع تناسب")} ${carName(car)}`}
            onSeeAll={() => router.navigate({ pathname: "/customer/parts", params: { fit: "1" } })}
          />
          {fitItems.length ? (
            <HRow>
              {fitItems.map((p) => (
                <MiniProductCard key={p.id} p={p} car={car} onPress={() => openPart(p.id)} />
              ))}
            </HRow>
          ) : fit.loading || fit.error ? (
            <RowState loading={fit.loading} error={fit.error} onRetry={fit.reload} />
          ) : (
            <Notice icon="information-circle-outline">{t("No parts match this car yet.", "لا توجد قطع مطابقة لهذه السيارة بعد.")}</Notice>
          )}
        </>
      ) : (
        <View style={{ marginTop: 14 }}>
          <Button variant="ghost" icon="car-outline" label={t("Set your car to see parts that fit it", "حدّد سيارتك لعرض القطع المناسبة لها")} onPress={() => router.navigate({ pathname: "/customer/parts", params: { fit: "1" } })} />
        </View>
      )}

      {/* 3. Category tiles */}
      <RowHeader title={t("Shop by category", "تسوق حسب الفئة")} onSeeAll={() => router.push("/customer/categories")} extra={t("Browse all categories", "تصفح كل الفئات")} />
      <View style={[row, { flexWrap: "wrap", justifyContent: "space-between" }]}>
        {CATALOG_GROUPS.map((g) => (
          <View key={g.key} style={{ width: "48.5%" }}>
            <Card label={labelOf(g, isArabic)} onPress={() => router.push(`/customer/category/${g.key}`)}>
              <Ionicons name={g.icon} size={26} color={col.accent} />
              <Text numberOfLines={2} style={[{ color: col.text, fontSize: 13, fontWeight: "800", marginTop: 8, minHeight: 34 }, align]}>{labelOf(g, isArabic)}</Text>
            </Card>
          </View>
        ))}
        <View style={{ width: "48.5%" }}>
          <Card label={t("Browse all categories", "تصفح كل الفئات")} onPress={() => router.push("/customer/categories")}>
            <Ionicons name="grid-outline" size={26} color={col.accent} />
            <Text numberOfLines={2} style={[{ color: col.text, fontSize: 13, fontWeight: "800", marginTop: 8, minHeight: 34 }, align]}>{t("All categories", "كل الفئات")}</Text>
          </Card>
        </View>
      </View>

      {/* 4. Recently added (newest first) */}
      <RowHeader title={t("Recently added", "أُضيفت حديثًا")} onSeeAll={() => router.navigate({ pathname: "/customer/parts", params: { sort: "newest" } })} />
      {recentItems.length ? (
        <HRow>
          {recentItems.map((p) => (
            <MiniProductCard key={p.id} p={p} car={car} onPress={() => openPart(p.id)} />
          ))}
        </HRow>
      ) : recent.loading || recent.error ? (
        <RowState loading={recent.loading} error={recent.error} onRetry={recent.reload} />
      ) : (
        <Notice icon="cube-outline">{t("No parts are available yet.", "لا توجد قطع متاحة بعد.")}</Notice>
      )}

      {/* 5. Shops */}
      <RowHeader title={t("Shops on MOTEXA", "المتاجر على MOTEXA")} />
      {shopItems.length ? (
        <HRow>
          {shopItems.map((s) => (
            <ShopTile key={s.id} s={s} onPress={() => router.push(`/customer/shops/${s.id}`)} />
          ))}
        </HRow>
      ) : shops.loading || shops.error ? (
        <RowState loading={shops.loading} error={shops.error} onRetry={shops.reload} />
      ) : (
        <Notice icon="storefront-outline">{t("No shops yet.", "لا توجد متاجر بعد.")}</Notice>
      )}

      {/* 6. Tow shortcut and AI diagnosis */}
      <View style={{ height: 22 }} />
      {action("car-outline", t("Need a tow?", "تحتاج إلى سحب؟"), t("See approved tow companies and their trucks.", "تعرّف على شركات السحب المعتمدة وشاحناتها."), () => router.navigate("/customer/tow"))}

      <Card>
        <View style={[row, { alignItems: "center", gap: 14 }]}>
          <View style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: col.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="sparkles-outline" size={26} color={col.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={[{ color: col.text, fontSize: 17, fontWeight: "800" }, align]}>{t("AI car diagnosis", "تشخيص السيارة بالذكاء الاصطناعي")}</Text>
            <Text numberOfLines={2} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3, lineHeight: 18 }, align]}>
              {t("Describe a problem and get help. Not available yet.", "صف المشكلة واحصل على المساعدة. غير متاح بعد.")}
            </Text>
          </View>
        </View>
        <View style={[row, { marginTop: 12 }]}>
          <Badge tone="neutral" icon="time-outline" label={t("Coming soon", "قريبًا")} />
        </View>
      </Card>

      {/* 7. My requests */}
      {action("receipt-outline", t("My requests", "طلباتي"), t("Your questions to shops and your tow requests.", "أسئلتك للمتاجر وطلبات السحب."), () => router.push("/customer/requests"))}
    </Screen>
  );
}
