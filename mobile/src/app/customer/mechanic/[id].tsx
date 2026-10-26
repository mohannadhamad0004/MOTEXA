import { router, useLocalSearchParams } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BackButton,
  BlueprintPage,
  BlueprintSurface,
  COMPACT_OVERLAP,
  Icon,
  InspectionCheck,
  MechanicAvatar,
  Rise,
  Row,
  Section,
  StickyActionBar,
  Tag,
  useHeroStatusBar,
} from "../../../components/blueprint";
import { Async, Notice } from "../../../components/ui/Feedback";
import { Text } from "../../../components/ui/Text";
import { cityLabel } from "../../../core/constants/cities";
import { distanceLabel, locationMemory, roundPoint } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { M } from "../../../motion";
import { alpha } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

/** Compact dark hero (160 px): tags, the name and workshop with the public verification line, a profile mark on the end side. */
function DetailHero({ name, workshop, city, verified }: { name?: string; workshop?: string; city?: string; verified: boolean }) {
  const insets = useSafeAreaInsets();
  const { c, row, isArabic, align } = useTheme();
  const { t } = useL();
  useHeroStatusBar();
  return (
    <BlueprintSurface style={{ height: insets.top + 172 }}>
      <View style={{ position: "absolute", left: 20, right: 20, top: insets.top + 18, flexDirection: isArabic ? "row-reverse" : "row", justifyContent: "space-between", gap: 12 }}>
        <View style={[{ flexShrink: 1 }, isArabic ? { marginRight: 52 } : { marginLeft: 52 }]}>
          <Tag color={alpha(c.cream, 0.7)} align={isArabic ? "right" : "left"}>MECHANICS / 04</Tag>
        </View>
        <View style={{ maxWidth: "40%" }}>{city ? <Tag color={c.bronzeLight} align={isArabic ? "left" : "right"}>{city}</Tag> : null}</View>
      </View>
      <View style={[row, { position: "absolute", left: 20, right: 20, top: insets.top + 64, bottom: 34, alignItems: "center", gap: 14 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={[{ color: c.cream, fontSize: 24, fontWeight: "700", lineHeight: isArabic ? 33 : 28 }, align]}>{name ?? ""}</Text>
          {workshop ? <Text numberOfLines={2} style={[{ color: alpha(c.cream, 0.75), fontSize: 14, marginTop: 2 }, align]}>{workshop}</Text> : null}
          {verified ? (
            <View style={[row, { alignItems: "center", gap: 6, marginTop: 8 }]}>
              <InspectionCheck size={16} color={c.bronzeLight} delay={M.entrance} />
              <Text style={{ color: c.bronzeLight, fontSize: 12, fontWeight: "700" }}>{t("Verified by MOTEXA", "موثّق من موتكسا")}</Text>
            </View>
          ) : null}
        </View>
        <MechanicAvatar size={72} />
      </View>
      <BackButton fallback="/customer/mechanics" />
    </BlueprintSurface>
  );
}

// Public mechanic profile. Only fields MOTEXA verified or the mechanic published; no phone, email or credentials.
// Mechanics have no stored coordinates yet, so the map pin is the city centre and says so.
export default function MechanicProfile() {
  const { c, row, align } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const from = locationMemory.current ? roundPoint(locationMemory.current) : null;
  const state = useLoad(() => mechanicCatalog.get(id, from), [id]);
  const m = state.data;
  // every public mechanic has at least one skill approved by MOTEXA, so the profile counts as verified only when that is true
  const verified = !!m && m.skills.length > 0;
  const rail = { borderStartWidth: 2, borderStartColor: c.bronze, paddingStart: 12 } as const;

  return (
    <BlueprintPage
      overlap={COMPACT_OVERLAP}
      top={<DetailHero name={m?.name} workshop={m?.workshopName} city={m ? cityLabel(m.city, isArabic) : undefined} verified={verified} />}
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      footer={m ? <StickyActionBar icon="mech" label={t("Request service", "اطلب خدمة")} onPress={() => router.push({ pathname: "/customer/mechanicrequest/new", params: { mechanicId: m.id } })} /> : undefined}
    >
      <Async state={state}>
        {(m) => (
          <>
            {m.distanceKm != null ? (
              <Text style={[{ color: c.bronze, fontSize: 13, fontWeight: "700" }, align]}>
                {distanceLabel(m.distanceKm, isArabic)}
                {m.distanceSource === "city" ? ` · ${t("from the city centre", "من مركز المدينة")}` : ""}
              </Text>
            ) : null}
            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: "/customer/mechanics/map", params: { focus: m.id } })} hitSlop={8} style={[row, { alignItems: "center", gap: 6, minHeight: 44 }]}>
              <Icon name="map" size={16} color={c.bronze} />
              <Text style={{ color: c.bronze, fontSize: 13, fontWeight: "700" }}>{t("Show on map", "عرض على الخريطة")}</Text>
            </Pressable>

            <Section n="01" title={t("Verification", "التوثيق")}>
              <View style={rail}>
                <View style={[row, { alignItems: "center", gap: 8 }]}>
                  <InspectionCheck size={20} color={c.bronze} delay={M.entrance} />
                  <Text style={[{ flex: 1, color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{t("Verified by MOTEXA", "موثّق من موتكسا")}</Text>
                </View>
                <Text style={[{ color: c.soft, fontSize: 13, lineHeight: 19, marginTop: 6 }, align]}>
                  {t("The skills below were reviewed and approved by MOTEXA. Skills that were not approved are never shown.", "راجعت موتكسا المهارات أدناه ووافقت عليها. المهارات التي لم تتم الموافقة عليها لا تُعرض أبدًا.")}
                </Text>
              </View>
            </Section>

            <Section n="02" title={t("Approved skills", "المهارات المعتمدة")}>
              <View style={rail}>
                {m.skills.map((s, k) => (
                  <Rise key={s} i={0} delay={M.entrance + k * M.staggerFine} distance={6}>
                    <View style={[row, { alignItems: "center", gap: 10, minHeight: 40 }]}>
                      <InspectionCheck size={16} color={c.bronze} delay={M.entrance + k * M.staggerFine} />
                      <Text style={[{ flex: 1, color: c.ink, fontSize: 15, fontWeight: "600" }, align]}>{skillLabel(s)}</Text>
                    </View>
                  </Rise>
                ))}
              </View>
            </Section>

            <Section n="03" title={t("Workshop", "الورشة")}>
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
    </BlueprintPage>
  );
}
