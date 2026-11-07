import { useState } from "react";
import { View } from "react-native";
import { Chip, Field, GButton, GText, Note } from "../../components/garage";
import { isRealDate } from "../../core/constants/files";
import { uploadErrorText } from "../../core/hooks/pickPhoto";
import { useL } from "../../core/hooks/useL";
import { asActor, useSessionUser } from "../shared/session";
import { gType, useGarageTheme } from "../../theme/garage";
import { DocKind, TRUCK_TYPES, Truck, TruckInput, TruckType, towFleetService } from "../tow/towService";
import { docLabel, useTruckLabels } from "../tow/truckBits";
import { PhotoField, StepSheet } from "./steps";

const KINDS: DocKind[] = ["REGISTRATION", "INSURANCE"];

/**
 * Add / edit a truck in four short steps: type + plate + capacity, photo, make / model / year, the two required documents.
 * (Documents and the vehicle name are what the server needs before MOTEXA can approve the truck.) Editable later with the same steps.
 */
export function TruckWizard({ truck, onClose, onSaved }: { truck?: Truck; onClose: () => void; onSaved: () => void }) {
  const { t } = useL();
  const user = useSessionUser();
  const { type } = useTruckLabels();
  const { row, align } = useGarageTheme();
  const [kind, setKind] = useState<TruckType>(truck?.type ?? "FLATBED");
  const [plate, setPlate] = useState(truck?.plate ?? "");
  const [weight, setWeight] = useState(truck?.maxWeightKg ? String(truck.maxWeightKg) : "");
  const [photo, setPhoto] = useState<string | null>(truck?.photoUri ?? null);
  const [make, setMake] = useState(truck?.make ?? "");
  const [model, setModel] = useState(truck?.model ?? "");
  const [year, setYear] = useState(truck?.year ? String(truck.year) : "");
  const [docs, setDocs] = useState(truck?.documents ?? []);
  const [more, setMore] = useState(false);
  const doc = (k: DocKind) => docs.find((d) => d.kind === k);
  const setDoc = (k: DocKind, uri: string) => setDocs((all) => [...all.filter((d) => d.kind !== k), { kind: k, fileName: `${k.toLowerCase()}.jpg`, uri, expiresAt: all.find((d) => d.kind === k)?.expiresAt ?? null }]);
  const expiry = (k: DocKind) => (doc(k)?.expiresAt ?? "").slice(0, 10);
  const kg = weight.trim() ? Number(weight.trim()) : null;

  const validate = (s: number) => {
    if (s === 0) {
      if (!plate.trim()) return t("Enter the plate number.", "أدخل رقم اللوحة.");
      if (kg !== null && !(Number.isInteger(kg) && kg >= 500 && kg <= 60000)) return t("Capacity must be a whole number of kg between 500 and 60000.", "يجب أن تكون السعة عددًا صحيحًا بالكيلوغرام بين 500 و60000.");
    }
    if (s === 1 && !photo) return t("A truck photo is required.", "صورة الشاحنة مطلوبة.");
    if (s === 2) {
      if (!make.trim() || !model.trim()) return t("Enter the make and the model.", "أدخل الشركة المصنعة والطراز.");
      if (year.trim() && !(Number(year) >= 1950 && Number(year) <= new Date().getFullYear() + 1)) return t("The year is not valid.", "السنة غير صحيحة.");
    }
    if (s === 3) {
      if (!KINDS.every((k) => doc(k))) return t("Add the registration and the insurance photos.", "أضف صورتي ترخيص المركبة والتأمين.");
      if (KINDS.some((k) => expiry(k) && !isRealDate(expiry(k)))) return t("Expiry must be a real date: YYYY-MM-DD.", "يجب أن يكون الانتهاء تاريخًا حقيقيًا: YYYY-MM-DD.");
    }
    return null;
  };
  const save = async () => {
    const input: TruckInput = { type: kind, plate: plate.trim(), make: make.trim(), model: model.trim(), year: year.trim() ? parseInt(year, 10) : null, maxWeightKg: kg, photoUri: photo, documents: docs };
    try {
      if (truck) await towFleetService.updateTruck(asActor(user), truck.id, input);
      else await towFleetService.addTruck(asActor(user), input);
    } catch (e) {
      throw new Error(uploadErrorText(e, t));
    }
    onSaved();
  };

  return (
    <StepSheet
      visible
      title={truck ? t("Edit truck", "تعديل الشاحنة") : t("Add truck", "إضافة شاحنة")}
      steps={[t("Type and plate", "النوع واللوحة"), t("Photo", "الصورة"), t("The vehicle", "المركبة"), t("Documents", "المستندات")]}
      onClose={onClose}
      validate={validate}
      onSave={save}
      saveLabel={truck ? t("Save changes", "حفظ التغييرات") : t("Submit for approval", "إرسال للاعتماد")}
      render={(s) =>
        s === 0 ? (
          <View>
            <GText style={[gType.caption, align, { fontWeight: "700", marginBottom: 6 }]}>{t("Truck type", "نوع الشاحنة")}</GText>
            <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 14 }]}>
              {TRUCK_TYPES.map((k) => <Chip key={k} label={type[k]} on={kind === k} onPress={() => setKind(k)} />)}
            </View>
            <Field label={t("Plate number", "رقم اللوحة")} value={plate} onChangeText={setPlate} autoCapitalize="characters" maxLength={20} />
            <Field label={t("Capacity: heaviest car in kg (optional)", "السعة: أثقل سيارة بالكغ (اختياري)")} value={weight} onChangeText={setWeight} keyboardType="number-pad" maxLength={5} />
            {!truck ? <Note icon="time-outline">{t("New trucks wait for MOTEXA approval before they can take jobs.", "تنتظر الشاحنات الجديدة اعتماد موتكسا قبل أن تستلم مهام.")}</Note> : null}
          </View>
        ) : s === 1 ? (
          <PhotoField required label={t("Truck photo", "صورة الشاحنة")} value={photo} onChange={(uri) => setPhoto(uri)} hint={t("Customers see this photo.", "يراها الزبائن.")} />
        ) : s === 2 ? (
          <View>
            <Field label={t("Make", "الشركة المصنعة")} value={make} onChangeText={setMake} maxLength={60} />
            <Field label={t("Model", "الطراز")} value={model} onChangeText={setModel} maxLength={60} />
            <Field label={t("Year (optional)", "السنة (اختياري)")} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
          </View>
        ) : (
          <View>
            {KINDS.map((k) => (
              <PhotoField key={k} required label={docLabel(t, k)} value={doc(k)?.uri ?? null} onChange={(uri) => setDoc(k, uri)} hint={t("Private: only you and MOTEXA see it.", "خاص: لا يراه إلا أنت وموتكسا.")} />
            ))}
            <GButton variant="ghost" label={more ? t("Hide more details", "إخفاء المزيد") : t("More details: expiry dates", "المزيد: تواريخ الانتهاء")} onPress={() => setMore(!more)} />
            {more ? KINDS.map((k) => (
              <Field key={k} label={`${docLabel(t, k)}: ${t("expiry (YYYY-MM-DD)", "الانتهاء (YYYY-MM-DD)")}`} value={expiry(k)} onChangeText={(v) => setDocs((all) => all.map((d) => (d.kind === k ? { ...d, expiresAt: v } : d)))} maxLength={10} />
            )) : null}
          </View>
        )
      }
    />
  );
}
