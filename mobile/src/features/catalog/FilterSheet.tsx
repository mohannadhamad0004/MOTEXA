import { useEffect, useState } from "react";
import { View } from "react-native";
import { Chip, Field, GButton, GIcon, GText, Note, Sheet, Tap } from "../../components/garage";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { CITIES, cityLabel } from "../../core/constants/cities";
import { CURRENCY, priceTag } from "../../core/constants/money";
import { useL } from "../../core/hooks/useL";
import { catalogService } from "./catalogService";
import { EMPTY_FILTERS, PartFilters, priceOk, priceProblem } from "./filters";
import { CONDITIONS, PART_TYPES, usePartLabels } from "./partAttrs";

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** A titled group of the filter sheet. */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const { align } = useGarageTheme();
  return (
    <View style={{ marginTop: 18 }}>
      <GText style={[gType.label, align, { fontWeight: "800" }]}>{title}</GText>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}
const Wrap = ({ children }: { children: React.ReactNode }) => {
  const { row } = useGarageTheme();
  return <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{children}</View>;
};

/** Bottom sheet: condition, type, brand, price range, in stock, shop city. Nothing changes until "Show results". */
export function FilterSheet({
  visible,
  value,
  category,
  group,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: PartFilters;
  category?: string | null;
  group?: string | null;
  onApply: (f: PartFilters) => void;
  onClose: () => void;
}) {
  const { g } = useGarageTheme();
  const { t, isArabic, row, align } = useL();
  const labels = usePartLabels();
  const [draft, setDraft] = useState(value);
  const [brands, setBrands] = useState<string[] | null>(null);
  const [brandsError, setBrandsError] = useState(false);
  const problem = priceProblem(draft);

  // Start from the active filters each time the sheet opens; load the brands that really exist (in this category).
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    let live = true;
    setBrands(null);
    setBrandsError(false);
    catalogService
      .getBrands({ category: category ?? undefined, group: group ?? undefined })
      .then((b) => live && setBrands(b))
      .catch(() => live && setBrandsError(true));
    return () => {
      live = false;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only when the sheet opens
  }, [visible]);

  // A brand picked earlier stays visible even if the current list no longer has it, so it can be switched off.
  const brandList = [...new Set([...(brands ?? []), ...draft.brands])].sort((a, b) => a.localeCompare(b));
  const muted = { color: g.soft, fontSize: 12 } as const;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t("Filters", "التصفية")}
      closeLabel={t("Close", "إغلاق")}
      tall
      footer={
        <View style={[row, { gap: 12 }]}>
          <GButton flex variant="secondary" label={t("Reset", "إعادة ضبط")} onPress={() => setDraft(EMPTY_FILTERS)} />
          <GButton flex label={t("Show results", "عرض النتائج")} disabled={!!problem} onPress={() => onApply(draft)} />
        </View>
      }
    >
      <View>
        <Group title={t("Condition", "الحالة")}>
          <Wrap>
            {CONDITIONS.map((c) => (
              <Chip key={c} label={labels.condition[c]} on={draft.conditions.includes(c)} onPress={() => setDraft({ ...draft, conditions: toggle(draft.conditions, c) })} />
            ))}
          </Wrap>
        </Group>

        <Group title={t("Type", "النوع")}>
          <Wrap>
            <Chip label={t("Any", "أي نوع")} on={draft.partType === null} onPress={() => setDraft({ ...draft, partType: null })} />
            {PART_TYPES.map((p) => (
              <Chip key={p} label={labels.type[p]} on={draft.partType === p} onPress={() => setDraft({ ...draft, partType: p })} />
            ))}
          </Wrap>
        </Group>

        <Group title={t("Brand", "الماركة")}>
          {brands === null && !brandsError ? (
            <GText style={[muted, align]}>{t("Loading brands…", "جارٍ تحميل الماركات…")}</GText>
          ) : brandsError && !brandList.length ? (
            <GText style={[muted, align]}>{t("Brands could not be loaded.", "تعذّر تحميل الماركات.")}</GText>
          ) : !brandList.length ? (
            <GText style={[muted, align]}>{t("No brands yet.", "لا توجد ماركات بعد.")}</GText>
          ) : (
            <Wrap>
              {brandList.map((b) => (
                <Chip key={b} label={b} on={draft.brands.includes(b)} onPress={() => setDraft({ ...draft, brands: toggle(draft.brands, b) })} />
              ))}
            </Wrap>
          )}
        </Group>

        <Group title={`${t("Price", "السعر")} (${CURRENCY.symbol})`}>
          <View style={[row, { gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Field label={t("Min", "الأدنى")} value={draft.minPrice} keyboardType="decimal-pad" maxLength={12} error={priceOk(draft.minPrice) ? undefined : t("Numbers only", "أرقام فقط")} onChangeText={(v) => setDraft({ ...draft, minPrice: v })} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("Max", "الأعلى")} value={draft.maxPrice} keyboardType="decimal-pad" maxLength={12} error={priceOk(draft.maxPrice) ? undefined : t("Numbers only", "أرقام فقط")} onChangeText={(v) => setDraft({ ...draft, maxPrice: v })} />
            </View>
          </View>
          {problem === "order" ? <Note tone="danger" icon="alert-circle-outline">{t("The minimum price is higher than the maximum.", "السعر الأدنى أعلى من السعر الأعلى.")}</Note> : null}
        </Group>

        <Group title={t("Availability", "التوفر")}>
          <Wrap>
            <Chip label={t("In stock only", "المتوفر فقط")} on={draft.inStock} onPress={() => setDraft({ ...draft, inStock: !draft.inStock })} />
            <Chip icon="pricetag-outline" label={t("On sale", "عليها خصم")} on={draft.onSale} onPress={() => setDraft({ ...draft, onSale: !draft.onSale })} />
          </Wrap>
        </Group>

        <Group title={t("Shop city", "مدينة المتجر")}>
          <Wrap>
            {CITIES.map((c) => (
              <Chip key={c.name} label={cityLabel(c.name, isArabic)} on={draft.city === c.name} onPress={() => setDraft({ ...draft, city: draft.city === c.name ? "" : c.name })} />
            ))}
          </Wrap>
        </Group>
      </View>
    </Sheet>
  );
}

