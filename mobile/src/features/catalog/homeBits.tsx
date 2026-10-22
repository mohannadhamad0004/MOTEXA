import { ReactNode } from "react";
import { View } from "react-native";
import { HScroll, Icon, Ltr, PartThumb, Press, RoundIcon } from "../../components/blueprint";
import { Text } from "../../components/ui/Text";
import { formatPrice } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { carName } from "./catalogBits";
import type { CatalogProduct, CatalogShopRow } from "./catalogService";

export { carName };

/** A horizontally scrolling row that runs to the screen edges (the sheet has 20px side padding). */
export function HRow({ children }: { children: ReactNode }) {
  return <HScroll gap={12}>{children}</HScroll>;
}

/** Compact card for the Home rows: square thumb, name, price. */
export function MiniProductCard({ p, onPress }: { p: CatalogProduct; car?: unknown; onPress: () => void }) {
  const { c } = useTheme();
  const { align } = useL();
  return (
    <Press accessibilityLabel={p.name} onPress={onPress} style={{ width: 160, borderRadius: 20, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, padding: 10 }}>
      <PartThumb category={p.category} uri={p.imageUri} />
      <Text numberOfLines={1} style={[{ color: c.ink, fontSize: 13, fontWeight: "600", marginTop: 10 }, align]}>{p.name}</Text>
      <Ltr style={{ fontSize: 15, fontWeight: "700", marginTop: 2 }}>{formatPrice(p.price)}</Ltr>
    </Press>
  );
}

/** A shop row: round icon, name, city, chevron. */
export function ShopRow({ s, onPress }: { s: CatalogShopRow; onPress: () => void }) {
  const { c } = useTheme();
  const { t, row, align } = useL();
  return (
    <Press accessibilityLabel={s.name} onPress={onPress} style={[row, { alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line + "99" }]}>
      <RoundIcon icon="shop" />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[{ color: c.ink, fontSize: 14, fontWeight: "700" }, align]}>{s.name}</Text>
        <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 12 }, align]}>
          {s.city} · {s.productCount} {s.productCount === 1 ? t("part", "قطعة") : t("parts", "قطع")}
        </Text>
      </View>
      <Icon name="chev" size={16} color={c.soft} />
    </Press>
  );
}
