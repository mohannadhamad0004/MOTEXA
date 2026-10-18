import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { ImageTile } from "../../../components/ui/Rows";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Chip, FitBadge, ProductCard } from "../../../features/catalog/catalogBits";
import { ConditionBadge, usePartLabels } from "../../../features/catalog/partAttrs";
import { catalogService, currentCar, fitsCar } from "../../../features/catalog/catalogService";
import { StockStateBadge } from "../../../features/parts/partsBits";
import { formatPrice } from "../../../core/constants/money";
import { findCategory, labelOf } from "../../../core/constants/categories";

/** Up to 6 more visible parts of the same shop. Hidden when there are none (or the call fails). */
function OtherFromShop({ shopId, currentId }: { shopId: string; currentId: string }) {
  const { t } = useL();
  const state = useLoad(() => catalogService.searchParts({ shopId }), [shopId]);
  const car = currentCar();
  const others = (state.data?.products ?? []).filter((x) => x.id !== currentId).slice(0, 6);
  if (!others.length) return null;
  return (
    <>
      <SectionHeader title={t("Other parts from this shop", "قطع أخرى من هذا المتجر")} />
      {others.map((x) => (
        <ProductCard key={x.id} p={x} showShop={false} car={car} onPress={() => router.push(`/customer/parts/${x.id}`)} />
      ))}
    </>
  );
}

export default function CustomerPartDetail() {
  const { c: col } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align, isArabic } = useL();
  const state = useLoad(() => catalogService.getPart(id), [id]);
  const car = currentCar();
  const labels = usePartLabels();

  return (
    <Screen>
      <Header brand="MOTEXA" title={t("Part details", "تفاصيل القطعة")} back />
      <Async state={state}>
        {(p) => (
          <>
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <ImageTile uri={p.imageUri} icon="cube-outline" size={150} />
            </View>
            <Text style={[{ color: col.text, fontSize: 21, fontWeight: "800" }, align]}>{p.name}</Text>
            <Text style={[{ color: col.textMuted, fontSize: 13, marginTop: 4 }, align]}>
              {p.brand} · {p.partNumber}
            </Text>
            {findCategory(p.category) ? (
              <View style={[row, { marginTop: 12 }]}>
                <Chip icon={findCategory(p.category)!.icon} label={labelOf(findCategory(p.category), isArabic)} on={false} onPress={() => router.push(`/customer/category/${p.category}`)} />
              </View>
            ) : null}
            <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 14 }]}>
              <Text style={{ color: col.accent, fontSize: 22, fontWeight: "800", marginHorizontal: 4 }}>{formatPrice(p.price)}</Text>
              <StockStateBadge state={p.stock} />
              <ConditionBadge value={p.condition} />
              <FitBadge p={p} car={car} />
            </View>

            {p.partType ? (
              <Text style={[{ color: col.textMuted, fontSize: 13, marginTop: 10 }, align]}>
                {t("Type", "النوع")}: {labels.type[p.partType]}
              </Text>
            ) : null}

            {p.description ? (
              <>
                <SectionHeader title={t("Description", "الوصف")} />
                <Card>
                  <Text style={[{ color: col.text, fontSize: 13, lineHeight: 20 }, align]}>{p.description}</Text>
                </Card>
              </>
            ) : null}

            {car && state.data && !fitsCar(p, car) ? (
              <Notice tone="accent" icon="alert-circle-outline">{t("This part may not fit your car. Check the list below or ask the shop.", "قد لا تناسب هذه القطعة سيارتك. راجع القائمة أدناه أو اسأل المتجر.")}</Notice>
            ) : null}

            <SectionHeader title={t("Fits these vehicles", "تناسب هذه المركبات")} />
            <Card>
              {p.fitments.length ? (
                p.fitments.map((f, i) => (
                  <View key={i} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: col.border }}>
                    <Text style={[{ color: col.text, fontSize: 13, fontWeight: "700" }, align]}>
                      {f.make} {f.model}
                    </Text>
                    <Text style={[{ color: col.textMuted, fontSize: 12, marginTop: 2 }, align]}>
                      {f.yearFrom}–{f.yearTo}
                      {f.trim ? ` · ${f.trim}` : ""}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[{ color: col.textMuted, fontSize: 13 }, align]}>{t("No fitment listed", "لا يوجد توافق محدد")}</Text>
              )}
            </Card>

            <SectionHeader title={t("Sold by", "يُباع بواسطة")} />
            <Card label={p.shop.name} onPress={() => router.push(`/customer/shops/${p.shop.id}`)}>
              <View style={[row, { alignItems: "center", gap: 12 }]}>
                <Ionicons name="storefront-outline" size={24} color={col.accent} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{p.shop.name}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{p.shop.city}</Text>
                </View>
                <Ionicons name={row.flexDirection === "row-reverse" ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
              </View>
            </Card>

            <View style={{ height: 8 }} />
            <Button icon="chatbubble-ellipses-outline" label={t("Ask the shop", "اسأل المتجر")} onPress={() => router.push({ pathname: "/customer/inquiry/new", params: { productId: p.id } })} />

            <OtherFromShop shopId={p.shop.id} currentId={p.id} />
          </>
        )}
      </Async>
    </Screen>
  );
}
