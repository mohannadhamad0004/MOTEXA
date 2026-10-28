// Provider onboarding for tow companies and parts shops, in the look of the mechanic onboarding (Diala's mechanic UI kit).
//   DRAFT           -> vertical stepper: 1 Information, 2 Documents, 3 Review and submit (saved on the server after each step)
//   PENDING         -> status screen: timeline + messages, nothing editable
//   NEEDS_CHANGES   -> status screen with what the reviewer flagged + "Fix and resubmit" (opens the stepper again)
//   APPROVED        -> status screen with a way into the provider dashboard (the thread stays as "Contact MOTEXA")
//   REJECTED        -> status screen with the reason
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { ReactNode, useCallback, useRef, useState } from "react";
import { View } from "react-native";
import { MechanicField, MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { ProviderButton, ProviderCard, ProviderChoice, ProviderNote } from "./kit";
import { pickMechanicDocument } from "../../components/MechanicDocuments";
import { Text } from "../../components/MotexaVisual";
import { CATALOG_GROUPS } from "../../core/constants/categories";
import { CITIES, MAX_SERVICE_CITIES, cityCentre, cityLabel } from "../../core/constants/cities";
import { localFileToBase64, fileNameOf } from "../../core/constants/files";
import { pickImage } from "../../core/hooks/nav";
import { LocationRow } from "../department/LocationRow";
import { takePickedLocation } from "./LocationPicker";
import { TRUCK_TYPES, towFleetService } from "../tow/towService";
import type { TruckType } from "../tow/towService";
import { Application, Doc, Info, TruckRow, onboarding } from "./api";
import { actionLabel, appStatusLabel, bi, docLabel, docStatusLabel, fmtDay, fmtTime, keyLabel, truckTypeLabel } from "./labels";
import { VerticalStepper, useDocViewer } from "./ui";
import { DButton, Panel, Pill, StatusChip, cardStyle, useDT } from "../department/ui";

const ACTOR = { id: "", email: "", fullName: "" };
const err = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);
const iso = /^\d{4}-\d{2}-\d{2}$/;

/** A tinted note under a field the reviewer flagged. */
function Flag({ show }: { show: boolean }) {
  const d = useDT();
  if (!show) return null;
  const c = d.chip("amber");
  return (
    <View style={{ flexDirection: d.row, alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
      <Ionicons name="flag" size={14} color={c.fg} />
      <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, fontWeight: "600", color: c.fg, textAlign: d.align }}>{d.t("MOTEXA asked you to fix this", "طلبت MOTEXA تصحيح هذا")}</Text>
    </View>
  );
}

function Label({ children }: { children: ReactNode }) {
  const m = useMechanicTheme();
  return <Text style={{ fontSize: 12, lineHeight: 19, fontWeight: "600", color: m.ink, textAlign: m.align }}>{children}</Text>;
}

function Wrap({ children }: { children: ReactNode }) {
  const m = useMechanicTheme();
  return <View style={{ flexDirection: m.row, flexWrap: "wrap", gap: 8 }}>{children}</View>;
}

