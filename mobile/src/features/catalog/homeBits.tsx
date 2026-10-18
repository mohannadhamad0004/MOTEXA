import { Card } from "../../components/ui/Card";
import { ImageTile } from "../../components/ui/Rows";
import { useL } from "../../core/hooks/useL";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { formatPrice } from "../../core/constants/money";
import { FitBadge, carName } from "./catalogBits";
import type { CatalogShopRow } from "./catalogService";
import type { CatalogProduct } from "./catalogService";
import { ConditionBadge } from "./partAttrs";
import { StockStateBadge } from "../parts/partsBits";

type Car = { make: string; model: string; year: string };

export { SectionHeader as RowHeader } from "../../components/ui/SectionHeader";

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
  const { c: col } = useTheme();
  const { align } = useL();
  return (
    <View style={{ width: 158 }}>
      <Card label={p.name} onPress={onPress}>
        <View style={{ alignItems: "center", marginBottom: 10 }}>
          <ImageTile uri={p.imageUri} icon="cube-outline" size={96} />
        </View>
        <Text numberOfLines={2} style={[{ color: col.text, fontSize: 13, fontWeight: "800", minHeight: 34 }, align]}>{p.name}</Text>
        <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 11, marginTop: 2 }, align]}>{p.brand}</Text>
        <Text style={[{ color: col.accent, fontSize: 15, fontWeight: "800", marginTop: 6 }, align]}>{formatPrice(p.price)}</Text>
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
  const { c: col } = useTheme();
  const { t, align } = useL();
  return (
    <View style={{ width: 172 }}>
      <Card label={s.name} onPress={onPress}>
        <Ionicons name="storefront-outline" size={26} color={col.accent} />
        <Text numberOfLines={2} style={[{ color: col.text, fontSize: 14, fontWeight: "800", marginTop: 10, minHeight: 36 }, align]}>{s.name}</Text>
        <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{s.city}</Text>
        <Text style={[{ color: col.textDim, fontSize: 11, marginTop: 8 }, align]}>
          {s.productCount} {s.productCount === 1 ? t("part", "قطعة") : t("parts", "قطع")}
        </Text>
      </Card>
    </View>
  );
}

export { carName };
