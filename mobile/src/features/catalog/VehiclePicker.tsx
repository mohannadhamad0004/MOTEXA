import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { apiUrl } from "../../core/config/api";
import { Field, GButton, GIcon, GText, Note, SearchBar, Sheet, SkeletonRows, Tap } from "../../components/garage";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { useL } from "../../core/hooks/useL";
import { GenerationRow, VehicleRow, catalogService } from "./catalogService";
import { addGarageCar, updateGarageCar, closeMyCarPicker, useGarage, useGaragePicker, garageError, canAddGarageCar, matchingGarageCars, openMyCarPicker } from "./myCar";
import { normSearch } from "./vehicleMatch";
import { CAR_COLORS, DEFAULT_COLOR } from "../car3d/car3d";

export type PickedCar = { make: string; model: string; year: string };

/** The vehicle list, read once per session (shared by the picker, the search chip and the shop form). */
export function useVehicleList() {
  const [list, setList] = useState<VehicleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    catalogService
      .getVehicleList()
      .then((v) => live && (setList(v), setError(null)))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [tick]);
  return { list, error, retry: () => setTick((n) => n + 1) };
}

/**
 * Make -> Model -> Year from the vehicle list (no free text), searchable in English or Arabic. The step shows as a trail at the
 * top; tapping a step goes back to it. `onChange` gets year "" until a year is picked.
 */
export function VehiclePicker({ value, onChange }: { value: PickedCar; onChange: (v: PickedCar) => void }) {
  const { g, shadow } = useGarageTheme();
  const { t, row, align, isArabic } = useL();
  const { list, error, retry } = useVehicleList();
  const [q, setQ] = useState("");
  const step: "make" | "model" | "year" = !value.make ? "make" : !value.model ? "model" : "year";
  useEffect(() => setQ(""), [step]);

  const label = (en: string, ar: string) => (isArabic && ar ? ar : en);
  const hit = (...names: string[]) => !q.trim() || names.some((n) => normSearch(n).includes(normSearch(q)));
  const makes = useMemo(() => {
    const seen = new Map<string, VehicleRow>();
    for (const v of list ?? []) if (!seen.has(v.make)) seen.set(v.make, v);
    return [...seen.values()];
  }, [list]);
  const models = (list ?? []).filter((v) => v.make === value.make);
  const chosen = models.find((v) => v.model === value.model);
  const years = chosen ? Array.from({ length: Math.min(chosen.yearTo, new Date().getFullYear() + 1) - chosen.yearFrom + 1 }, (_, i) => Math.min(chosen.yearTo, new Date().getFullYear() + 1) - i) : [];

  const option = (key: string, text: string, sub: string | null, on: boolean, onPress: () => void) => (
    <Tap key={key} label={text} onPress={onPress} style={[row, { minHeight: 48, alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: gShape.small, backgroundColor: on ? g.tint : g.card, borderWidth: 1, borderColor: on ? g.accent : g.line }]}>
      <View style={{ flex: 1 }}>
        <GText style={[gType.label, { fontWeight: "700" }, align]}>{text}</GText>
        {sub ? <GText soft style={[gType.caption, align]}>{sub}</GText> : null}
      </View>
      <GIcon name={on ? "checkmark-circle" : "chevron-forward"} size={18} color={on ? g.accent : g.soft} flip={!on} />
    </Tap>
  );
  const crumb = (text: string, onPress: () => void) => (
    <Tap label={text} onPress={onPress} style={[row, { minHeight: 36, alignItems: "center", gap: 4, paddingHorizontal: 12, borderRadius: gShape.pill, backgroundColor: g.card }, shadow(1)]}>
      <GText style={[gType.caption, { fontWeight: "800" }]}>{text}</GText>
      <GIcon name="close" size={13} color={g.soft} />
    </Tap>
  );

  if (error)
    return (
      <View style={{ gap: 10 }}>
        <Note tone="danger" icon="alert-circle-outline">{error}</Note>
        <GButton variant="secondary" label={t("Retry", "إعادة المحاولة")} onPress={retry} />
      </View>
    );
  if (!list) return <SkeletonRows />;
  return (
    <View style={{ gap: 10 }}>
      {value.make ? (
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
          {crumb(label(value.make, makes.find((m) => m.make === value.make)?.makeAr ?? ""), () => onChange({ make: "", model: "", year: "" }))}
          {value.model ? crumb(label(value.model, chosen?.modelAr ?? ""), () => onChange({ ...value, model: "", year: "" })) : null}
          {value.year ? crumb(value.year, () => onChange({ ...value, year: "" })) : null}
        </View>
      ) : null}
      <GText style={[gType.title, align]}>{step === "make" ? t("Make", "الشركة المصنعة") : step === "model" ? t("Model", "الطراز") : t("Year", "سنة الصنع")}</GText>
      {step !== "year" ? (
        <SearchBar value={q} onChangeText={setQ} placeholder={step === "make" ? t("Search a make, e.g. Toyota", "ابحث عن شركة، مثل تويوتا") : t("Search a model", "ابحث عن طراز")} />
      ) : null}
      {step === "make" ? (
        <View style={{ gap: 8 }}>{makes.filter((m) => hit(m.make, m.makeAr)).map((m) => option(m.make, label(m.make, m.makeAr), isArabic ? m.make : m.makeAr, false, () => onChange({ make: m.make, model: "", year: "" })))}</View>
      ) : step === "model" ? (
        <View style={{ gap: 8 }}>
          {models.filter((m) => hit(m.model, m.modelAr)).map((m) => option(m.model, label(m.model, m.modelAr), `${m.yearFrom}–${Math.min(m.yearTo, new Date().getFullYear() + 1)}`, false, () => onChange({ ...value, model: m.model, year: "" })))}
        </View>
      ) : (
        <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
          {years.map((y) => (
            <Tap key={y} label={String(y)} onPress={() => onChange({ ...value, year: String(y) })} style={{ minWidth: 72, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: gShape.pill, borderWidth: 1, borderColor: value.year === String(y) ? g.accent : g.line, backgroundColor: value.year === String(y) ? g.accent : g.card }}>
              <GText style={[gType.label, { fontWeight: "700", color: value.year === String(y) ? g.onAccent : g.ink }]}>{String(y)}</GText>
            </Tap>
          ))}
        </View>
      )}
      {step !== "year" && !(step === "make" ? makes.some((m) => hit(m.make, m.makeAr)) : models.some((m) => hit(m.model, m.modelAr))) ? (
        <Note>{t("Not on the list. Check the spelling, or try the English name.", "غير موجودة في القائمة. تحقق من الكتابة أو جرّب الاسم بالإنجليزية.")}</Note>
      ) : null}
    </View>
  );
}

