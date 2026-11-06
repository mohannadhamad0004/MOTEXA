import { StyleProp, View, ViewStyle } from "react-native";
import { formatPrice } from "../../core/constants/money";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { PhotoKey } from "../../theme/photos";
import { PartPhoto } from "../../features/catalog/PartPhoto";
import { fitStatus, type CatalogProduct, type FitStatus, type ProductBadge } from "../../features/catalog/catalogService";
import { Photo } from "./Photo";
import { Badge, Tap, Tone } from "./primitives";
import { GIcon, GText } from "./text";
import { useLanguage } from "../../i18n/LanguageContext";

/** Home service card: photo on top, title, real subline. `primary` = filled accent (Tow). */
export function ServiceCard({ photo, title, sub, primary, onPress }: { photo: PhotoKey; title: string; sub?: string; primary?: boolean; onPress: () => void }) {
  const { g, shadow, align } = useGarageTheme();
  const fg = primary ? g.onAccent : g.ink;
  return (
    <Tap label={title} onPress={onPress} style={[{ flex: 1, borderRadius: gShape.card, backgroundColor: primary ? g.accent : g.card, padding: 8 }, shadow(primary ? 2 : 1)]}>
      <Photo k={photo} radius={16} style={{ width: "100%", aspectRatio: 4 / 3 }} />
      <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4, minHeight: 52 }}>
        <GText numberOfLines={1} style={[gType.label, { fontWeight: "800", color: fg }, align]}>{title}</GText>
        {sub ? <GText numberOfLines={2} style={[gType.tiny, { color: primary ? fg : g.soft, opacity: primary ? 0.9 : 1 }, align]}>{sub}</GText> : null}
      </View>
    </Tap>
  );
}

const t2 = (ar: boolean) => (en: string, a: string) => (ar ? a : en);

/** Card badges from the server's list: at most `max`, in priority Sold out > Discount > Only N left > New. */
export function cardBadges(badges: ProductBadge[] | undefined, isArabic: boolean, max = 2): { label: string; tone: Tone | "dark" }[] {
  const t = t2(isArabic);
  const by = (k: ProductBadge["kind"]) => (badges ?? []).find((b) => b.kind === k);
  const out: { label: string; tone: Tone | "dark" }[] = [];
  if (by("SOLD_OUT")) out.push({ label: t("Sold out", "نفدت الكمية"), tone: "dark" });
  const d = by("DISCOUNT");
  if (d) out.push({ label: `−${d.value}%`, tone: "danger" });
  const low = by("LOW_STOCK");
  if (low) out.push({ label: t(`Only ${low.value} left`, `بقي ${low.value} فقط`), tone: "warning" });
  if (by("NEW")) out.push({ label: t("New", "جديد"), tone: "success" });
  return out.slice(0, max);
}

type Car = { make: string; model: string; year: string; trim?: string; generation?: { id: string } | null };

/**
 * The fit line for a car. Only FITS claims a fit (from a fitment row); UNIVERSAL is the shop's "fits every car"; a part with no
 * fitment data never claims anything ("Not sure? Ask the shop"). `mine` = the customer's own car (vs another car they browse).
 */
export function fitLine(status: FitStatus, car: Car, mine: boolean, isArabic: boolean) {
  const t = t2(isArabic);
  const name = [car.model, car.year].filter(Boolean).join(" ");
  switch (status) {
    case "FITS":
      return { icon: "checkmark-circle", tone: "success", text: mine ? t(`Fits your ${name}`, `تناسب ${name} الخاصة بك`) : t(`Fits ${name}`, `تناسب ${name}`) } as const;
    case "UNIVERSAL":
      return { icon: "globe-outline", tone: "accent", text: t("Universal", "عامة لكل السيارات") } as const;
    case "NOT_LISTED":
      return { icon: "alert-circle-outline", tone: "warning", text: mine ? t(`Not listed for your ${name}`, `غير مدرجة لـ ${name}`) : t(`Not listed for ${name}`, `غير مدرجة لـ ${name}`) } as const;
    default:
      return { icon: "help-circle-outline", tone: "soft", text: t("Not sure? Ask the shop", "غير متأكد؟ اسأل المتجر") } as const;
  }
}

/**
 * Photo-first product card (two-column grid or a rail). Keeps the catalogue's real-photo handling (PartPhoto: whole picture,
 * never stretched; a failed load calls onBroken so the list can drop it).
 */
