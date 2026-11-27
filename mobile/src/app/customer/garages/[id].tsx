import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Card, ErrorState, GaragePage, HeroLayout, GButton, GIcon, GText, ListRow, Note, Section, SkeletonBlock, StatusChip, StickyActionBar } from "../../../components/garage";
import { cityLabel } from "../../../core/constants/cities";
import { distanceLabel, locationMemory, roundPoint } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useLoad } from "../../../core/hooks/useLoad";
import { useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { garageCatalog } from "../../../features/mechanics/mechanicsService";
import { MAPS_AVAILABLE, PinMap } from "../../../features/shared/maps";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

// A verified garage as customers see it: services, hours, its pin (rounded to ~100 m), its approved mechanics (first name, skills,
// free now). "Request this garage" lets the owner pick the mechanic; a mechanic row opens that mechanic to ask him directly.
// Never a phone, email or a mechanic's live point.
export default function GarageProfile() {
  const { g, row, align } = useGarageTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const from = locationMemory.current ? roundPoint(locationMemory.current) : null;
  const state = useLoad(() => garageCatalog.get(id, from), [id]);
  const x = state.data;
  const name = x ? (isArabic && x.nameAr ? x.nameAr : x.name) : t("Garage", "كراج");

  return (
    <GaragePage
      onRefresh={state.reload}
      refreshing={state.loading && !!state.data}
      hero={
        <HeroLayout
          config={{
            tab: "mechanics",
            title: name,
            line: x ? [cityLabel(x.city, isArabic), x.open24h ? t("Open 24/7", "مفتوح 24/7") : x.workingHours].filter(Boolean).join(" · ") : undefined,
            top: { label: t("Garage", "كراج"), back: () => (router.canGoBack() ? router.back() : router.navigate("/customer/mechanics")), actions: [] },
          }}
        />
      }
      bottom={
        x ? (
          <StickyActionBar>
            <GButton flex icon="construct-outline" label={t("Request this garage", "اطلب من هذا الكراج")} onPress={() => router.push({ pathname: "/customer/mechanicrequest/new", params: { garageId: x.id } })} />
          </StickyActionBar>
        ) : undefined
      }
    >
      {state.error && !x ? (
        <ErrorState text={state.error} onRetry={state.reload} retryLabel={t("Retry", "إعادة المحاولة")} />
      ) : !x ? (
        <SkeletonBlock height={180} radius={gShape.card} />
      ) : (
        <View>
          <View style={[row, { flexWrap: "wrap", gap: 8, marginBottom: 12 }]}>
            <StatusChip tone="success" icon="shield-checkmark" label={t("Verified by MOTEXA", "موثّق من موتكسا")} />
            <StatusChip tone={x.freeCount ? "success" : "neutral"} label={`${x.freeCount}/${x.mechanicsCount} ${t("free now", "متاح الآن")}`} />
          </View>
          {x.description ? <GText style={[gType.bodySm, align, { marginBottom: 12 }]}>{x.description}</GText> : null}

          <Card pad={12}>
            {x.distanceKm != null ? <ListRow icon="navigate-outline" title={distanceLabel(x.distanceKm, isArabic)} sub={x.distanceSource === "city" ? t("from the city centre", "من مركز المدينة") : undefined} /> : null}
            {x.address ? <ListRow divider={x.distanceKm != null} icon="location-outline" title={t("Address", "العنوان")} sub={x.address} /> : null}
            <ListRow divider={x.distanceKm != null || !!x.address} icon="time-outline" title={t("Working hours", "ساعات العمل")} sub={x.open24h ? t("Open 24/7", "مفتوح 24/7") : x.workingHours ?? t("Not given", "غير محددة")} />
          </Card>
          {MAPS_AVAILABLE && x.pin ? (
            <View style={{ marginTop: 12, borderRadius: gShape.card, overflow: "hidden" }}>
              <PinMap point={x.pin} />
              <GText soft style={[gType.tiny, align, { marginTop: 6 }]}>{t("The pin is approximate (about 100 m).", "الدبوس تقريبي (حوالي 100 م).")}</GText>
            </View>
          ) : null}

          <Section title={t("Services", "الخدمات")}>
            <Card>
              {x.services.map((s) => (
                <View key={s} style={[row, { alignItems: "center", gap: 10, minHeight: 40 }]}>
                  <GIcon name="checkmark-circle" size={18} color={g.success} />
                  <GText style={[gType.label, { flex: 1 }, align]}>{skillLabel(s)}</GText>
                </View>
              ))}
            </Card>
          </Section>

          <Section title={`${t("Mechanics", "الميكانيكيون")} · ${x.mechanics.length}`}>
            {x.mechanics.length ? (
              <Card pad={12}>
                {x.mechanics.map((m, i) => (
                  <ListRow
                    key={m.id}
                    divider={i > 0}
                    title={m.name}
                    sub={m.skills.map(skillLabel).join(" · ") || undefined}
                    icon="person-outline"
                    end={m.free ? <StatusChip tone="success" label={t("Free", "متاح")} /> : undefined}
                    onPress={() => router.push(`/customer/mechanic/${m.id}`)}
                  />
                ))}
              </Card>
            ) : (
              <Note>{t("This garage has no approved mechanic yet. You can still send a request; the garage answers it.", "لا يوجد ميكانيكي معتمد في هذا الكراج بعد. يمكنك إرسال طلب وسيرد الكراج عليه.")}</Note>
            )}
          </Section>

          <View style={{ marginTop: 20 }}>
            <Note icon="chatbubbles-outline">{t("The garage answers your request in the app and assigns one of its mechanics. Contact details are not shown here.", "يرد الكراج على طلبك داخل التطبيق ويسند أحد ميكانيكييه. لا تُعرض بيانات التواصل هنا.")}</Note>
          </View>
        </View>
      )}
    </GaragePage>
  );
}