/** Explicit add/edit sheet; saved-car selection lives in GarageSheets. */
export function MyCarSheet() {
  const picker = useGaragePicker();
  const { garageCars, busy, loaded, error } = useGarage();
  const editing = picker?.mode === "edit" ? garageCars.find(c => c.id === picker.id) : undefined;
  const open = picker?.mode === "add" || picker?.mode === "edit";
  const { t } = useL();
  const [draft, setDraft] = useState<PickedCar>({ make: "", model: "", year: "" });
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState<string | null>(DEFAULT_COLOR);
  const [genId, setGenId] = useState<string | null | undefined>(undefined);
  const { list, error: listError, retry } = useVehicleList();
  const gens = (list ?? []).find(v => v.make === draft.make && v.model === draft.model)?.generations?.filter(x => draft.year && x.yearFrom <= +draft.year && +draft.year <= x.yearTo) ?? [];
  const gen = genId === undefined && gens.length === 1 ? gens[0].id : genId;
  const genDone = gens.length <= 1 || genId !== undefined;
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const initial = picker?.mode === "add" ? picker.draft : editing;
    setDraft(initial ? { make: initial.make, model: initial.model, year: String(initial.year) } : { make: "", model: "", year: "" });
    setColor(initial?.color === undefined ? DEFAULT_COLOR : initial.color);
    setNickname(initial?.nickname ?? "");
    setGenId(initial?.generationId);
    setErr(null);
    // Snapshot the selected ID once; refreshes must not overwrite a draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker]);
  const duplicate = !editing && !!draft.year && matchingGarageCars(garageCars, { ...draft, generationId: gen ?? null }).length > 0;
  const atLimit = !editing && !canAddGarageCar(garageCars);
  const missing = picker?.mode === "edit" && !editing;
  const save = async () => {
    setErr(null);
    try {
      const input = { make: draft.make, model: draft.model, year: Number(draft.year), color, nickname: nickname.trim() || null, generationId: gen ?? null };
      if (editing) await updateGarageCar(editing.id, input);
      else await addGarageCar(input);
      closeMyCarPicker();
    } catch (e) { setErr(garageError(e, t)); }
  };
  const close = () => { if (!busy) closeMyCarPicker(); };
  return (
    <Sheet visible={open} tall onClose={close} closeLabel={t("Close", "إغلاق")} title={editing ? t("Edit car", "تعديل السيارة") : t("Add car", "إضافة سيارة")}
      footer={<View style={{ gap: 8 }}>
        {err ? <Note tone="danger">{err}</Note> : null}
        {error ? <Note tone="danger">{t("Refresh your Garage before saving.", "حدّث كراجك قبل الحفظ.")}</Note> : null}
        {missing ? <Note tone="danger">{t("This car is no longer saved.", "لم تعد هذه السيارة محفوظة.")}</Note> : null}
        {atLimit ? <Note>{t("You've reached the 10-car Garage limit.", "وصلت إلى الحد الأقصى للكراج: 10 سيارات.")}</Note> : null}
        {duplicate ? <GButton variant="secondary" label={t("Already saved — choose from Garage", "محفوظة بالفعل — اختر من الكراج")} onPress={openMyCarPicker} /> : null}
        <GButton label={editing ? t("Save changes", "حفظ التغييرات") : t("Add to Garage", "إضافة إلى الكراج")} busy={busy} disabled={!loaded || !!error || !list || !!listError || !draft.year || !genDone || atLimit || duplicate || missing} onPress={() => void save()} />
      </View>}>
      <Field label={t("Nickname (optional)", "اسم السيارة (اختياري)")} value={nickname} onChangeText={setNickname} maxLength={40} />
      <VehiclePicker value={draft} onChange={v => { if (v.make !== draft.make || v.model !== draft.model || v.year !== draft.year) setGenId(undefined); setDraft(v); }} />
      {listError ? <GButton variant="secondary" label={t("Retry vehicle list", "إعادة تحميل قائمة المركبات")} onPress={retry} /> : null}
      {draft.year && gens.length ? <GenerationStep gens={gens} value={gen} onChange={setGenId} /> : null}
      {draft.year && genDone ? <ColorStep key={picker?.mode === "edit" ? picker.id : "add"} value={color ?? DEFAULT_COLOR} onChange={setColor} /> : null}
    </Sheet>
  );
}

