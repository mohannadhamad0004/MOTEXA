import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Icon, InspectionCheck, Ltr, Mono, Press, Rise } from "../../components/blueprint";
import { ease, M, useReduced } from "../../motion";
import { Text } from "../../components/ui/Text";
import { formatPrice } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { fitmentSummary } from "../parts/partsBits";
import { fitsCar, type CatalogProduct } from "./catalogService";
import { usePartLabels } from "./partAttrs";
import { PartPhoto } from "./PartPhoto";

type Car = { make: string; model: string; year: string; trim?: string };
/** "Mercedes-Benz W202 · 1998 · C 200 Petrol" */
export const carName = (c: Car) => [[c.make, c.model].map((v) => v.trim()).filter(Boolean).join(" "), c.year.trim(), (c.trim ?? "").trim()].filter(Boolean).join(" · ");

/** "Fits your <car>" (bronze check) / "Doesn't fit your <car>" (danger). Renders nothing when no car is set. */
export function FitBadge({ p, car, sweep }: { p: { fitments: CatalogProduct["fitments"] }; car: Car | null; sweep?: number }) {
  const { t, row } = useL();
  const { c } = useTheme();
  if (!car) return null;
  const fits = fitsCar(p, car);
  const color = fits ? c.bronze : c.danger;
  return (
    <View style={[row, { alignItems: "center", gap: 4 }]}>
      {fits ? <InspectionCheck size={14} color={color} animate={sweep !== undefined} delay={(sweep ?? 0) * M.staggerFine} /> : <Icon name="alert" size={14} color={color} />}
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
export function ProductCard({
  p,
  onPress,
  showShop = true,
  car = null,
  cascade,
  sweep,
  onBroken,
}: {
  onBroken?: (id: string) => void;
  p: CatalogProduct;
  onPress: () => void;
  showShop?: boolean;
  car?: Car | null;
  /** row index in the first visible batch: the photo fades in 50 ms before the text, rows 45 ms apart */
  cascade?: number;
  /** row index while "Fits my car" has just been switched on: the check sweeps in row by row */
  sweep?: number;
}) {
  const { c } = useTheme();
  const reduced = useReduced();
  // with a car set, parts that do not fit dim slightly
  const dim = !!car && !fitsCar(p, car);
  const o = useSharedValue(dim ? 0.55 : 1);
  useEffect(() => {
    o.value = withTiming(dim ? 0.55 : 1, { duration: reduced ? M.reduced : M.chip, easing: ease });
  }, [dim, reduced, o]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: o.value }));
  const ci = cascade ?? 99;
  const { t, row, align } = useL();
  const labels = usePartLabels();
  return (
    <Animated.View style={dimStyle}>
      <Press
        accessibilityLabel={p.name}
        onPress={onPress}
        style={[row, { gap: 14, paddingVertical: 14, alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: c.line + "99" }]}
      >
        <Rise i={ci} distance={0} style={{ width: "30%" }}>
          <PartPhoto uri={p.imageUri} onFail={onBroken ? () => onBroken(p.id) : undefined} />
        </Rise>
        <Rise i={ci} delay={50} style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 16, fontWeight: "700", lineHeight: 21 }, align]}>{p.name}</Text>
          <View style={[row, { alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 3 }]}>
            <Ltr style={{ fontSize: 21, fontWeight: "700" }}>{formatPrice(p.price)}</Ltr>
            <StockWord state={p.stock} />
          </View>
          <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 13, marginTop: 2 }, align]}>{`${p.brand} · ${labels.condition[p.condition]}`}</Text>
          <View style={[row, { marginTop: 1 }]}>
            <Mono numberOfLines={1} size={11}>{p.partNumber}</Mono>
          </View>
          {car ? (
            <View style={{ marginTop: 6 }}>
              <FitBadge p={p} car={car} sweep={sweep} />
            </View>
          ) : (
            <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12, marginTop: 6 }, align]}>{fitmentSummary(p, t)}</Text>
          )}
          {showShop && (
            <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12, marginTop: 3 }, align]}>
              {p.shop.name} · {p.shop.city}
            </Text>
          )}
        </Rise>
      </Press>
    </Animated.View>
  );
}

/** Stock as a coloured dot + word (real state only). */
export function StockLine({ state }: { state: "IN" | "LOW" | "OUT" }) {
  const { t } = useL();
  const { c } = useTheme();
  const m = { IN: [c.success, t("In stock", "متوفر")], LOW: [c.warning, t("Low stock", "مخزون منخفض")], OUT: [c.danger, t("Out of stock", "نفد المخزون")] }[state];
  return <Text numberOfLines={1} style={{ color: m[0], fontSize: 11, fontWeight: "700" }}>{`● ${m[1]}`}</Text>;
}

/**
 * Photo-first product card: real photo, name, OEM / part number, "brand · condition", price, stock. `compact` = the narrower
 * card of a horizontal row; otherwise the two-column grid card. The whole card opens the part.
 */
export function ProductGridCard({ p, onPress, car = null, onBroken, compact = false, width }: { p: CatalogProduct; onPress: () => void; car?: Car | null; onBroken?: (id: string) => void; compact?: boolean; width?: number | string }) {
  const { c } = useTheme();
  const { row, align } = useL();
  const labels = usePartLabels();
  return (
    <Press accessibilityLabel={p.name} onPress={onPress} style={{ width: (width ?? "48.5%") as any, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, padding: compact ? 6 : 8 }}>
      <PartPhoto uri={p.imageUri} style={{ borderRadius: 12 }} onFail={onBroken ? () => onBroken(p.id) : undefined} />
      <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4 }}>
        <Text numberOfLines={2} style={[{ color: c.ink, fontSize: compact ? 12 : 14, fontWeight: "700", lineHeight: compact ? 16 : 19, minHeight: compact ? 32 : 38 }, align]}>{p.name}</Text>
        <Mono numberOfLines={1} size={compact ? 10 : 11} color={c.soft}>{p.partNumber}</Mono>
        <Text numberOfLines={1} style={[{ color: c.soft, fontSize: compact ? 10.5 : 12, marginTop: 2 }, align]}>{`${p.brand} · ${labels.condition[p.condition]}`}</Text>
        <View style={[row, { alignItems: "center", justifyContent: "space-between", marginTop: 6 }]}>
          <Ltr style={{ fontSize: compact ? 14 : 17, fontWeight: "700" }}>{formatPrice(p.price)}</Ltr>
          {compact ? (
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: c.bronze, alignItems: "center", justifyContent: "center" }}>
              <Icon name="chev" size={11} color={c.btnFg} />
            </View>
          ) : null}
        </View>
        <View style={{ marginTop: 3 }}>
          <StockLine state={p.stock} />
        </View>
        {car ? (
          <View style={{ marginTop: 5 }}>
            <FitBadge p={p} car={car} />
          </View>
        ) : null}
      </View>
    </Press>
  );
}
