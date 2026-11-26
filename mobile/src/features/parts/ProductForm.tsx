// The product form shared by the shop (provider) screen and the MOTEXA admin editor: a Form step flow (docs/guide/10-ui-system.md):
// Photo · What is it? · Price and stock · Fits which cars (· 3D, only for a saved part that can be shown in 3D). It knows nothing about
// who is saving: the caller passes onSubmit (provider or admin service) and onDone. It renders its own Page so its ONE primary action
// (Next / Save) sits in the sticky footer.
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Chip, Field, GButton, GText, Note, Toggle } from "../../components/garage";
import type { ItemAction } from "../../components/ItemActionsMenu";
import { SmartPicker, StepFooter, useDiscardGuard } from "../../components/manage/Form";
import { Block, Page } from "../../components/manage/Page";
import { StepperHeader } from "../../components/garage";
import { PartPhoto } from "../catalog/PartPhoto";
import { pickImage } from "../../core/hooks/nav";
import { useL } from "../../core/hooks/useL";
import { gType, useGarageTheme } from "../../theme/garage";
import { Fitment, Product, ProductInput } from "./partsService";
import { CONDITIONS, PART_TYPES, usePartLabels } from "../catalog/partAttrs";
import { CATALOG_GROUPS, labelOf } from "../../core/constants/categories";
import { VehiclePicker, useVehicleList } from "../catalog/VehiclePicker";
import { typesForCategory } from "../accessory3d/api";
import { UploadBar } from "../fleet/steps";
import { normalizeNumberText, strictNumber } from "../../core/constants/numbers";

export const blankProduct: ProductInput = {
  name: "", brand: "", partNumber: "", description: "", price: 0, stock: 0, category: null, condition: "NEW", partType: null, imageUri: null, fitments: [], isUniversal: false,
};
const isBroad = (key: string | null) => CATALOG_GROUPS.some((g) => g.categories.some((c) => c.key === key && c.children));

