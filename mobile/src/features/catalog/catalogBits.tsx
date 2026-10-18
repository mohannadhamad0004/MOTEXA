import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { ImageTile } from "../../components/ui/Rows";
import { useL } from "../../core/hooks/useL";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, View } from "react-native";
import { StockStateBadge, fitmentSummary } from "../parts/partsBits";
import { formatPrice } from "../../core/constants/money";
import { fitsCar, type CatalogProduct } from "./catalogService";
import { ConditionBadge } from "./partAttrs";

type Car = { make: string; model: string; year: string };
export const carName = (c: Car) => [c.make, c.model, c.year].map((v) => v.trim()).filter(Boolean).join(" ");

/** "Fits your <car>" / "Doesn't fit your <car>". Renders nothing when no car is set. */
export function FitBadge({ p, car }: { p: { fitments: CatalogProduct["fitments"] }; car: Car | null }) {
  const { t } = useL();
  if (!car) return null;
  return fitsCar(p, car) ? (
    <Badge tone="success" icon="checkmark-circle-outline" label={`${t("Fits your", "تناسب سيارتك")} ${carName(car)}`} />
  ) : (
    <Badge tone="danger" icon="alert-circle-outline" label={`${t("Doesn't fit your", "لا تناسب سيارتك")} ${carName(car)}`} />
  );
}

export { Chip, ChipRow } from "../../components/ui/Chip";

/** One catalog product in a list. Price is a bare number (no currency), stock is a state. */
export function ProductCard({ p, onPress, showShop = true, car = null }: { p: CatalogProduct; onPress: () => void; showShop?: boolean; car?: Car | null }) {
  const { c: col } = useTheme();
  const { t, row, align } = useL();
  return (
    <Card label={p.name} onPress={onPress}>
      <View style={[row, { gap: 14 }]}>
        <ImageTile uri={p.imageUri} icon="cube-outline" size={64} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{p.name}</Text>
          <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
            {p.brand} · {p.partNumber}
          </Text>
          <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 12, marginTop: 2 }, align]}>{fitmentSummary(p, t)}</Text>
        </View>
      </View>
      <View style={[row, { flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 12 }]}>
        <Text style={{ color: col.accent, fontSize: 15, fontWeight: "800", marginHorizontal: 4 }}>{formatPrice(p.price)}</Text>
        <StockStateBadge state={p.stock} />
        <ConditionBadge value={p.condition} />
        <FitBadge p={p} car={car} />
      </View>
      {showShop && (
        <Text numberOfLines={1} style={[{ color: col.textDim, fontSize: 11, marginTop: 10 }, align]}>
          {p.shop.name} · {p.shop.city}
        </Text>
      )}
    </Card>
  );
}
