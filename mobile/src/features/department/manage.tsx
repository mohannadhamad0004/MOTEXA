// MOTEXA admin editors for the Parts and Tow departments (Form template). A department admin edits records on behalf of providers,
// inside their own domain only; the server enforces it (backend routes /admin/parts/* and /admin/tow/*). These screens never touch the
// approval status (that stays in the review) and never involve the provider's login. ONE primary action: Save, fixed at the bottom.
import { Image } from "expo-image";
import { useState } from "react";
import { View } from "react-native";
import { Chip, Field, GButton, GIcon, GText, Note, Toggle } from "../../components/garage";
import { SmartPicker } from "../../components/manage/Form";
import { Block, Page } from "../../components/manage/Page";
import { CATALOG_GROUPS, labelOf } from "../../core/constants/categories";
import { CITIES, cityLabel } from "../../core/constants/cities";
import { isRealDate } from "../../core/constants/files";
import { goBack, pickImage } from "../../core/hooks/nav";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { gShape, gType, useGarageTheme } from "../../theme/garage";
import { ProductForm, blankProduct } from "../parts/ProductForm";
import { partsAdminService } from "../parts/partsService";
import { api } from "../shared/api";
import { type DocKind, TRUCK_TYPES, type Truck, type TruckType, towAdminService } from "../tow/towService";
import { useTruckLabels } from "../tow/truckBits";

const ACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const num = (v: string) => (v.trim() === "" ? null : Number(v.trim()));
/** "" / "" -> both null (clear); both numbers in range -> the pair; anything else -> undefined (invalid) */
const readPoint = (lat: string, lng: string): { lat: number | null; lng: number | null } | undefined => {
  const a = num(lat), b = num(lng);
  if (a === null && b === null) return { lat: null, lng: null };
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return undefined;
  return { lat: a, lng: b };
};
function useSave(back: Parameters<typeof goBack>[0]) {
  const [err, setErr] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await work(); goBack(back); } catch (e: any) { setErr(e?.message ?? "Error"); } finally { setBusy(false); }
  };
  return { err, setErr, busy, run };
}
const CITY_OPTIONS = (ar: boolean) => CITIES.map(o => ({ id: o.name, label: cityLabel(o.name, ar), find: `${o.name} ${cityLabel(o.name, true)}` }));
function Photo({ uri, icon }: { uri: string | null; icon: "storefront-outline" | "camera-outline" }) {
  const { g } = useGarageTheme();
  return <View style={{ width: 72, height: 72, borderRadius: gShape.small, overflow: "hidden", backgroundColor: g.cardSoft, alignItems: "center", justifyContent: "center" }}>
    {uri ? <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <GIcon name={icon} size={26} color={g.soft} />}</View>;
}
/** loading / error page of an editor whose record is still being read */
function Loading({ title, state }: { title: string; state: { error: string | null } }) {
  const { t } = useL();
  return <Page title={title}>{state.error ? <Note tone="danger" icon="alert-circle-outline">{state.error}</Note> : <GText soft>{t("Loading…", "جارٍ التحميل…")}</GText>}</Page>;
}

// ---------------------------------------------------------------- Parts: product
export function ProductEditor({ id, shopId }: { id: string; shopId?: string }) {
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad(() => (isNew ? Promise.resolve(null) : partsAdminService.getProduct(ACTOR, id)), [id]);
  const back = "/dept/directory";
  const title = isNew ? t("Add product for the shop", "إضافة منتج للمتجر") : t("Edit product", "تعديل المنتج");
  const p = state.data as any;
  if (!isNew && !p) return <Loading title={title} state={state} />;
  const line = t("Recorded as a MOTEXA admin action", "يُسجَّل كإجراء من إدارة موتكسا");
  if (isNew && !shopId) return <Page title={title}><Note tone="danger" icon="alert-circle-outline">{t("No shop selected.", "لم يتم اختيار متجر.")}</Note></Page>;
  return isNew ? <ProductForm admin isNew title={title} line={line} initial={blankProduct} onSubmit={i => partsAdminService.createProduct(ACTOR, shopId!, i)} onDone={() => goBack(back)} />
    : <ProductForm admin isNew={false} product={p} title={title} line={line}
      initial={{ name: p.name, brand: p.brand, partNumber: p.partNumber, description: p.description, price: p.price, stock: p.stock, category: p.category, condition: p.condition, partType: p.partType, imageUri: p.imageUri, fitments: p.fitments ?? [], isUniversal: !!p.isUniversal }}
      onSubmit={i => partsAdminService.updateProduct(ACTOR, id, i)} onDone={() => goBack(back)} />;
}