export function ProductForm({ initial, product, isNew, onSubmit, onDone, admin = false, title, line, actions }: {
  initial: ProductInput; product?: Product; isNew: boolean; onSubmit: (input: ProductInput) => Promise<unknown>; onDone: () => void;
  /** MOTEXA admin editing on behalf of the shop: no provider-only wording */ admin?: boolean;
  title: string; line?: string; actions?: ItemAction[];
}) {
  const { t, isArabic } = useL();
  const { row, align } = useGarageTheme();
  const labels = usePartLabels();
  const [f, setF] = useState(initial);
  const [price, setPrice] = useState(String(initial.price ?? ""));
  const [stock, setStock] = useState(String(initial.stock ?? ""));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [more, setMore] = useState(false);
  // the 3D step only exists for a saved part whose category can be shown in 3D (a new part is saved first)
  const with3D = !!product && typesForCategory(f.category).length > 0;
  const STEPS = [t("Photo", "الصورة"), t("What is it?", "ما هي القطعة؟"), t("Price and stock", "السعر والمخزون"), t("Fits which cars", "تناسب أي سيارات"), ...(with3D ? [t("3D (optional)", "ثلاثي الأبعاد (اختياري)")] : [])];
  const last = step >= STEPS.length - 1;
  const dirty = JSON.stringify(f) !== JSON.stringify(initial) || price !== String(initial.price ?? "") || stock !== String(initial.stock ?? "");
  const guard = useDiscardGuard(dirty && !busy);
  const picked = f.imageUri !== initial.imageUri; // a local photo chosen in this session, not saved yet
  // "Fits these cars": picked from the vehicle list (no free text), each with its own year range
  const vehicles = useVehicleList("fitment").list;
  const listed = (x: Fitment) => !vehicles || vehicles.some((v) => v.make === x.make && v.model === x.model);
  const [adding, setAdding] = useState<{ make: string; model: string; year: string } | null>(null);
  const addCar = (make: string, model: string) => {
    const v = vehicles?.find((x) => x.make === make && x.model === model);
    if (!v) return;
    const top = Math.min(v.yearTo, new Date().getFullYear() + 1);
    if (!f.fitments.some((x) => x.make === make && x.model === model)) setF({ ...f, fitments: [...f.fitments, { make, model, yearFrom: Math.max(v.yearFrom, top - 8), yearTo: top }] });
    setAdding(null);
  };
  const setFit = (i: number, patch: Partial<Fitment>) => setF({ ...f, fitments: f.fitments.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const gensOf = (x: Fitment) => vehicles?.find((v) => v.make === x.make && v.model === x.model)?.generations ?? [];
  /** Tick a generation: this row takes it (and its years) when it has none, else it becomes a new row. Untick: back to plain years. */
  const tickGen = (i: number, g: { id: string; yearFrom: number; yearTo: number }) => {
    const x = f.fitments[i];
    const at = f.fitments.findIndex((r) => r.make === x.make && r.model === x.model && r.generationId === g.id);
    if (at >= 0) return setFit(at, { generationId: undefined });
    const years = { generationId: g.id, yearFrom: g.yearFrom, yearTo: Math.min(g.yearTo, new Date().getFullYear() + 1) };
    if (!x.generationId) return setFit(i, years);
    setF({ ...f, fitments: [...f.fitments, { make: x.make, model: x.model, ...years }] });
  };
  // ONE category per part, always a leaf: the picker lists sub-categories (and categories without any) under their group
  type Leaf = { k: (typeof CATALOG_GROUPS)[number]["categories"][number]; parent: (typeof CATALOG_GROUPS)[number]["categories"][number] | null };
  const categories = useMemo(() => CATALOG_GROUPS.flatMap((g) => g.categories.flatMap((c): Leaf[] => (c.children ? c.children.map((k) => ({ k, parent: c })) : [{ k: c, parent: null }]))
    .map(({ k, parent }) => ({ id: k.key, label: labelOf(k, isArabic), sub: [labelOf(g, isArabic), parent ? labelOf(parent, isArabic) : null].filter(Boolean).join(" · "),
      find: [k.en, k.ar, parent?.en, parent?.ar, g.en, g.ar].filter(Boolean).join(" ") }))), [isArabic]);

  const isEmptyRow = (x: Fitment) => !x.make.trim() && !x.model.trim();
  /** The checks of one step (null = fine). */
  const check = (s: number): string | null => {
    if (s === 1) {
      if (!f.name.trim()) return t("Enter the part name.", "أدخل اسم القطعة.");
      if (!f.category) return t("Choose a category.", "اختر فئة.");
      if (isBroad(f.category)) return t("Choose a more specific category (for example Bulbs or Headlights under Lighting).", "اختر فئة أدق (مثل المصابيح أو الأضواء الأمامية ضمن الإضاءة).");
    }
    if (s === 2) {
      if (strictNumber(price, false, 9_999_999_999.99) === null) return t("Enter a price of 0 or more, with up to two decimal places and no letters.", "أدخل سعرًا من صفر فأكثر، بمنزلتين عشريتين كحد أقصى ودون أحرف.");
      if (strictNumber(stock, true, 1_000_000) === null) return t("Enter a whole stock quantity from 0 to 1,000,000, without decimals or letters.", "أدخل كمية صحيحة من صفر إلى مليون، دون كسور أو أحرف.");
    }
    return null;
  };
  const next = () => {
    const v = check(step);
    if (v) return setErr(v);
    setErr(null);
    setStep(step + 1);
  };
  const save = async (open3D = false) => {
    // at least one car or Universal; every car from the vehicle list with a valid year range (the server checks the same)
    const cars = f.fitments.filter((x) => !isEmptyRow(x));
    for (const s of [1, 2]) {
      const v = check(s);
      if (v) { setStep(s); return setErr(v); }
    }
    if (!cars.length && !f.isUniversal) return setErr(t("Add at least one car this part fits, or mark it Universal.", "أضف سيارة واحدة على الأقل تناسبها القطعة، أو حدّدها كعامة."));
    const bad = cars.find((x) => !listed(x));
    if (bad) return setErr(t(`${bad.make} ${bad.model} is not on the vehicle list. Remove it and add the car from the list.`, `${bad.make} ${bad.model} غير موجودة في قائمة المركبات. أزلها وأضف السيارة من القائمة.`));
    const badYears = cars.find((x) => !x.yearFrom || !x.yearTo || x.yearFrom > x.yearTo);
    if (badYears) return setErr(t(`Check the years for ${badYears.make} ${badYears.model}: "from" must be before "to".`, `تحقق من سنوات ${badYears.make} ${badYears.model}: يجب أن تكون "من" قبل "إلى".`));
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ ...f, price: strictNumber(price)!, stock: strictNumber(stock, true)!, fitments: cars });
      guard.release();
      if (open3D && product) router.push(`/provider/parts/accessory-3d/${product.id}`);
      else onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveLabel = isNew ? t("Add part", "إضافة القطعة") : t("Save changes", "حفظ التغييرات");
  return (
    <Page title={title} line={line} actions={actions}
      footer={<StepFooter back={step > 0 ? { label: t("Back", "رجوع"), onPress: () => { setErr(null); setStep(step - 1); } } : undefined}
        primary={last ? { label: saveLabel, icon: "checkmark", busy, onPress: () => void save() } : { label: t("Next", "التالي"), onPress: next }} />}>
      {product?.hidden ? (
        <Note tone="danger" icon="eye-off-outline">
          {[t("Hidden by MOTEXA", "مخفية بواسطة MOTEXA"), product.hiddenReason,
            admin ? t("This listing is hidden from customers. Use Show again on the shop page to publish it.", "هذه القطعة مخفية عن العملاء. استخدم إظهار مرة أخرى من صفحة المتجر لنشرها.") : t("You can edit the details, but only MOTEXA can make this listing visible again.", "يمكنك تعديل التفاصيل، ولكن MOTEXA فقط يمكنها إعادة إظهار هذه القطعة.")].filter(Boolean).join("\n")}
        </Note>
      ) : null}
      <StepperHeader steps={STEPS} index={step} label={(i, n) => t(`Step ${i} of ${n}`, `الخطوة ${i} من ${n}`)} />

      {step === 0 ? (
        <View style={{ gap: 12 }}>
          {!f.imageUri ? (
            <Note tone="warning" icon="image-outline">
              {admin ? t("Product photo required — hidden from customers", "صورة المنتج مطلوبة — مخفي عن العملاء")
                : t("Product photo required: customers can't see this part until it has a real photo of the actual product.", "صورة المنتج مطلوبة: لا يرى العملاء هذه القطعة حتى تضاف لها صورة حقيقية للمنتج نفسه.")}
            </Note>
          ) : null}
          {/* whole picture, aspect ratio kept, never cropped; the server checks the real JPEG/PNG and the minimum size on save */}
          <View style={{ width: "100%", maxWidth: 360, alignSelf: "center" }}><PartPhoto uri={f.imageUri} /></View>
          {picked ? <GText soft style={[gType.caption, align]}>{t("New photo selected. It is uploaded when you save.", "تم اختيار صورة جديدة. تُرفع عند الحفظ.")}</GText> : null}
          <View style={[row, { gap: 10, flexWrap: "wrap" }]}>
            <GButton variant="secondary" icon="camera-outline"
              label={!f.imageUri ? t("Add product photo", "إضافة صورة المنتج") : picked ? t("Replace selection", "استبدال الصورة المختارة") : t("Change product photo", "تغيير صورة المنتج")}
              onPress={async () => { const uri = await pickImage(); if (uri) setF({ ...f, imageUri: uri }); }} />
            {picked ? <GButton variant="ghost" icon="close-outline" label={t("Cancel selection", "إلغاء الاختيار")} onPress={() => setF({ ...f, imageUri: initial.imageUri })} /> : null}
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: 14 }}>
          <Field label={t("Part name", "اسم القطعة")} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
          <SmartPicker label={t("Category", "الفئة")} value={f.category} options={categories} onChange={(k) => setF({ ...f, category: k })} placeholder={t("Choose a category", "اختر فئة")}
            hint={!f.category && !isNew ? t("This part has no category yet. Choose one to save changes.", "ليس لهذه القطعة فئة بعد. اختر فئة لحفظ التغييرات.") : isBroad(f.category) ? t("Pick the exact type (for example Bulbs or Headlights), so the part shows in one place only.", "اختر النوع الدقيق (مثل اللمبات أو الأضواء الأمامية) حتى تظهر القطعة في مكان واحد فقط.") : undefined} />
          <View style={{ gap: 8 }}>
            <GText style={[gType.label, align, { fontWeight: "700" }]}>{t("Condition", "الحالة")}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{CONDITIONS.map((c) => <Chip key={c} label={labels.condition[c]} on={f.condition === c} onPress={() => setF({ ...f, condition: c })} />)}</View>
          </View>
          <View style={{ gap: 8 }}>
            <GText style={[gType.label, align, { fontWeight: "700" }]}>{t("Type", "النوع")}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              {PART_TYPES.map((p) => <Chip key={p} label={labels.type[p]} on={f.partType === p} onPress={() => setF({ ...f, partType: p })} />)}
              <Chip label={labels.notSpecified} on={f.partType === null} onPress={() => setF({ ...f, partType: null })} />
            </View>
          </View>
          <GButton variant="ghost" icon={more ? "chevron-up-outline" : "chevron-down-outline"} label={more ? t("Hide more details", "إخفاء التفاصيل الإضافية") : t("More details: brand, part number, description", "المزيد: العلامة ورقم القطعة والوصف")} onPress={() => setMore(!more)} />
          {more ? (
            <View style={{ gap: 12 }}>
              <Field label={t("Brand", "العلامة التجارية")} value={f.brand} onChangeText={(v) => setF({ ...f, brand: v })} />
              <Field label={t("Part number", "رقم القطعة")} value={f.partNumber} autoCapitalize="characters" onChangeText={(v) => setF({ ...f, partNumber: v })} />
              <Field label={t("Description", "الوصف")} value={f.description} multiline onChangeText={(v) => setF({ ...f, description: v })} />
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 2 ? (
        <View style={{ gap: 12 }}>
          <Field label={t("Price (₪)", "السعر (₪)")} value={price} keyboardType="decimal-pad" onChangeText={(v) => setPrice(normalizeNumberText(v))} />
          <Field label={t("Stock quantity", "الكمية المتوفرة")} value={stock} keyboardType="number-pad" onChangeText={(v) => setStock(normalizeNumberText(v))} />
        </View>
      ) : null}

      {step === 3 ? (
        <View style={{ gap: 12 }}>
          <Toggle label={t("Universal: fits every car", "عامة: تناسب كل السيارات")} value={f.isUniversal} onChange={(v) => setF({ ...f, isUniversal: v })}
            sub={t("Oil, bulbs, accessories. Otherwise add every car it fits: customers only see a fit you list here.", "زيوت، لمبات، إكسسوارات. وإلا فأضف كل سيارة تناسبها: لا يرى العملاء توافقًا إلا ما تحدده هنا.")} />
          {f.fitments.map((x, i) => (
            <Block key={`${x.make}|${x.model}|${i}`} title={`${x.make} ${x.model}${x.generationId ? ` ${gensOf(x).find((g) => g.id === x.generationId)?.code ?? ""}` : ""}`}
              action={<GButton variant="ghost" icon="trash-outline" label={t("Remove", "إزالة")} onPress={() => setF({ ...f, fitments: f.fitments.filter((_, j) => j !== i) })} />}>
              <View style={{ gap: 10, paddingVertical: 10 }}>
                {!listed(x) ? <Note tone="warning" icon="alert-circle-outline">{t("Not on the vehicle list. Remove this row and add the car from the list.", "غير موجودة في قائمة المركبات. أزل هذا الصف وأضف السيارة من القائمة.")}</Note> : null}
                {gensOf(x).length ? (
                  <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                    {/* "Fits W202": a generation = its year range on the server */}
                    {gensOf(x).map((g) => <Chip key={g.id} label={`${t("Fits", "تناسب")} ${g.code}`} on={f.fitments.some((r) => r.make === x.make && r.model === x.model && r.generationId === g.id)} onPress={() => tickGen(i, g)} />)}
                  </View>
                ) : null}
                <View style={[row, { gap: 10 }]}>
                  <View style={{ flex: 1 }}><Field label={t("Year from", "من سنة")} value={String(x.yearFrom || "")} keyboardType="number-pad" onChangeText={(v) => setFit(i, { yearFrom: strictNumber(normalizeNumberText(v), true) ?? 0, generationId: undefined })} /></View>
                  <View style={{ flex: 1 }}><Field label={t("Year to", "إلى سنة")} value={String(x.yearTo || "")} keyboardType="number-pad" onChangeText={(v) => setFit(i, { yearTo: strictNumber(normalizeNumberText(v), true) ?? 0, generationId: undefined })} /></View>
                </View>
                <Field label={t("Engine / trim (optional)", "المحرك / الفئة (اختياري)")} value={x.trim ?? ""} onChangeText={(v) => setFit(i, { trim: v })} />
              </View>
            </Block>
          ))}
          {adding ? (
            <Block title={t("Add a car", "إضافة سيارة")} action={<GButton variant="ghost" label={t("Cancel", "إلغاء")} onPress={() => setAdding(null)} />}>
              {/* make -> model from the list; picking the model adds the car (years are set on its row) */}
              <View style={{ paddingVertical: 10 }}><VehiclePicker purpose="fitment" value={adding} onChange={(v) => (v.model ? addCar(v.make, v.model) : setAdding(v))} /></View>
            </Block>
          ) : (
            <GButton variant="secondary" icon="add-outline" label={t("Add a car", "إضافة سيارة")} onPress={() => setAdding({ make: "", model: "", year: "" })} />
          )}
        </View>
      ) : null}

      {step === 4 && with3D ? (
        <View style={{ gap: 12 }}>
          <Note icon="cube-outline">{t("This part can be shown in 3D on customers' cars. Save it now, or save and open its 3D request.", "يمكن عرض هذه القطعة ثلاثية الأبعاد على سيارات العملاء. احفظها الآن، أو احفظها وافتح طلبها ثلاثي الأبعاد.")}</Note>
          <GButton variant="secondary" icon="cube-outline" disabled={busy} label={t("Save and request 3D", "حفظ وطلب نموذج ثلاثي الأبعاد")} onPress={() => void save(true)} />
        </View>
      ) : null}

      {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
      <UploadBar />
      {guard.sheet}
    </Page>
  );
}
