import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { DashboardLayout } from "../../../components/layout/DashboardLayout";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { useState } from "react";
import { View } from "react-native";
import { Chip, ChipRow } from "../../../features/catalog/catalogBits";
import { KV, VerificationBadge } from "../../../features/shared/blocks";
import { CITIES, MAX_SERVICE_CITIES, cityCentre, cityLabel } from "../../../core/constants/cities";
import { Point } from "../../../core/constants/geo";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { TowCompany, towFleetService } from "../../../features/tow/towService";

const DESCRIPTION_MAX = 600;

/** The public profile customers see. These are not verification fields: saving never changes the approval status. */
function ProfileForm({ company }: { company: TowCompany }) {
  const { c: col } = useTheme();
  const user = useSessionUser();
  const { t, isArabic, align } = useL();
  const [description, setDescription] = useState(company.description ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [hours, setHours] = useState(company.workingHours ?? "");
  const [cities, setCities] = useState<string[]>(company.serviceCities);
  // The business location customers see on the map (rounded to about 100 m for them). Read from the phone only when you tap.
  const [base, setBase] = useState<Point | null>(company.baseLat !== null && company.baseLng !== null ? { lat: company.baseLat, lng: company.baseLng } : null);
  const loc = useCurrentLocation();
  const moveBase = (p: Point | null) => {
    setBase(p);
    setSaved(false);
  };
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const rejected = company.verification === "REJECTED";

  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setSaved(false);
  };
  const toggle = (name: string) => {
    setSaved(false);
    setCities((cur) => (cur.includes(name) ? cur.filter((c) => c !== name) : cur.length >= MAX_SERVICE_CITIES ? cur : [...cur, name]));
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await towFleetService.updateMyCompany(asActor(user), { description, address, workingHours: hours, serviceCities: cities, baseLat: base?.lat ?? null, baseLng: base?.lng ?? null });
      setSaved(true);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card>
        <KV k={t("Company", "الشركة")} v={company.name} />
        <KV k={t("Based in", "المقر")} v={company.city} />
        <View style={{ marginTop: 8, alignItems: "flex-start" }}>
          <VerificationBadge value={company.verification} prefix={t("Approval", "الاعتماد")} />
        </View>
        <Text style={[{ color: col.textDim, fontSize: 11, marginTop: 10 }, align]}>
          {t("The name and licence can't be changed here. Editing the profile below doesn't affect your approval.", "لا يمكن تغيير الاسم والترخيص من هنا. تعديل الملف أدناه لا يؤثر على اعتمادك.")}
        </Text>
      </Card>

      {rejected ? (
        <Notice tone="danger" icon="close-circle-outline">{t("Your company application was rejected. You cannot edit the profile.", "تم رفض طلب شركتك. لا يمكنك تعديل الملف.")}</Notice>
      ) : null}

      <SectionHeader title={t("About", "نبذة")} />
      <Card>
        <Input label={t("Description", "الوصف")} value={description} multiline maxLength={DESCRIPTION_MAX} editable={!rejected} onChangeText={edit(setDescription)} />
        <Text style={{ color: col.textDim, fontSize: 11, marginTop: -6, marginBottom: 8, textAlign: isArabic ? "right" : "left" }}>
          {description.length}/{DESCRIPTION_MAX}
        </Text>
        <Input label={t("Address", "العنوان")} value={address} maxLength={200} editable={!rejected} onChangeText={edit(setAddress)} />
        <Input
          label={t("Working hours", "ساعات العمل")}
          value={hours}
          maxLength={100}
          placeholder={t("e.g. Sat–Thu 08:00–20:00, or 24/7", "مثال: السبت–الخميس 08:00–20:00، أو 24/7")}
          editable={!rejected}
          onChangeText={edit(setHours)}
        />
      </Card>

      <SectionHeader title={t("Base location", "موقع القاعدة")} />
      <Card>
        {loc.dialog}
        <Text style={[{ color: col.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 10 }, align]}>
          {base
            ? t("Customers see this point on the map, rounded to about 100 m, and use it to sort companies by distance.", "يرى العملاء هذه النقطة على الخريطة بدقة تقريبية نحو 100 م، ويستخدمونها لترتيب الشركات حسب المسافة.")
            : t(`No base location yet. Customers will see ${company.city} city centre instead.`, `لا يوجد موقع قاعدة بعد. سيرى العملاء مركز مدينة ${company.city} بدلًا منه.`)}
        </Text>
        {MAPS_AVAILABLE && base ? <PinMap point={base} onChange={rejected ? undefined : moveBase} height={190} /> : null}
        <LocationProblem loc={loc} />
        {!rejected ? (
          <View style={{ gap: 8 }}>
            <Button
              variant="ghost"
              icon="locate-outline"
              label={loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my current location", "استخدم موقعي الحالي")}
              disabled={loc.locating}
              onPress={async () => {
                const p = await loc.locate();
                if (p) moveBase(p);
              }}
            />
            {MAPS_AVAILABLE && !base ? <Button variant="ghost" icon="map-outline" label={t("Choose on the map", "اختر على الخريطة")} onPress={() => moveBase(cityCentre(company.city) ?? { lat: 32.2211, lng: 35.2544 })} /> : null}
            {base ? <Button variant="ghost" icon="trash-outline" label={t("Clear base location", "مسح موقع القاعدة")} onPress={() => moveBase(null)} /> : null}
            {base ? <Text style={{ color: col.textDim, fontSize: 11 }}>{t("Tap the map or drag the pin to adjust, then press Save profile.", "اضغط على الخريطة أو اسحب الدبوس للتعديل، ثم اضغط حفظ الملف.")}</Text> : null}
          </View>
        ) : null}
      </Card>

      <SectionHeader title={`${t("Service area", "منطقة الخدمة")} (${cities.length}/${MAX_SERVICE_CITIES})`} />
      <Text style={[{ color: col.textMuted, fontSize: 12, marginBottom: 10 }, align]}>
        {t(`Cities you serve besides ${company.city}.`, `المدن التي تخدمها إضافة إلى ${company.city}.`)}
      </Text>
      <ChipRow>
        {CITIES.map((c) => (
          <Chip key={c.name} label={cityLabel(c.name, isArabic)} on={cities.includes(c.name)} onPress={() => !rejected && toggle(c.name)} />
        ))}
      </ChipRow>

      {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
      {saved ? <Notice tone="accent" icon="checkmark-circle-outline">{t("Saved.", "تم الحفظ.")}</Notice> : null}
      <Button icon="save-outline" label={t("Save profile", "حفظ الملف")} disabled={busy || rejected} onPress={save} />
    </>
  );
}

export default function CompanyProfile() {
  const user = useSessionUser();
  const { t } = useL();
  const state = useLoad(() => towFleetService.getMyFleet(asActor(user)), [user.id]);
  return (
    <DashboardLayout tag="COMPANY / T4" brand="MOTEXA TOW" title={t("Company profile", "ملف الشركة")} back>
      <Async state={state}>{({ company }) => <ProfileForm company={company} />}</Async>
    </DashboardLayout>
  );
}
