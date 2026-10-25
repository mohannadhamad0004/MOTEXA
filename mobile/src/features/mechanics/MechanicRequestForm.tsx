import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Section } from "../../components/blueprint";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Chip, ChipRow } from "../../components/ui/Chip";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { cityCentre } from "../../core/constants/cities";
import { Point, locationMemory, roundPoint } from "../../core/constants/geo";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { currentCar } from "../catalog/catalogService";
import { MAPS_AVAILABLE, PinMap } from "../shared/maps";
import { LocationProblem, reverseGeocode, useCurrentLocation } from "../shared/useCurrentLocation";
import { useSkillLabel } from "./mechanicBits";
import { CustomerMechanicRequest, customerMechanicRequests } from "./mechanicsService";

const PHONE_OK = (v: string) => /^[0-9+()\-\s]{6,20}$/.test(v) && v.replace(/\D/g, "").length >= 5;

/**
 * All state and rules of the mechanic service request form. Used by the full screen (customer/mechanicrequest/new)
 * and by the panel on the Mechanics map page. A service request to one verified mechanic; no price, no promised time.
 */
export function useMechanicRequestForm(mechanic: { id: string; city: string }) {
  const { t } = useL();
  const car = currentCar();
  const [skill, setSkill] = useState<string | null>(null);
  const [make, setMake] = useState(car?.make ?? "");
  const [model, setModel] = useState(car?.model ?? "");
  const [year, setYear] = useState(car?.year ?? "");
  const [problem, setProblem] = useState("");
  const [where, setWhere] = useState("");
  const [when, setWhen] = useState("");
  const [phone, setPhone] = useState("");
  const [spot, setSpot] = useState<Point | null>(null);
  const [auto, setAuto] = useState(false);
  const [finding, setFinding] = useState(false);
  const loc = useCurrentLocation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const lookup = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLookup = () => {
    lookup.current++;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setFinding(false);
  };
  useEffect(
    () => () => {
      lookup.current++;
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    },
    []
  );
  const place = (p: Point, replaceText: boolean) => {
    const at = roundPoint(p);
    setSpot(at);
    if (!(replaceText || !where.trim() || auto)) return;
    cancelLookup();
    const mine = lookup.current;
    setFinding(true);
    lookupTimer.current = setTimeout(
      async () => {
        const text = await reverseGeocode(at);
        if (mine !== lookup.current) return;
        setFinding(false);
        if (text) {
          setWhere(text);
          setAuto(true);
        }
      },
      replaceText ? 0 : 400
    );
  };
  const useHere = async () => {
    const p = await loc.locate();
    if (p) place(p, true);
  };
  const editWhere = (v: string) => {
    cancelLookup();
    setWhere(v);
    setAuto(false);
  };
  const removePin = () => {
    cancelLookup();
    setSpot(null);
  };
  const startPin = () => place(locationMemory.current ?? cityCentre(mechanic.city) ?? { lat: 32.2211, lng: 35.2544 }, false);

  const fail = (m: string) => {
    setErr(m);
    return null;
  };
  /** Validates and sends. Returns the created request, or null (the error is in `err`). */
  const submit = async (): Promise<CustomerMechanicRequest | null> => {
    const y = year.trim() ? Number(year.trim()) : undefined;
    if (!make.trim() || !model.trim()) return fail(t("Enter the car make and model.", "أدخل ماركة السيارة وطرازها."));
    if (y !== undefined && !(Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1)) return fail(t("The car year is not valid.", "سنة السيارة غير صحيحة."));
    if (problem.trim().length < 10) return fail(t("Describe the problem in at least 10 characters.", "صف المشكلة في 10 أحرف على الأقل."));
    if (where.trim().length < 3) return fail(t("Enter where the car is.", "أدخل مكان السيارة."));
    if (phone.trim() && !PHONE_OK(phone.trim())) return fail(t("The phone number is not valid. Leave it empty to skip it.", "رقم الهاتف غير صحيح. اتركه فارغًا لتخطيه."));
    setBusy(true);
    setErr(null);
    try {
      return await customerMechanicRequests.create({
        mechanicId: mechanic.id,
        ...(skill ? { skill } : {}),
        carMake: make.trim(),
        carModel: model.trim(),
        ...(y !== undefined ? { carYear: y } : {}),
        problemDescription: problem.trim(),
        locationText: where.trim(),
        ...(spot ? { locationLat: spot.lat, locationLng: spot.lng } : {}),
        ...(when.trim() ? { preferredTime: when.trim() } : {}),
        ...(phone.trim() ? { contactPhone: phone.trim() } : {}),
      });
    } catch (e: any) {
      setErr(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  return { loc, spot, place, useHere, editWhere, removePin, startPin, finding, busy, err, submit, skill, setSkill, make, setMake, model, setModel, year, setYear, problem, setProblem, where, when, setWhen, phone, setPhone };
}
export type MechanicForm = ReturnType<typeof useMechanicRequestForm>;

/** The form fields (skills come from this mechanic's approved skills). */
export function MechanicRequestFields({ form, skills, pinMap, numbered = true }: { form: MechanicForm; skills: string[]; pinMap: boolean; numbered?: boolean }) {
  const { t } = useL();
  const { c, align } = useTheme();
  const skillLabel = useSkillLabel();
  const wrap = (n: string, title: string, body: React.ReactNode) =>
    numbered ? (
      <Section n={n} title={title}>{body}</Section>
    ) : (
      <View style={{ marginTop: 20 }}>
        <Text style={[{ color: c.ink, fontSize: 15, fontWeight: "700", marginBottom: 10 }, align]}>{title}</Text>
        {body}
      </View>
    );
  return (
    <>
      {wrap(
        "01",
        t("Skill (optional)", "المهارة (اختياري)"),
        <ChipRow>
          {skills.map((s) => (
            <Chip key={s} label={skillLabel(s)} on={form.skill === s} onPress={() => form.setSkill(form.skill === s ? null : s)} />
          ))}
        </ChipRow>
      )}
      {wrap(
        "02",
        t("Your car", "سيارتك"),
        <Card>
          <Input label={t("Make", "الشركة المصنعة")} value={form.make} onChangeText={form.setMake} maxLength={60} />
          <Input label={t("Model", "الطراز")} value={form.model} onChangeText={form.setModel} maxLength={60} />
          <Input label={t("Year (optional)", "السنة (اختياري)")} value={form.year} onChangeText={form.setYear} keyboardType="number-pad" maxLength={4} />
        </Card>
      )}
      {wrap(
        "03",
        t("The problem", "المشكلة"),
        <Card>
          <Input label={t("What is wrong?", "ما المشكلة؟")} value={form.problem} onChangeText={form.setProblem} multiline maxLength={1000} />
          <Text style={[{ color: c.soft, fontSize: 11, marginTop: -8 }, align]}>{form.problem.trim().length}/1000</Text>
        </Card>
      )}
      {wrap(
        "04",
        t("Where and when", "المكان والوقت"),
        <Card>
          {form.loc.dialog}
          <Button
            variant="ghost"
            icon="locate-outline"
            label={form.finding || form.loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my current location", "استخدم موقعي الحالي")}
            disabled={form.finding || form.loc.locating}
            onPress={form.useHere}
          />
          <LocationProblem loc={form.loc} />
          <Input label={t("Where is the car?", "أين السيارة؟")} value={form.where} onChangeText={form.editWhere} multiline maxLength={300} />
          {MAPS_AVAILABLE && pinMap && form.spot ? (
            <>
              <PinMap point={form.spot} onChange={(p) => form.place(p, false)} />
              <Text style={{ color: c.soft, fontSize: 11, marginBottom: 10 }}>{t("Tap the map or drag the pin to adjust the point.", "اضغط على الخريطة أو اسحب الدبوس لتعديل النقطة.")}</Text>
              <Button variant="ghost" icon="trash-outline" label={t("Remove the pin", "إزالة الدبوس")} onPress={form.removePin} />
              <View style={{ height: 10 }} />
            </>
          ) : null}
          {!pinMap ? (
            form.spot ? (
              <>
                <Text style={{ color: c.soft, fontSize: 11, marginBottom: 10 }}>{t("Drag the A pin on the map to adjust the point.", "اسحب الدبوس A على الخريطة لتعديل النقطة.")}</Text>
                <Button variant="ghost" icon="trash-outline" label={t("Remove the pin", "إزالة الدبوس")} onPress={form.removePin} />
                <View style={{ height: 10 }} />
              </>
            ) : (
              <>
                <Button variant="ghost" icon="map-outline" label={t("Place the pin on the map", "ضع الدبوس على الخريطة")} onPress={form.startPin} />
                <View style={{ height: 10 }} />
              </>
            )
          ) : null}
          <Input label={t("Preferred time (optional)", "الوقت المفضل (اختياري)")} value={form.when} onChangeText={form.setWhen} maxLength={100} placeholder={t("e.g. Tomorrow after 4 pm", "مثال: غدًا بعد الرابعة عصرًا")} />
        </Card>
      )}
      {wrap(
        "05",
        t("Contact (optional)", "التواصل (اختياري)"),
        <Card>
          <Input label={t("Phone number", "رقم الهاتف")} value={form.phone} onChangeText={form.setPhone} keyboardType="phone-pad" maxLength={20} />
          <Text style={[{ color: c.soft, fontSize: 11, marginTop: -8 }, align]}>{t("Shared only with this mechanic.", "يُشارك مع هذا الميكانيكي فقط.")}</Text>
        </Card>
      )}
    </>
  );
}