// ================================================================= step 1: information
function InfoStep({ app, onSaved, onNext }: { app: Application; onSaved: (a: Application) => void; onNext: () => void }) {
  const m = useMechanicTheme();
  const tow = app.kind === "TOW";
  const i = app.info;
  const flagged = new Set(app.flaggedFields);
  const [f, setF] = useState({
    name: i.name ?? "",
    nameAr: i.nameAr ?? "",
    ownerName: i.ownerName ?? "",
    phone: i.phone ?? "",
    city: i.city ?? "",
    address: i.address ?? "",
    workingHours: i.workingHours && i.workingHours !== "24/7" ? i.workingHours : "",
    brands: (i.brands ?? []).join(", "),
    count: i.truckCountClaimed ? String(i.truckCountClaimed) : "",
  });
  const [cities, setCities] = useState<string[]>(i.serviceCities ?? []);
  const [truckTypes, setTruckTypes] = useState<string[]>(i.truckTypes ?? []);
  const [cats, setCats] = useState<string[]>(i.categories ?? []);
  const [open24, setOpen24] = useState<boolean>(!!i.open24h);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(i.baseLat != null && i.baseLng != null ? { lat: i.baseLat, lng: i.baseLng } : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (v: string) => setF((cur) => ({ ...cur, [k]: v }));
  // coming back from the full-screen picker: it already saved the point on the draft, the form just shows it
  useFocusEffect(
    useCallback(() => {
      const p = takePickedLocation();
      if (p) setPin(p);
    }, []),
  );
  const openPicker = () =>
    router.push({ pathname: "/provider/onboarding/location", params: { ...(pin ? { lat: String(pin.lat), lng: String(pin.lng) } : {}), city: f.city } } as never);
  const toggle = (list: string[], v: string, max = 99) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body: Info = { name: f.name, nameAr: f.nameAr, ownerName: f.ownerName, phone: f.phone, city: f.city, address: f.address, baseLat: pin?.lat ?? null, baseLng: pin?.lng ?? null };
      if (tow) Object.assign(body, { serviceCities: cities, open24h: open24, truckTypes, truckCountClaimed: f.count ? Number(f.count) : null, ...(open24 ? {} : { workingHours: f.workingHours }) });
      else Object.assign(body, { categories: cats, brands: f.brands.split(",").map((x: string) => x.trim()).filter(Boolean), workingHours: f.workingHours });
      onSaved(await onboarding.saveInfo(body));
      onNext();
    } catch (e) {
      setError(err(e, m.t("Could not save.", "تعذّر الحفظ.")));
    } finally {
      setBusy(false);
    }
  }


  return (
    <ProviderCard>
      <View style={{ gap: 13 }}>
        {error ? <ProviderNote error>{error}</ProviderNote> : null}
        <MechanicField label={tow ? m.t("Company name", "اسم الشركة") : m.t("Shop name", "اسم المتجر")} icon="business-outline" value={f.name} onChangeText={set("name")} maxLength={120} />
        <MechanicField label={tow ? m.t("Company name in Arabic", "اسم الشركة بالعربية") : m.t("Shop name in Arabic", "اسم المتجر بالعربية")} icon="text-outline" value={f.nameAr} onChangeText={set("nameAr")} maxLength={120} />
        <MechanicField label={m.t("Owner name", "اسم المالك")} icon="person-outline" value={f.ownerName} onChangeText={set("ownerName")} maxLength={120} />
        <Flag show={flagged.has("ownerName")} />
        <MechanicField label={m.t("Phone", "الهاتف")} icon="call-outline" value={f.phone} onChangeText={set("phone")} keyboardType="phone-pad" maxLength={24} />
        <Flag show={flagged.has("phone")} />
        <Label>{m.t("City", "المدينة")}</Label>
        <Wrap>
          {CITIES.map((c) => (
            <ProviderChoice key={c.name} label={cityLabel(c.name, m.ar)} selected={f.city === c.name} onPress={() => set("city")(c.name)} />
          ))}
        </Wrap>
        <Flag show={flagged.has("city")} />
        <MechanicField label={m.t("Address", "العنوان")} icon="location-outline" value={f.address} onChangeText={set("address")} maxLength={200} />
        <Flag show={flagged.has("address")} />

        <Label>{m.t("Location on the map", "الموقع على الخريطة")}</Label>
        <LocationRow point={pin} city={f.city} address={f.address} buttonLabel={pin ? m.t("Change", "تغيير") : m.t("Pick location on map", "اختر الموقع على الخريطة")} flagged={flagged.has("location")} onPress={openPicker} />
        <Flag show={flagged.has("location")} />

        {tow ? (
          <>
            <Label>{m.t("Cities you cover", "المدن التي تغطيها")} ({cities.length}/{MAX_SERVICE_CITIES})</Label>
            <Wrap>
              {CITIES.map((c) => (
                <ProviderChoice key={c.name} label={cityLabel(c.name, m.ar)} selected={cities.includes(c.name)} onPress={() => setCities(toggle(cities, c.name, MAX_SERVICE_CITIES))} />
              ))}
            </Wrap>
            <Flag show={flagged.has("serviceCities")} />
            <Label>{m.t("Working hours", "ساعات العمل")}</Label>
            <ProviderChoice label={m.t("Open 24/7", "يعمل على مدار الساعة")} selected={open24} onPress={() => setOpen24(!open24)} icon={open24 ? "checkmark-circle" : "ellipse-outline"} />
            {!open24 ? <MechanicField label={m.t("Hours (for example Sat-Thu 08:00-18:00)", "الساعات (مثال: السبت-الخميس 08:00-18:00)")} icon="time-outline" value={f.workingHours} onChangeText={set("workingHours")} maxLength={100} /> : null}
            <Flag show={flagged.has("workingHours")} />
            <Label>{m.t("Truck types you operate", "أنواع الشاحنات لديك")}</Label>
            <Wrap>
              {TRUCK_TYPES.map((k) => (
                <ProviderChoice key={k} label={truckTypeLabel(m.t, k)} selected={truckTypes.includes(k)} onPress={() => setTruckTypes(toggle(truckTypes, k))} />
              ))}
            </Wrap>
            <Flag show={flagged.has("truckTypes")} />
            <MechanicField label={m.t("Number of trucks", "عدد الشاحنات")} icon="car-sport-outline" value={f.count} onChangeText={(v) => set("count")(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={3} />
            <TrucksEditor app={app} onChanged={onSaved} />
            <Flag show={flagged.has("truck")} />
          </>
        ) : (
          <>
            <Label>{m.t("What you sell", "ما تبيعه")}</Label>
            {CATALOG_GROUPS.map((g) => (
              <View key={g.key} style={{ gap: 8 }}>
                <Text style={{ fontSize: 11, color: m.muted, textAlign: m.align }}>{m.t(g.en, g.ar)}</Text>
                <Wrap>
                  {g.categories.map((c) => (
                    <ProviderChoice key={c.key} label={m.t(c.en, c.ar)} selected={cats.includes(c.key)} onPress={() => setCats(toggle(cats, c.key))} />
                  ))}
                </Wrap>
              </View>
            ))}
            <Flag show={flagged.has("categories")} />
            <MechanicField label={m.t("Main brands (separate with commas)", "العلامات التجارية الرئيسية (افصل بفواصل)")} icon="pricetags-outline" value={f.brands} onChangeText={set("brands")} maxLength={300} />
            <Flag show={flagged.has("brands")} />
            <MechanicField label={m.t("Opening hours (for example Sat-Thu 08:00-19:00)", "ساعات العمل (مثال: السبت-الخميس 08:00-19:00)")} icon="time-outline" value={f.workingHours} onChangeText={set("workingHours")} maxLength={100} />
            <Flag show={flagged.has("workingHours")} />
          </>
        )}
        <ProviderButton label={m.t("Save and continue", "حفظ ومتابعة")} onPress={save} busy={busy} disabled={busy} />
      </View>
    </ProviderCard>
  );
}

/** Trucks of the company (at least one is required): plate, type, make, model, year and the truck photo. */
function TrucksEditor({ app, onChanged }: { app: Application; onChanged: (a: Application) => void }) {
  const m = useMechanicTheme();
  const [adding, setAdding] = useState(false);
  const [plate, setPlate] = useState("");
  const [type, setType] = useState<TruckType>("FLATBED");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    if (busy) return;
    setError("");
    if (!plate.trim() || !make.trim() || !model.trim()) return setError(m.t("Plate, make and model are required.", "اللوحة والصنع والطراز مطلوبة."));
    if (!photo) return setError(m.t("Add a photo of the truck.", "أضف صورة للشاحنة."));
    setBusy(true);
    try {
      await towFleetService.addTruck(ACTOR, { type, plate, make, model, year: year ? Number(year) : null, maxWeightKg: null, photoUri: photo, documents: [] });
      setAdding(false);
      setPlate("");
      setMake("");
      setModel("");
      setYear("");
      setPhoto(null);
      onChanged(await onboarding.get());
    } catch (e) {
      setError(err(e, m.t("The truck could not be added.", "تعذّرت إضافة الشاحنة.")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      <Label>{m.t("Your trucks", "شاحناتك")} ({app.trucks.length})</Label>
      {app.trucks.map((t) => (
        <View key={t.id} style={{ flexDirection: m.row, alignItems: "center", gap: 10, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: m.border, backgroundColor: m.surface }}>
          <Ionicons name="car-sport-outline" size={22} color={m.muted} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: m.ink, fontSize: 14, fontWeight: "600", textAlign: m.align }}>{truckTypeLabel(m.t, t.type)} · {"⁦" + t.plate + "⁩"}</Text>
            <Text numberOfLines={1} style={{ color: m.muted, fontSize: 12, textAlign: m.align }}>{[t.make, t.model, t.year].filter(Boolean).join(" ")}</Text>
          </View>
        </View>
      ))}
      {adding ? (
        <View style={{ gap: 12, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: m.border }}>
          {error ? <ProviderNote error>{error}</ProviderNote> : null}
          <MechanicField label={m.t("Plate number", "رقم اللوحة")} icon="reader-outline" value={plate} onChangeText={setPlate} maxLength={20} autoCapitalize="characters" />
          <Wrap>
            {TRUCK_TYPES.map((k) => (
              <ProviderChoice key={k} label={truckTypeLabel(m.t, k)} selected={type === k} onPress={() => setType(k)} />
            ))}
          </Wrap>
          <MechanicField label={m.t("Make", "الصنع")} icon="car-outline" value={make} onChangeText={setMake} maxLength={60} />
          <MechanicField label={m.t("Model", "الطراز")} icon="car-outline" value={model} onChangeText={setModel} maxLength={60} />
          <MechanicField label={m.t("Year (optional)", "السنة (اختياري)")} icon="calendar-outline" value={year} onChangeText={(v) => setYear(v.replace(/[^0-9]/g, ""))} keyboardType="number-pad" maxLength={4} />
          <ProviderButton secondary label={photo ? m.t("Photo chosen · change", "تم اختيار صورة · تغيير") : m.t("Add a truck photo", "أضف صورة الشاحنة")} onPress={async () => setPhoto((await pickImage()) ?? photo)} />
          <ProviderButton label={m.t("Add this truck", "إضافة هذه الشاحنة")} onPress={add} busy={busy} disabled={busy} />
          <ProviderButton secondary label={m.t("Cancel", "إلغاء")} onPress={() => setAdding(false)} />
        </View>
      ) : (
        <ProviderButton secondary label={m.t("Add a truck", "إضافة شاحنة")} onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

// ================================================================= step 2: documents
/** One document: icon, translated kind, status chip, the file, the reviewer's reason when rejected, and Upload / Replace. */
function DocCard({ title, doc, flagged, busy, onPick, expiry, setExpiry }: { title: string; doc?: Doc; flagged: boolean; busy: boolean; onPick: () => void; expiry?: string; setExpiry?: (v: string) => void }) {
  const d = useDT();
  const rejected = doc?.status === "REJECTED";
  const tone = rejected ? "bad" : doc ? (doc.status === "ACCEPTED" ? "ok" : "amber") : "neutral";
  const c = d.chip(tone);
  return (
    <View style={{ ...cardStyle(d, rejected || (flagged && !doc) ? "bad" : undefined), padding: 14, gap: 10 }}>
      <View style={{ flexDirection: d.row, alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, borderWidth: 1, borderColor: c.border }}>
          <Ionicons name={doc ? "document-attach-outline" : "cloud-upload-outline"} size={22} color={c.fg} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ fontSize: 14, lineHeight: 21, fontWeight: "700", color: d.ink, textAlign: d.align }}>{title}</Text>
          <Text numberOfLines={1} style={{ fontSize: 11, lineHeight: 17, color: d.muted, textAlign: d.align }}>
            {doc ? `${doc.fileName}${doc.expiresAt ? ` · ${d.t("expires", "ينتهي")} ${fmtDay(doc.expiresAt)}` : ""}` : d.t("Not uploaded yet", "لم يُرفع بعد")}
          </Text>
        </View>
        {doc ? <StatusChip kind="doc" status={doc.status} /> : null}
      </View>
      {rejected && doc?.reason ? (
        <View style={{ flexDirection: d.row, gap: 8, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: d.chip("bad").border, backgroundColor: d.chip("bad").bg }}>
          <Ionicons name="alert-circle" size={18} color={d.chip("bad").fg} />
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 19, color: d.chip("bad").fg, fontWeight: "600", textAlign: d.align }}>{doc.reason}</Text>
        </View>
      ) : null}
      <Flag show={flagged && !rejected} />
      {setExpiry ? <MechanicField label={d.t("Expiry date (optional, YYYY-MM-DD)", "تاريخ الانتهاء (اختياري، YYYY-MM-DD)")} icon="calendar-outline" value={expiry ?? ""} onChangeText={setExpiry} maxLength={10} keyboardType="numbers-and-punctuation" /> : null}
      <DButton variant={doc && !rejected ? "ghost" : "primary"} icon="cloud-upload-outline" label={busy ? d.t("Uploading…", "جارٍ الرفع…") : doc ? d.t("Replace file", "استبدال الملف") : d.t("Upload photo or PDF", "رفع صورة أو PDF")} onPress={onPick} disabled={busy} />
    </View>
  );
}

function DocumentsStep({ app, onSaved, onNext }: { app: Application; onSaved: (a: Application) => void; onNext: () => void }) {
  const m = useMechanicTheme();
  const tow = app.kind === "TOW";
  const flagged = new Set(app.flaggedFields);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expiry, setExpiry] = useState<Record<string, string>>({});
  const kinds = tow ? app.requiredDocuments : ["STOREFRONT_PHOTO", ...app.requiredDocuments];
  const docOf = (k: string) => app.documents.find((d) => d.kind === k);

  async function run(key: string, work: () => Promise<void>) {
    if (busyKey) return;
    setBusyKey(key);
    setError("");
    try {
      await work();
      onSaved(await onboarding.get());
    } catch (e) {
      setError(err(e, m.t("The file could not be uploaded.", "تعذّر رفع الملف.")));
    } finally {
      setBusyKey(null);
    }
  }

  const checkExpiry = (v?: string) => {
    if (v && !iso.test(v)) throw new Error(m.t("Use the date format YYYY-MM-DD.", "استخدم صيغة التاريخ YYYY-MM-DD."));
    return v || null;
  };

  const pickCompany = (kind: string) =>
    run(kind, async () => {
      const expiresAt = checkExpiry(expiry[kind]);
      if (kind === "STOREFRONT_PHOTO") {
        const uri = await pickImage();
        if (!uri) return;
        await onboarding.upload({ kind, name: fileNameOf(uri, "storefront.jpg"), dataBase64: await localFileToBase64(uri), expiresAt });
        return;
      }
      const f = await pickMechanicDocument(kind);
      if (f) await onboarding.upload({ kind, name: f.fileName, dataBase64: f.base64, expiresAt });
    });

  const pickTruck = (t: TruckRow, kind: "REGISTRATION" | "INSURANCE" | "OPERATING_LICENSE" | "PHOTO") =>
    run(`${t.id}:${kind}`, async () => {
      const uri = await pickImage();
      if (!uri) return;
      const photo = t.documents.find((d) => d.purpose === "TRUCK_PHOTO");
      const exp = kind === "PHOTO" ? null : checkExpiry(expiry[`${t.id}:${kind}`]);
      await towFleetService.updateTruck(ACTOR, t.id, {
        type: t.type as TruckType,
        plate: t.plate,
        make: t.make,
        model: t.model,
        year: t.year,
        maxWeightKg: null,
        photoUri: kind === "PHOTO" ? uri : (photo?.uri ?? null),
        documents: kind === "PHOTO" ? [] : [{ kind, fileName: fileNameOf(uri, `${kind.toLowerCase()}.jpg`), uri, expiresAt: exp }],
      });
    });

  return (
    <View style={{ gap: 12 }}>
      {error ? <ProviderNote error>{error}</ProviderNote> : null}
      <Text style={{ fontSize: 12, lineHeight: 20, color: m.muted, textAlign: m.align }}>
        {m.t("JPEG, PNG or PDF, up to 5 MB. Documents are private: only you and the MOTEXA team can open them.", "JPEG أو PNG أو PDF حتى 5 ميغابايت. المستندات خاصة: لا يفتحها إلا أنت وفريق MOTEXA.")}
      </Text>
      {kinds.map((k) => (
        <DocCard key={k} title={docLabel(m.t, k)} doc={docOf(k)} flagged={flagged.has(`doc:${k}`)} busy={busyKey === k} onPick={() => pickCompany(k)} expiry={expiry[k]} setExpiry={k === "STOREFRONT_PHOTO" ? undefined : (v) => setExpiry((c) => ({ ...c, [k]: v }))} />
      ))}
      {tow
        ? app.trucks.map((t) => (
            <View key={t.id} style={{ gap: 10 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: m.ink, textAlign: m.align, marginTop: 6 }}>{truckTypeLabel(m.t, t.type)} · {"⁦" + t.plate + "⁩"}</Text>
              <DocCard title={docLabel(m.t, "TRUCK_PHOTO")} doc={t.documents.find((d) => d.purpose === "TRUCK_PHOTO")} flagged={flagged.has("doc:TRUCK_PHOTO")} busy={busyKey === `${t.id}:PHOTO`} onPick={() => pickTruck(t, "PHOTO")} />
              {/* trucks from the new signup carry an operating licence; older trucks keep their insurance document */}
              {(t.documents.some((x) => x.purpose === "TRUCK_OPERATING_LICENSE") ? (["REGISTRATION", "OPERATING_LICENSE"] as const) : (["REGISTRATION", "INSURANCE"] as const)).map((k) => (
                <DocCard
                  key={k}
                  title={docLabel(m.t, k)}
                  doc={t.documents.find((d) => d.purpose === `TRUCK_${k}`)}
                  flagged={flagged.has(`doc:TRUCK_${k}`)}
                  busy={busyKey === `${t.id}:${k}`}
                  onPick={() => pickTruck(t, k)}
                  expiry={expiry[`${t.id}:${k}`]}
                  setExpiry={(v) => setExpiry((c) => ({ ...c, [`${t.id}:${k}`]: v }))}
                />
              ))}
            </View>
          ))
        : null}
      {tow && app.trucks.length === 0 ? <ProviderNote>{m.t("Add at least one truck in step 1 to upload its documents.", "أضف شاحنة واحدة على الأقل في الخطوة 1 لرفع مستنداتها.")}</ProviderNote> : null}
      <ProviderButton label={m.t("Continue", "متابعة")} onPress={onNext} />
    </View>
  );
}

