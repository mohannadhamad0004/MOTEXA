import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { C } from "../shared/palette";
import { formatPrice } from "../shared/money";
import { Card, Thumb, useL } from "../shared/ui";
import { FitBadge, carName } from "./catalogBits";
import type { CatalogShopRow } from "./catalogService";
import type { CatalogProduct } from "./catalogService";
import { ConditionBadge } from "./partAttrs";
import { StockStateBadge } from "../parts/partsBits";

type Car = { make: string; model: string; year: string };

/** A section title with an optional "See all" link on the other side. */
export function RowHeader({ title, onSeeAll, extra }: { title: string; onSeeAll?: () => void; extra?: string }) {
  const { t, row, align, isArabic } = useL();
  return (
    <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 12, gap: 10 }]}>
      <Text numberOfLines={2} style={[{ color: "#E8D8CC", fontSize: 12, fontWeight: "800", letterSpacing: 1.2, flex: 1 }, align]}>{title.toUpperCase()}</Text>
      {onSeeAll ? (
        <TouchableOpacity accessibilityRole="button" onPress={onSeeAll} hitSlop={10} style={[row, { alignItems: "center", gap: 2 }]}>
          <Text style={{ color: C.accent, fontSize: 12, fontWeight: "800" }}>{extra ?? t("See all", "عرض الكل")}</Text>
          <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={14} color={C.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/** A horizontally scrolling row that runs to the screen edges (the screen has 18px side padding). */
export function HRow({ children }: { children: ReactNode }) {
  const { row } = useL();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={[row, { paddingHorizontal: 18, gap: 12 }]}>
      {children}
    </ScrollView>
  );
}

/** Compact product card for the Home rows: image, name, price, stock, Used/Refurbished and fit badges. */
export function MiniProductCard({ p, car, onPress }: { p: CatalogProduct; car: Car | null; onPress: () => void }) {
  const { align } = useL();
  return (
    <View style={{ width: 158 }}>
      <Card label={p.name} onPress={onPress}>
        <View style={{ alignItems: "center", marginBottom: 10 }}>
          <Thumb uri={p.imageUri} icon="cube-outline" size={96} />
        </View>
        <Text numberOfLines={2} style={[{ color: C.text, fontSize: 13, fontWeight: "800", minHeight: 34 }, align]}>{p.name}</Text>
        <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 11, marginTop: 2 }, align]}>{p.brand}</Text>
        <Text style={[{ color: C.accent, fontSize: 15, fontWeight: "800", marginTop: 6 }, align]}>{formatPrice(p.price)}</Text>
        <View style={{ gap: 5, marginTop: 8, alignItems: "flex-start" }}>
          <StockStateBadge state={p.stock} />
          <ConditionBadge value={p.condition} />
          {car ? <FitBadge p={p} car={car} /> : null}
        </View>
      </Card>
    </View>
  );
}

/** A shop in the "Shops on MOTEXA" row: name, city and the number of parts it sells. */
export function ShopTile({ s, onPress }: { s: CatalogShopRow; onPress: () => void }) {
  const { t, align } = useL();
  return (
    <View style={{ width: 172 }}>
      <Card label={s.name} onPress={onPress}>
        <Ionicons name="storefront-outline" size={26} color={C.accent} />
        <Text numberOfLines={2} style={[{ color: C.text, fontSize: 14, fontWeight: "800", marginTop: 10, minHeight: 36 }, align]}>{s.name}</Text>
        <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>{s.city}</Text>
        <Text style={[{ color: C.textDim, fontSize: 11, marginTop: 8 }, align]}>
          {s.productCount} {s.productCount === 1 ? t("part", "قطعة") : t("parts", "قطع")}
        </Text>
      </Card>
    </View>
  );
}

export { carName };
