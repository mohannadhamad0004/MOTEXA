// Tow company signup, step 3 editor: one truck. Required: photo, plate, type, make, model and the truck's OWN confirmed latitude + longitude
// (not the company base). Saved in the in-memory draft under a stable localId; nothing is uploaded yet and no documents are asked here.
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, View } from "react-native";
import { MechanicField, MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { pickImage } from "../../core/hooks/nav";
import { useDT } from "../department/ui";
import { truckTypeLabel } from "../department/departments";
import { TRUCK_TYPES } from "../tow/towService";
import type { TruckType } from "../tow/towService";
import { ProviderButton, ProviderChoice, ProviderNote } from "./kit";
import { TowLocationChooser, validPoint } from "./TowLocationChooser";
import { TowSignupPlace, getTowSignupDraft, newTruckId, saveTowSignupTruck } from "./towSignupDraft";

export default function TowSignupTruckForm() {
  const d = getTowSignupDraft();
  if (!d) return <Redirect href={"/provider/tow-signup" as never} />;
  if (d.baseLat === undefined) return <Redirect href={"/provider/tow-signup/location" as never} />;
  return <Body />;
}

function Body() {
  const m = useMechanicTheme();
  const dt = useDT();
  const draft = getTowSignupDraft()!;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? draft.trucks.find((t) => t.localId === id) : undefined;
  const [photo, setPhoto] = useState(existing?.photoUri ?? "");
  const [plate, setPlate] = useState(existing?.plateNumber ?? "");
  const [type, setType] = useState<TruckType | "">(existing?.truckType ?? "");
  const [make, setMake] = useState(existing?.make ?? "");
  const [model, setModel] = useState(existing?.model ?? "");
  const [place, setPlace] = useState<TowSignupPlace | null>(
    existing ? { baseLat: existing.baseLat, baseLng: existing.baseLng, locationAddress: existing.locationAddress, locationSource: existing.locationSource } : null,
  );
  const [tried, setTried] = useState(false);
  const bad = dt.chip("bad").fg;

  const errors: Record<string, string> = {};
  if (!photo) errors.photo = m.t("Add a photo of the truck.", "أضف صورة للشاحنة.");
  if (!plate.trim()) errors.plate = m.t("Enter the plate number.", "أدخل رقم اللوحة.");
  else if (draft.trucks.some((t) => t.localId !== existing?.localId && t.plateNumber.trim().toLowerCase() === plate.trim().toLowerCase())) errors.plate = m.t("This plate is already in your list.", "هذه اللوحة موجودة بالفعل في قائمتك.");
  if (!type) errors.type = m.t("Choose the truck type.", "اختر نوع الشاحنة.");
  if (!make.trim()) errors.make = m.t("Enter the make.", "أدخل الصنع.");
  if (!model.trim()) errors.model = m.t("Enter the model.", "أدخل الطراز.");
  if (!place || !validPoint({ lat: place.baseLat, lng: place.baseLng })) errors.place = m.t("Confirm the truck's own location.", "أكّد موقع الشاحنة الخاص بها.");
  const err = (k: string) => (tried ? errors[k] : undefined);
  const note = (k: string) => (err(k) ? <Text accessibilityRole="alert" style={{ color: bad, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: m.align }}>{err(k)}</Text> : null);

  const save = () => {
    setTried(true);
    if (Object.keys(errors).length || !place || !type) return;
    saveTowSignupTruck({ ...place, localId: existing?.localId ?? newTruckId(), photoUri: photo, plateNumber: plate.trim(), truckType: type, make: make.trim(), model: model.trim() });
    router.back();
  };

  return (
    <MechanicPage back title={existing ? m.t("Edit tow truck", "تعديل شاحنة السحب") : m.t("Add tow truck", "إضافة شاحنة سحب")} subtitle={m.t("3 of 5 — Tow trucks", "3 من 5 — شاحنات السحب")}>
      <View style={{ gap: 13 }}>
        {tried && Object.keys(errors).length ? <ProviderNote error>{m.t("Check the highlighted fields.", "راجع الحقول المطلوبة.")}</ProviderNote> : null}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, lineHeight: 20, fontWeight: "600", color: m.ink, textAlign: m.align }}>{m.t("Truck photo", "صورة الشاحنة")}</Text>
          {photo ? <Image source={{ uri: photo }} accessibilityLabel={m.t("Truck photo preview", "معاينة صورة الشاحنة")} style={{ width: "100%", height: 180, borderRadius: 18, backgroundColor: m.border }} resizeMode="cover" /> : null}
          <ProviderButton secondary label={photo ? m.t("Replace photo", "استبدال الصورة") : m.t("Choose photo", "اختيار صورة")} onPress={async () => setPhoto((await pickImage()) ?? photo)} />
          {note("photo")}
        </View>
        <View>
          <MechanicField label={m.t("License plate number", "رقم لوحة الشاحنة")} icon="reader-outline" value={plate} onChangeText={setPlate} maxLength={20} autoCapitalize="characters" />
          {note("plate")}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, lineHeight: 20, fontWeight: "600", color: m.ink, textAlign: m.align }}>{m.t("Truck type", "نوع الشاحنة")}</Text>
          <View style={{ flexDirection: m.row, flexWrap: "wrap", gap: 8 }}>
            {TRUCK_TYPES.map((k) => (
              <ProviderChoice key={k} label={truckTypeLabel(m.t, k)} selected={type === k} onPress={() => setType(k)} />
            ))}
          </View>
          {note("type")}
        </View>
        <View>
          <MechanicField label={m.t("Make", "الصنع")} icon="car-outline" value={make} onChangeText={setMake} maxLength={60} />
          {note("make")}
        </View>
        <View>
          <MechanicField label={m.t("Model", "الطراز")} icon="car-outline" value={model} onChangeText={setModel} maxLength={60} />
          {note("model")}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 12, lineHeight: 20, fontWeight: "600", color: m.ink, textAlign: m.align }}>{m.t("Where this truck operates from", "المكان الذي تعمل منه هذه الشاحنة")}</Text>
          <TowLocationChooser value={place} startCity={draft.city} onChange={setPlace} />
          {note("place")}
        </View>
        <ProviderButton label={existing ? m.t("Save changes", "حفظ التعديلات") : m.t("Save truck", "حفظ الشاحنة")} onPress={save} />
        <ProviderButton secondary label={m.t("Cancel", "إلغاء")} onPress={() => router.back()} />
      </View>
    </MechanicPage>
  );
}
