// Brand -> model -> generation (docs/guide/10-ui-system.md §5): three smart pickers over the managed catalog. Changing a parent clears
// its children; a missing brand / model / generation is added from the list itself ("+ Add '…' as a new …"), asking only for the
// Arabic name and, for a model or generation, the production years.
import { View } from "react-native";
import { SmartPicker, type AddField } from "../../components/manage/Form";
import { useL } from "../../core/hooks/useL";
import { vehicleCatalog, type Taxonomy } from "./api";

export type CarPick = { brandId: string; modelId: string; generationId: string };
export const NO_CAR: CarPick = { brandId: "", modelId: "", generationId: "" };

/** the brand / model / generation a generation id belongs to (to open a form on an existing generation) */
export function carOf(tax: Taxonomy, generationId: string): CarPick {
  const v = tax.vehicles.find(x => x.generations.some(g => g.id === generationId));
  return v ? { brandId: v.brandId ?? "", modelId: v.id, generationId } : NO_CAR;
}

export function VehiclePickers({ tax, value, onChange, reload, suggested, hint }: {
  tax: Taxonomy; value: CarPick; onChange: (v: CarPick) => void; reload: () => Promise<unknown>;
  suggested?: { brands?: string[]; models?: string[]; generations?: string[] }; hint?: string;
}) {
  const { t, isArabic } = useL();
  const brands = tax.brands.filter(b => b.isActive || b.id === value.brandId);
  const models = tax.vehicles.filter(v => v.brandId === value.brandId && (v.isActive || v.id === value.modelId));
  const gens = (models.find(v => v.id === value.modelId)?.generations ?? []).filter(g => g.isActive || g.id === value.generationId);
  const arName: AddField = { key: "nameAr", label: t("Arabic name (optional)", "الاسم بالعربية (اختياري)") };
  const years: AddField[] = [
    { key: "yearFrom", label: t("Production start year", "سنة بداية الإنتاج"), numeric: true, required: true },
    { key: "yearTo", label: t("Production end year", "سنة نهاية الإنتاج"), numeric: true, required: true },
  ];
  const added = async (id: string) => { await reload(); return id; };
  return (
    <View style={{ gap: 14 }}>
      <SmartPicker label={t("Brand", "الشركة")} value={value.brandId} hint={hint} suggested={suggested?.brands}
        options={brands.map(b => ({ id: b.id, label: isArabic ? b.nameAr || b.name : b.name, find: [b.name, b.nameAr, ...b.aliases].join(" ") }))}
        onChange={id => onChange({ brandId: id, modelId: "", generationId: "" })}
        add={{ noun: ["brand", "شركة جديدة"], fields: [arName],
          create: async (text, v) => added((await vehicleCatalog.save("brands", null, { name: text, nameAr: v.nameAr?.trim() || text })).id) }} />
      <SmartPicker label={t("Model", "الطراز")} value={value.modelId} disabled={!value.brandId} suggested={suggested?.models}
        options={models.map(m => ({ id: m.id, label: isArabic ? m.modelAr || m.model : m.model, find: `${m.model} ${m.modelAr}` }))}
        onChange={id => onChange({ ...value, modelId: id, generationId: "" })}
        add={{ noun: ["model", "طراز جديد"], fields: [arName, ...years],
          create: async (text, v) => added((await vehicleCatalog.save("models", null, { brandId: value.brandId, model: text, modelAr: v.nameAr?.trim() || text, yearFrom: Number(v.yearFrom), yearTo: Number(v.yearTo) })).id) }} />
      <SmartPicker label={t("Generation", "الجيل")} value={value.generationId} disabled={!value.modelId} suggested={suggested?.generations}
        options={gens.map(g => ({ id: g.id, label: `${isArabic ? g.nameAr || g.code : g.code} (${g.yearFrom}–${g.yearTo})`, find: `${g.code} ${g.nameEn} ${g.nameAr} ${g.yearFrom} ${g.yearTo}` }))}
        onChange={id => onChange({ ...value, generationId: id })}
        add={{ noun: ["generation", "جيل جديد"], fields: [arName, ...years],
          create: async (text, v) => added((await vehicleCatalog.save("generations", null, { vehicleId: value.modelId, code: text, nameAr: v.nameAr?.trim() || text, yearFrom: Number(v.yearFrom), yearTo: Number(v.yearTo) })).id) }} />
    </View>
  );
}
