// MOTEXA admin editors for the Parts and Tow departments. A department admin edits records on behalf of providers, inside
// their own domain only; the server enforces it (see backend routes /admin/parts/* and /admin/tow/*). These screens never
// touch the approval status (that stays in the review screen) and never involve the provider's login.
import { useState } from "react";
import { View } from "react-native";
import { Async, Notice } from "../../components/ui/Feedback";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { ImageTile } from "../../components/ui/Rows";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { Text } from "../../components/ui/Text";
import { CATALOG_GROUPS, labelOf } from "../../core/constants/categories";
import { CITIES, cityLabel } from "../../core/constants/cities";
import { isRealDate } from "../../core/constants/files";
import { goBack, pickImage } from "../../core/hooks/nav";
import { useL } from "../../core/hooks/useL";
import { useLoad } from "../../core/hooks/useLoad";
import { useTheme } from "../../theme/useTheme";
import { Chip } from "../catalog/catalogBits";
import { ProductForm, blankProduct } from "../parts/ProductForm";
import { partsAdminService } from "../parts/partsService";
import { api } from "../shared/api";
import { DocKind, TRUCK_TYPES, Truck, TruckType, towAdminService } from "../tow/towService";
import { useTruckLabels } from "../tow/truckBits";
import { DeptPage } from "./ui";

const ACTOR = { id: "", email: "", fullName: "", role: "ADMIN", permissions: [] as string[] };
const num = (v: string) => (v.trim() === "" ? null : Number(v.trim()));
/** "" / "" -> both null (clear); both numbers in range -> the pair; anything else -> undefined (invalid) */
const readPoint = (lat: string, lng: string): { lat: number | null; lng: number | null } | undefined => {
  const a = num(lat);
  const b = num(lng);
  if (a === null && b === null) return { lat: null, lng: null };
  if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return undefined;
  return { lat: a, lng: b };
};

function useSave(back: Parameters<typeof goBack>[0]) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await work();
      goBack(back);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };
  return { err, setErr, busy, run };
}

const Label = ({ children }: { children: string }) => {
  const { c } = useTheme();
  const { align } = useL();
  return <Text style={[{ color: c.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 7 }, align]}>{children}</Text>;
};

// ---------------------------------------------------------------- Parts: product
export function ProductEditor({ id, shopId }: { id: string; shopId?: string }) {
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad(() => (isNew ? Promise.resolve(null) : partsAdminService.getProduct(ACTOR, id)), [id]);
  const back = "/dept/directory";
  return (
    <DeptPage back tabs={false}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: useTheme().c.text, marginBottom: 12 }}>{isNew ? t("Add product for the shop", "إضافة منتج للمتجر") : t("Edit product", "تعديل المنتج")}</Text>
      <Notice icon="shield-checkmark-outline">{t("You are editing on behalf of the shop. The change is recorded as a MOTEXA admin action.", "أنت تعدّل نيابةً عن المتجر. يُسجَّل التغيير كإجراء من مشرف MOTEXA.")}</Notice>
      {isNew ? (
        shopId ? (
          <ProductForm admin isNew initial={blankProduct} onSubmit={(i) => partsAdminService.createProduct(ACTOR, shopId, i)} onDone={() => goBack(back)} />
        ) : (
          <Notice tone="danger" icon="alert-circle-outline">{t("No shop selected.", "لم يتم اختيار متجر.")}</Notice>
        )
      ) : (
        <Async state={state as any}>
          {(p: any) => (
            <ProductForm
              admin
              isNew={false}
              product={p}
              initial={{ name: p.name, brand: p.brand, partNumber: p.partNumber, description: p.description, price: p.price, stock: p.stock, category: p.category, condition: p.condition, partType: p.partType, imageUri: p.imageUri, fitments: p.fitments, isUniversal: p.isUniversal }}
              onSubmit={(i) => partsAdminService.updateProduct(ACTOR, id, i)}
              onDone={() => goBack(back)}
            />
          )}
        </Async>
      )}
    </DeptPage>
  );
}

