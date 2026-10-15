import { Text, View } from "react-native";
import { StockStateBadge, fitmentSummary } from "../parts/partsBits";
import { C } from "../shared/palette";
import { Card, Thumb, useL } from "../shared/ui";
import type { CatalogProduct } from "./catalogService";

/** One catalog product in a list. Price is a bare number (no currency), stock is a state. */
export function ProductCard({ p, onPress, showShop = true }: { p: CatalogProduct; onPress: () => void; showShop?: boolean }) {
  const { t, row, align } = useL();
  return (
    <Card label={p.name} onPress={onPress}>
      <View style={[row, { gap: 14 }]}>
        <Thumb uri={p.imageUri} icon="cube-outline" size={64} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[{ color: C.text, fontSize: 15, fontWeight: "800" }, align]}>{p.name}</Text>
          <Text numberOfLines={1} style={[{ color: C.textMuted, fontSize: 12, marginTop: 3 }, align]}>
            {p.brand} · {p.partNumber}
          </Text>
          <Text numberOfLines={1} style={[{ color: C.textDim, fontSize: 12, marginTop: 2 }, align]}>{fitmentSummary(p, t)}</Text>
        </View>
      </View>
      <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 12 }]}>
        <Text style={{ color: C.accent, fontSize: 15, fontWeight: "800", marginHorizontal: 4 }}>{p.price.toFixed(2)}</Text>
        <StockStateBadge state={p.stock} />
      </View>
      {showShop && (
        <Text numberOfLines={1} style={[{ color: C.textDim, fontSize: 11, marginTop: 10 }, align]}>
          {p.shop.name} · {p.shop.city}
        </Text>
      )}
    </Card>
  );
}
