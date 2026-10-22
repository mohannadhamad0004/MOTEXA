import { Async, Notice } from "../../../components/ui/Feedback";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Header } from "../../../components/layout/DashboardLayout";
import { KV } from "../../../components/ui/Rows";
import { SectionHeader } from "../../../components/ui/SectionHeader";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { cityLabel } from "../../../core/constants/cities";
import { distanceLabel, locationMemory, roundPoint } from "../../../core/constants/geo";
import { InitialAvatar, VerifiedBadge, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { mechanicCatalog } from "../../../features/mechanics/mechanicsService";

// Public mechanic profile. Only fields MOTEXA verified or the mechanic published; no phone, email or credentials.
// There is no map: MOTEXA does not store workshop coordinates yet, so no pin is drawn rather than a made-up one.
export default function MechanicProfile() {
  const { c: col } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, row, align, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const from = locationMemory.current ? roundPoint(locationMemory.current) : null;
  const state = useLoad(() => mechanicCatalog.get(id, from), [id]);

  return (
    <Screen onRefresh={state.reload} refreshing={state.loading && !!state.data}>
      <Header brand="MOTEXA" title={t("Mechanic", "الميكانيكي")} back />
      <Async state={state}>
        {(m) => (
          <>
            <Card>
              <View style={[row, { alignItems: "center", gap: 14 }]}>
                <InitialAvatar name={m.name} size={60} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2} style={[{ color: col.text, fontSize: 20, fontWeight: "800" }, align]}>{m.name}</Text>
                  <Text numberOfLines={2} style={[{ color: col.textMuted, fontSize: 13, marginTop: 3 }, align]}>{m.workshopName}</Text>
                </View>
              </View>
              <View style={[row, { flexWrap: "wrap", gap: 6, marginTop: 14 }]}>
                <VerifiedBadge />
                <Badge tone="neutral" icon="location-outline" label={cityLabel(m.city, isArabic)} />
              </View>
              {m.distanceKm != null ? (
                <Text style={[{ color: col.accent, fontSize: 12, fontWeight: "800", marginTop: 12 }, align]}>
                  {distanceLabel(m.distanceKm, isArabic)}
                  {m.distanceSource === "city" ? ` · ${t("from the city centre", "من مركز المدينة")}` : ""}
                </Text>
              ) : null}
            </Card>

            <SectionHeader title={t("Skills approved by MOTEXA", "مهارات معتمدة من MOTEXA")} />
            <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>
              {m.skills.map((s) => (
                <Badge key={s} tone="accent" icon="checkmark-circle-outline" label={skillLabel(s)} />
              ))}
            </View>

            <SectionHeader title={t("Workshop", "الورشة")} />
            <Card>
              <KV k={t("Name", "الاسم")} v={m.workshopName} />
              <KV k={t("Address", "العنوان")} v={m.workshopAddress} />
              <KV k={t("City", "المدينة")} v={cityLabel(m.city, isArabic)} />
              {m.yearsOfExperience != null ? <KV k={t("Experience", "الخبرة")} v={`${m.yearsOfExperience} ${t("years", "سنة")}`} /> : null}
            </Card>

            <Button icon="construct-outline" label={t("Request service", "اطلب خدمة")} onPress={() => router.push({ pathname: "/customer/mechanicrequest/new", params: { mechanicId: m.id } })} />
            <View style={{ height: 12 }} />
            <Notice icon="information-circle-outline">
              {t("The mechanic answers your request in the app. Contact details are not shown here.", "يرد الميكانيكي على طلبك داخل التطبيق. لا تُعرض بيانات التواصل هنا.")}
            </Notice>
          </>
        )}
      </Async>
    </Screen>
  );
}