// ---------------------------------------------------------------- Parts: shop profile
type ShopRaw = { shopName: string; shopNameAr?: string | null; brandName: string | null; branchName: string | null; ownerName: string; phone: string; city: string; address: string | null; licenceNumber?: string | null; workingHours?: string | null; categories: string[]; baseLat: number | null; baseLng: number | null; locationAddress: string | null; storefrontUri?: string | null };

function ShopForm({ id, s }: { id: string; s: ShopRaw }) {
  const { t, isArabic } = useL();
  const { c } = useTheme();
  const { err, setErr, busy, run } = useSave("/dept/directory");
  const [f, setF] = useState({
    shopName: s.shopName, shopNameAr: s.shopNameAr ?? "", brandName: s.brandName ?? "", branchName: s.branchName ?? "", ownerName: s.ownerName ?? "", phone: s.phone, city: s.city,
    address: s.address ?? "", locationAddress: s.locationAddress ?? "", licenceNumber: s.licenceNumber ?? "", workingHours: s.workingHours ?? "",
  });
  const [cats, setCats] = useState<string[]>(s.categories);
  const [lat, setLat] = useState(s.baseLat === null ? "" : String(s.baseLat));
  const [lng, setLng] = useState(s.baseLng === null ? "" : String(s.baseLng));
  const [photo, setPhoto] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const save = () =>
    run(async () => {
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
    <>
      <Card>
        <Input label={t("Shop name", "اسم المتجر")} value={f.shopName} onChangeText={set("shopName")} />
        <Input label={t("Shop name (Arabic)", "اسم المتجر (بالعربية)")} value={f.shopNameAr} onChangeText={set("shopNameAr")} />
        <Input label={t("Brand", "العلامة التجارية")} value={f.brandName} onChangeText={set("brandName")} />
        <Input label={t("Branch", "الفرع")} value={f.branchName} onChangeText={set("branchName")} />
        <Input label={t("Owner / manager name", "اسم المالك / المدير")} value={f.ownerName} onChangeText={set("ownerName")} />
        <Input label={t("Phone", "الهاتف")} value={f.phone} keyboardType="phone-pad" onChangeText={set("phone")} />
        <Input label={t("City", "المدينة")} value={f.city} onChangeText={set("city")} />
        <Input label={t("Address", "العنوان")} value={f.address} onChangeText={set("address")} />
        <Input label={t("Working hours", "ساعات العمل")} value={f.workingHours} onChangeText={set("workingHours")} />
        <Input label={t("Licence number", "رقم الرخصة")} value={f.licenceNumber} onChangeText={set("licenceNumber")} />
      </Card>
      <SectionHeader title={t("Exact location", "الموقع الدقيق")} />
      <Card>
        <Input label={t("Latitude", "خط العرض")} value={lat} keyboardType="numbers-and-punctuation" onChangeText={setLat} />
        <Input label={t("Longitude", "خط الطول")} value={lng} keyboardType="numbers-and-punctuation" onChangeText={setLng} />
        <Input label={t("Location label", "وصف الموقع")} value={f.locationAddress} onChangeText={set("locationAddress")} />
        <Text style={{ color: c.textMuted, fontSize: 12 }}>{t("Approval needs a confirmed location. Leave both empty only to clear it.", "الموافقة تتطلب موقعًا مؤكدًا. اترك الحقلين فارغين فقط لمسح الموقع.")}</Text>
      </Card>
      <SectionHeader title={t("Categories", "الفئات")} />
      <Card>
        {CATALOG_GROUPS.map((g) => (
          <View key={g.key} style={{ marginBottom: 12 }}>
            <Label>{labelOf(g, isArabic)}</Label>
            <View style={{ flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 8 }}>
              {g.categories.map((x) => (
                <Chip key={x.key} icon={x.icon} label={labelOf(x, isArabic)} on={cats.includes(x.key)} onPress={() => setCats(cats.includes(x.key) ? cats.filter((k) => k !== x.key) : [...cats, x.key])} />
              ))}
            </View>
          </View>
        ))}
      </Card>
      <SectionHeader title={t("Storefront photo", "صورة واجهة المتجر")} />
      <Card>
        <View style={{ flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 14 }}>
          <ImageTile uri={photo} icon="storefront-outline" size={72} />
          <View style={{ flex: 1 }}>
            <Button variant="ghost" icon="camera-outline" label={photo ? t("Choose another photo", "اختيار صورة أخرى") : t("Replace storefront photo", "استبدال صورة الواجهة")} onPress={async () => { const u = await pickImage(); if (u) setPhoto(u); }} />
          </View>
        </View>
      </Card>
      <View style={{ height: 16 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <Button label={t("Save shop", "حفظ المتجر")} disabled={busy} onPress={save} />
    </>
  );
}

export function ShopEditor({ id }: { id: string }) {
  const { t } = useL();
  const state = useLoad(async () => (await api<{ shop: ShopRaw }>("GET", `/admin/parts/shops/${id}`)).shop, [id]);
  return (
    <DeptPage back tabs={false}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: useTheme().c.text, marginBottom: 12 }}>{t("Edit shop", "تعديل المتجر")}</Text>
      <Notice icon="shield-checkmark-outline">{t("Saving does not approve or reject the shop. The approval status only changes in the review.", "الحفظ لا يعتمد المتجر ولا يرفضه. حالة الموافقة تتغير فقط من المراجعة.")}</Notice>
      <Async state={state as any}>{(s: ShopRaw) => <ShopForm id={id} s={s} />}</Async>
    </DeptPage>
  );
}

// ---------------------------------------------------------------- Tow: company profile
type CompanyRaw = { companyName: string; companyNameAr?: string | null; contactName?: string; ownerName?: string | null; phone: string; city: string; address: string | null; licenceNumber?: string | null; description: string | null; workingHours: string | null; open24h?: boolean; serviceCities: string[]; baseLat: number | null; baseLng: number | null };

function CompanyForm({ id, co }: { id: string; co: CompanyRaw }) {
  const { t, isArabic } = useL();
  const { c } = useTheme();
  const { err, busy, run } = useSave("/dept/directory");
  const [f, setF] = useState({ companyName: co.companyName, companyNameAr: co.companyNameAr ?? "", ownerName: co.ownerName ?? co.contactName ?? "", phone: co.phone, address: co.address ?? "", licenceNumber: co.licenceNumber ?? "", description: co.description ?? "", workingHours: co.workingHours ?? "" });
  const [city, setCity] = useState(co.city);
  const [open24h, setOpen24h] = useState(!!co.open24h);
  const [service, setService] = useState<string[]>(co.serviceCities);
  const [lat, setLat] = useState(co.baseLat === null ? "" : String(co.baseLat));
  const [lng, setLng] = useState(co.baseLng === null ? "" : String(co.baseLng));
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const save = () =>
    run(async () => {
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
    <>
      <Card>
        <Input label={t("Company name", "اسم الشركة")} value={f.companyName} onChangeText={set("companyName")} />
        <Input label={t("Company name (Arabic)", "اسم الشركة (بالعربية)")} value={f.companyNameAr} onChangeText={set("companyNameAr")} />
        <Input label={t("Owner / manager name", "اسم المالك / المدير")} value={f.ownerName} onChangeText={set("ownerName")} />
        <Input label={t("Phone", "الهاتف")} value={f.phone} keyboardType="phone-pad" onChangeText={set("phone")} />
        <Input label={t("Address", "العنوان")} value={f.address} onChangeText={set("address")} />
        <Input label={t("Licence number", "رقم الرخصة")} value={f.licenceNumber} onChangeText={set("licenceNumber")} />
        <Input label={t("Working hours", "ساعات العمل")} value={f.workingHours} onChangeText={set("workingHours")} />
        <Input label={t("Description", "الوصف")} value={f.description} multiline onChangeText={set("description")} />
        <View style={{ flexDirection: isArabic ? "row-reverse" : "row" }}>
          <Chip icon="time-outline" label={t("Open 24 hours", "يعمل على مدار الساعة")} on={open24h} onPress={() => setOpen24h(!open24h)} />
        </View>
      </Card>
      <SectionHeader title={t("City and service area", "المدينة ومنطقة الخدمة")} />
      <Card>
        <Label>{t("BASE CITY", "مدينة المقر")}</Label>
        <View style={{ flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {CITIES.map((o) => o.name).map((x) => <Chip key={x} label={cityLabel(x, isArabic)} on={city === x} onPress={() => setCity(x)} />)}
        </View>
        <Label>{t("SERVICE CITIES", "مدن الخدمة")}</Label>
        <View style={{ flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 8 }}>
          {CITIES.map((o) => o.name).map((x) => <Chip key={x} label={cityLabel(x, isArabic)} on={service.includes(x)} onPress={() => setService(service.includes(x) ? service.filter((k) => k !== x) : [...service, x])} />)}
        </View>
      </Card>
      <SectionHeader title={t("Company HQ location", "موقع مقر الشركة")} />
      <Card>
        <Input label={t("Latitude", "خط العرض")} value={lat} keyboardType="numbers-and-punctuation" onChangeText={setLat} />
        <Input label={t("Longitude", "خط الطول")} value={lng} keyboardType="numbers-and-punctuation" onChangeText={setLng} />
        <Text style={{ color: c.textMuted, fontSize: 12 }}>{t("Approval needs a confirmed HQ location.", "الموافقة تتطلب موقعًا مؤكدًا للمقر.")}</Text>
      </Card>
      <View style={{ height: 16 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <Button label={t("Save company", "حفظ الشركة")} disabled={busy} onPress={save} />
    </>
  );
}

export function CompanyEditor({ id }: { id: string }) {
  const { t } = useL();
  const state = useLoad(async () => (await api<{ company: CompanyRaw }>("GET", `/admin/tow/companies/${id}`)).company, [id]);
  return (
    <DeptPage back tabs={false}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: useTheme().c.text, marginBottom: 12 }}>{t("Edit company", "تعديل الشركة")}</Text>
      <Notice icon="shield-checkmark-outline">{t("Saving does not approve or reject the company. The approval status only changes in the review.", "الحفظ لا يعتمد الشركة ولا يرفضها. حالة الموافقة تتغير فقط من المراجعة.")}</Notice>
      <Async state={state as any}>{(co: CompanyRaw) => <CompanyForm id={id} co={co} />}</Async>
    </DeptPage>
  );
}

// ---------------------------------------------------------------- Tow: truck
const DOC_KINDS: DocKind[] = ["REGISTRATION", "INSURANCE", "OPERATING_LICENSE"];

function TruckForm({ truck, companyId }: { truck?: Truck; companyId?: string }) {
  const { t, isArabic } = useL();
  const { type } = useTruckLabels();
  const { err, busy, run } = useSave("/dept/directory");
  const [f, setF] = useState({ type: (truck?.type ?? "FLATBED") as TruckType, plate: truck?.plate ?? "", make: truck?.make ?? "", model: truck?.model ?? "", locationAddress: truck?.locationAddress ?? "" });
  const [year, setYear] = useState(truck?.year ? String(truck.year) : "");
  const [weight, setWeight] = useState(truck?.maxWeightKg ? String(truck.maxWeightKg) : "");
  const [lat, setLat] = useState(truck?.baseLat == null ? "" : String(truck.baseLat));
  const [lng, setLng] = useState(truck?.baseLng == null ? "" : String(truck.baseLng));
  const [photo, setPhoto] = useState<string | null>(truck?.photoUri ?? null);
  const [docs, setDocs] = useState(truck?.documents ?? []);
  const expiry = (k: DocKind) => (docs.find((d) => d.kind === k)?.expiresAt ?? "").slice(0, 10);
  const attach = async (k: DocKind) => {
    const uri = await pickImage();
    if (!uri) return;
    const prev = docs.find((d) => d.kind === k);
    setDocs([...docs.filter((d) => d.kind !== k), { kind: k, fileName: uri.split("/").pop() || `${k.toLowerCase()}.jpg`, uri, expiresAt: prev?.expiresAt ?? null }]);
  };
  const setExpiry = (k: DocKind, v: string) => setDocs(docs.map((d) => (d.kind === k ? { ...d, expiresAt: v } : d)));
  const save = () =>
    run(async () => {
      const p = readPoint(lat, lng);
      if (!p) throw new Error(t("Location needs both a latitude and a longitude, or both empty.", "الموقع يحتاج خط عرض وخط طول معًا، أو اتركهما فارغين."));
      if (!f.plate.trim() || !f.make.trim() || !f.model.trim()) throw new Error(t("Plate, make and model are required.", "اللوحة والشركة والطراز مطلوبة."));
      const kg = weight.trim() ? Number(weight.trim()) : null;
      if (kg !== null && !(Number.isInteger(kg) && kg >= 500 && kg <= 60000)) throw new Error(t("Max load must be a whole number of kg between 500 and 60000.", "الحمل الأقصى عدد صحيح بالكيلوغرام بين 500 و60000."));
      if (docs.some((d) => d.expiresAt && !isRealDate(d.expiresAt.slice(0, 10)))) throw new Error(t("Expiry dates must be real dates in YYYY-MM-DD format.", "يجب أن تكون تواريخ الانتهاء تواريخ حقيقية بصيغة YYYY-MM-DD."));
      const input = { type: f.type, plate: f.plate, make: f.make, model: f.model, year: year ? parseInt(year, 10) : null, maxWeightKg: kg, photoUri: photo, documents: docs, baseLat: p.lat, baseLng: p.lng, locationAddress: f.locationAddress.trim() || null };
      if (truck) await towAdminService.updateTruck(ACTOR, truck.id, input);
      else await towAdminService.addTruck(ACTOR, companyId!, input);
    });
  return (
    <>
      {!truck ? <Notice icon="time-outline">{t("A new truck starts as Pending. Approving it is a separate decision in its review.", "تبدأ الشاحنة الجديدة بحالة قيد المراجعة. اعتمادها قرار منفصل من صفحة مراجعتها.")}</Notice> : null}
      <Card>
        <View style={{ flexDirection: isArabic ? "row-reverse" : "row", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <ImageTile uri={photo} icon="camera-outline" size={72} />
          <View style={{ flex: 1 }}>
            <Button variant="ghost" icon="camera-outline" label={photo ? t("Change photo", "تغيير الصورة") : t("Add truck photo", "إضافة صورة الشاحنة")} onPress={async () => { const u = await pickImage(); if (u) setPhoto(u); }} />
          </View>
        </View>
        <Label>{t("TRUCK TYPE", "نوع الشاحنة")}</Label>
        <View style={{ flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {TRUCK_TYPES.map((k) => <Chip key={k} label={type[k]} on={f.type === k} onPress={() => setF({ ...f, type: k })} />)}
        </View>
        <Input label={t("Plate number", "رقم اللوحة")} value={f.plate} autoCapitalize="characters" onChangeText={(v) => setF({ ...f, plate: v })} />
        <Input label={t("Make", "الشركة المصنعة")} value={f.make} onChangeText={(v) => setF({ ...f, make: v })} />
        <Input label={t("Model", "الطراز")} value={f.model} onChangeText={(v) => setF({ ...f, model: v })} />
        <Input label={t("Year", "السنة")} value={year} keyboardType="number-pad" maxLength={4} onChangeText={setYear} />
        <Input label={t("Max load (kg, optional)", "الحمل الأقصى (كغ، اختياري)")} value={weight} keyboardType="number-pad" maxLength={5} onChangeText={setWeight} />
      </Card>
      <SectionHeader title={t("Truck operating location", "موقع تشغيل الشاحنة")} />
      <Card>
        <Input label={t("Latitude", "خط العرض")} value={lat} keyboardType="numbers-and-punctuation" onChangeText={setLat} />
        <Input label={t("Longitude", "خط الطول")} value={lng} keyboardType="numbers-and-punctuation" onChangeText={setLng} />
        <Input label={t("Location label", "وصف الموقع")} value={f.locationAddress} onChangeText={(v) => setF({ ...f, locationAddress: v })} />
      </Card>
      <SectionHeader title={t("Documents and expiry", "المستندات وتواريخ الانتهاء")} />
      {DOC_KINDS.map((k) => {
        const has = docs.some((d) => d.kind === k);
        const label = { REGISTRATION: t("Vehicle registration", "ترخيص المركبة"), INSURANCE: t("Insurance", "التأمين"), OPERATING_LICENSE: t("Operating licence", "رخصة التشغيل") }[k];
        const ex = expiry(k);
        return (
          <Card key={k}>
            <Label>{label.toUpperCase()}</Label>
            <Button variant="ghost" icon={has ? "checkmark-circle-outline" : "attach-outline"} label={has ? t("Replace file", "استبدال الملف") : t("Attach file", "إرفاق ملف")} onPress={() => attach(k)} />
            {has ? (
              <>
                <Input label={t("Expiry date (YYYY-MM-DD)", "تاريخ الانتهاء (YYYY-MM-DD)")} value={ex} placeholder="2027-12-31" onChangeText={(v) => setExpiry(k, v)} />
                {ex && isRealDate(ex) && new Date(ex).getTime() < Date.now() ? <Notice tone="danger" icon="alert-circle-outline">{t("This document has expired. Ask the company to renew it, or archive the truck.", "انتهت صلاحية هذا المستند. اطلب من الشركة تجديده، أو أرشف الشاحنة.")}</Notice> : null}
              </>
            ) : null}
          </Card>
        );
      })}
      <View style={{ height: 16 }} />
      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      <Button label={truck ? t("Save truck", "حفظ الشاحنة") : t("Add truck", "إضافة الشاحنة")} disabled={busy} onPress={save} />
    </>
  );
}

export function TruckEditor({ id, companyId }: { id: string; companyId?: string }) {
  const { t } = useL();
  const isNew = id === "new";
  const state = useLoad(async () => {
    if (isNew) return null;
    const all = await towAdminService.listTrucks(ACTOR);
    const found = all.find((x) => x.id === id);
    if (!found) throw new Error("Truck not found.");
    return found;
  }, [id]);
  return (
    <DeptPage back tabs={false}>
      <Text style={{ fontSize: 22, fontWeight: "700", color: useTheme().c.text, marginBottom: 12 }}>{isNew ? t("Add truck for the company", "إضافة شاحنة للشركة") : t("Edit truck", "تعديل الشاحنة")}</Text>
      <Notice icon="shield-checkmark-outline">{t("You are editing on behalf of the company. The change is recorded as a MOTEXA admin action.", "أنت تعدّل نيابةً عن الشركة. يُسجَّل التغيير كإجراء من مشرف MOTEXA.")}</Notice>
      {isNew ? companyId ? <TruckForm companyId={companyId} /> : <Notice tone="danger" icon="alert-circle-outline">{t("No company selected.", "لم يتم اختيار شركة.")}</Notice> : <Async state={state as any}>{(tr: Truck) => <TruckForm truck={tr} />}</Async>}
    </DeptPage>
  );
}