/** "Is this your car?": the generation(s) covering the picked year, each with its photo. Two overlap -> pick one, or "not sure". */
function GenerationStep({ gens, value, onChange }: { gens: GenerationRow[]; value: string | null | undefined; onChange: (id: string | null) => void }) {
  const { g } = useGarageTheme();
  const { t, row, align, isArabic } = useL();
  const many = gens.length > 1;
  return (
    <View style={{ gap: 10, marginTop: 18 }}>
      <GText style={[gType.title, align]}>{many ? t("Which one is your car?", "أيّ واحدة سيارتك؟") : t("Is this your car?", "هل هذه سيارتك؟")}</GText>
      {gens.map((x) => {
        const on = value === x.id;
        const name = isArabic ? x.nameAr : x.nameEn;
        return (
          <Tap key={x.id} label={name} onPress={() => onChange(x.id)} style={[row, { alignItems: "center", gap: 12, padding: 8, borderRadius: gShape.small, borderWidth: on ? 2 : 1, borderColor: on ? g.accent : g.line, backgroundColor: on ? g.tint : g.card }]}>
            <View style={{ width: 112, height: 72, borderRadius: gShape.small, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
              {x.photoUrl ? <Image source={{ uri: apiUrl(x.photoUrl) }} contentFit="cover" style={{ width: "100%", height: "100%" }} accessibilityLabel={name} /> : <GIcon name="car-sport-outline" size={28} color={g.soft} />}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <GText style={[gType.label, { fontWeight: "800" }, align]}>{name}</GText>
              <GText soft style={[gType.caption, align]}>{`${x.yearFrom}–${Math.min(x.yearTo, new Date().getFullYear() + 1)}`}</GText>
              {x.photoUrl && x.photoCredit ? <GText soft numberOfLines={1} style={[gType.tiny, align]}>{`${t("Photo", "صورة")}: ${x.photoCredit} (${x.photoLicense ?? ""})`}</GText> : null}
            </View>
            {many ? <GIcon name={on ? "checkmark-circle" : "ellipse-outline"} size={20} color={on ? g.accent : g.soft} /> : null}
          </Tap>
        );
      })}
      {gens.length ? (
        <Tap label={t("Not sure", "لست متأكدًا")} onPress={() => onChange(null)} style={[row, { minHeight: 44, alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: gShape.pill, borderWidth: 1, borderColor: value === null ? g.accent : g.line, alignSelf: isArabic ? "flex-end" : "flex-start" }]}>
          <GIcon name={value === null ? "checkmark-circle" : "help-circle-outline"} size={18} color={value === null ? g.accent : g.soft} />
          <GText style={[gType.label, { fontWeight: "700" }]}>{t("Not sure", "لست متأكدًا")}</GText>
        </Tap>
      ) : null}
    </View>
  );
}

/** Optional paint for the 3D view: 10 common colours + "Other" (a #rrggbb field). Default silver. */
function ColorStep({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const { g } = useGarageTheme();
  const { t, row, align, isArabic } = useL();
  const preset = CAR_COLORS.some((c) => c.hex === value);
  const [other, setOther] = useState(!preset);
  const [hex, setHex] = useState(preset ? "" : value);
  useEffect(() => { setOther(!CAR_COLORS.some(c => c.hex === value)); setHex(value); }, [value]);
  const swatch = (key: string, label: string, fill: string | null, on: boolean, onPress: () => void) => (
    <Tap key={key} label={label} onPress={onPress} style={{ width: 64, alignItems: "center", gap: 4 }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: on ? 3 : 1, borderColor: on ? g.accent : g.line, padding: 3 }}>
        <View style={{ flex: 1, borderRadius: 19, backgroundColor: fill ?? g.tint, alignItems: "center", justifyContent: "center" }}>
          {fill ? null : <GIcon name="color-palette-outline" size={16} color={g.accentText} />}
        </View>
      </View>
      <GText numberOfLines={1} soft={!on} style={[gType.tiny, { fontWeight: on ? "800" : "600" }]}>{label}</GText>
    </Tap>
  );
  return (
    <View style={{ gap: 10, marginTop: 18 }}>
      <GText style={[gType.title, align]}>{t("Colour", "اللون")}</GText>
      <View style={[row, { flexWrap: "wrap", rowGap: 10 }]}>
        {CAR_COLORS.map((c) => swatch(c.hex, isArabic ? c.ar : c.en, c.hex, !other && value === c.hex, () => (setOther(false), onChange(c.hex))))}
        {swatch("other", t("Other", "آخر"), other && /^#[0-9a-f]{6}$/i.test(hex) ? hex : null, other, () => setOther(true))}
      </View>
      {other ? (
        <TextInput
          value={hex}
          onChangeText={(v) => {
            const next = (v.startsWith("#") ? v : "#" + v).slice(0, 7);
            setHex(next);
            if (/^#[0-9a-f]{6}$/i.test(next)) onChange(next.toLowerCase());
          }}
          placeholder="#8a1c2b"
          placeholderTextColor={g.soft}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t("Colour code, e.g. #8a1c2b", "رمز اللون، مثل #8a1c2b")}
          style={{ minHeight: 48, paddingHorizontal: 14, borderRadius: gShape.small, borderWidth: 1, borderColor: g.line, backgroundColor: g.card, color: g.ink, fontSize: 15, writingDirection: "ltr", textAlign: "left" }}
        />
      ) : null}
    </View>
  );
}
