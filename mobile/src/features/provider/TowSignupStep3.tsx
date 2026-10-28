// Tow company signup, step 3 of 5: tow trucks. At least ONE valid truck is required; a company may register several, each with its own
// operating location. The list is read from the in-memory draft; the add / edit form is its own screen. Nothing is sent to the server.
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, View } from "react-native";
import { MechanicPage, useMechanicTheme } from "../../components/MechanicUI";
import { Text } from "../../components/MotexaVisual";
import { DButton, Pill, cardStyle, useDT } from "../department/ui";
import { truckTypeLabel } from "../department/departments";
import { fmtPoint } from "../department/LocationRow";
import { ProviderButton, ProviderNote } from "./kit";
import { getTowSignupDraft, removeTowSignupTruck } from "./towSignupDraft";

export default function TowSignupStep3() {
  const d = getTowSignupDraft();
  if (!d) return <Redirect href={"/provider/tow-signup" as never} />;
  if (d.baseLat === undefined) return <Redirect href={"/provider/tow-signup/location" as never} />; // step 2 not done
  return <Body />;
}

function Body() {
  const m = useMechanicTheme();
  const dt = useDT();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const [, bump] = useState(0);
  useFocusEffect(useCallback(() => bump((n) => n + 1), [])); // coming back from the editor: re-read the draft
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const trucks = getTowSignupDraft()?.trucks ?? [];
  const edit = (id?: string) => router.push((id ? `/provider/tow-signup/truck?id=${id}` : "/provider/tow-signup/truck") as never);

  return (
    <MechanicPage back title={m.t("Tow trucks", "شاحنات السحب")} subtitle={m.t("3 of 5 — Tow trucks", "3 من 5 — شاحنات السحب")}>
      <View style={{ flexDirection: m.row, gap: 6, marginTop: -8, marginBottom: 14 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= 2 ? "#B18350" : m.border }} />
        ))}
      </View>
      <View style={{ gap: 13 }}>
        <ProviderNote>{m.t("Add the tow trucks operated by your company. Each truck can have its own operating location.", "أضف شاحنات السحب التي تشغّلها شركتك. يمكن لكل شاحنة أن يكون لها موقع تشغيل خاص بها.")}</ProviderNote>
        {trucks.length === 0 ? (
          <View style={{ ...cardStyle(dt), padding: 16, alignItems: "center", gap: 6 }}>
            <Ionicons name="car-sport-outline" size={28} color={dt.accent} />
            <Text style={{ color: dt.ink, fontSize: 14, fontWeight: "700", textAlign: "center" }}>{m.t("No tow trucks yet", "لا توجد شاحنات بعد")}</Text>
            <Text style={{ color: dt.muted, fontSize: 12, lineHeight: 19, textAlign: "center" }}>{m.t("You need at least one tow truck to continue.", "تحتاج إلى شاحنة سحب واحدة على الأقل للمتابعة.")}</Text>
          </View>
        ) : (
          trucks.map((t) => (
            <View key={t.localId} style={{ ...cardStyle(dt), padding: 12, gap: 10 }}>
              <View style={{ flexDirection: m.row, gap: 12, alignItems: "center" }}>
                <Image source={{ uri: t.photoUri }} accessibilityLabel={m.t("Truck photo", "صورة الشاحنة")} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: dt.border }} resizeMode="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: dt.ink, fontSize: 15, lineHeight: 22, fontWeight: "800", textAlign: m.align }}>{"⁦" + t.plateNumber + "⁩"}</Text>
                  <Text numberOfLines={1} style={{ color: dt.muted, fontSize: 12, lineHeight: 18, textAlign: m.align }}>{[t.make, t.model].join(" ")} · {truckTypeLabel(m.t, t.truckType)}</Text>
                  <Text numberOfLines={2} style={{ color: dt.muted, fontSize: 12, lineHeight: 18, textAlign: m.align, writingDirection: t.locationAddress ? undefined : "ltr" }}>{t.locationAddress ?? fmtPoint(t.baseLat, t.baseLng)}</Text>
                </View>
              </View>
              <View style={{ flexDirection: m.row, flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <Pill tone="ok" icon="checkmark-circle-outline" label={m.t("Location confirmed", "تم تأكيد الموقع")} />
              </View>
              <View style={{ flexDirection: m.row, gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <DButton variant="ghost" icon="create-outline" label={m.t("Edit", "تعديل")} onPress={() => edit(t.localId)} />
                </View>
                <View style={{ flex: 1 }}>
                  {confirmId === t.localId ? (
                    <DButton variant="ghost" icon="trash-outline" label={m.t("Tap to remove", "المس للحذف")} onPress={() => { removeTowSignupTruck(t.localId); setConfirmId(null); }} />
                  ) : (
                    <DButton variant="ghost" icon="trash-outline" label={m.t("Remove", "حذف")} onPress={() => setConfirmId(t.localId)} />
                  )}
                </View>
              </View>
            </View>
          ))
        )}
        <DButton variant="ghost" icon="add-circle-outline" label={m.t("+ Add tow truck", "+ إضافة شاحنة سحب")} onPress={() => edit()} />
        <ProviderButton label={from === "review" ? m.t("Save and return to review", "حفظ والعودة إلى المراجعة") : m.t("Continue to documents", "المتابعة إلى المستندات")} disabled={trucks.length === 0} onPress={() => (from === "review" ? router.back() : router.push("/provider/tow-signup/documents" as never))} />
        <ProviderButton secondary label={m.t("Back", "رجوع")} onPress={() => router.back()} />
      </View>
    </MechanicPage>
  );
}
