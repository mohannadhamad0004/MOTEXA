// Tow company signup, step 2 of 5: company location. The base location is REQUIRED and is a real latitude + longitude (read from the
// phone once, or placed on the map) that the owner confirms. Saved only in the in-memory draft; nothing is sent to the server.
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { ProviderButton, ProviderNote } from "./kit";
import { TowLocationChooser, validPoint } from "./TowLocationChooser";
import { TowSignupPlace, getTowSignupDraft, setTowSignupLocation } from "./towSignupDraft";

export default function TowSignupStep2() {
  if (!getTowSignupDraft()) return <Redirect href={"/provider/tow-signup" as never} />; // opened directly: start from step 1
  return <Body />;
}

function Body() {
  const m = useMechanicTheme();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const draft = getTowSignupDraft()!;
  const had: TowSignupPlace | null =
    draft.baseLat !== undefined && draft.baseLng !== undefined ? { baseLat: draft.baseLat, baseLng: draft.baseLng, locationAddress: draft.locationAddress ?? null, locationSource: draft.locationSource ?? "manual" } : null;
  const [place, setPlace] = useState<TowSignupPlace | null>(had);
  const ok = !!place && validPoint({ lat: place.baseLat, lng: place.baseLng });

  return (
    <MechanicPage back title={m.t("Company location", "موقع الشركة")} subtitle={m.t("2 of 5 — Company location", "2 من 5 — موقع الشركة")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 1 ? "#B18350" : m.border }} />
        ))}
      </View>
      <View style={{ gap: 13 }}>
        <ProviderNote>{m.t("Set the main location of your towing company. Each tow truck can have its own operating location later.", "حدّد الموقع الرئيسي لشركة السحب. يمكن لكل شاحنة سحب أن يكون لها موقع تشغيل خاص لاحقًا.")}</ProviderNote>
        <TowLocationChooser
          value={had}
          startCity={draft.city}
          onChange={(p) => {
            setPlace(p);
            if (p) setTowSignupLocation(p);
          }}
        />
        <ProviderButton label={from === "review" ? m.t("Save and return to review", "حفظ والعودة إلى المراجعة") : m.t("Continue to tow trucks", "المتابعة إلى شاحنات السحب")} disabled={!ok} onPress={() => (from === "review" ? router.back() : router.push("/provider/tow-signup/trucks" as never))} />
        <ProviderButton secondary label={m.t("Back", "رجوع")} onPress={() => router.back()} />
        <Text style={{ fontSize: 12, lineHeight: 19, color: m.muted, textAlign: m.align }}>{m.t("Typing an address or choosing a city is not enough: the company needs a confirmed point on the map.", "كتابة عنوان أو اختيار مدينة لا يكفي: تحتاج الشركة إلى نقطة مؤكدة على الخريطة.")}</Text>
      </View>
    </MechanicPage>
  );
}
