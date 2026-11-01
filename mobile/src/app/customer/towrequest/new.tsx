import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Card, Chip, ErrorState, Field, GarageHero, GaragePage, GButton, GIcon, GText, ListRow, Note, SkeletonBlock, StepperHeader, StickyActionBar } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { catalogService } from "../../../features/catalog/catalogService";
import { useProblemLabels } from "../../../features/requests/requestBits";
import { TOW_PROBLEMS } from "../../../features/requests/requestsService";
import { useTowRequestForm } from "../../../features/requests/TowRequestForm";
import { freeDriversOf } from "../../../features/tow/dispatchService";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { LocationProblem } from "../../../features/shared/useCurrentLocation";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

// The tow request as three steps (pickup + destination, car + problem + phone, confirm) with a sticky bar. The rules live in
// useTowRequestForm (shared with the map page); a sent request shows a short confirmation, then the status page.
export default function NewTowRequest() {
  const { companyId, driverId } = useLocalSearchParams<{ companyId: string; driverId?: string }>();
  const { t, isArabic } = useL();
  const { g, row, align } = useGarageTheme();
  const problem = useProblemLabels();
  const state = useLoad(() => catalogService.getTowCompany(companyId), [companyId]);
  const form = useTowRequestForm({ id: companyId, city: state.data?.company.city ?? "" });
  // who comes: any driver of the company (it assigns) or one of its FREE drivers
  const drivers = useLoad(() => freeDriversOf(companyId), [companyId]);
  useEffect(() => {
    if (driverId) form.setDriverId(driverId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);
  const [step, setStep] = useState(0);
  const [stepErr, setStepErr] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const steps = [t("Pickup", "الاستلام"), t("Car & problem", "السيارة والمشكلة"), t("Confirm", "التأكيد")];

  const next = () => {
    setStepErr(null);
    if (step === 0 && form.pickup.trim().length < 3) return setStepErr(t("Enter the pickup address.", "أدخل عنوان الاستلام."));
    if (step === 0 && form.dropoff.trim().length < 3) return setStepErr(t("Enter the destination.", "أدخل الوجهة."));
    if (step === 1 && (!form.make.trim() || !form.model.trim())) return setStepErr(t("Enter the car make and model.", "أدخل ماركة السيارة وطرازها."));
    if (step === 1 && !form.problem) return setStepErr(t("Choose what is wrong with the car.", "اختر مشكلة السيارة."));
    setStep(step + 1);
  };
  const send = async () => {
    setStepErr(null);
    const r = await form.submit();
    if (!r) return;
    if (r.existing) router.replace({ pathname: "/customer/towrequest/[id]", params: { id: r.id } });
    else setSent(r.id);
  };
  // short success confirmation, then the request itself
  useEffect(() => {
    if (!sent) return;
    const id = setTimeout(() => router.replace({ pathname: "/customer/towrequest/[id]", params: { id: sent, created: "1" } }), 1200);
    return () => clearTimeout(id);
  }, [sent]);
  const back = () => (step > 0 && !sent ? setStep(step - 1) : router.canGoBack() ? router.back() : router.navigate("/customer/tow"));

  const co = state.data?.company;
  const noTruck = !!co && co.availableTrucks === 0;
  return (
    <GaragePage
      hero={<GarageHero variant="detail" onBack={back} title={t("Request a tow", "اطلب سحبًا")} line={co ? `${co.name} · ${cityLabel(co.city, isArabic)}` : undefined} />}
      bottom={
        co && !noTruck && !sent ? (
          <StickyActionBar>
            {step > 0 ? <GButton variant="secondary" label={t("Back", "رجوع")} onPress={back} /> : null}
            {step < 2 ? <GButton flex icon="arrow-forward" label={t("Next", "التالي")} onPress={next} /> : <GButton flex icon="send" label={t("Send request", "إرسال الطلب")} busy={form.busy} onPress={send} />}
          </StickyActionBar>
        ) : undefined
      }
    >
      {sent ? (
        <Card style={{ alignItems: "center", gap: 12, paddingVertical: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: g.tint, alignItems: "center", justifyContent: "center" }}>
            <GIcon name="checkmark-circle" size={40} color={g.success} />
          </View>
          <GText style={[gType.title, { textAlign: "center" }]}>{t("Request sent", "تم إرسال الطلب")}</GText>
          <GText soft style={[gType.bodySm, { textAlign: "center" }]}>{t("Opening your request…", "جارٍ فتح طلبك…")}</GText>
        </Card>
      ) : state.error && !co ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !co ? (
        <SkeletonBlock height={220} radius={gShape.card} />
      ) : noTruck ? (
        <Note tone="danger" icon="alert-circle-outline">{t(`${co.name} has no available truck right now. Please try another company or come back later.`, `لا توجد شاحنة متاحة لدى ${co.name} حاليًا. جرّب شركة أخرى أو عد لاحقًا.`)}</Note>
      ) : (
        <View>
          <StepperHeader steps={steps} index={step} label={(i, n) => t(`Step ${i} of ${n}`, `الخطوة ${i} من ${n}`)} />
          {step === 0 ? (
            <Card>
              {form.loc.dialog}
              <GButton variant="secondary" icon="locate-outline" label={form.finding || form.loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my current location", "استخدم موقعي الحالي")} disabled={form.finding || form.loc.locating} onPress={form.useHere} />
              <View style={{ height: 10 }} />
              <LocationProblem loc={form.loc} />
              <Field label={t("Pickup address", "عنوان الاستلام")} value={form.pickup} onChangeText={form.editPickup} multiline maxLength={300} />
              {MAPS_AVAILABLE ? (
                form.spot ? (
                  <View style={{ marginBottom: 12, borderRadius: gShape.small, overflow: "hidden" }}>
                    <PinMap point={form.spot} onChange={(p) => form.place(p, false)} />
                    <GText soft style={[gType.tiny, align, { marginVertical: 6 }]}>{t("Tap the map or drag the pin to adjust the pickup point.", "اضغط على الخريطة أو اسحب الدبوس لتعديل نقطة الاستلام.")}</GText>
                    <GButton variant="ghost" icon="trash-outline" label={t("Remove the pin", "إزالة الدبوس")} onPress={form.removePin} />
                  </View>
                ) : (
                  <View style={{ marginBottom: 12 }}>
                    <GButton variant="ghost" icon="map-outline" label={t("Choose on the map", "اختر على الخريطة")} onPress={form.startPin} />
                  </View>
                )
              ) : null}
              <Field label={t("Destination", "الوجهة")} value={form.dropoff} onChangeText={form.setDropoff} multiline maxLength={300} />
            </Card>
          ) : step === 1 ? (
            <>
              <Card>
                <Field label={t("Make", "الشركة المصنعة")} value={form.make} onChangeText={form.setMake} maxLength={60} />
                <Field label={t("Model", "الطراز")} value={form.model} onChangeText={form.setModel} maxLength={60} />
                <Field label={t("Year (optional)", "السنة (اختياري)")} value={form.year} onChangeText={form.setYear} keyboardType="number-pad" maxLength={4} />
              </Card>
              <GText style={[gType.label, { fontWeight: "800", marginTop: 16, marginBottom: 8 }, align]}>{t("What is wrong?", "ما المشكلة؟")}</GText>
              <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                {TOW_PROBLEMS.map((k) => (
                  <Chip key={k} label={problem[k]} on={form.problem === k} onPress={() => form.setProblem(k)} />
                ))}
              </View>
              <Card style={{ marginTop: 16 }}>
                <Field label={t("Contact phone", "هاتف التواصل")} value={form.phone} onChangeText={form.setPhone} keyboardType="phone-pad" maxLength={20} />
                <Field label={t("Notes (optional)", "ملاحظات (اختياري)")} value={form.notes} onChangeText={form.setNotes} multiline maxLength={500} />
              </Card>
            </>
          ) : (
            <Card pad={12}>
              <ListRow icon="business-outline" title={t("Company", "الشركة")} sub={`${co.name} · ${cityLabel(co.city, isArabic)}`} />
              <View style={{ paddingVertical: 8, gap: 8 }}>
                <GText style={[gType.label, { fontWeight: "800" }, align]}>{t("Who should come?", "من يأتي؟")}</GText>
                <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                  <Chip icon="business-outline" label={t(`Any driver from ${co.name}`, `أي سائق من ${co.name}`)} on={!form.driverId} onPress={() => form.setDriverId(null)} />
                  {(drivers.data ?? []).map((d) => (
                    <Chip key={d.id} icon="person-outline" label={d.truck ? `${d.firstName} · ${d.truck.make}` : d.firstName} on={form.driverId === d.id} onPress={() => form.setDriverId(d.id)} />
                  ))}
                </View>
                {form.driverId && drivers.data && !drivers.data.some((d) => d.id === form.driverId) ? (
                  <Note tone="warning" icon="alert-circle-outline">{t("That driver is no longer free. The company will assign another one.", "هذا السائق لم يعد متاحًا. ستُسند الشركة سائقًا آخر.")}</Note>
                ) : null}
              </View>
              <ListRow divider icon="location-outline" title={t("Pickup", "الاستلام")} sub={form.pickup.trim()} />
              <ListRow divider icon="flag-outline" title={t("Destination", "الوجهة")} sub={form.dropoff.trim()} />
              <ListRow divider icon="car-sport-outline" title={t("Car", "السيارة")} sub={[form.make, form.model, form.year].map((x) => x.trim()).filter(Boolean).join(" ")} />
              <ListRow divider icon="alert-circle-outline" title={t("Problem", "المشكلة")} sub={form.problem ? problem[form.problem] : undefined} />
              <ListRow divider icon="call-outline" title={t("Contact phone", "هاتف التواصل")} sub={form.phone.trim()} />
            </Card>
          )}
          <View style={{ marginTop: 12 }}>
            {stepErr || form.err ? <Note tone="danger" icon="alert-circle-outline">{stepErr ?? form.err}</Note> : null}
            <Note icon="lock-closed-outline">{t("The company sees your name, your phone and what you wrote here. Your email is never shared.", "ترى الشركة اسمك ورقم هاتفك وما كتبته هنا فقط. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}</Note>
          </View>
        </View>
      )}
    </GaragePage>
  );
}
