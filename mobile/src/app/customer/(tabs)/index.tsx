import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import {
  Card,
  ErrorState,
  GaragePage,
  HeroLayout,
  GIcon,
  GText,
  PrivatePhoto,
  ProductCard,
  Rail,
  Section,
  ServiceCard,
  SkeletonBlock,
  Tap,
} from "../../../components/garage";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { carName } from "../../../features/catalog/catalogBits";
import { CatalogShopRow, catalogService } from "../../../features/catalog/catalogService";
import { useMyCar } from "../../../features/catalog/myCar";
import { CarPreview } from "../../../features/car3d/CarPreview";
import { mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { Active, useActiveRequest } from "../../../features/requests/activeRequest";
import { useSessionUser } from "../../../features/shared/session";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const greeting = (t: (en: string, ar: string) => string, name: string) => {
  const h = new Date().getHours();
  const hello = h < 12 ? t("Good morning", "صباح الخير") : h < 18 ? t("Good afternoon", "طاب يومك") : t("Good evening", "مساء الخير");
  return `${hello}${t(", ", "، ")}${name}`;
};

/** The open request: tag, one sentence, a mini progress bar, "View". Keyed by request so polling never remounts it. */
function ActiveCard({ a }: { a: Active }) {
  const { g, shadow, row, align } = useGarageTheme();
  const { t } = useL();
  const steps = a.labels?.length ?? 0;
  const pct = steps && a.index !== undefined ? ((a.index + 1) / steps) * 100 : 0;
  return (
    <Tap label={a.title} onPress={() => router.push(a.href as never)} style={[{ backgroundColor: g.card, borderRadius: gShape.cardLg, padding: 16, borderWidth: 1.5, borderColor: g.accent }, shadow(2)]}>
      <View style={[row, { alignItems: "center", gap: 8 }]}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: g.accent }} />
        <GText style={[gType.caption, { fontWeight: "700", color: g.accentText, flex: 1 }, align]}>{a.tag}</GText>
        <GText soft style={gType.caption}>{a.stage}</GText>
      </View>
      <GText style={[gType.label, { fontWeight: "800", marginTop: 8 }, align]}>{a.title}</GText>
      {pct ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: g.tint, marginTop: 12, overflow: "hidden", alignItems: row.flexDirection === "row" ? "flex-start" : "flex-end" }}>
          <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: g.accent }} />
        </View>
      ) : null}
      <View style={[row, { alignItems: "center", gap: 4, marginTop: 12 }]}>
        <GText style={[gType.caption, { fontWeight: "800", color: g.accentText }]}>{a.labels ? t("View request", "عرض الطلب") : t("View answer", "عرض الرد")}</GText>
        <GIcon name="arrow-forward" size={14} flip />
      </View>
    </Tap>
  );
}

function ShopTile({ s }: { s: CatalogShopRow }) {
  const { g, shadow, align } = useGarageTheme();
  const { t } = useL();
  return (
    <Tap label={s.name} onPress={() => router.push(`/customer/shops/${s.id}`)} style={[{ width: 220, backgroundColor: g.card, borderRadius: gShape.card, padding: 8 }, shadow(1)]}>
      <PrivatePhoto uri={s.storefrontUri} fallback="service.parts" radius={16} style={{ width: "100%", height: 110 }} />
      <View style={{ padding: 6, gap: 2 }}>
        <GText numberOfLines={1} style={[gType.label, { fontWeight: "800" }, align]}>{s.name}</GText>
        <GText soft numberOfLines={1} style={[gType.caption, align]}>{`${s.city} · ${s.productCount} ${s.productCount === 1 ? t("part", "قطعة") : t("parts", "قطع")}`}</GText>
      </View>
    </Tap>
  );
}

