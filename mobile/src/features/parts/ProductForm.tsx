import { Notice } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { PartPhoto } from "../catalog/PartPhoto";
import { pickImage } from "../../core/hooks/nav";
import { useL } from "../../core/hooks/useL";
import { Text } from "../../components/ui/Text";
import { useTheme } from "../../theme/useTheme";
import { useState } from "react";
import { View } from "react-native";
import { Fitment, Product, ProductInput } from "./partsService";
import { Chip } from "../catalog/catalogBits";
import { CONDITIONS, PART_TYPES, usePartLabels } from "../catalog/partAttrs";
import { CATALOG_GROUPS, labelOf } from "../../core/constants/categories";
import { VehiclePicker, useVehicleList } from "../catalog/VehiclePicker";
import { router } from "expo-router";
import { typesForCategory } from "../accessory3d/api";
import { Dots, UploadBar } from "../fleet/steps";

// The product form shared by the shop (provider) screen and the MOTEXA admin editor. It knows nothing about who is
// saving: the caller passes onSubmit (provider or admin service) and onDone.
export const blankProduct: ProductInput = {
  name: "", brand: "", partNumber: "", description: "", price: 0, stock: 0, category: null, condition: "NEW", partType: null, imageUri: null, fitments: [], isUniversal: false,
};

