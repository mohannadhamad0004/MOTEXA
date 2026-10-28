// Parts shop signup, step 2 of 4: shop location. One account = ONE physical shop / branch, and it MUST have a confirmed real
// latitude + longitude (read from the phone once, or placed on the map, then confirmed). The chooser is the one the tow signup uses.
// Saved only in the in-memory draft; nothing is sent to the server.
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { ProviderButton, ProviderNote } from "./kit";
import { PartsSignupPlace, getPartsSignupDraft, setPartsSignupLocation } from "./partsSignupDraft";
import { TowLocationChooser, validPoint } from "./TowLocationChooser";
import type { TowSignupPlace } from "./towSignupDraft";

export default function PartsSignupStep2() {
  if (!getPartsSignupDraft()) return <Redirect href={"/provider/parts-signup" as never} />; // opened directly: start from step 1
  return <Body />;
}

function Body() {
  const m = useMechanicTheme();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const draft = getPartsSignupDraft()!;
  const had: TowSignupPlace | null =
    draft.lat !== undefined && draft.lng !== undefined ? { baseLat: draft.lat, baseLng: draft.lng, locationAddress: draft.locationAddress ?? null, locationSource: draft.locationSource ?? "manual" } : null;
  const [place, setPlace] = useState<TowSignupPlace | null>(had);
  const ok = !!place && validPoint({ lat: place.baseLat, lng: place.baseLng });

  return (
    <MechanicPage back title={m.t("Set your shop location", "حدّد موقع متجرك")} subtitle={m.t("2 of 5 — Shop location", "2 من 5 — موقع المتجر")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 1 ? "#B18350" : m.border }} />
        ))}
      </View>
      <View style={{ gap: 13 }}>
        <ProviderNote>{m.t("Choose the physical location of this shop or branch. Customers and MOTEXA admins will use this location to identify the shop.", "اختر الموقع الفعلي لهذا المتجر أو الفرع. سيستخدم العملاء ومسؤولو MOTEXA هذا الموقع للتعرّف على المتجر.")}</ProviderNote>
        <TowLocationChooser
          value={had}
          startCity={draft.city}
          onChange={(p) => {
            setPlace(p);
            if (p) {
              const v: PartsSignupPlace = { lat: p.baseLat, lng: p.baseLng, locationAddress: p.locationAddress, locationSource: p.locationSource };
              setPartsSignupLocation(v);
            }
          }}
        />
        <ProviderButton label={from === "review" ? m.t("Save and return to review", "حفظ والعودة إلى المراجعة") : m.t("Continue to categories", "المتابعة إلى الفئات")} disabled={!ok} onPress={() => (from === "review" ? router.back() : router.push("/provider/parts-signup/categories" as never))} />
        <ProviderButton secondary label={m.t("Back", "رجوع")} onPress={() => router.back()} />
        <Text style={{ fontSize: 12, lineHeight: 19, color: m.muted, textAlign: m.align }}>
          {m.t("This location is only for this shop or branch. Typing an address or choosing a city is not enough: the shop needs a confirmed point on the map.", "هذا الموقع خاص بهذا المتجر أو الفرع فقط. كتابة عنوان أو اختيار مدينة لا يكفي: يحتاج المتجر إلى نقطة مؤكدة على الخريطة.")}
        </Text>
      </View>
    </MechanicPage>
  );
}