export function ProductCard({ p, onPress, car = null, mine = true, onBroken, width, compact }: { p: CatalogProduct; onPress: () => void; car?: Car | null; /** car is the customer's own (not a browsed one) */ mine?: boolean; onBroken?: (id: string) => void; width?: number | `${number}%`; compact?: boolean }) {
  const { g, shadow, row, align } = useGarageTheme();
  const { isArabic } = useLanguage();
  const t = t2(isArabic);
  const badges = cardBadges(p.badges, isArabic);
  const fit = car ? fitLine(fitStatus(p, car), car, mine, isArabic) : null;
  const fitColor = fit ? { success: g.success, accent: g.accentText, warning: g.warning, soft: g.soft }[fit.tone] : g.soft;
  // "3D · View on my car" only on a car whose generation has the part; kits also say "Front + rear"
  const m3 = p.model3d, onCar3d = !!m3 && !!car?.generation?.id && (m3.universal || m3.generationIds.includes(car.generation.id));
  const kit = !!m3 && m3.parts.some((x) => x.part === "FRONT") && m3.parts.some((x) => x.part === "REAR");
  const pills3d = [kit ? t("Front + rear", "أمامي + خلفي") : null, onCar3d ? `3D · ${t("View on my car", "اعرضها على سيارتي")}` : null].filter((x): x is string => !!x);
  const old = p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : null;
  const stock = { IN: [g.success, t("In stock", "متوفر")], LOW: [g.warning, t("Low stock", "كمية محدودة")], OUT: [g.danger, t("Out of stock", "نفدت الكمية")] }[p.stock];
  const cond = p.condition === "USED" ? t("Used", "مستعمل") : p.condition === "REFURBISHED" ? t("Refurbished", "مجدّد") : t("New", "جديد");
  return (
    <Tap label={p.name} onPress={onPress} style={[{ width: width ?? "48%", borderRadius: gShape.card, backgroundColor: g.card, padding: 8 }, shadow(1)]}>
      <View>
        <PartPhoto uri={p.imageUri} style={{ borderRadius: 16 }} onFail={onBroken ? () => onBroken(p.id) : undefined} />
        {badges.length ? (
          <View style={[row, { position: "absolute", top: 8, left: 8, right: 8, gap: 4, flexWrap: "wrap" }]}>
            {badges.map((b) => (
              <Badge key={b.label} label={b.label} tone={b.tone} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4, gap: 2 }}>
        <GText numberOfLines={2} style={[{ fontSize: compact ? 13 : 14, lineHeight: compact ? 18 : 19, fontWeight: "700", minHeight: compact ? 36 : 38 }, align]}>{p.name}</GText>
        <GText soft numberOfLines={1} style={[gType.tiny, align, { writingDirection: "ltr" }]}>{p.partNumber}</GText>
        <GText soft numberOfLines={1} style={[gType.tiny, align]}>{`${p.brand} · ${cond}`}</GText>
        <View style={[row, { alignItems: "baseline", gap: 6, marginTop: 4, flexWrap: "wrap" }]}>
          <GText style={{ fontSize: compact ? 15 : 17, lineHeight: compact ? 20 : 23, fontWeight: "800", color: g.accentText, writingDirection: "ltr" }}>{formatPrice(p.price)}</GText>
          {old ? <GText soft style={{ fontSize: 12, textDecorationLine: "line-through", writingDirection: "ltr" }}>{formatPrice(old)}</GText> : null}
        </View>
        <View style={[row, { alignItems: "center", gap: 5 }]}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: stock[0] }} />
          <GText numberOfLines={1} style={[gType.tiny, { fontWeight: "700", color: stock[0] }]}>{stock[1]}</GText>
        </View>
        {fit ? (
          <View style={[row, { alignItems: "center", gap: 4, marginTop: 2 }]}>
            <GIcon name={fit.icon} size={14} color={fitColor} />
            <GText numberOfLines={1} style={[gType.tiny, { fontWeight: "600", color: fitColor, flexShrink: 1 }]}>{fit.text}</GText>
          </View>
        ) : null}
        {pills3d.length ? <View style={[row, { flexWrap: "wrap", gap: 4, marginTop: 4 }]}>{pills3d.map((l) => <Badge key={l} label={l} tone="accent" />)}</View> : null}
      </View>
    </Tap>
  );
}

/** Two-column grid of children with even gaps. */
export function Grid({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { row } = useGarageTheme();
  return <View style={[row, { flexWrap: "wrap", justifyContent: "space-between", rowGap: 14 }, style]}>{children}</View>;
}