// ================================================================= step 3: review and submit
function ReviewStep({ app, onEdit, onSubmitted }: { app: Application; onEdit: (step: "info" | "documents") => void; onSubmitted: (a: Application) => void }) {
  const m = useMechanicTheme();
  const i = app.info;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const missing = app.missing ?? [];
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onSubmitted(await onboarding.submit());
    } catch (e) {
      setError(err(e, m.t("Could not submit.", "تعذّر الإرسال.")));
    } finally {
      setBusy(false);
    }
  }
  const row = (k: string, v?: string | null) => (v ? (
    <View key={k} style={{ flexDirection: m.row, justifyContent: "space-between", gap: 12, paddingVertical: 5 }}>
      <Text style={{ color: m.muted, fontSize: 12 }}>{k}</Text>
      <Text style={{ flex: 1, color: m.ink, fontSize: 13, textAlign: m.ar ? "left" : "right" }}>{v}</Text>
    </View>
  ) : null);
  return (
    <View style={{ gap: 12 }}>
      {error ? <ProviderNote error>{error}</ProviderNote> : null}
      <ProviderCard>
        <View style={{ gap: 2 }}>
          {row(m.t("Name", "الاسم"), i.name)}
          {row(m.t("Arabic name", "الاسم بالعربية"), i.nameAr)}
          {row(m.t("Owner", "المالك"), i.ownerName)}
          {row(m.t("Phone", "الهاتف"), i.phone)}
          {row(m.t("City", "المدينة"), i.city ? cityLabel(i.city, m.ar) : null)}
          {row(m.t("Address", "العنوان"), i.address)}
          {row(m.t("Map location", "الموقع على الخريطة"), i.baseLat != null ? m.t("Set", "محدد") : null)}
          {row(m.t("Working hours", "ساعات العمل"), i.open24h ? m.t("Open 24/7", "على مدار الساعة") : i.workingHours)}
          {app.kind === "TOW" ? row(m.t("Trucks", "الشاحنات"), String(app.trucks.length)) : row(m.t("Categories", "الفئات"), String((i.categories ?? []).length))}
        </View>
        <ProviderButton secondary label={m.t("Edit information", "تعديل البيانات")} onPress={() => onEdit("info")} />
      </ProviderCard>
      <ProviderCard>
        {[...app.requiredDocuments, ...(app.kind === "PARTS" ? ["STOREFRONT_PHOTO"] : [])].map((k) => {
          const d = app.documents.find((x) => x.kind === k);
          return (
            <View key={k} style={{ flexDirection: m.row, alignItems: "center", gap: 8, paddingVertical: 5 }}>
              <Ionicons name={d ? "checkmark-circle" : "alert-circle-outline"} size={18} color={d ? (m.dark ? "#AFCB99" : "#52733E") : m.dark ? "#E8C07E" : "#9A6A1F"} />
              <Text style={{ flex: 1, color: m.ink, fontSize: 13, textAlign: m.align }}>{docLabel(m.t, k)}</Text>
            </View>
          );
        })}
        <ProviderButton secondary label={m.t("Edit documents", "تعديل المستندات")} onPress={() => onEdit("documents")} />
      </ProviderCard>
      {missing.length ? (
        <ProviderNote error>
          {m.t("Still missing: ", "ما زال ناقصًا: ")}
          {missing.map((k) => keyLabel(m.t, k)).join(m.ar ? "، " : ", ")}
        </ProviderNote>
      ) : (
        <ProviderNote>{m.t("Everything is in place. MOTEXA will review your application.", "كل شيء جاهز. ستراجع MOTEXA طلبك.")}</ProviderNote>
      )}
      <ProviderButton label={app.status === "NEEDS_CHANGES" ? m.t("Resubmit for review", "أعد الإرسال للمراجعة") : m.t("Submit for review", "أرسل للمراجعة")} onPress={submit} busy={busy} disabled={busy || missing.length > 0} />
    </View>
  );
}