/** The active filters as small removable chips under the result count, with "Clear all". */
export function ActiveFilters({ value, onChange }: { value: PartFilters; onChange: (f: PartFilters) => void }) {
  const { t, isArabic } = useL();
  const { g, row } = useGarageTheme();
  const labels = usePartLabels();
  const chips: { key: string; label: string; next: PartFilters }[] = [];
  for (const k of value.conditions) chips.push({ key: "c:" + k, label: labels.condition[k], next: { ...value, conditions: value.conditions.filter((x) => x !== k) } });
  if (value.partType) chips.push({ key: "type", label: labels.type[value.partType], next: { ...value, partType: null } });
  for (const b of value.brands) chips.push({ key: "b:" + b, label: b, next: { ...value, brands: value.brands.filter((x) => x !== b) } });
  const min = value.minPrice.trim();
  const max = value.maxPrice.trim();
  if (min || max) {
    const label = min && max ? priceTag(`${min}–${max}`) : min ? `${t("From", "من")} ${priceTag(min)}` : `${t("Up to", "حتى")} ${priceTag(max)}`;
    chips.push({ key: "price", label, next: { ...value, minPrice: "", maxPrice: "" } });
  }
  if (value.inStock) chips.push({ key: "stock", label: t("In stock only", "المتوفر فقط"), next: { ...value, inStock: false } });
  if (value.onSale) chips.push({ key: "sale", label: t("On sale", "عليها خصم"), next: { ...value, onSale: false } });
  if (value.city) chips.push({ key: "city", label: cityLabel(value.city, isArabic), next: { ...value, city: "" } });
  if (!chips.length) return null;
  return (
    <View style={[row, { flexWrap: "wrap", gap: 6, marginTop: 8 }]}>
      {chips.map((k) => (
        <Tap key={k.key} label={`${k.label} ×`} onPress={() => onChange(k.next)} style={[row, { minHeight: 34, alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: gShape.pill, backgroundColor: g.tint, borderWidth: 1, borderColor: g.line }]}>
          <GText numberOfLines={1} style={[gType.caption, { fontWeight: "700" }]}>{k.label}</GText>
          <GIcon name="close" size={13} color={g.soft} />
        </Tap>
      ))}
      <Tap label={t("Clear all", "مسح الكل")} onPress={() => onChange(EMPTY_FILTERS)} style={{ minHeight: 34, justifyContent: "center", paddingHorizontal: 6 }}>
        <GText style={[gType.caption, { color: g.accentText, fontWeight: "800" }]}>{t("Clear all", "مسح الكل")}</GText>
      </Tap>
    </View>
  );
}
