import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Card, Chip, ErrorState, Field, GarageHero, GaragePage, GButton, GIcon, GText, Note, SkeletonBlock, StepperHeader, StickyActionBar } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { useMechanicRequestForm } from "../../../features/mechanics/MechanicRequestForm";
import { mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { LocationProblem } from "../../../features/shared/useCurrentLocation";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

// A service request to one verified mechanic, as three steps (car + skill, problem, where / when / contact). The rules and the
// final validation are the shared form hook; nothing here is a price or a promise of a time.
export default function NewMechanicRequest() {
  const { mechanicId } = useLocalSearchParams<{ mechanicId: string }>();
  const { t, isArabic } = useL();
  const { g, align } = useGarageTheme();
  const skillLabel = useSkillLabel();
  const state = useLoad(() => mechanicCatalog.get(mechanicId), [mechanicId]);
  const form = useMechanicRequestForm({ id: mechanicId, city: state.data?.city ?? "" });
  const [step, setStep] = useState(0);
  const [stepErr, setStepErr] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const steps = [t("Car", "السيارة"), t("Problem", "المشكلة"), t("Place & time", "المكان والوقت")];

  const next = () => {
    setStepErr(null);
    if (step === 0 && (!form.make.trim() || !form.model.trim())) return setStepErr(t("Enter the car make and model.", "أدخل ماركة السيارة وطرازها."));
    if (step === 1 && form.problem.trim().length < 10) return setStepErr(t("Describe the problem in at least 10 characters.", "صف المشكلة في 10 أحرف على الأقل."));
    setStep(step + 1);
  };
  const send = async () => {
    setStepErr(null);
    const r = await form.submit();
    if (r) setSentId(r.id);
  };
  const back = () => (step > 0 && !sentId ? setStep(step - 1) : router.canGoBack() ? router.back() : router.navigate("/customer/mechanics"));
  const m = state.data;

  return (
    <GaragePage
      hero={<GarageHero variant="detail" onBack={back} title={t("Request service", "طلب خدمة")} line={m ? `${m.name} · ${cityLabel(m.city, isArabic)}` : undefined} />}
      bottom={
        m && !sentId ? (
          <StickyActionBar>
            {step > 0 ? <GButton variant="secondary" label={t("Back", "رجوع")} onPress={back} /> : null}
            {step < 2 ? <GButton flex icon="arrow-forward" label={t("Next", "التالي")} onPress={next} /> : <GButton flex icon="send" label={t("Send request", "إرسال الطلب")} busy={form.busy} onPress={send} />}
          </StickyActionBar>
        ) : undefined
      }
    >
      {state.error && !m ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !m ? (
        <SkeletonBlock height={200} radius={gShape.card} />
      ) : sentId ? (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 28 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
            <GIcon name="checkmark-circle" size={36} color={g.success} />
          </View>
          <GText style={[gType.title, { textAlign: "center" }]}>{t("Request sent", "تم إرسال الطلب")}</GText>
          <GText soft style={[gType.bodySm, { textAlign: "center" }]}>{t(`${m.name} will accept or decline it. You can follow its status here.`, `سيقبل ${m.name} الطلب أو يرفضه. يمكنك متابعة حالته هنا.`)}</GText>
          <GButton icon="arrow-forward" label={t("View request", "عرض الطلب")} onPress={() => router.replace(`/customer/mechanicrequest/${sentId}`)} />
        </Card>
      ) : (
        <View>
          <StepperHeader steps={steps} index={step} label={(i, n) => t(`Step ${i} of ${n}`, `الخطوة ${i} من ${n}`)} />
          {step === 0 ? (
            <>
              <Card>
                <Field label={t("Make", "الشركة المصنعة")} value={form.make} onChangeText={form.setMake} maxLength={60} />
                <Field label={t("Model", "الطراز")} value={form.model} onChangeText={form.setModel} maxLength={60} />
                <Field label={t("Year (optional)", "السنة (اختياري)")} value={form.year} onChangeText={form.setYear} keyboardType="number-pad" maxLength={4} />
              </Card>
              {m.skills.length ? (
                <View style={{ marginTop: 16 }}>
                  <GText style={[gType.label, { fontWeight: "800", marginBottom: 8 }, align]}>{t("Skill (optional)", "المهارة (اختياري)")}</GText>
                  <View style={{ flexDirection: isArabic ? "row-reverse" : "row", flexWrap: "wrap", gap: 8 }}>
                    {m.skills.map((s) => (
                      <Chip key={s} label={skillLabel(s)} on={form.skill === s} onPress={() => form.setSkill(form.skill === s ? null : s)} />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : step === 1 ? (
            <Card>
              <Field label={t("What is wrong?", "ما المشكلة؟")} value={form.problem} onChangeText={form.setProblem} multiline maxLength={1000} />
              <GText soft style={[gType.tiny, align, { marginTop: -6 }]}>{`${form.problem.trim().length}/1000`}</GText>
            </Card>
          ) : (
            <>
              <Card>
                {form.loc.dialog}
                <GButton variant="secondary" icon="locate-outline" label={form.finding || form.loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my current location", "استخدم موقعي الحالي")} disabled={form.finding || form.loc.locating} onPress={form.useHere} />
                <View style={{ height: 10 }} />
                <LocationProblem loc={form.loc} />
                <Field label={t("Where is the car?", "أين السيارة؟")} value={form.where} onChangeText={form.editWhere} multiline maxLength={300} />
                {MAPS_AVAILABLE && form.spot ? (
                  <View style={{ marginBottom: 12, borderRadius: gShape.small, overflow: "hidden" }}>
                    <PinMap point={form.spot} onChange={(p) => form.place(p, false)} />
                    <GText soft style={[gType.tiny, align, { marginVertical: 6 }]}>{t("Tap the map or drag the pin to adjust the point.", "اضغط على الخريطة أو اسحب الدبوس لتعديل النقطة.")}</GText>
                    <GButton variant="ghost" icon="trash-outline" label={t("Remove the pin", "إزالة الدبوس")} onPress={form.removePin} />
                  </View>
                ) : null}
                <Field label={t("Preferred time (optional)", "الوقت المفضل (اختياري)")} value={form.when} onChangeText={form.setWhen} maxLength={100} placeholder={t("e.g. Tomorrow after 4 pm", "مثال: غدًا بعد الرابعة عصرًا")} />
              </Card>
              <Card style={{ marginTop: 12 }}>
                <Field label={t("Phone number (optional)", "رقم الهاتف (اختياري)")} value={form.phone} onChangeText={form.setPhone} keyboardType="phone-pad" maxLength={20} />
                <GText soft style={[gType.tiny, align, { marginTop: -6 }]}>{t("Shared only with this mechanic.", "يُشارك مع هذا الميكانيكي فقط.")}</GText>
              </Card>
            </>
          )}
          <View style={{ marginTop: 12 }}>
            {stepErr || form.err ? <Note tone="danger" icon="alert-circle-outline">{stepErr ?? form.err}</Note> : null}
            <Note icon="lock-closed-outline">{t("The mechanic sees your name, your car, the problem and the location you wrote. Your email is never shared.", "يرى الميكانيكي اسمك وسيارتك والمشكلة والموقع الذي كتبته. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}</Note>
          </View>
        </View>
      )}
    </GaragePage>
  );
}