export default function CustomerHome() {
  const user = useSessionUser();
  const { t } = useL();
  const { g, row, align } = useGarageTheme();
  const [refreshing, setRefreshing] = useState(false);

  // the account's car: set anywhere (Home, Parts, Profile), every screen updates at once
  const { car } = useMyCar();
  const carKey = car ? `${car.make}|${car.model}|${car.year}` : "";

  const fit = useLoad(() => (car ? catalogService.searchParts({ make: car.make, model: car.model, year: car.year }) : Promise.resolve(null)), [carKey]);
  const recent = useLoad(() => catalogService.searchParts({ sort: "newest" }), []);
  const shops = useLoad(() => catalogService.getShops(), []);
  const tow = useLoad(() => catalogService.listTowCompanies(), []);
  const mechs = useLoad(() => mechanicCatalog.list(), []);
  const { active, reload: reloadActive } = useActiveRequest();

  const refresh = async () => {
    setRefreshing(true);
    await Promise.allSettled([fit.reload(), recent.reload(), shops.reload(), tow.reload(), mechs.reload(), reloadActive()]);
    setRefreshing(false);
  };

  const firstName = user.fullName.trim().split(/\s+/)[0] || user.fullName;

  // real counts only; a subline is left out until its number is known
  const trucksFree = tow.data ? tow.data.reduce((n, c) => n + c.availableTrucks, 0) : null;
  const fitCount = car && fit.data ? fit.data.total : null;
  const partCount = recent.data ? recent.data.total : null;
  const mechCount = mechs.data ? mechs.data.total : null;
  const shopList = (shops.data ?? []).filter((s) => s.productCount > 0);

  // about the user, not the catalogue
  const line = car ? t(`Your ${carName(car)}`, `سيارتك ${carName(car)}`) : t("Set your car to get matching parts", "حدّد سيارتك لتظهر القطع المناسبة");

  const rail = car ? fit : recent;
  const railItems = rail.data?.products.slice(0, 10) ?? [];

  return (
    <GaragePage
      tabs
      entry="home"
      refreshing={refreshing}
      onRefresh={refresh}
      hero={
        <HeroLayout
          config={{
            tab: "home",
            title: greeting(t, firstName),
            line,
            action: active
              ? { kind: "button", icon: "pulse-outline", label: active.stage, onPress: () => router.push(active.href as never) }
              : { kind: "button", icon: "car-outline", label: t("Request a tow", "اطلب سحبًا"), onPress: () => router.navigate("/customer/tow") },
          }}
        />
      }
    >
      {car ? <CarPreview key="car3d" /> : null}
      {active ? (
        <View key={active.key} style={car ? { marginTop: 12 } : undefined}>
          <ActiveCard a={active} />
        </View>
      ) : null}

      <Section title={t("What does your car need?", "ماذا تحتاج سيارتك؟")} style={active ? undefined : { marginTop: 4 }}>
        <View style={[row, { gap: 10 }]}>
          <ServiceCard
            photo="service.tow"
            primary
            title={t("Tow", "سحب")}
            sub={trucksFree !== null ? t(`${trucksFree} ${trucksFree === 1 ? "truck" : "trucks"} free`, `${trucksFree} شاحنات متاحة`) : undefined}
            onPress={() => router.navigate("/customer/tow")}
          />
          <ServiceCard
            photo="service.parts"
            title={t("Parts", "قطع")}
            sub={fitCount !== null ? t(`${fitCount} fit you`, `${fitCount} تناسبك`) : partCount !== null ? t(`${partCount} ${partCount === 1 ? "part" : "parts"}`, `${partCount} قطعة`) : undefined}
            onPress={() => router.navigate("/customer/parts")}
          />
          <ServiceCard
            photo="service.mechanics"
            title={t("Mechanics", "ميكانيكي")}
            sub={mechCount !== null ? t(`${mechCount} verified`, `${mechCount} موثّقون`) : undefined}
            onPress={() => router.navigate("/customer/mechanics")}
          />
        </View>
      </Section>

      <Section
        title={car ? `${t("For your", "لسيارتك")} ${carName({ ...car, year: "" })}` : t("New on MOTEXA", "جديد على موتكسا")}
        action={{ label: t("See all", "عرض الكل"), onPress: () => router.navigate({ pathname: "/customer/parts", params: car ? { fit: "1" } : {} }) }}
      >
        {railItems.length ? (
          <Rail>
            {railItems.map((p) => (
              <ProductCard key={p.id} p={p} compact width={164} car={car} onPress={() => router.push(`/customer/parts/${p.id}`)} />
            ))}
          </Rail>
        ) : rail.error ? (
          <ErrorState text={rail.error} onRetry={rail.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : rail.loading ? (
          <View style={[row, { gap: 12 }]}>
            <SkeletonBlock width={164} height={230} radius={gShape.card} />
            <SkeletonBlock width={164} height={230} radius={gShape.card} />
          </View>
        ) : (
          <Card soft>
            <GText soft style={[gType.bodySm, align]}>{car ? t("No parts match this car yet.", "لا توجد قطع مطابقة لهذه السيارة بعد.") : t("No parts are available yet.", "لا توجد قطع متاحة بعد.")}</GText>
          </Card>
        )}
      </Section>

      <Section title={t("Shops on MOTEXA", "متاجر على موتكسا")} action={shopList.length ? { label: t("Map", "الخريطة"), onPress: () => router.push("/customer/parts/map") } : undefined}>
        {shopList.length ? (
          <Rail>
            {shopList.map((s) => (
              <ShopTile key={s.id} s={s} />
            ))}
          </Rail>
        ) : shops.error ? (
          <ErrorState text={shops.error} onRetry={shops.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : shops.loading ? (
          <SkeletonBlock height={170} radius={gShape.card} />
        ) : (
          <Card soft>
            <GText soft style={[gType.bodySm, align]}>{t("No shops yet.", "لا توجد متاجر بعد.")}</GText>
          </Card>
        )}
      </Section>

      <View style={[row, { marginTop: 24, minHeight: 52, alignItems: "center", gap: 10, paddingHorizontal: 16, borderRadius: gShape.card, borderWidth: 1, borderStyle: "dashed", borderColor: g.line }]}>
        <GIcon name="sparkles-outline" size={18} color={g.soft} />
        <GText soft style={[gType.label, { flex: 1 }, align]}>{t("AI diagnosis", "تشخيص بالذكاء الاصطناعي")}</GText>
        <GText soft style={gType.caption}>{t("Coming soon", "قريباً")}</GText>
      </View>
    </GaragePage>
  );
}
