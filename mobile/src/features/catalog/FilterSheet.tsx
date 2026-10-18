import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Notice } from "../../components/ui/Feedback";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { useL } from "../../core/hooks/useL";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CITIES, cityLabel } from "../../core/constants/cities";
import { CURRENCY, priceTag } from "../../core/constants/money";
import { Chip, ChipRow } from "./catalogBits";
import { catalogService } from "./catalogService";
import { EMPTY_FILTERS, PartFilters, priceOk, priceProblem } from "./filters";
import { CONDITIONS, PART_TYPES, usePartLabels } from "./partAttrs";

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Full-screen sheet: condition, type, brand, price range, in stock, shop city. Nothing changes until Apply. */
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
  const { c: col } = useTheme();
  const { t, isArabic, row, align } = useL();
  const insets = useSafeAreaInsets();
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: col.bg, paddingTop: insets.top + 8 }}>
        <View style={[row, { alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10 }]}>
          <Text style={{ color: col.text, fontSize: 20, fontWeight: "800" }}>{t("Filters", "التصفية")}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={t("Close", "إغلاق")} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={26} color={col.text} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 24 }}>
            <SectionHeader title={t("Condition", "الحالة")} />
            <ChipRow>
              {CONDITIONS.map((c) => (
                <Chip key={c} label={labels.condition[c]} on={draft.conditions.includes(c)} onPress={() => setDraft({ ...draft, conditions: toggle(draft.conditions, c) })} />
              ))}
            </ChipRow>

            <SectionHeader title={t("Type", "النوع")} />
            <ChipRow>
              <Chip label={t("Any", "أي نوع")} on={draft.partType === null} onPress={() => setDraft({ ...draft, partType: null })} />
              {PART_TYPES.map((p) => (
                <Chip key={p} label={labels.type[p]} on={draft.partType === p} onPress={() => setDraft({ ...draft, partType: p })} />
              ))}
            </ChipRow>

            <SectionHeader title={t("Brand", "الماركة")} />
            {brands === null && !brandsError ? (
              <Text style={[{ color: col.textMuted, fontSize: 12, marginBottom: 12 }, align]}>{t("Loading brands…", "جارٍ تحميل الماركات…")}</Text>
            ) : brandsError && !brandList.length ? (
              <Text style={[{ color: col.textMuted, fontSize: 12, marginBottom: 12 }, align]}>{t("Brands could not be loaded.", "تعذّر تحميل الماركات.")}</Text>
            ) : !brandList.length ? (
              <Text style={[{ color: col.textMuted, fontSize: 12, marginBottom: 12 }, align]}>{t("No brands yet.", "لا توجد ماركات بعد.")}</Text>
            ) : (
              <ChipRow>
                {brandList.map((b) => (
                  <Chip key={b} label={b} on={draft.brands.includes(b)} onPress={() => setDraft({ ...draft, brands: toggle(draft.brands, b) })} />
                ))}
              </ChipRow>
            )}

            <SectionHeader title={`${t("Price", "السعر")} (${CURRENCY.symbol})`} />
            <View style={[row, { gap: 12 }]}>
              <View style={{ flex: 1 }}>
                <Input label={t("Min", "الأدنى")} value={draft.minPrice} keyboardType="decimal-pad" maxLength={12} error={priceOk(draft.minPrice) ? undefined : t("Numbers only", "أرقام فقط")} onChangeText={(v) => setDraft({ ...draft, minPrice: v })} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label={t("Max", "الأعلى")} value={draft.maxPrice} keyboardType="decimal-pad" maxLength={12} error={priceOk(draft.maxPrice) ? undefined : t("Numbers only", "أرقام فقط")} onChangeText={(v) => setDraft({ ...draft, maxPrice: v })} />
              </View>
            </View>
            {problem === "order" ? <Notice tone="danger" icon="alert-circle-outline">{t("The minimum price is higher than the maximum.", "السعر الأدنى أعلى من السعر الأعلى.")}</Notice> : null}

            <SectionHeader title={t("Availability", "التوفر")} />
            <ChipRow>
              <Chip icon="checkmark-circle-outline" label={t("In stock only", "المتوفر فقط")} on={draft.inStock} onPress={() => setDraft({ ...draft, inStock: !draft.inStock })} />
            </ChipRow>

            <SectionHeader title={t("Shop city", "مدينة المتجر")} />
            <ChipRow>
              {CITIES.map((c) => (
                <Chip key={c.name} label={cityLabel(c.name, isArabic)} on={draft.city === c.name} onPress={() => setDraft({ ...draft, city: draft.city === c.name ? "" : c.name })} />
              ))}
            </ChipRow>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[row, { gap: 12, paddingHorizontal: 18, paddingTop: 12, paddingBottom: insets.bottom + 12, borderTopWidth: 1, borderTopColor: col.border }]}>
          <View style={{ flex: 1 }}>
            <Button variant="ghost" icon="refresh-outline" label={t("Reset", "إعادة ضبط")} onPress={() => setDraft(EMPTY_FILTERS)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button icon="checkmark-outline" label={t("Apply", "تطبيق")} disabled={!!problem} onPress={() => onApply(draft)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** The active filters as removable chips above the list, with "Clear all". */
export function ActiveFilters({ value, onChange }: { value: PartFilters; onChange: (f: PartFilters) => void }) {
  const { t, isArabic } = useL();
  const labels = usePartLabels();
  const chips: { key: string; label: string; next: PartFilters }[] = [];
  for (const c of value.conditions) chips.push({ key: "c:" + c, label: labels.condition[c], next: { ...value, conditions: value.conditions.filter((x) => x !== c) } });
  if (value.partType) chips.push({ key: "type", label: labels.type[value.partType], next: { ...value, partType: null } });
  for (const b of value.brands) chips.push({ key: "b:" + b, label: b, next: { ...value, brands: value.brands.filter((x) => x !== b) } });
  const min = value.minPrice.trim();
  const max = value.maxPrice.trim();
  if (min || max) {
    const label = min && max ? priceTag(`${min}–${max}`) : min ? `${t("From", "من")} ${priceTag(min)}` : `${t("Up to", "حتى")} ${priceTag(max)}`;
    chips.push({ key: "price", label, next: { ...value, minPrice: "", maxPrice: "" } });
  }
  if (value.inStock) chips.push({ key: "stock", label: t("In stock only", "المتوفر فقط"), next: { ...value, inStock: false } });
  if (value.city) chips.push({ key: "city", label: cityLabel(value.city, isArabic), next: { ...value, city: "" } });
  if (!chips.length) return null;
  return (
    <ChipRow>
      {chips.map((c) => (
        <Chip key={c.key} on label={`${c.label} ×`} onPress={() => onChange(c.next)} />
      ))}
      <Chip on={false} icon="close-circle-outline" label={t("Clear all", "مسح الكل")} onPress={() => onChange(EMPTY_FILTERS)} />
    </ChipRow>
  );
}
