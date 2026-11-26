// Vehicle catalog (/dept/vehicles) on the one UI system: a List with three views (generations · models · brands), search and one chip
// row; tap or ⋮ opens the record in a sheet (Form). Adding uses the brand -> model -> generation smart pickers ("+ Add '…'"), no
// separate Create buttons. Uploads and imports live in "Add 3D model" and the import pages.
import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Field, GButton, GText, Note, Sheet, Toggle } from "../../components/garage";
import { SmartPicker } from "../../components/manage/Form";
import { FilterChips, ManageEntry, ManagePage, ManageRow } from "../../components/manage/ManagePage";
import { type ItemAction } from "../../components/ItemActionsMenu";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { refreshRuntimeModels } from "../car3d/runtimeModels";
import { catalogService } from "../catalog/catalogService";
import { vehicleCatalog, type Brand, type Generation, type Model, type Taxonomy } from "./api";
import { GenerationUsage } from "./generationUsage";
import { NO_CAR, VehiclePickers, type CarPick } from "./VehiclePickers";

type Kind = "brands" | "models" | "generations";
type Open = { kind: Kind; id: string | null; values: Record<string, string>; active: boolean };
type GenRow = { g: Generation; v: Model };

export function VehicleCatalogScreen() {
  const { t, isArabic } = useL();
  const data = useLoad(vehicleCatalog.list, []);
  const [view, setView] = useState<Kind>("generations"), [q, setQ] = useState(""), [show, setShow] = useState("ALL");
  const [open, setOpen] = useState<Open | null>(null), [adding, setAdding] = useState(false), [car, setCar] = useState<CarPick>(NO_CAR);
  const tax = data.data;
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const hit = (...xs: (string | number | null | undefined)[]) => { const hay = xs.join(" ").toLowerCase(); return words.every(w => hay.includes(w)); };
  const gens: GenRow[] = useMemo(() => (tax?.vehicles ?? []).flatMap(v => v.generations.map(g => ({ g, v }))), [tax]);
  const brandOf = (id: string | null) => tax?.brands.find(b => b.id === id);
  const editGen = ({ g, v }: GenRow) => setOpen({ kind: "generations", id: g.id, active: g.isActive, values: { vehicleId: v.id, code: g.code, nameEn: g.nameEn, nameAr: g.nameAr, yearFrom: String(g.yearFrom), yearTo: String(g.yearTo) } });
  const editModel = (v: Model) => setOpen({ kind: "models", id: v.id, active: v.isActive, values: { brandId: v.brandId ?? "", model: v.model, modelAr: v.modelAr, yearFrom: String(v.yearFrom), yearTo: String(v.yearTo) } });
  const editBrand = (b: Brand) => setOpen({ kind: "brands", id: b.id, active: b.isActive, values: { name: b.name, nameAr: b.nameAr, aliases: b.aliases.join(", ") } });
  const genFilters = [{ key: "ALL", en: "All", ar: "الكل", f: (_: GenRow) => true }, { key: "3D", en: "With 3D", ar: "بنموذج", f: (x: GenRow) => x.g.effectiveAvailable },
    { key: "NO3D", en: "No 3D", ar: "بلا نموذج", f: (x: GenRow) => !x.g.effectiveAvailable }, { key: "OFF", en: "Inactive", ar: "غير نشط", f: (x: GenRow) => !x.g.isActive }];
  const genMatching = gens.filter(x => hit(x.v.displayMake, x.v.model, x.v.modelAr, x.g.code, x.g.nameEn, x.g.nameAr, x.g.yearFrom, x.g.yearTo));
  const rowsGen = genMatching.filter(genFilters.find(f => f.key === show)?.f ?? (() => true)).sort((a, b) => `${a.v.displayMake} ${a.v.model} ${a.g.yearFrom}`.localeCompare(`${b.v.displayMake} ${b.v.model} ${b.g.yearFrom}`));
  const rowsModel = (tax?.vehicles ?? []).filter(v => hit(v.displayMake, v.model, v.modelAr) && (show !== "OFF" || !v.isActive)).sort((a, b) => `${a.displayMake} ${a.model}`.localeCompare(`${b.displayMake} ${b.model}`));
  const rowsBrand = (tax?.brands ?? []).filter(b => hit(b.name, b.nameAr, ...b.aliases) && (show !== "OFF" || !b.isActive)).sort((a, b) => a.name.localeCompare(b.name));
  const items: { key: string; node: () => React.ReactElement }[] = view === "generations"
    ? rowsGen.map(x => ({ key: x.g.id, node: () => <ManageRow title={`${x.v.displayMake} ${isArabic ? x.v.modelAr || x.v.model : x.v.model}`} sub={[`${x.g.code} · ${x.g.yearFrom}–${x.g.yearTo}`, !x.g.isActive ? t("inactive", "غير نشط") : null].filter(Boolean).join(" · ")}
        status={x.g.effectiveAvailable ? { label: t("3D", "ثلاثي الأبعاد"), tone: "success" } : { label: t("No 3D", "بلا نموذج"), tone: "neutral" }} onPress={() => editGen(x)}
        actions={[{ key: "gen", label: t("Edit generation", "تعديل الجيل"), icon: "create-outline", run: () => editGen(x) }, { key: "model", label: t("Edit model", "تعديل الطراز"), icon: "car-outline", run: () => editModel(x.v) },
          ...(brandOf(x.v.brandId) ? [{ key: "brand", label: t("Edit brand", "تعديل الشركة"), icon: "pricetag-outline" as const, run: () => editBrand(brandOf(x.v.brandId)!) }] : []),
          { key: "add3d", label: x.g.effectiveAvailable ? t("Replace its 3D model", "استبدال نموذجه") : t("Add its 3D model", "إضافة نموذجه"), icon: "cube-outline", run: () => router.push(`/dept/3d/add?generationId=${x.g.id}` as Href) }] as ItemAction[]} /> }))
    : view === "models"
      ? rowsModel.map(v => ({ key: v.id, node: () => <ManageRow title={`${v.displayMake} ${isArabic ? v.modelAr || v.model : v.model}`} sub={`${v.generations.length} ${t("generations", "أجيال")} · ${v.yearFrom}–${v.yearTo}`}
          status={v.isActive ? null : { label: t("Inactive", "غير نشط"), tone: "neutral" }} onPress={() => editModel(v)} /> }))
      : rowsBrand.map(b => ({ key: b.id, node: () => <ManageRow title={isArabic ? b.nameAr || b.name : b.name} sub={[b.nameAr, b.aliases.join(", "), `${(tax?.vehicles ?? []).filter(v => v.brandId === b.id).length} ${t("models", "طرازات")}`].filter(Boolean).join(" · ")}
          status={b.isActive ? null : { label: t("Inactive", "غير نشط"), tone: "neutral" }} onPress={() => editBrand(b)} /> }));
  const chipFilters = view === "generations" ? genFilters.map(f => ({ key: f.key, label: t(f.en, f.ar), count: tax ? genMatching.filter(f.f).length : undefined }))
    : [{ key: "ALL", label: t("All", "الكل") }, { key: "OFF", label: t("Inactive", "غير نشط") }];
  return (
    <>
      <ManagePage title={t("Vehicle catalog", "كتالوج المركبات")} line={tax ? t(`${tax.brands.length} brands · ${tax.vehicles.length} models · ${gens.length} generations`, `${tax.brands.length} شركة · ${tax.vehicles.length} طراز · ${gens.length} جيل`) : undefined}
        tabs={{ value: view, onChange: k => { setView(k as Kind); setShow("ALL"); }, options: [{ key: "generations", label: t("Generations", "الأجيال") }, { key: "models", label: t("Models", "الطرازات") }, { key: "brands", label: t("Brands", "الشركات") }] }}
        search={{ value: q, onChange: setQ, placeholder: t("Search brand, model or generation", "البحث عن شركة أو طراز أو جيل") }}
        filters={<FilterChips value={show} onChange={setShow} filters={chipFilters} />}
        above={<ManageEntry icon="add-circle-outline" title={t("Add brand, model or generation", "إضافة شركة أو طراز أو جيل")} sub={t("Pick or type a name; missing ones are added from the list", "اختر أو اكتب اسمًا؛ يُضاف الناقص من القائمة")} onPress={() => { setCar(NO_CAR); setAdding(true); }} />}
        items={items} keyOf={x => x.key} renderItem={x => x.node()}
        loading={!tax && !data.error} error={data.error ? t("Could not load catalog. Parts Admin permission is required.", "تعذّر تحميل الكتالوج. يلزم صلاحية إدارة قطع الغيار.") : null} onRetry={() => void data.reload()}
        empty={{ text: q || show !== "ALL" ? t("Nothing matches.", "لا توجد نتائج مطابقة.") : t("The catalog is empty.", "الكتالوج فارغ."), action: q || show !== "ALL" ? { label: t("Clear filters", "مسح الفلاتر"), onPress: () => { setQ(""); setShow("ALL"); } } : undefined }}
        onRefresh={() => void data.reload()} refreshing={false}
        detailHint={t("Tap a record to edit it.", "اضغط على سجل لتعديله.")} />
      <Sheet visible={adding} onClose={() => setAdding(false)} tall title={t("Add to the catalog", "إضافة إلى الكتالوج")} closeLabel={t("Close", "إغلاق")}>
        {tax ? <View style={{ gap: 12 }}>
          <Note>{t("Choose an existing brand / model, or type a new name and tap \"+ Add\" at the end of the list.", "اختر شركة / طرازًا موجودًا، أو اكتب اسمًا جديدًا واضغط «+ إضافة» في آخر القائمة.")}</Note>
          <VehiclePickers tax={tax} value={car} onChange={setCar} reload={async () => { await data.reload(); catalogService.invalidateVehicleList(); }} />
          <GButton label={t("Done", "تم")} onPress={() => setAdding(false)} />
        </View> : null}
      </Sheet>
      {open && tax ? <RecordSheet key={`${open.kind}-${open.id}`} open={open} tax={tax} onClose={() => setOpen(null)} reload={data.reload} /> : null}
    </>
  );
}

