import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { Avatar, Icon, Pill, Rise, Row, Section, SimplePage, Stamp, StickyActionBar } from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { Text } from "../../../components/ui/Text";
import { cityLabel } from "../../../core/constants/cities";
import { distanceLabel, locationMemory, roundPoint } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { M } from "../../../motion";
import { useTheme } from "../../../theme/useTheme";

// Public mechanic profile. Only fields MOTEXA verified or the mechanic published; no phone, email or credentials.
// There is no map: MOTEXA does not store workshop coordinates yet, so no pin is drawn rather than a made-up one.
export default function MechanicProfile() {
  const { c, row, align } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const from = locationMemory.current ? roundPoint(locationMemory.current) : null;
  const state = useLoad(() => mechanicCatalog.get(id, from), [id]);
  const m = state.data;

  return (
    <SimplePage
      kind="wrench"
      back="/customer/mechanics"
      tl="MECHANICS / 04"
      tr={m ? cityLabel(m.city, isArabic) : undefined}
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      footer={m ? <StickyActionBar icon="mech" label={t("Request service", "اطلب خدمة")} onPress={() => router.push({ pathname: "/customer/mechanicrequest/new", params: { mechanicId: m.id } })} /> : undefined}
    >
      <Async state={state}>
        {(m) => (
          <>
            <View style={[row, { alignItems: "center", gap: 16 }]}>
              <Avatar name={m.name} size={64} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 26, fontWeight: "700", lineHeight: isArabic ? 34 : 29 }, align]}>{m.name}</Text>
                <Text numberOfLines={2} style={[{ color: c.soft, fontSize: 14, marginTop: 2 }, align]}>{m.workshopName}</Text>
              </View>
              <Stamp label={t("Verified", "موثّق")} delay={M.entrance + m.skills.length * M.staggerFine + 100} />
            </View>
            <View style={[row, { flexWrap: "wrap", gap: 8, marginTop: 16 }]}>
              <Pill icon={<Icon name="shield" size={14} color={c.bronze} />}>{t("Verified by MOTEXA", "موثّق من موتكسا")}</Pill>
              <Pill icon={<Icon name="pin" size={14} color={c.bronze} />}>{cityLabel(m.city, isArabic)}</Pill>
            </View>
            {m.distanceKm != null ? (
              <Text style={[{ color: c.bronze, fontSize: 13, fontWeight: "700", marginTop: 12 }, align]}>
                {distanceLabel(m.distanceKm, isArabic)}
                {m.distanceSource === "city" ? ` · ${t("from the city centre", "من مركز المدينة")}` : ""}
              </Text>
            ) : null}


            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/customer/mechanics/map", params: { focus: m.id } })} hitSlop={8} style={[row, { alignItems: "center", gap: 6, minHeight: 44 }]}>
              <Icon name="map" size={16} color={c.bronze} />
              <Text style={{ color: c.bronze, fontSize: 13, fontWeight: "700" }}>{t("Show on map", "عرض على الخريطة")}</Text>
            </Pressable>

            <Section n="01" title={t("Skills approved by MOTEXA", "مهارات معتمدة من موتكسا")}>
              <View style={[row, { flexWrap: "wrap", gap: 8 }]}>
                {m.skills.map((s, k) => (
                  <Rise key={s} i={0} delay={M.entrance + k * M.staggerFine} distance={4}>
                    <Pill icon={<Icon name="check" size={14} color={c.bronze} />}>{skillLabel(s)}</Pill>
                  </Rise>
                ))}
              </View>
            </Section>

            <Section n="02" title={t("Workshop", "الورشة")}>
              <Row label={t("Name", "الاسم")} value={m.workshopName} />
              <Row label={t("Address", "العنوان")} value={m.workshopAddress} />
              <Row label={t("City", "المدينة")} value={cityLabel(m.city, isArabic)} />
              {m.yearsOfExperience != null ? <Row label={t("Experience", "الخبرة")} value={`${m.yearsOfExperience} ${t("years", "سنة")}`} /> : null}
            </Section>

            <View style={{ marginTop: 24 }}>
              <Notice icon="information-circle-outline">
                {t("The mechanic answers your request in the app. Contact details are not shown here.", "يرد الميكانيكي على طلبك داخل التطبيق. لا تُعرض بيانات التواصل هنا.")}
              </Notice>
            </View>
          </>
        )}
      </Async>
    </SimplePage>
  );
}
