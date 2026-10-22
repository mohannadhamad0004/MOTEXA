import { View } from "react-native";
import { Icon, Ltr, Mono, PartThumb, Press } from "../../components/blueprint";
import { Text } from "../../components/ui/Text";
import { formatPrice } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { fitmentSummary } from "../parts/partsBits";
import { fitsCar, type CatalogProduct } from "./catalogService";
import { usePartLabels } from "./partAttrs";

type Car = { make: string; model: string; year: string };
export const carName = (c: Car) => [c.make, c.model, c.year].map((v) => v.trim()).filter(Boolean).join(" ");

/** "Fits your <car>" (bronze check) / "Doesn't fit your <car>" (danger). Renders nothing when no car is set. */
export function FitBadge({ p, car }: { p: { fitments: CatalogProduct["fitments"] }; car: Car | null }) {
  const { t, row } = useL();
  const { c } = useTheme();
  if (!car) return null;
  const fits = fitsCar(p, car);
  const color = fits ? c.bronze : c.danger;
  return (
    <View style={[row, { alignItems: "center", gap: 4 }]}>
      <Icon name={fits ? "check" : "alert"} size={14} color={color} />
      <Text numberOfLines={1} style={{ color, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>
        {`${fits ? t("Fits your", "تناسب سيارتك") : t("Doesn't fit your", "لا تناسب سيارتك")} ${carName(car)}`}
      </Text>
    </View>
  );
}

export { Chip, ChipRow } from "../../components/ui/Chip";

/** Stock as one coloured word (customers get a state, never a count). */
export function StockWord({ state }: { state: "IN" | "LOW" | "OUT" }) {
  const { t } = useL();
  const { c } = useTheme();
  const m = {
    IN: { color: c.success, label: t("In stock", "متوفر") },
    LOW: { color: c.warning, label: t("Low stock", "مخزون منخفض") },
    OUT: { color: c.danger, label: t("Out of stock", "نفد المخزون") },
  }[state];
  return <Text style={{ color: m.color, fontSize: 12, fontWeight: "700" }}>{m.label}</Text>;
}

/** One catalog product in a list: thumb, name, price, "brand · condition · part number", fit line, shop. */
export function ProductCard({ p, onPress, showShop = true, car = null }: { p: CatalogProduct; onPress: () => void; showShop?: boolean; car?: Car | null }) {
  const { c } = useTheme();
  const { t, row, align } = useL();
  const labels = usePartLabels();
  return (
    <Press
      accessibilityLabel={p.name}
      onPress={onPress}
      style={[row, { gap: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.line + "99" }]}
    >
      <PartThumb category={p.category} uri={p.imageUri} size={96} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{p.name}</Text>
        <View style={[row, { alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 4 }]}>
          <Ltr style={{ fontSize: 22, fontWeight: "700" }}>{formatPrice(p.price)}</Ltr>
          <StockWord state={p.stock} />
        </View>
        <View style={[row, { alignItems: "center", flexWrap: "wrap", gap: 4, marginTop: 2 }]}>
          <Text numberOfLines={1} style={{ color: c.soft, fontSize: 12 }}>{`${p.brand} · ${labels.condition[p.condition]} ·`}</Text>
          <Mono numberOfLines={1} size={11}>{p.partNumber}</Mono>
        </View>
        {car ? (
          <View style={{ marginTop: 4 }}>
            <FitBadge p={p} car={car} />
          </View>
        ) : (
          <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12, marginTop: 4 }, align]}>{fitmentSummary(p, t)}</Text>
        )}
        {showShop && (
          <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12, marginTop: 2 }, align]}>
            {p.shop.name} · {p.shop.city}
          </Text>
        )}
      </View>
    </Press>
  );
}
