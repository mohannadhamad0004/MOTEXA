import { Async, Notice } from "../../../components/ui/Feedback";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Chip, ChipRow } from "../../../components/ui/Chip";
import { Input } from "../../../components/ui/Input";
import { Header } from "../../../components/layout/DashboardLayout";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { currentCar } from "../../../features/catalog/catalogService";
import { cityLabel } from "../../../core/constants/cities";
import { Point, roundPoint } from "../../../core/constants/geo";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { LocationProblem, reverseGeocode, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { InitialAvatar, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { customerMechanicRequests, mechanicCatalog } from "../../../features/mechanics/mechanicsService";

const PHONE_OK = (v: string) => /^[0-9+()\-\s]{6,20}$/.test(v) && v.replace(/\D/g, "").length >= 5;

// A service request to one verified mechanic. The mechanic answers inside the app; nothing here is a price or a promise of a time.
export default function NewMechanicRequest() {
  const { c: col } = useTheme();
  const { mechanicId } = useLocalSearchParams<{ mechanicId: string }>();
  const { t, row, align, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const state = useLoad(() => mechanicCatalog.get(mechanicId), [mechanicId]);
  const car = currentCar(); // from "Fits my car" when set; still editable below
  const [skill, setSkill] = useState<string | null>(null);
  const [make, setMake] = useState(car?.make ?? "");
  const [model, setModel] = useState(car?.model ?? "");
  const [year, setYear] = useState(car?.year ?? "");
  const [problem, setProblem] = useState("");
  const [where, setWhere] = useState("");
  const [when, setWhen] = useState("");
  const [phone, setPhone] = useState("");
  // Where the car is: read only when you tap "Use my current location". Sent with the request, nowhere else.
  const [spot, setSpot] = useState<Point | null>(null);
  const [auto, setAuto] = useState(false); // the location text came from the map, so moving the pin may refresh it
  const [finding, setFinding] = useState(false);
  const loc = useCurrentLocation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  // Address lookups: only the newest one may write (a manual edit or removing the pin cancels it), and map moves are debounced.
  const lookup = useRef(0);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLookup = () => {
    lookup.current++;
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    setFinding(false);
  };
  useEffect(() => () => { lookup.current++; if (lookupTimer.current) clearTimeout(lookupTimer.current); }, []);
  const place = (p: Point, replaceText: boolean) => {
    const at = roundPoint(p);
    setSpot(at);
    if (!(replaceText || !where.trim() || auto)) return;
    cancelLookup();
    const mine = lookup.current;
    setFinding(true);
    lookupTimer.current = setTimeout(async () => {
      const text = await reverseGeocode(at);
      if (mine !== lookup.current) return;
      setFinding(false);
      if (text) {
        setWhere(text);
        setAuto(true);
      }
    }, replaceText ? 0 : 400);
  };
  const useHere = async () => {
    const p = await loc.locate();
    if (p) place(p, true);
  };

  const submit = async () => {
    const y = year.trim() ? Number(year.trim()) : undefined;
    if (!make.trim() || !model.trim()) return setErr(t("Enter the car make and model.", "أدخل ماركة السيارة وطرازها."));
    if (y !== undefined && !(Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1)) return setErr(t("The car year is not valid.", "سنة السيارة غير صحيحة."));
    if (problem.trim().length < 10) return setErr(t("Describe the problem in at least 10 characters.", "صف المشكلة في 10 أحرف على الأقل."));
    if (where.trim().length < 3) return setErr(t("Enter where the car is.", "أدخل مكان السيارة."));
    if (phone.trim() && !PHONE_OK(phone.trim())) return setErr(t("The phone number is not valid. Leave it empty to skip it.", "رقم الهاتف غير صحيح. اتركه فارغًا لتخطيه."));
    setBusy(true);
    setErr(null);
    try {
      const r = await customerMechanicRequests.create({
        mechanicId,
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
      setSentId(r.id);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header brand="MOTEXA" title={t("Request service", "طلب خدمة")} back />
      <Async state={state}>
        {(m) =>
          sentId ? (
            <Card>
              <View style={{ alignItems: "center", paddingVertical: 14, gap: 10 }}>
                <Ionicons name="checkmark-circle-outline" size={44} color={col.success} />
                <Text style={{ color: col.text, fontSize: 18, fontWeight: "800", textAlign: "center" }}>{t("Request sent", "تم إرسال الطلب")}</Text>
                <Text style={{ color: col.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center" }}>
                  {t(`${m.name} will accept or decline it. You can follow its status here.`, `سيقبل ${m.name} الطلب أو يرفضه. يمكنك متابعة حالته هنا.`)}
                </Text>
              </View>
              <Button icon="receipt-outline" label={t("View request", "عرض الطلب")} onPress={() => router.replace(`/customer/mechanicrequest/${sentId}`)} />
            </Card>
          ) : (
            <>
              <Card>
                <View style={[row, { alignItems: "center", gap: 12 }]}>
                  <InitialAvatar name={m.name} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[{ color: col.text, fontSize: 15, fontWeight: "800" }, align]}>{m.name}</Text>
                    <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>{m.workshopName} · {cityLabel(m.city, isArabic)}</Text>
                  </View>
                </View>
              </Card>

              <SectionHeader title={t("Skill (optional)", "المهارة (اختياري)")} />
              <ChipRow>
                {m.skills.map((s) => (
                  <Chip key={s} label={skillLabel(s)} on={skill === s} onPress={() => setSkill(skill === s ? null : s)} />
                ))}
              </ChipRow>

              <SectionHeader title={t("Your car", "سيارتك")} />
              <Card>
                <Input label={t("Make", "الشركة المصنعة")} value={make} onChangeText={setMake} maxLength={60} />
                <Input label={t("Model", "الطراز")} value={model} onChangeText={setModel} maxLength={60} />
                <Input label={t("Year (optional)", "السنة (اختياري)")} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
              </Card>

              <SectionHeader title={t("The problem", "المشكلة")} />
              <Card>
                <Input label={t("What is wrong?", "ما المشكلة؟")} value={problem} onChangeText={setProblem} multiline maxLength={1000} />
                <Text style={[{ color: col.textDim, fontSize: 11, marginTop: -8 }, align]}>{problem.trim().length}/1000</Text>
              </Card>

              <SectionHeader title={t("Where and when", "المكان والوقت")} />
              <Card>
                {loc.dialog}
                <Button variant="ghost" icon="locate-outline" label={finding || loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my current location", "استخدم موقعي الحالي")} disabled={finding || loc.locating} onPress={useHere} />
                <LocationProblem loc={loc} />
                <Input label={t("Where is the car?", "أين السيارة؟")} value={where} onChangeText={(v) => { cancelLookup(); setWhere(v); setAuto(false); }} multiline maxLength={300} />
                {MAPS_AVAILABLE && spot ? (
                  <>
                    <PinMap point={spot} onChange={(p) => place(p, false)} />
                    <Text style={{ color: col.textDim, fontSize: 11, marginBottom: 10 }}>
                      {t("Tap the map or drag the pin to adjust the point.", "اضغط على الخريطة أو اسحب الدبوس لتعديل النقطة.")}
                    </Text>
                    <Button variant="ghost" icon="trash-outline" label={t("Remove the pin", "إزالة الدبوس")} onPress={() => { cancelLookup(); setSpot(null); }} />
                    <View style={{ height: 10 }} />
                  </>
                ) : null}
                <Input label={t("Preferred time (optional)", "الوقت المفضل (اختياري)")} value={when} onChangeText={setWhen} maxLength={100} placeholder={t("e.g. Tomorrow after 4 pm", "مثال: غدًا بعد الرابعة عصرًا")} />
              </Card>

              <SectionHeader title={t("Contact (optional)", "التواصل (اختياري)")} />
              <Card>
                <Input label={t("Phone number", "رقم الهاتف")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} />
                <Text style={[{ color: col.textDim, fontSize: 11, marginTop: -8 }, align]}>{t("Shared only with this mechanic.", "يُشارك مع هذا الميكانيكي فقط.")}</Text>
              </Card>

              {err ? <Notice tone="danger" icon="alert-circle-outline">{err}</Notice> : null}
              <Button icon="send-outline" label={busy ? t("Sending…", "جارٍ الإرسال…") : t("Send request", "إرسال الطلب")} disabled={busy} onPress={submit} />
              <View style={{ height: 12 }} />
              <Notice icon="information-circle-outline">
                {t("The mechanic sees your name, your car, the problem and the location you wrote. Your email is never shared.", "يرى الميكانيكي اسمك وسيارتك والمشكلة والموقع الذي كتبته. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}
              </Notice>
            </>
          )
        }
      </Async>
    </Screen>
  );
}
