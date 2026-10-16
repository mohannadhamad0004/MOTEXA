import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";
import { StockStateBadge, fitmentSummary } from "../parts/partsBits";
import { C } from "../shared/palette";
import { Badge, Card, Thumb, useL } from "../shared/ui";
import { fitsCar, type CatalogProduct } from "./catalogService";

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

/** A small pill that wraps with its siblings (used for sort and filter choices). */
export function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? C.accent : C.cardBorder,
        backgroundColor: on ? C.accent : C.card,
      }}
    >
      {icon ? <Ionicons name={icon} size={13} color={on ? C.onAccent : C.textMuted} /> : null}
      <Text style={{ color: on ? C.onAccent : C.textMuted, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Wrapping row of chips, mirrored in Arabic. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  const { row } = useL();
  return <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>{children}</View>;
}

/** One catalog product in a list. Price is a bare number (no currency), stock is a state. */
export function ProductCard({ p, onPress, showShop = true, car = null }: { p: CatalogProduct; onPress: () => void; showShop?: boolean; car?: Car | null }) {
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
        <FitBadge p={p} car={car} />
      </View>
      {showShop && (
        <Text numberOfLines={1} style={[{ color: C.textDim, fontSize: 11, marginTop: 10 }, align]}>
          {p.shop.name} · {p.shop.city}
        </Text>
      )}
    </Card>
  );
}