export function ProductForm({ initial, product, isNew, onSubmit, onDone, admin = false }: { initial: ProductInput; product?: Product; isNew: boolean; onSubmit: (input: ProductInput) => Promise<unknown>; onDone: () => void; /** MOTEXA admin editing on behalf of the shop: no provider-only wording */ admin?: boolean }) {
  const { c: col } = useTheme();
  const { t, row, isArabic, align } = useL();
  const labels = usePartLabels();
  const [f, setF] = useState(initial);
  const [price, setPrice] = useState(String(initial.price || ""));
  const [stock, setStock] = useState(String(initial.stock || ""));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // five short steps: photos, name + category + condition, price + stock, which cars, optional 3D
  const [step, setStep] = useState(0);
  const [more, setMore] = useState(false);
  const STEPS = [t("Photo", "الصورة"), t("What is it?", "ما هي القطعة؟"), t("Price and stock", "السعر والمخزون"), t("Fits which cars", "تناسب أي سيارات"), t("3D (optional)", "ثلاثي الأبعاد (اختياري)")];
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

  const setFit = (i: number, patch: Partial<Fitment>) =>
    setF({ ...f, fitments: f.fitments.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
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

  const isEmptyRow = (x: Fitment) => !x.make.trim() && !x.model.trim();
  /** The checks of one step (null = fine). The same rules as before, just asked where the field is. */
  const check = (s: number): string | null => {
    if (s === 1) {
      if (!f.name.trim()) return t("Enter the part name.", "أدخل اسم القطعة.");
      if (!f.category) return t("Choose a category.", "اختر فئة.");
      if (CATALOG_GROUPS.some((g) => g.categories.some((c) => c.key === f.category && c.children))) return t("Choose a more specific category (for example Bulbs or Headlights under Lighting).", "اختر فئة أدق (مثل المصابيح أو الأضواء الأمامية ضمن الإضاءة).");
    }
    if (s === 2) {
      const p = parseFloat(price || "0"), n = parseInt(stock || "0", 10);
      if (!(p >= 0) || Number.isNaN(p)) return t("Enter a valid price.", "أدخل سعرًا صحيحًا.");
      if (!(n >= 0) || Number.isNaN(n)) return t("Enter a valid stock quantity.", "أدخل كمية صحيحة.");
    }
    return null;
  };
  const next = () => {
    const v = check(step);
    if (v) return setErr(v);
    setErr(null);
    setStep(step + 1);
  };
  const save = async () => {
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
    if (!f.category) return setErr(t("Choose a category.", "اختر فئة."));
    if (CATALOG_GROUPS.some((g) => g.categories.some((c) => c.key === f.category && c.children))) return setErr(t("Choose a more specific category (for example Bulbs or Headlights under Lighting).", "اختر فئة أدق (مثل اللمبات أو الأضواء الأمامية ضمن الإضاءة)."));
    setBusy(true);
    setErr(null);
    try {
      const input: ProductInput = {
        ...f,
        price: parseFloat(price || "0"),
        stock: parseInt(stock || "0", 10),
        fitments: cars,
      };
      await onSubmit(input);
      onDone();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {product?.hidden && (
        <Notice tone="danger" icon="eye-off-outline">
          {t("Hidden by MOTEXA", "مخفية بواسطة MOTEXA")}
          {product.hiddenReason ? "\n" + product.hiddenReason : ""}
          {"\n"}
          {admin ? t("This listing is hidden from customers. Use Show again on the shop page to publish it.", "هذه القطعة مخفية عن العملاء. استخدم إظهار مرة أخرى من صفحة المتجر لنشرها.") : t("You can edit the details, but only MOTEXA can make this listing visible again.", "يمكنك تعديل التفاصيل، ولكن MOTEXA فقط يمكنها إعادة إظهار هذه القطعة.")}
        </Notice>
      )}
      <Dots count={STEPS.length} index={step} />
      <Text style={[{ color: col.text, fontSize: 18, fontWeight: "800", marginBottom: 8 }, align]}>{STEPS[step]}</Text>
      {step === 0 ? (<>
      <SectionHeader title={t("Product photo", "صورة المنتج")} />
      {!f.imageUri ? (
        <Notice tone="warning" icon="image-outline">
          {admin
            ? t("Product photo required — hidden from customers", "صورة المنتج مطلوبة — مخفي عن العملاء")
            : t("Product photo required: customers can't see this part until it has a real photo of the actual product.", "صورة المنتج مطلوبة: لا يرى العملاء هذه القطعة حتى تضاف لها صورة حقيقية للمنتج نفسه.")}
        </Notice>
      ) : null}
      <Card>
        {/* whole picture, aspect ratio kept, never cropped; the server checks the real JPEG/PNG and the minimum size on save */}
        <PartPhoto uri={f.imageUri} style={{ marginBottom: 12 }} />
        {picked ? (
          <Text style={[{ color: col.textMuted, fontSize: 12, marginBottom: 10 }, align]}>
            {t("New photo selected. It is uploaded when you save.", "تم اختيار صورة جديدة. تُرفع عند الحفظ.")}
          </Text>
        ) : null}
        <Button
          variant={f.imageUri ? "ghost" : "primary"}
          icon="camera-outline"
          label={!f.imageUri ? t("Add product photo", "إضافة صورة المنتج") : picked ? t("Replace selection", "استبدال الصورة المختارة") : t("Change product photo", "تغيير صورة المنتج")}
          onPress={async () => {
            const uri = await pickImage();
            if (uri) setF({ ...f, imageUri: uri });
          }}
        />
        {picked ? <Button variant="ghost" icon="close-outline" label={t("Cancel selection", "إلغاء الاختيار")} onPress={() => setF({ ...f, imageUri: initial.imageUri })} /> : null}
      </Card>

      </>) : null}

      {step === 1 ? (<>
      <Card>
        <Input label={t("Part name", "اسم القطعة")} value={f.name} onChangeText={(v) => setF({ ...f, name: v })} />
        <Button variant="ghost" icon={more ? "chevron-up-outline" : "chevron-down-outline"} label={more ? t("Hide more details", "إخفاء التفاصيل الإضافية") : t("More details: brand, part number, description", "المزيد: العلامة ورقم القطعة والوصف")} onPress={() => setMore(!more)} />
        {more ? (
          <>
            <Input label={t("Brand", "العلامة التجارية")} value={f.brand} onChangeText={(v) => setF({ ...f, brand: v })} />
            <Input label={t("Part number", "رقم القطعة")} value={f.partNumber} autoCapitalize="characters" onChangeText={(v) => setF({ ...f, partNumber: v })} />
            <Input label={t("Description", "الوصف")} value={f.description} multiline onChangeText={(v) => setF({ ...f, description: v })} />
          </>
        ) : null}
      </Card>

      <SectionHeader title={t("Condition", "الحالة")} />
      <Card>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
          {CONDITIONS.map((c) => (
            <Chip key={c} label={labels.condition[c]} on={f.condition === c} onPress={() => setF({ ...f, condition: c })} />
          ))}
        </View>
        <Text style={[{ color: col.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 14, marginBottom: 7 }, align]}>{t("TYPE", "النوع")}</Text>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
          {PART_TYPES.map((p) => (
            <Chip key={p} label={labels.type[p]} on={f.partType === p} onPress={() => setF({ ...f, partType: p })} />
          ))}
          <Chip label={labels.notSpecified} on={f.partType === null} onPress={() => setF({ ...f, partType: null })} />
        </View>
      </Card>

      <SectionHeader title={t("Category", "الفئة")} />
      {!f.category && !isNew ? (
        <Notice tone="accent" icon="information-circle-outline">{t("This part has no category yet. Choose one to save changes.", "ليس لهذه القطعة فئة بعد. اختر فئة لحفظ التغييرات.")}</Notice>
      ) : null}
      {f.category && CATALOG_GROUPS.some((g) => g.categories.some((c) => c.key === f.category && c.children)) ? (
        <Notice tone="accent" icon="information-circle-outline">{t("Pick the exact type below (for example Bulbs or Headlights), so the part shows in one place only.", "اختر النوع الدقيق أدناه (مثل اللمبات أو الأضواء الأمامية) حتى تظهر القطعة في مكان واحد فقط.")}</Notice>
      ) : null}
      <Card>
        {/* ONE category per part: a category with sub-categories only offers its sub-categories */}
        {CATALOG_GROUPS.map((g) => (
          <View key={g.key} style={{ marginBottom: 12 }}>
            <Text style={[{ color: col.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 7 }, align]}>{labelOf(g, isArabic)}</Text>
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              {g.categories.filter((c) => !c.children).map((c) => (
                <Chip key={c.key} icon={c.icon} label={labelOf(c, isArabic)} on={f.category === c.key} onPress={() => setF({ ...f, category: c.key })} />
              ))}
            </View>
            {g.categories.filter((c) => c.children).map((c) => (
              <View key={c.key} style={{ marginTop: 10 }}>
                <Text style={[{ color: col.text, fontSize: 13, fontWeight: "700", marginBottom: 6 }, align]}>{labelOf(c, isArabic)}</Text>
                <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                  {c.children!.map((k) => (
                    <Chip key={k.key} icon={k.icon} label={labelOf(k, isArabic)} on={f.category === k.key} onPress={() => setF({ ...f, category: k.key })} />
                  ))}
                </View>
              </View>
            ))}
          </View>
        ))}
      </Card>

      </>) : null}

      {step === 2 ? (
        <Card>
          <Input label={t("Price (₪)", "السعر (₪)")} value={price} keyboardType="decimal-pad" onChangeText={setPrice} />
          <Input label={t("Stock quantity", "الكمية المتوفرة")} value={stock} keyboardType="number-pad" onChangeText={setStock} />
        </Card>
      ) : null}

      {step === 3 ? (<>
      <SectionHeader title={t("Fits these cars", "تناسب هذه السيارات")} />
      <Card>
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
          <Chip icon="globe-outline" label={t("Universal: fits every car", "عامة: تناسب كل السيارات")} on={f.isUniversal} onPress={() => setF({ ...f, isUniversal: !f.isUniversal })} />
        </View>
        <Text style={[{ color: col.textMuted, fontSize: 12, marginTop: 8 }, align]}>
          {t("Add every car this part fits, or mark it Universal (oil, bulbs, accessories). Customers only see a fit you list here.", "أضف كل سيارة تناسبها هذه القطعة، أو حدّدها كعامة (زيوت، لمبات، إكسسوارات). لا يرى العملاء توافقًا إلا ما تحدده هنا.")}
        </Text>
      </Card>
      {f.fitments.map((x, i) => (
        <Card key={`${x.make}|${x.model}|${i}`}>
          <Text style={[{ color: col.text, fontSize: 16, fontWeight: "800", marginBottom: 8 }, align]}>{`${x.make} ${x.model}${x.generationId ? ` ${gensOf(x).find((g) => g.id === x.generationId)?.code ?? ""}` : ""}`}</Text>
          {!listed(x) ? (
            <Notice tone="warning" icon="alert-circle-outline">{t("Not on the vehicle list. Remove this row and add the car from the list.", "غير موجودة في قائمة المركبات. أزل هذا الصف وأضف السيارة من القائمة.")}</Notice>
          ) : null}
          {gensOf(x).length ? (
            <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 8 }]}>
              {/* "Fits W202": a generation = its year range on the server */}
              {gensOf(x).map((g) => (
                <Chip key={g.id} label={`${t("Fits", "تناسب")} ${g.code}`} on={f.fitments.some((r) => r.make === x.make && r.model === x.model && r.generationId === g.id)} onPress={() => tickGen(i, g)} />
              ))}
            </View>
          ) : null}
          <View style={[row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Input label={t("Year from", "من سنة")} value={String(x.yearFrom || "")} keyboardType="number-pad" onChangeText={(v) => setFit(i, { yearFrom: parseInt(v || "0", 10), generationId: undefined })} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label={t("Year to", "إلى سنة")} value={String(x.yearTo || "")} keyboardType="number-pad" onChangeText={(v) => setFit(i, { yearTo: parseInt(v || "0", 10), generationId: undefined })} />
            </View>
          </View>
          <Input label={t("Engine / trim (optional)", "المحرك / الفئة (اختياري)")} value={x.trim ?? ""} onChangeText={(v) => setFit(i, { trim: v })} />
          <Button variant="danger" label={t("Remove car", "إزالة السيارة")} onPress={() => setF({ ...f, fitments: f.fitments.filter((_, j) => j !== i) })} />
        </Card>
      ))}
      {adding ? (
        <Card>
          {/* make -> model from the list; picking the model adds the car (years are set on its row) */}
          <VehiclePicker purpose="fitment" value={adding} onChange={(v) => (v.model ? addCar(v.make, v.model) : setAdding(v))} />
          <Button variant="ghost" label={t("Cancel", "إلغاء")} onPress={() => setAdding(null)} />
        </Card>
      ) : (
        <Button variant="ghost" icon="add-outline" label={t("Add a car", "إضافة سيارة")} onPress={() => setAdding({ make: "", model: "", year: "" })} />
      )}
      </>) : null}

      {step === 4 ? (
        <Card>
          <Text style={[{ color: col.text, fontSize: 13, lineHeight: 20, marginBottom: 10 }, align]}>
            {typesForCategory(f.category).length
              ? product ? t("This part can be shown in 3D on customers' cars.", "يمكن عرض هذه القطعة ثلاثية الأبعاد على سيارات العملاء.") : t("Save the part first, then open it to add its 3D model. You can skip this step.", "احفظ القطعة أولًا ثم افتحها لإضافة نموذجها الثلاثي الأبعاد. يمكنك تخطي هذه الخطوة.")
              : t("3D is for body kits, exterior accessories and rims. Nothing to do here: save the part.", "الثلاثي الأبعاد لأطقم الهيكل والإكسسوارات الخارجية والجنوط. لا شيء هنا: احفظ القطعة.")}
          </Text>
          {product && typesForCategory(f.category).length ? <Button variant="secondary" icon="cube-outline" label={t("Show it in 3D on customers' cars", "اعرضها ثلاثية الأبعاد على سيارات العملاء")} onPress={() => router.push(`/provider/parts/accessory-3d/${product.id}`)} /> : null}
        </Card>
      ) : null}

      <View style={{ height: 20 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <UploadBar />
      <View style={{ gap: 8 }}>
        {step < STEPS.length - 1 ? <Button label={t("Next", "التالي")} onPress={next} /> : <Button label={isNew ? t("Add part", "إضافة القطعة") : t("Save changes", "حفظ التغييرات")} disabled={busy} onPress={save} />}
        {step === 3 ? <Button variant="ghost" label={isNew ? t("Save without 3D", "حفظ بدون ثلاثي الأبعاد") : t("Save changes", "حفظ التغييرات")} disabled={busy} onPress={save} /> : null}
        {step > 0 ? <Button variant="ghost" label={t("Back", "رجوع")} onPress={() => { setErr(null); setStep(step - 1); }} /> : null}
      </View>
    </>
  );
}

