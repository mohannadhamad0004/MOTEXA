import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Chip, ChipRow } from "../../../features/catalog/catalogBits";
import { CustomerScreen } from "../../../features/catalog/CustomerScreen";
import { useProblemLabels } from "../../../features/requests/requestBits";
import { TOW_PROBLEMS, TowProblem, customerTowRequests, existingIdOf } from "../../../features/requests/requestsService";
import { catalogService } from "../../../features/catalog/catalogService";
import { Async, Button, Card, Field, Header, Notice, Section, useL, useLoad } from "../../../features/shared/ui";

// Addresses are plain text in this version (no GPS, no distance, no price: the company answers the request).
export default function NewTowRequest() {
  const { companyId } = useLocalSearchParams<{ companyId: string }>();
  const { t } = useL();
  const state = useLoad(() => catalogService.getTowCompany(companyId), [companyId]);
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [problem, setProblem] = useState<TowProblem | null>(null);
  const problemLabel = useProblemLabels();
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    const y = year.trim() ? Number(year.trim()) : null;
    if (pickup.trim().length < 3) return setErr(t("Enter the pickup address.", "أدخل عنوان الاستلام."));
    if (dropoff.trim().length < 3) return setErr(t("Enter the destination.", "أدخل الوجهة."));
    if (!make.trim() || !model.trim()) return setErr(t("Enter the car make and model.", "أدخل ماركة السيارة وطرازها."));
    if (y !== null && !(Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1)) return setErr(t("The car year is not valid.", "سنة السيارة غير صحيحة."));
    if (!problem) return setErr(t("Choose what is wrong with the car.", "اختر مشكلة السيارة."));
    if (!/^[0-9+()\-\s]{6,20}$/.test(phone.trim()) || phone.replace(/\D/g, "").length < 5)
      return setErr(t("Enter a valid contact phone number.", "أدخل رقم هاتف صحيحًا للتواصل."));
    setBusy(true);
    setErr(null);
    try {
      const r = await customerTowRequests.create({
        companyId,
        pickupAddress: pickup.trim(),
        dropoffAddress: dropoff.trim(),
        contactPhone: phone.trim(),
        vehicleMake: make.trim(),
        vehicleModel: model.trim(),
        vehicleYear: y,
        problemType: problem,
        notes: notes.trim(),
      });
      router.replace(`/customer/towrequest/${r.id}`);
    } catch (e: any) {
      const existing = existingIdOf(e, "existingRequestId");
      if (existing) router.replace(`/customer/towrequest/${existing}`);
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <CustomerScreen>
      <Header brand="MOTEXA" title={t("Request a tow", "اطلب سحبًا")} back />
      <Async state={state}>
        {({ company }) =>
          company.availableTrucks === 0 ? (
            <Notice tone="danger" icon="alert-circle-outline">
              {t(`${company.name} has no available truck right now. Please try another company or come back later.`, `لا توجد شاحنة متاحة لدى ${company.name} حاليًا. جرّب شركة أخرى أو عد لاحقًا.`)}
            </Notice>
          ) : (
            <>
              <Notice icon="car-outline">{t(`Request to ${company.name} · ${company.city}`, `طلب إلى ${company.name} · ${company.city}`)}</Notice>
              <Section title={t("Where", "أين")} />
              <Card>
                <Field label={t("Pickup address", "عنوان الاستلام")} value={pickup} onChangeText={setPickup} multiline maxLength={300} />
                <Field label={t("Destination", "الوجهة")} value={dropoff} onChangeText={setDropoff} multiline maxLength={300} />
              </Card>
              <Section title={t("Your car", "سيارتك")} />
              <Card>
                <Field label={t("Make", "الشركة المصنعة")} value={make} onChangeText={setMake} maxLength={60} />
                <Field label={t("Model", "الطراز")} value={model} onChangeText={setModel} maxLength={60} />
                <Field label={t("Year (optional)", "السنة (اختياري)")} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
              </Card>
              <Section title={t("What is wrong?", "ما المشكلة؟")} />
              <ChipRow>
                {TOW_PROBLEMS.map((k) => (
                  <Chip key={k} label={problemLabel[k]} on={problem === k} onPress={() => setProblem(k)} />
                ))}
              </ChipRow>
              <Section title={t("Contact", "التواصل")} />
              <Card>
                <Field label={t("Contact phone", "هاتف التواصل")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
                <Field label={t("Notes (optional)", "ملاحظات (اختياري)")} value={notes} onChangeText={setNotes} multiline maxLength={500} />
              </Card>
              {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
              <Button icon="send-outline" label={t("Send request", "إرسال الطلب")} disabled={busy} onPress={submit} />
              <Notice icon="information-circle-outline">
                {t("The company sees your name, your phone and what you wrote here. Your email is never shared.", "ترى الشركة اسمك ورقم هاتفك وما كتبته هنا فقط. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}
              </Notice>
            </>
          )
        }
      </Async>
    </CustomerScreen>
  );
}