// ---------------------------------------------------------------- Parts: shop profile
type ShopRaw = { shopName: string; shopNameAr?: string | null; brandName: string | null; branchName: string | null; ownerName: string; phone: string; city: string; address: string | null; licenceNumber?: string | null; workingHours?: string | null; categories: string[]; baseLat: number | null; baseLng: number | null; locationAddress: string | null };

function ShopForm({ id, s }: { id: string; s: ShopRaw }) {
  const { t, isArabic } = useL();
  const { row } = useGarageTheme();
  const { err, busy, run } = useSave("/dept/directory");
  const [f, setF] = useState({ shopName: s.shopName, shopNameAr: s.shopNameAr ?? "", brandName: s.brandName ?? "", branchName: s.branchName ?? "", ownerName: s.ownerName ?? "", phone: s.phone, city: s.city,
    address: s.address ?? "", locationAddress: s.locationAddress ?? "", licenceNumber: s.licenceNumber ?? "", workingHours: s.workingHours ?? "" });
  const [cats, setCats] = useState<string[]>(s.categories), [lat, setLat] = useState(s.baseLat === null ? "" : String(s.baseLat)), [lng, setLng] = useState(s.baseLng === null ? "" : String(s.baseLng)), [photo, setPhoto] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const save = () => run(async () => {
    const p = readPoint(lat, lng);
    if (!p) throw new Error(t("Location needs both a latitude (-90 to 90) and a longitude (-180 to 180), or both empty.", "الموقع يحتاج خط عرض (من -90 إلى 90) وخط طول (من -180 إلى 180) معًا، أو اتركهما فارغين."));
    if (!f.shopName.trim() || !f.phone.trim() || !f.city.trim()) throw new Error(t("Shop name, phone and city are required.", "اسم المتجر والهاتف والمدينة مطلوبة."));
    // only what changed is sent: saving an untouched form changes nothing (and never copies the account name into the shop)
    const was: Record<string, unknown> = { shopName: s.shopName, shopNameAr: s.shopNameAr ?? "", brandName: s.brandName ?? "", branchName: s.branchName ?? "", phone: s.phone, city: s.city, address: s.address ?? "", locationAddress: s.locationAddress ?? "", licenceNumber: s.licenceNumber ?? "", workingHours: s.workingHours ?? "" };
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(was)) if ((f as Record<string, string>)[k] !== was[k]) patch[k] = (f as Record<string, string>)[k];
    if (f.ownerName !== (s.ownerName ?? "") && f.ownerName.trim()) patch.ownerName = f.ownerName;
    if ([...cats].sort().join() !== [...s.categories].sort().join()) patch.categories = cats;
    if (p.lat !== s.baseLat || p.lng !== s.baseLng) Object.assign(patch, { baseLat: p.lat, baseLng: p.lng });
    if (Object.keys(patch).length) await partsAdminService.updateShop(ACTOR, id, patch);
    if (photo) await partsAdminService.replaceStorefront(ACTOR, id, photo);
  });
  return (
    <Page title={t("Edit shop", "تعديل المتجر")} line={t("Saving never approves or rejects the shop", "الحفظ لا يعتمد المتجر ولا يرفضه")}
      footer={<GButton icon="checkmark" label={t("Save shop", "حفظ المتجر")} busy={busy} disabled={busy} onPress={() => void save()} />}>
      <Block title={t("Shop", "المتجر")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <Field label={t("Shop name", "اسم المتجر")} value={f.shopName} onChangeText={set("shopName")} />
          <Field label={t("Shop name (Arabic)", "اسم المتجر (بالعربية)")} value={f.shopNameAr} onChangeText={set("shopNameAr")} />
          <Field label={t("Brand", "العلامة التجارية")} value={f.brandName} onChangeText={set("brandName")} />
          <Field label={t("Branch", "الفرع")} value={f.branchName} onChangeText={set("branchName")} />
          <Field label={t("Owner / manager name", "اسم المالك / المدير")} value={f.ownerName} onChangeText={set("ownerName")} />
          <Field label={t("Phone", "الهاتف")} value={f.phone} keyboardType="phone-pad" onChangeText={set("phone")} />
          <SmartPicker label={t("City", "المدينة")} value={f.city} options={CITY_OPTIONS(isArabic)} onChange={set("city")} />
          <Field label={t("Address", "العنوان")} value={f.address} onChangeText={set("address")} />
          <Field label={t("Working hours", "ساعات العمل")} value={f.workingHours} onChangeText={set("workingHours")} />
          <Field label={t("Licence number", "رقم الرخصة")} value={f.licenceNumber} onChangeText={set("licenceNumber")} />
        </View>
      </Block>
      <Block title={t("Exact location", "الموقع الدقيق")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <Field label={t("Latitude", "خط العرض")} value={lat} onChangeText={setLat} />
          <Field label={t("Longitude", "خط الطول")} value={lng} onChangeText={setLng} />
          <Field label={t("Location label", "وصف الموقع")} value={f.locationAddress} onChangeText={set("locationAddress")} />
          <GText soft style={gType.caption}>{t("Approval needs a confirmed location. Leave both empty only to clear it.", "الموافقة تتطلب موقعًا مؤكدًا. اترك الحقلين فارغين فقط لمسحه.")}</GText>
        </View>
      </Block>
      <Block title={`${t("Categories", "الفئات")} (${cats.length})`}>
        <View style={{ gap: 12, paddingVertical: 10 }}>
          {CATALOG_GROUPS.map(g => (
            <View key={g.key} style={{ gap: 6 }}>
              <GText soft style={gType.caption}>{labelOf(g, isArabic)}</GText>
              <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                {g.categories.map(x => <Chip key={x.key} icon={x.icon} label={labelOf(x, isArabic)} on={cats.includes(x.key)} onPress={() => setCats(cats.includes(x.key) ? cats.filter(k => k !== x.key) : [...cats, x.key])} />)}
              </View>
            </View>
          ))}
        </View>
      </Block>
      <Block title={t("Storefront photo", "صورة واجهة المتجر")}>
        <View style={[row, { alignItems: "center", gap: 14, paddingVertical: 10 }]}>
          <Photo uri={photo} icon="storefront-outline" />
          <GButton variant="secondary" icon="camera-outline" label={photo ? t("Choose another photo", "اختيار صورة أخرى") : t("Replace storefront photo", "استبدال صورة الواجهة")} onPress={async () => { const u = await pickImage(); if (u) setPhoto(u); }} />
        </View>
      </Block>
      {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
    </Page>
  );
}
export function ShopEditor({ id }: { id: string }) {
  const { t } = useL();
  const state = useLoad(async () => (await api<{ shop: ShopRaw }>("GET", `/admin/parts/shops/${id}`)).shop, [id]);
  return state.data ? <ShopForm id={id} s={state.data} /> : <Loading title={t("Edit shop", "تعديل المتجر")} state={state} />;
}

// ---------------------------------------------------------------- Tow: company profile
type CompanyRaw = { companyName: string; companyNameAr?: string | null; contactName?: string; ownerName?: string | null; phone: string; city: string; address: string | null; licenceNumber?: string | null; description: string | null; workingHours: string | null; open24h?: boolean; serviceCities: string[]; baseLat: number | null; baseLng: number | null };

function CompanyForm({ id, co }: { id: string; co: CompanyRaw }) {
  const { t, isArabic } = useL();
  const { row } = useGarageTheme();
  const { err, busy, run } = useSave("/dept/directory");
  const [f, setF] = useState({ companyName: co.companyName, companyNameAr: co.companyNameAr ?? "", ownerName: co.ownerName ?? co.contactName ?? "", phone: co.phone, address: co.address ?? "", licenceNumber: co.licenceNumber ?? "", description: co.description ?? "", workingHours: co.workingHours ?? "" });
  const [city, setCity] = useState(co.city), [open24h, setOpen24h] = useState(!!co.open24h), [service, setService] = useState<string[]>(co.serviceCities);
  const [lat, setLat] = useState(co.baseLat === null ? "" : String(co.baseLat)), [lng, setLng] = useState(co.baseLng === null ? "" : String(co.baseLng));
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const save = () => run(async () => {
    const p = readPoint(lat, lng);
    if (!p) throw new Error(t("Location needs both a latitude (-90 to 90) and a longitude (-180 to 180), or both empty.", "الموقع يحتاج خط عرض (من -90 إلى 90) وخط طول (من -180 إلى 180) معًا، أو اتركهما فارغين."));
    if (!f.companyName.trim() || !f.phone.trim()) throw new Error(t("Company name and phone are required.", "اسم الشركة والهاتف مطلوبان."));
    const was: Record<string, unknown> = { companyName: co.companyName, companyNameAr: co.companyNameAr ?? "", phone: co.phone, address: co.address ?? "", licenceNumber: co.licenceNumber ?? "", description: co.description ?? "", workingHours: co.workingHours ?? "" };
    const patch: Record<string, unknown> = {};
    for (const k of Object.keys(was)) if ((f as Record<string, string>)[k] !== was[k]) patch[k] = (f as Record<string, string>)[k];
    if (f.ownerName !== (co.ownerName ?? co.contactName ?? "") && f.ownerName.trim()) patch.ownerName = f.ownerName;
    if (city !== co.city) patch.city = city;
    if (open24h !== !!co.open24h) patch.open24h = open24h;
    if ([...service].sort().join() !== [...co.serviceCities].sort().join()) patch.serviceCities = service;
    if (p.lat !== co.baseLat || p.lng !== co.baseLng) Object.assign(patch, { baseLat: p.lat, baseLng: p.lng });
    if (Object.keys(patch).length) await towAdminService.updateCompany(ACTOR, id, patch);
  });
  return (
    <Page title={t("Edit company", "تعديل الشركة")} line={t("Saving never approves or rejects the company", "الحفظ لا يعتمد الشركة ولا يرفضها")}
      footer={<GButton icon="checkmark" label={t("Save company", "حفظ الشركة")} busy={busy} disabled={busy} onPress={() => void save()} />}>
      <Block title={t("Company", "الشركة")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <Field label={t("Company name", "اسم الشركة")} value={f.companyName} onChangeText={set("companyName")} />
          <Field label={t("Company name (Arabic)", "اسم الشركة (بالعربية)")} value={f.companyNameAr} onChangeText={set("companyNameAr")} />
          <Field label={t("Owner / manager name", "اسم المالك / المدير")} value={f.ownerName} onChangeText={set("ownerName")} />
          <Field label={t("Phone", "الهاتف")} value={f.phone} keyboardType="phone-pad" onChangeText={set("phone")} />
          <Field label={t("Address", "العنوان")} value={f.address} onChangeText={set("address")} />
          <Field label={t("Licence number", "رقم الرخصة")} value={f.licenceNumber} onChangeText={set("licenceNumber")} />
          <Field label={t("Working hours", "ساعات العمل")} value={f.workingHours} onChangeText={set("workingHours")} />
          <Field label={t("Description", "الوصف")} value={f.description} multiline onChangeText={set("description")} />
          <Toggle label={t("Open 24 hours", "يعمل على مدار الساعة")} value={open24h} onChange={setOpen24h} />
        </View>
      </Block>
      <Block title={t("City and service area", "المدينة ومنطقة الخدمة")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <SmartPicker label={t("Base city", "مدينة المقر")} value={city} options={CITY_OPTIONS(isArabic)} onChange={setCity} />
          <GText soft style={gType.caption}>{`${t("Service cities", "مدن الخدمة")} (${service.length})`}</GText>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
            {CITIES.map(o => o.name).map(x => <Chip key={x} label={cityLabel(x, isArabic)} on={service.includes(x)} onPress={() => setService(service.includes(x) ? service.filter(k => k !== x) : [...service, x])} />)}
          </View>
        </View>
      </Block>
      <Block title={t("Company HQ location", "موقع مقر الشركة")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <Field label={t("Latitude", "خط العرض")} value={lat} onChangeText={setLat} />
          <Field label={t("Longitude", "خط الطول")} value={lng} onChangeText={setLng} />
          <GText soft style={gType.caption}>{t("Approval needs a confirmed HQ location.", "الموافقة تتطلب موقعًا مؤكدًا للمقر.")}</GText>
        </View>
      </Block>
      {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
    </Page>
  );
}
export function CompanyEditor({ id }: { id: string }) {
  const { t } = useL();
  const state = useLoad(async () => (await api<{ company: CompanyRaw }>("GET", `/admin/tow/companies/${id}`)).company, [id]);
  return state.data ? <CompanyForm id={id} co={state.data} /> : <Loading title={t("Edit company", "تعديل الشركة")} state={state} />;
}

// ---------------------------------------------------------------- Tow: truck
const DOC_KINDS: DocKind[] = ["REGISTRATION", "INSURANCE", "OPERATING_LICENSE"];

function TruckForm({ truck, companyId }: { truck?: Truck; companyId?: string }) {
  const { t } = useL();
  const { row } = useGarageTheme();
  const { type } = useTruckLabels();
  const { err, busy, run } = useSave("/dept/directory");
  const [f, setF] = useState({ type: (truck?.type ?? "FLATBED") as TruckType, plate: truck?.plate ?? "", make: truck?.make ?? "", model: truck?.model ?? "", locationAddress: truck?.locationAddress ?? "" });
  const [year, setYear] = useState(truck?.year ? String(truck.year) : ""), [weight, setWeight] = useState(truck?.maxWeightKg ? String(truck.maxWeightKg) : "");
  const [lat, setLat] = useState(truck?.baseLat == null ? "" : String(truck.baseLat)), [lng, setLng] = useState(truck?.baseLng == null ? "" : String(truck.baseLng));
  const [photo, setPhoto] = useState<string | null>(truck?.photoUri ?? null), [docs, setDocs] = useState(truck?.documents ?? []);
  const expiry = (k: DocKind) => (docs.find(d => d.kind === k)?.expiresAt ?? "").slice(0, 10);
  const attach = async (k: DocKind) => {
    const uri = await pickImage();
    if (!uri) return;
    const prev = docs.find(d => d.kind === k);
    setDocs([...docs.filter(d => d.kind !== k), { kind: k, fileName: uri.split("/").pop() || `${k.toLowerCase()}.jpg`, uri, expiresAt: prev?.expiresAt ?? null }]);
  };
  const setExpiry = (k: DocKind, v: string) => setDocs(docs.map(d => (d.kind === k ? { ...d, expiresAt: v } : d)));
  const save = () => run(async () => {
    const p = readPoint(lat, lng);
    if (!p) throw new Error(t("Location needs both a latitude and a longitude, or both empty.", "الموقع يحتاج خط عرض وخط طول معًا، أو اتركهما فارغين."));
    if (!f.plate.trim() || !f.make.trim() || !f.model.trim()) throw new Error(t("Plate, make and model are required.", "اللوحة والشركة والطراز مطلوبة."));
    const kg = weight.trim() ? Number(weight.trim()) : null;
    if (kg !== null && !(Number.isInteger(kg) && kg >= 500 && kg <= 60000)) throw new Error(t("Max load must be a whole number of kg between 500 and 60000.", "الحمل الأقصى عدد صحيح بالكيلوغرام بين 500 و60000."));
    if (docs.some(d => d.expiresAt && !isRealDate(d.expiresAt.slice(0, 10)))) throw new Error(t("Expiry dates must be real dates in YYYY-MM-DD format.", "يجب أن تكون تواريخ الانتهاء تواريخ حقيقية بصيغة YYYY-MM-DD."));
    const input = { type: f.type, plate: f.plate, make: f.make, model: f.model, year: year ? parseInt(year, 10) : null, maxWeightKg: kg, photoUri: photo, documents: docs, baseLat: p.lat, baseLng: p.lng, locationAddress: f.locationAddress.trim() || null };
    if (truck) await towAdminService.updateTruck(ACTOR, truck.id, input); else await towAdminService.addTruck(ACTOR, companyId!, input);
  });
  const docLabel = (k: DocKind) => ({ REGISTRATION: t("Vehicle registration", "ترخيص المركبة"), INSURANCE: t("Insurance", "التأمين"), OPERATING_LICENSE: t("Operating licence", "رخصة التشغيل") }[k]);
  return (
    <Page title={truck ? t("Edit truck", "تعديل الشاحنة") : t("Add truck for the company", "إضافة شاحنة للشركة")} line={t("Recorded as a MOTEXA admin action", "يُسجَّل كإجراء من إدارة موتكسا")}
      footer={<GButton icon="checkmark" label={truck ? t("Save truck", "حفظ الشاحنة") : t("Add truck", "إضافة الشاحنة")} busy={busy} disabled={busy} onPress={() => void save()} />}>
      {!truck ? <Note icon="time-outline">{t("A new truck starts as Pending. Approving it is a separate decision in its review.", "تبدأ الشاحنة الجديدة بحالة قيد المراجعة. اعتمادها قرار منفصل من صفحة مراجعتها.")}</Note> : null}
      <Block title={t("Truck", "الشاحنة")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <View style={[row, { alignItems: "center", gap: 14 }]}>
            <Photo uri={photo} icon="camera-outline" />
            <GButton variant="secondary" icon="camera-outline" label={photo ? t("Change photo", "تغيير الصورة") : t("Add truck photo", "إضافة صورة الشاحنة")} onPress={async () => { const u = await pickImage(); if (u) setPhoto(u); }} />
          </View>
          <GText soft style={gType.caption}>{t("Truck type", "نوع الشاحنة")}</GText>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{TRUCK_TYPES.map(k => <Chip key={k} label={type[k]} on={f.type === k} onPress={() => setF({ ...f, type: k })} />)}</View>
          <Field label={t("Plate number", "رقم اللوحة")} value={f.plate} autoCapitalize="characters" onChangeText={v => setF({ ...f, plate: v })} />
          <Field label={t("Make", "الشركة المصنعة")} value={f.make} onChangeText={v => setF({ ...f, make: v })} />
          <Field label={t("Model", "الطراز")} value={f.model} onChangeText={v => setF({ ...f, model: v })} />
          <Field label={t("Year", "السنة")} value={year} keyboardType="number-pad" maxLength={4} onChangeText={setYear} />
          <Field label={t("Max load (kg, optional)", "الحمل الأقصى (كغ، اختياري)")} value={weight} keyboardType="number-pad" maxLength={5} onChangeText={setWeight} />
        </View>
      </Block>
      <Block title={t("Truck operating location", "موقع تشغيل الشاحنة")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          <Field label={t("Latitude", "خط العرض")} value={lat} onChangeText={setLat} />
          <Field label={t("Longitude", "خط الطول")} value={lng} onChangeText={setLng} />
          <Field label={t("Location label", "وصف الموقع")} value={f.locationAddress} onChangeText={v => setF({ ...f, locationAddress: v })} />
        </View>
      </Block>
      <Block title={t("Documents and expiry", "المستندات وتواريخ الانتهاء")}>
        <View style={{ gap: 12, paddingVertical: 10 }}>
          {DOC_KINDS.map(k => {
            const has = docs.some(d => d.kind === k), ex = expiry(k);
            return (
              <View key={k} style={{ gap: 6 }}>
                <View style={[row, { alignItems: "center", gap: 10 }]}>
                  <GText style={[gType.bodySm, { flex: 1, fontWeight: "700" }]}>{docLabel(k)}</GText>
                  <GButton variant="ghost" icon={has ? "checkmark-circle-outline" : "attach-outline"} label={has ? t("Replace file", "استبدال الملف") : t("Attach file", "إرفاق ملف")} onPress={() => void attach(k)} />
                </View>
                {has ? <Field label={t("Expiry date (YYYY-MM-DD)", "تاريخ الانتهاء (YYYY-MM-DD)")} value={ex} placeholder="2027-12-31" onChangeText={v => setExpiry(k, v)} /> : null}
                {has && ex && isRealDate(ex) && new Date(ex).getTime() < Date.now() ? <Note tone="danger" icon="alert-circle-outline">{t("This document has expired. Ask the company to renew it, or archive the truck.", "انتهت صلاحية هذا المستند. اطلب من الشركة تجديده أو أرشف الشاحنة.")}</Note> : null}
              </View>
            );
          })}
        </View>
      </Block>
      {err ? <Note tone="danger" icon="alert-circle-outline">{err}</Note> : null}
    </Page>
  );
}
export function TruckEditor({ id, companyId }: { id: string; companyId?: string }) {
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad(async () => {
    if (isNew) return null;
    const all = await towAdminService.listTrucks(ACTOR);
    const found = all.find(x => x.id === id);
    if (!found) throw new Error("Truck not found.");
    return found;
  }, [id]);
  if (isNew) return companyId ? <TruckForm companyId={companyId} /> : <Page title={t("Add truck for the company", "إضافة شاحنة للشركة")}><Note tone="danger" icon="alert-circle-outline">{t("No company selected.", "لم يتم اختيار شركة.")}</Note></Page>;
  return state.data ? <TruckForm truck={state.data} /> : <Loading title={t("Edit truck", "تعديل الشاحنة")} state={state} />;
}
