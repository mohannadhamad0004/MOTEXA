import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Section } from "../../components/blueprint";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Text } from "../../components/ui/Text";
import { cityCentre } from "../../core/constants/cities";
import { Point, locationMemory, roundPoint } from "../../core/constants/geo";
import { useL } from "../../core/hooks/useL";
import { useTheme } from "../../theme/useTheme";
import { currentCar } from "../catalog/catalogService";
import { MAPS_AVAILABLE, PinMap } from "../shared/maps";
import { LocationProblem, reverseGeocode, useCurrentLocation } from "../shared/useCurrentLocation";
import { Chip, ChipRow } from "../../components/ui/Chip";
import { useProblemLabels } from "./requestBits";
import { TOW_PROBLEMS, TowProblem, CustomerTowRequest, customerTowRequests, existingIdOf } from "./requestsService";

/**
 * All state and rules of the tow request form (validation, address lookup, location). The full screen
 * (customer/towrequest/new) and the panel on the map page both use it, so the rules live in one place.
 */
export function useTowRequestForm(company: { id: string; city: string }) {
  const { t } = useL();
  const car = currentCar(); // from "Fits my car" when set; still editable
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [make, setMake] = useState(car?.make ?? "");
  const [model, setModel] = useState(car?.model ?? "");
  const [year, setYear] = useState(car?.year ?? "");
  const [problem, setProblem] = useState<TowProblem | null>(null);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  // Where the car is: read only when you tap "Use my current location" (or place the pin yourself). Sent with the request, nowhere else.
  const [spot, setSpot] = useState<Point | null>(null);
  const [auto, setAuto] = useState(false); // the pickup text was filled in from the map, so moving the pin may refresh it
  const [finding, setFinding] = useState(false);
  const loc = useCurrentLocation();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Address lookups: only the newest one may write (a manual edit or removing the pin cancels it), and map moves are debounced.
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
    if (!(replaceText || !pickup.trim() || auto)) return;
    cancelLookup();
    const mine = lookup.current;
    setFinding(true);
    lookupTimer.current = setTimeout(
      async () => {
        const text = await reverseGeocode(at);
        if (mine !== lookup.current) return;
        setFinding(false);
        if (text) {
          setPickup(text);
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
  const editPickup = (v: string) => {
    cancelLookup();
    setPickup(v);
    setAuto(false);
  };
  const removePin = () => {
    cancelLookup();
    setSpot(null);
  };
  /** Drops the pin at your last known position, else at the company's city centre. */
  const startPin = () => place(locationMemory.current ?? cityCentre(company.city) ?? { lat: 32.2211, lng: 35.2544 }, false);

  /** Validates and sends. Returns the request id (a 409 "already open" answer returns that request's id), or null. */
  const submit = async (): Promise<{ id: string; existing: boolean; request?: CustomerTowRequest } | null> => {
    const y = year.trim() ? Number(year.trim()) : null;
    if (pickup.trim().length < 3) return fail(t("Enter the pickup address.", "أدخل عنوان الاستلام."));
    if (dropoff.trim().length < 3) return fail(t("Enter the destination.", "أدخل الوجهة."));
    if (!make.trim() || !model.trim()) return fail(t("Enter the car make and model.", "أدخل ماركة السيارة وطرازها."));
    if (y !== null && !(Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1)) return fail(t("The car year is not valid.", "سنة السيارة غير صحيحة."));
    if (!problem) return fail(t("Choose what is wrong with the car.", "اختر مشكلة السيارة."));
    if (!/^[0-9+()\-\s]{6,20}$/.test(phone.trim()) || phone.replace(/\D/g, "").length < 5) return fail(t("Enter a valid contact phone number.", "أدخل رقم هاتف صحيحًا للتواصل."));
    setBusy(true);
    setErr(null);
    try {
      const r = await customerTowRequests.create({
        companyId: company.id,
        pickupAddress: pickup.trim(),
        dropoffAddress: dropoff.trim(),
        contactPhone: phone.trim(),
        vehicleMake: make.trim(),
        vehicleModel: model.trim(),
        vehicleYear: y,
        ...(spot ? { pickupLat: spot.lat, pickupLng: spot.lng } : {}),
        problemType: problem,
        notes: notes.trim(),
      });
      return { id: r.id, existing: false, request: r };
    } catch (e: any) {
      const existing = existingIdOf(e, "existingRequestId");
      if (existing) return { id: existing, existing: true };
      setErr(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const fail = (m: string) => {
    setErr(m);
    return null;
  };

  return { loc, spot, place, useHere, editPickup, removePin, startPin, finding, busy, err, submit, setErr, pickup, dropoff, setDropoff, make, setMake, model, setModel, year, setYear, problem, setProblem, phone, setPhone, notes, setNotes, cancelLookup };
}
export type TowForm = ReturnType<typeof useTowRequestForm>;

/** The form fields. `pinMap` shows the small pin map (the full screen); on the map page the pin lives on the big map. */
export function TowRequestFields({ form, pinMap, numbered = true }: { form: TowForm; pinMap: boolean; numbered?: boolean }) {
  const { t } = useL();
  const { c, align } = useTheme();
  const problemLabel = useProblemLabels();
  const wrap = (n: string, title: string, body: React.ReactNode) => (numbered ? <Section n={n} title={title}>{body}</Section> : <View style={{ marginTop: 20 }}><Text style={[{ color: c.ink, fontSize: 15, fontWeight: "700", marginBottom: 10 }, align]}>{title}</Text>{body}</View>);
  return (
    <>
      {wrap(
        "01",
        t("Where", "أين"),
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
          <Input label={t("Pickup address", "عنوان الاستلام")} value={form.pickup} onChangeText={form.editPickup} multiline maxLength={300} />
          {MAPS_AVAILABLE && pinMap ? (
            form.spot ? (
              <>
                <PinMap point={form.spot} onChange={(p) => form.place(p, false)} />
                <Text style={{ color: c.soft, fontSize: 11, marginBottom: 10 }}>
                  {t("Tap the map or drag the pin to adjust the pickup point. Add a street or landmark above if the address is empty.", "اضغط على الخريطة أو اسحب الدبوس لتعديل نقطة الاستلام. أضف شارعًا أو معلمًا أعلاه إن كان العنوان فارغًا.")}
                </Text>
                <Button variant="ghost" icon="trash-outline" label={t("Remove the pin", "إزالة الدبوس")} onPress={form.removePin} />
              </>
            ) : (
              <Button variant="ghost" icon="map-outline" label={t("Choose on the map", "اختر على الخريطة")} onPress={form.startPin} />
            )
          ) : null}
          {!pinMap ? (
            form.spot ? (
              <>
                <Text style={{ color: c.soft, fontSize: 11, marginBottom: 10 }}>{t("Drag the A pin on the map to adjust the pickup point.", "اسحب الدبوس A على الخريطة لتعديل نقطة الاستلام.")}</Text>
                <Button variant="ghost" icon="trash-outline" label={t("Remove the pin", "إزالة الدبوس")} onPress={form.removePin} />
              </>
            ) : (
              <Button variant="ghost" icon="map-outline" label={t("Place the pin on the map", "ضع الدبوس على الخريطة")} onPress={form.startPin} />
            )
          ) : null}
          <Input label={t("Destination", "الوجهة")} value={form.dropoff} onChangeText={form.setDropoff} multiline maxLength={300} />
        </Card>
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
        t("What is wrong?", "ما المشكلة؟"),
        <ChipRow>
          {TOW_PROBLEMS.map((k) => (
            <Chip key={k} label={problemLabel[k]} on={form.problem === k} onPress={() => form.setProblem(k)} />
          ))}
        </ChipRow>
      )}
      {wrap(
        "04",
        t("Contact", "التواصل"),
        <Card>
          <Input label={t("Contact phone", "هاتف التواصل")} value={form.phone} onChangeText={form.setPhone} keyboardType="phone-pad" maxLength={20} />
          <Input label={t("Notes (optional)", "ملاحظات (اختياري)")} value={form.notes} onChangeText={form.setNotes} multiline maxLength={500} />
        </Card>
      )}
    </>
  );
}