// ================================================================= status screen
function Timeline({ app }: { app: Application }) {
  const m = useMechanicTheme();
  return (
    <View style={{ gap: 0 }}>
      {[...app.timeline].reverse().map((e, i, all) => (
        <View key={i} style={{ flexDirection: m.row, gap: 12 }}>
          <View style={{ alignItems: "center", width: 14 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 6, backgroundColor: e.action === "REJECTED" || e.action === "DOC_REJECTED" ? "#A24930" : e.action === "APPROVED" ? "#52733E" : "#B38A5C" }} />
            {i < all.length - 1 ? <View style={{ flex: 1, width: 1, backgroundColor: m.border }} /> : null}
          </View>
          <View style={{ flex: 1, paddingBottom: 12 }}>
            <Text style={{ color: m.ink, fontSize: 13, fontWeight: "600", textAlign: m.align }}>{actionLabel(m.t, e.action)}</Text>
            <Text style={{ color: m.muted, fontSize: 11, textAlign: m.align }}>{fmtTime(e.at)}</Text>
            {e.details?.message ? <Text style={{ color: m.muted, fontSize: 12, lineHeight: 19, textAlign: m.align }}>{String(e.details.message)}</Text> : null}
            {e.details?.reason ? <Text style={{ color: m.muted, fontSize: 12, lineHeight: 19, textAlign: m.align }}>{String(e.details.reason)}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function StatusView({ app, onFix }: { app: Application; onFix: () => void }) {
  const m = useMechanicTheme();
  const d = useDT();
  const viewer = useDocViewer();
  const companyFlagged = app.documents.filter((x) => x.status === "REJECTED");
  // a truck's problem is shown under that truck's plate, never as a problem of the whole company
  const truckFlagged = app.trucks.map((t) => ({ t, docs: t.documents.filter((x) => x.status === "REJECTED") })).filter((x) => x.docs.length);
  // the admin's own words: the latest "changes requested" message from the history, shown as written
  const adminMessage = [...app.timeline].reverse().find((e) => e.action === "CHANGES_REQUESTED")?.details?.message as string | undefined;
  const tone = { PENDING: "bronze", NEEDS_CHANGES: "amber", APPROVED: "ok", REJECTED: "bad", DRAFT: "neutral" }[app.status] as "bronze" | "amber" | "ok" | "bad" | "neutral";
  const c = d.chip(tone);
  const headline =
    app.status === "PENDING"
      ? m.t("Application under review", "الطلب قيد المراجعة")
      : app.status === "NEEDS_CHANGES"
        ? m.t("Changes requested", "مطلوب تعديلات")
        : app.status === "APPROVED"
          ? m.t("Application approved", "تمت الموافقة على الطلب")
          : app.status === "REJECTED"
            ? m.t("Application rejected", "تم رفض الطلب")
            : "";
  const flagged = app.flaggedFields.filter((k) => !k.startsWith("doc:"));
  const home = app.kind === "TOW" ? "/provider/tow" : "/provider/parts";
  const next =
    app.status === "PENDING"
      ? m.t("MOTEXA is reviewing your application. Until it is approved you cannot use the provider features that need approval. You will see the result here and get a notification.", "تراجع MOTEXA طلبك. إلى أن تتم الموافقة لا يمكنك استخدام ميزات المزوّد التي تتطلب الاعتماد. ستظهر النتيجة هنا وسيصلك إشعار.")
      : app.status === "NEEDS_CHANGES"
        ? m.t("MOTEXA asked for changes. Fix the items below and resubmit: you keep your application and do not need a new account.", "طلبت MOTEXA تعديلات. صحّح العناصر أدناه ثم أعد الإرسال: يبقى طلبك كما هو ولا تحتاج إلى حساب جديد.")
        : app.status === "APPROVED"
          ? m.t("You are approved. Customers can find you and you can receive requests now.", "تمت الموافقة عليك. يمكن للعملاء إيجادك ويمكنك استقبال الطلبات الآن.")
          : m.t("This application was rejected and cannot be resubmitted in the app. You can contact MOTEXA if you think this is a mistake.", "تم رفض هذا الطلب ولا يمكن إعادة إرساله من التطبيق. يمكنك التواصل مع MOTEXA إن رأيت أن ذلك خطأ.");
  return (
    <View style={{ gap: 12 }}>
      {viewer.element}
      <Panel>
        <View style={{ alignItems: "center", gap: 10, paddingVertical: 6 }}>
          <StatusChip status={app.status} size="l" />
          {headline ? <Text accessibilityRole="header" style={{ fontSize: 19, lineHeight: 28, fontWeight: "800", color: c.fg, textAlign: "center" }}>{headline}</Text> : null}
          <Text style={{ fontSize: 15, lineHeight: 22, fontWeight: "700", color: d.ink, textAlign: "center" }}>{app.info.name}</Text>
          <Text style={{ fontSize: 14, lineHeight: 23, color: d.muted, textAlign: "center" }}>{next}</Text>
        </View>
        {app.status === "REJECTED" ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: d.ink, textAlign: d.align }}>{m.t("Reason from MOTEXA", "السبب من MOTEXA")}</Text>
            <ProviderNote error>{app.rejectionReason || m.t("No reason was given. Contact MOTEXA.", "لم يُذكر سبب. تواصل مع MOTEXA.")}</ProviderNote>
          </View>
        ) : null}
        {app.status === "NEEDS_CHANGES" ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            {adminMessage ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: "700", color: d.ink, textAlign: d.align }}>{m.t("Message from MOTEXA", "رسالة من MOTEXA")}</Text>
                <ProviderNote>{adminMessage}</ProviderNote>
              </>
            ) : null}
            <Text style={{ fontSize: 13, fontWeight: "700", color: d.ink, textAlign: d.align }}>{m.t("To fix", "المطلوب تصحيحه")}</Text>
            {flagged.map((k) => (
              <Flagged key={k} text={keyLabel(m.t, k)} />
            ))}
            {companyFlagged.map((x) => (
              <Flagged key={x.id} text={docLabel(m.t, x.kind)} reason={x.reason} />
            ))}
            {truckFlagged.map(({ t, docs }) => (
              <View key={t.id} style={{ gap: 6 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: d.muted, textAlign: d.align }}>{m.t("Truck", "الشاحنة")} {"⁦" + t.plate + "⁩"}</Text>
                {docs.map((x) => (
                  <Flagged key={x.id} text={docLabel(m.t, x.kind)} reason={x.reason} />
                ))}
              </View>
            ))}
          </View>
        ) : null}
        <View style={{ gap: 10, marginTop: 14 }}>
          {app.status === "NEEDS_CHANGES" ? <DButton label={m.t("Update application", "تحديث الطلب")} icon="create-outline" onPress={onFix} /> : null}
          {app.status === "APPROVED" ? <DButton variant="success" icon="speedometer-outline" label={m.t("Open my dashboard", "افتح لوحتي")} onPress={() => router.replace(home as never)} /> : null}
          <DButton
            variant="ghost"
            icon="chatbubbles-outline"
            label={`${app.status === "APPROVED" ? m.t("Contact MOTEXA", "تواصل مع MOTEXA") : m.t("Messages", "الرسائل")}${app.unreadMessages ? ` (${app.unreadMessages})` : ""}`}
            onPress={() => router.push("/provider/onboarding/messages" as never)}
          />
        </View>
      </Panel>
      <Panel title={m.t("What happened", "ما الذي حدث")} icon="time-outline">
        <Timeline app={app} />
      </Panel>
    </View>
  );
}

