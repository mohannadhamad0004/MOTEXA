// The tow company's public profile = Form: about, base location (map), service cities; Save in the footer. These are not verification
// fields: saving never changes the approval status. A rejected company cannot save.
import { useState } from "react";
import { View } from "react-native";
import { Chip, Field, GButton, GText, Note, StatusChip } from "../../../components/garage";
import { useDiscardGuard } from "../../../components/manage/Form";
import { appStatus } from "../../../components/manage/ManagePage";
import { Block, Facts, Loaded, Page } from "../../../components/manage/Page";
import { CITIES, MAX_SERVICE_CITIES, cityCentre, cityLabel } from "../../../core/constants/cities";
import { Point } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { gType, useGarageTheme } from "../../../theme/garage";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { TowCompany, towFleetService } from "../../../features/tow/towService";

const DESCRIPTION_MAX = 600;

function ProfileForm({ company, onSaved }: { company: TowCompany; onSaved: () => void }) {
  const user = useSessionUser();
  const { t, isArabic } = useL();
  const { row, align } = useGarageTheme();
  const init = { description: company.description ?? "", address: company.address ?? "", hours: company.workingHours ?? "", cities: company.serviceCities,
    base: company.baseLat !== null && company.baseLng !== null ? ({ lat: company.baseLat, lng: company.baseLng } as Point) : null };
  const [f, setF] = useState(init), [saved, setSaved] = useState(init);
  // the business location customers see on the map (rounded to about 100 m for them); read from the phone only when you tap
  const loc = useCurrentLocation("signup");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const rejected = company.verification === "REJECTED";
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const guard = useDiscardGuard(dirty && !busy && !rejected);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((s) => ({ ...s, [k]: v })); setMsg(null); };
  const toggle = (name: string) => set("cities", f.cities.includes(name) ? f.cities.filter((c) => c !== name) : f.cities.length >= MAX_SERVICE_CITIES ? f.cities : [...f.cities, name]);
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await towFleetService.updateMyCompany(asActor(user), { description: f.description, address: f.address, workingHours: f.hours, serviceCities: f.cities, baseLat: f.base?.lat ?? null, baseLng: f.base?.lng ?? null });
      setSaved(f); setMsg({ ok: true, text: t("Saved.", "تم الحفظ.") }); onSaved();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); } finally { setBusy(false); }
  };
  return (
    <Page title={t("Business info", "معلومات النشاط")} line={company.name}
      footer={<GButton icon="checkmark" label={t("Save profile", "حفظ الملف")} busy={busy} disabled={busy || rejected || !dirty} onPress={() => void save()} />}>
      <Block title={t("Company", "الشركة")}>
        <Facts rows={[[t("Company", "الشركة"), company.name], [t("Based in", "المقر"), cityLabel(company.city, isArabic)], [t("Approval", "الاعتماد"), <StatusChip key="s" {...appStatus(company.verification, t)} />]]} />
      </Block>
      <Note icon="shield-checkmark-outline">{t("The name and licence can't be changed here. Editing the profile below doesn't affect your approval.", "لا يمكن تغيير الاسم والترخيص من هنا. تعديل الملف أدناه لا يؤثر على اعتمادك.")}</Note>
      {rejected ? <Note tone="danger" icon="close-circle-outline">{t("Your company application was rejected. You cannot edit the profile.", "تم رفض طلب شركتك. لا يمكنك تعديل الملف.")}</Note> : null}
      <Block title={t("About", "نبذة")}>
        <View style={{ gap: 12, paddingVertical: 10 }}>
          <Field label={`${t("Description", "الوصف")} (${f.description.length}/${DESCRIPTION_MAX})`} value={f.description} multiline maxLength={DESCRIPTION_MAX} onChangeText={(v) => set("description", v)} />
          <Field label={t("Address", "العنوان")} value={f.address} maxLength={200} onChangeText={(v) => set("address", v)} />
          <Field label={t("Working hours", "ساعات العمل")} value={f.hours} maxLength={100} placeholder={t("e.g. Sat–Thu 08:00–20:00, or 24/7", "مثال: السبت–الخميس 08:00–20:00، أو 24/7")} onChangeText={(v) => set("hours", v)} />
        </View>
      </Block>
      <Block title={t("Base location", "موقع القاعدة")}>
        <View style={{ gap: 10, paddingVertical: 10 }}>
          {loc.dialog}
          <GText soft style={[gType.caption, align]}>{f.base
            ? t("Customers see this point on the map, rounded to about 100 m, and use it to sort companies by distance. Tap the map or drag the pin to adjust.", "يرى العملاء هذه النقطة على الخريطة بدقة تقريبية نحو 100 م، ويستخدمونها لترتيب الشركات حسب المسافة. اضغط على الخريطة أو اسحب الدبوس للتعديل.")
            : t(`No base location yet. Customers will see ${company.city} city centre instead.`, `لا يوجد موقع قاعدة بعد. سيرى العملاء مركز مدينة ${company.city} بدلًا منه.`)}</GText>
          {MAPS_AVAILABLE && f.base ? <PinMap point={f.base} onChange={rejected ? undefined : (p) => set("base", p)} height={190} /> : null}
          <LocationProblem loc={loc} />
          {!rejected ? (
            <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
              <GButton variant="secondary" icon="locate-outline" label={loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my current location", "استخدم موقعي الحالي")} disabled={loc.locating}
                onPress={async () => { const p = await loc.locate(); if (p) set("base", p); }} />
              {MAPS_AVAILABLE && !f.base ? <GButton variant="ghost" icon="map-outline" label={t("Choose on the map", "اختر على الخريطة")} onPress={() => set("base", cityCentre(company.city) ?? { lat: 32.2211, lng: 35.2544 })} /> : null}
              {f.base ? <GButton variant="ghost" icon="trash-outline" label={t("Clear base location", "مسح موقع القاعدة")} onPress={() => set("base", null)} /> : null}
            </View>
          ) : null}
        </View>
      </Block>
      <Block title={`${t("Service area", "منطقة الخدمة")} (${f.cities.length}/${MAX_SERVICE_CITIES})`}>
        <View style={{ gap: 8, paddingVertical: 10 }}>
          <GText soft style={[gType.caption, align]}>{t(`Cities you serve besides ${company.city}.`, `المدن التي تخدمها إضافة إلى ${company.city}.`)}</GText>
          <View style={[row, { flexWrap: "wrap", gap: 8 }]}>{CITIES.map((c) => <Chip key={c.name} label={cityLabel(c.name, isArabic)} on={f.cities.includes(c.name)} onPress={() => !rejected && toggle(c.name)} />)}</View>
        </View>
      </Block>
      {msg ? <Note tone={msg.ok ? "success" : "danger"} icon={msg.ok ? "checkmark-circle-outline" : "alert-circle-outline"}>{msg.text}</Note> : null}
      {guard.sheet}
    </Page>
  );
}

export default function CompanyProfile() {
  const user = useSessionUser();
  const { t } = useL();
  const state = useLoad(() => towFleetService.getMyFleet(asActor(user)), [user.id]);
  if (!state.data) return <Page title={t("Business info", "معلومات النشاط")}><Loaded state={state}>{() => null}</Loaded></Page>;
  return <ProfileForm key={state.data.company.id} company={state.data.company} onSaved={() => void state.reload()} />;
}