/** One brand / model / generation: its fields, Active, Save; Delete when unused (brands, models) or the usage panel (generations). */
function RecordSheet({ open, tax, onClose, reload }: { open: Open; tax: Taxonomy; onClose: () => void; reload: () => Promise<unknown> }) {
  const { t, isArabic } = useL();
  const [values, setValues] = useState(open.values), [active, setActive] = useState(open.active), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const set = (k: string) => (v: string) => setValues(s => ({ ...s, [k]: v }));
  const work = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); await reload(); catalogService.invalidateVehicleList(); await refreshRuntimeModels(); onClose(); }
    catch (e) { setError(t((e as Error).message, "تعذّر إكمال الإجراء. تحقق من التفاصيل والتكرار والمراجع التاريخية.")); }
    finally { setBusy(false); }
  };
  const save = () => work(async () => {
    const body: Record<string, unknown> = { ...values, isActive: active };
    for (const k of Object.keys(body)) if (body[k] === "") delete body[k];
    if (open.kind === "brands") body.aliases = (values.aliases ?? "").split(",").map(x => x.trim()).filter(Boolean);
    else { if (values.yearFrom) body.yearFrom = Number(values.yearFrom); if (values.yearTo) body.yearTo = Number(values.yearTo); }
    await vehicleCatalog.save(open.kind, open.id, body);
  });
  const title = open.kind === "brands" ? t("Brand", "الشركة") : open.kind === "models" ? t("Model", "الطراز") : t("Generation", "الجيل");
  const years = <>
    <Field label={t("Production start year", "بداية الإنتاج")} value={values.yearFrom ?? ""} onChangeText={set("yearFrom")} keyboardType="number-pad" />
    <Field label={t("Production end year", "نهاية الإنتاج")} value={values.yearTo ?? ""} onChangeText={set("yearTo")} keyboardType="number-pad" />
  </>;
  return (
    <Sheet visible onClose={onClose} tall title={open.id ? `${t("Edit", "تعديل")} · ${title}` : title} closeLabel={t("Close", "إغلاق")}>
      <View style={{ gap: 12 }}>
        {open.kind === "brands" ? <>
          <Field label={t("Brand name", "اسم الشركة")} value={values.name ?? ""} onChangeText={set("name")} />
          <Field label={t("Arabic brand name", "اسم الشركة بالعربية")} value={values.nameAr ?? ""} onChangeText={set("nameAr")} />
          <Field label={t("Aliases (comma separated)", "الأسماء البديلة (مفصولة بفواصل)")} value={values.aliases ?? ""} onChangeText={set("aliases")} />
        </> : null}
        {open.kind === "models" ? <>
          <SmartPicker label={t("Brand", "الشركة")} value={values.brandId} options={tax.brands.map(b => ({ id: b.id, label: isArabic ? b.nameAr || b.name : b.name, find: [b.name, b.nameAr, ...b.aliases].join(" ") }))} onChange={set("brandId")} />
          <Field label={t("Model name", "اسم الطراز")} value={values.model ?? ""} onChangeText={set("model")} />
          <Field label={t("Arabic model name", "اسم الطراز بالعربية")} value={values.modelAr ?? ""} onChangeText={set("modelAr")} />
          {years}
        </> : null}
        {open.kind === "generations" ? <>
          <SmartPicker label={t("Model", "الطراز")} value={values.vehicleId} options={tax.vehicles.map(v => ({ id: v.id, label: `${v.displayMake} ${v.model}`, find: v.modelAr }))} onChange={set("vehicleId")} />
          <Field label={t("Generation code", "رمز الجيل")} value={values.code ?? ""} onChangeText={set("code")} />
          <Field label={t("Display name (optional)", "اسم العرض (اختياري)")} value={values.nameEn ?? ""} onChangeText={set("nameEn")} />
          <Field label={t("Arabic display name (optional)", "اسم العرض بالعربية (اختياري)")} value={values.nameAr ?? ""} onChangeText={set("nameAr")} />
          {years}
        </> : null}
        <Toggle label={t("Active", "نشط")} value={active} onChange={setActive} />
        {error ? <Note tone="danger">{error}</Note> : null}
        <GButton label={t("Save", "حفظ")} busy={busy} disabled={busy} onPress={() => void save()} />
        {open.id && open.kind === "generations" ? <GenerationUsage key={open.id} id={open.id} isActive={active} onDone={onClose} /> : null}
        {open.id && open.kind !== "generations" ? <>
          <GText soft>{t("Deactivate referenced records. Delete succeeds only when there are no dependent records or historical references.", "عطّل السجلات المرتبطة. ينجح الحذف فقط عند عدم وجود سجلات تابعة أو مراجع تاريخية.")}</GText>
          <GButton variant="danger" label={t("Delete unused record", "حذف سجل غير مستخدم")} disabled={busy} onPress={() => void work(() => vehicleCatalog.remove(open.kind, open.id!))} />
        </> : null}
      </View>
    </Sheet>
  );
}
