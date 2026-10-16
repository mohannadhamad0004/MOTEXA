import { useState } from "react";
import { Text, View } from "react-native";
import { Chip, ChipRow } from "../../../features/catalog/catalogBits";
import { KV, VerificationBadge } from "../../../features/shared/blocks";
import { CITIES, MAX_SERVICE_CITIES, cityLabel } from "../../../features/shared/cities";
import { C } from "../../../features/shared/palette";
import { asActor, useSessionUser } from "../../../features/shared/session";
import { Async, Button, Card, Field, Header, Notice, Screen, Section, useL, useLoad } from "../../../features/shared/ui";
import { TowCompany, towFleetService } from "../../../features/tow/towService";

const DESCRIPTION_MAX = 600;

/** The public profile customers see. These are not verification fields: saving never changes the approval status. */
function ProfileForm({ company }: { company: TowCompany }) {
  const user = useSessionUser();
  const { t, isArabic, align } = useL();
  const [description, setDescription] = useState(company.description ?? "");
  const [address, setAddress] = useState(company.address ?? "");
  const [hours, setHours] = useState(company.workingHours ?? "");
  const [cities, setCities] = useState<string[]>(company.serviceCities);
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
      await towFleetService.updateMyCompany(asActor(user), { description, address, workingHours: hours, serviceCities: cities });
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
        <Text style={[{ color: C.textDim, fontSize: 11, marginTop: 10 }, align]}>
          {t("The name and licence can't be changed here. Editing the profile below doesn't affect your approval.", "لا يمكن تغيير الاسم والترخيص من هنا. تعديل الملف أدناه لا يؤثر على اعتمادك.")}
        </Text>
      </Card>

      {rejected ? (
        <Notice tone="danger" icon="close-circle-outline">{t("Your company application was rejected. You cannot edit the profile.", "تم رفض طلب شركتك. لا يمكنك تعديل الملف.")}</Notice>
      ) : null}

      <Section title={t("About", "نبذة")} />
      <Card>
        <Field label={t("Description", "الوصف")} value={description} multiline maxLength={DESCRIPTION_MAX} editable={!rejected} onChangeText={edit(setDescription)} />
        <Text style={{ color: C.textDim, fontSize: 11, marginTop: -6, marginBottom: 8, textAlign: isArabic ? "right" : "left" }}>
          {description.length}/{DESCRIPTION_MAX}
        </Text>
        <Field label={t("Address", "العنوان")} value={address} maxLength={200} editable={!rejected} onChangeText={edit(setAddress)} />
        <Field
          label={t("Working hours", "ساعات العمل")}
          value={hours}
          maxLength={100}
          placeholder={t("e.g. Sat–Thu 08:00–20:00, or 24/7", "مثال: السبت–الخميس 08:00–20:00، أو 24/7")}
          editable={!rejected}
          onChangeText={edit(setHours)}
        />
      </Card>

      <Section title={`${t("Service area", "منطقة الخدمة")} (${cities.length}/${MAX_SERVICE_CITIES})`} />
      <Text style={[{ color: C.textMuted, fontSize: 12, marginBottom: 10 }, align]}>
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
    <Screen>
      <Header brand="MOTEXA TOW" title={t("Company profile", "ملف الشركة")} back />
      <Async state={state}>{({ company }) => <ProfileForm company={company} />}</Async>
    </Screen>
  );
}
