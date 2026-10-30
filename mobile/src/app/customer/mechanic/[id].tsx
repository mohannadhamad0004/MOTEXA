import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Card, ErrorState, GarageHero, GaragePage, GButton, GIcon, GText, ListRow, Note, Section, SkeletonBlock, StatusChip, StickyActionBar } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { distanceLabel, locationMemory, roundPoint } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { InitialBubble } from "../../../features/requests/garageBits";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

// Public mechanic profile. Only fields MOTEXA verified or the mechanic published; no phone, email or credentials.
// Mechanics have no stored coordinates yet, so the map pin is the city centre and says so.
export default function MechanicProfile() {
  const { g, row, align } = useGarageTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const from = locationMemory.current ? roundPoint(locationMemory.current) : null;
  const state = useLoad(() => mechanicCatalog.get(id, from), [id]);
  const m = state.data;
  // every public mechanic has at least one skill approved by MOTEXA, so the profile counts as verified only when that is true
  const verified = !!m && m.skills.length > 0;

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={
        <GarageHero
          variant="detail"
          onBack={() => (router.canGoBack() ? router.back() : router.navigate("/customer/mechanics"))}
          title={m?.name ?? t("Mechanic", "ميكانيكي")}
          line={m ? `${m.workshopName} · ${cityLabel(m.city, isArabic)}` : undefined}
          visual={m ? <InitialBubble name={m.name} size={72} /> : undefined}
        >
          {verified ? <StatusChip tone="success" icon="shield-checkmark" label={t("Verified by MOTEXA", "موثّق من موتكسا")} /> : null}
        </GarageHero>
      }
      bottom={
        m ? (
          <StickyActionBar>
            <GButton flex icon="construct-outline" label={t("Request service", "اطلب خدمة")} onPress={() => router.push({ pathname: "/customer/mechanicrequest/new", params: { mechanicId: m.id } })} />
          </StickyActionBar>
        ) : undefined
      }
    >
      {state.error && !m ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !m ? (
        <SkeletonBlock height={180} radius={gShape.card} />
      ) : (
        <View>
          <Card pad={12}>
            {m.distanceKm != null ? (
              <ListRow icon="navigate-outline" title={distanceLabel(m.distanceKm, isArabic)} sub={m.distanceSource === "city" ? t("from the city centre", "من مركز المدينة") : undefined} />
            ) : null}
            <ListRow divider={m.distanceKm != null} icon="map-outline" title={t("View on map", "عرض على الخريطة")} onPress={() => router.push({ pathname: "/customer/mechanics/map", params: { focus: m.id } })} />
          </Card>

          <Section title={t("Approved skills", "المهارات المعتمدة")}>
            <Card>
              <GText soft style={[gType.caption, align, { marginBottom: 10 }]}>
                {t("The skills below were reviewed and approved by MOTEXA. Skills that were not approved are never shown.", "راجعت موتكسا المهارات أدناه ووافقت عليها. المهارات التي لم تتم الموافقة عليها لا تُعرض أبدًا.")}
              </GText>
              {m.skills.map((s) => (
                <View key={s} style={[row, { alignItems: "center", gap: 10, minHeight: 40 }]}>
                  <GIcon name="checkmark-circle" size={18} color={g.success} />
                  <GText style={[gType.label, { flex: 1 }, align]}>{skillLabel(s)}</GText>
                </View>
              ))}
            </Card>
          </Section>

          <Section title={t("Workshop", "الورشة")}>
            <Card pad={12}>
              <ListRow icon="business-outline" title={t("Name", "الاسم")} sub={m.workshopName} />
              <ListRow divider icon="location-outline" title={t("Address", "العنوان")} sub={m.workshopAddress} />
              <ListRow divider icon="map-outline" title={t("City", "المدينة")} sub={cityLabel(m.city, isArabic)} />
              {m.yearsOfExperience != null ? <ListRow divider icon="ribbon-outline" title={t("Experience", "الخبرة")} sub={`${m.yearsOfExperience} ${t("years", "سنة")}`} /> : null}
            </Card>
          </Section>

          <View style={{ marginTop: 20 }}>
            <Note icon="chatbubbles-outline">{t("The mechanic answers your request in the app. Contact details are not shown here.", "يرد الميكانيكي على طلبك داخل التطبيق. لا تُعرض بيانات التواصل هنا.")}</Note>
          </View>
        </View>
      )}
    </GaragePage>
  );
}