function Flagged({ text, reason }: { text: string; reason?: string | null }) {
  const d = useDT();
  const c = d.chip("amber");
  return (
    <View style={{ flexDirection: d.row, alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg }}>
      <Ionicons name="flag" size={16} color={c.fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 13, lineHeight: 20, fontWeight: "700", color: c.fg, textAlign: d.align }}>{text}</Text>
        {reason ? <Text style={{ fontSize: 12, lineHeight: 19, color: c.fg, textAlign: d.align }}>{reason}</Text> : null}
      </View>
    </View>
  );
}

// ================================================================= the screen
export default function Onboarding() {
  const m = useMechanicTheme();
  const [app, setApp] = useState<Application | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<"info" | "documents" | "review">("info");
  const editingRef = useRef(false);
  editingRef.current = editing;

  const load = useCallback(async () => {
    try {
      const a = await onboarding.get();
      // never overwrite what the owner is typing: refresh only while the status screen is shown
      setApp((cur) => (editingRef.current && cur ? cur : a));
      setError("");
    } catch (e) {
      setError(err(e, m.t("Could not load your application.", "تعذّر تحميل طلبك.")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 15000); // status and unread badge, every 15 s while open
      return () => clearInterval(timer);
    }, [load]),
  );

  if (!app)
    return (
      <MechanicPage title={m.t("Your application", "طلبك")}>
        {error ? <ProviderNote error>{error}</ProviderNote> : <Text style={{ color: m.muted, textAlign: "center" }}>{m.t("Loading…", "جارٍ التحميل…")}</Text>}
      </MechanicPage>
    );

  const tow = app.kind === "TOW";
  const title = tow ? m.t("Tow company application", "طلب شركة سحب") : m.t("Parts shop application", "طلب متجر قطع غيار");
  const canEdit = app.status === "DRAFT" || (app.status === "NEEDS_CHANGES" && editing);
  const missing = new Set((app.missing ?? []).map((k) => (k.startsWith("doc:") ? "documents" : "info")));

  if (!canEdit)
    return (
      <MechanicPage title={title} subtitle={m.t("Follow your application here.", "تابع طلبك هنا.")}>
        <StatusView
          app={app}
          onFix={() => {
            setStep("info");
            setEditing(true);
          }}
        />
      </MechanicPage>
    );

  return (
    <MechanicPage title={title} subtitle={m.t("Your progress is saved on the server after each step. You can come back any time.", "يُحفظ تقدمك على الخادم بعد كل خطوة. يمكنك العودة في أي وقت.")}>
      {app.status === "NEEDS_CHANGES" ? <ProviderNote>{m.t("Items flagged by MOTEXA are marked in red.", "العناصر التي حددتها MOTEXA مُعلَّمة بالأحمر.")}</ProviderNote> : null}
      <View style={{ height: 12 }} />
      <VerticalStepper
        current={step}
        onSelect={(k) => setStep(k as typeof step)}
        steps={[
          { key: "info", label: m.t("Information", "المعلومات"), hint: m.t("Who you are, where you work and what you offer", "من أنت وأين تعمل وماذا تقدم"), done: !missing.has("info") },
          { key: "documents", label: m.t("Documents", "المستندات"), hint: m.t("Upload each document. Only you and MOTEXA can see them", "ارفع كل مستند. لا يراها إلا أنت وMOTEXA"), done: !missing.has("documents") },
          { key: "review", label: m.t("Review and submit", "المراجعة والإرسال"), hint: m.t("Check everything, then send it to MOTEXA", "راجع كل شيء ثم أرسله إلى MOTEXA"), done: false },
        ]}
      >
        {(k) =>
          k === "info" ? (
            <InfoStep app={app} onSaved={setApp} onNext={() => setStep("documents")} />
          ) : k === "documents" ? (
            <DocumentsStep app={app} onSaved={setApp} onNext={() => setStep("review")} />
          ) : (
            <ReviewStep
              app={app}
              onEdit={setStep}
              onSubmitted={(a) => {
                setApp(a);
                setEditing(false);
              }}
            />
          )
        }
      </VerticalStepper>
    </MechanicPage>
  );
}
