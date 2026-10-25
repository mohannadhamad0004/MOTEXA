import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Avatar, BlueprintPage, Chip, HStrip, HeroIconButton, Ltr, PageTitle, Press, PrimaryButton, Rise, SearchField, Stamp, Sub, Wrench } from "../../../components/blueprint";
import { Button } from "../../../components/ui/Button";
import { EmptyState, Notice } from "../../../components/ui/Feedback";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { Text } from "../../../components/ui/Text";
import { CITIES, cityLabel } from "../../../core/constants/cities";
import { Point, locationMemory, roundPoint } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { SkillBadges, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MECHANIC_SKILLS, MechanicRow, mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { useTheme } from "../../../theme/useTheme";

export default function CustomerMechanics() {
  const { c, row, align } = useTheme();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [skill, setSkill] = useState<string | null>(null);
  const [skillOpen, setSkillOpen] = useState(false);
  // Your position: read only when you tap the button, kept in memory for this session, never tracked.
  const [me, setMe] = useState<Point | null>(locationMemory.current);
  const loc = useCurrentLocation();
  const filtered = !!(name.trim() || city || skill);

  const [items, setItems] = useState<MechanicRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const seq = useRef(0);

  const run = useCallback(
    async (mode: "replace" | "refresh" | "more") => {
      const mine = ++seq.current;
      const next = mode === "more" ? page + 1 : 1;
      if (mode === "refresh") setRefreshing(true);
      else if (mode === "more") setMore(true);
      else setLoading(true);
      setError(null);
      try {
        const p = me ? roundPoint(me) : null;
        const r = await mechanicCatalog.list({ q: name.trim(), city, skill: skill ?? undefined, page: next, ...(p ? { lat: p.lat, lng: p.lng, sort: "nearest" as const } : {}) });
        if (mine !== seq.current) return;
        setItems((cur) => (mode === "more" ? [...cur, ...r.mechanics] : r.mechanics));
        setPage(r.page);
        setHasMore(r.hasMore);
        setTotal(r.total);
      } catch (e: any) {
        if (mine === seq.current) setError(e.message);
      } finally {
        if (mine === seq.current) {
          setLoading(false);
          setRefreshing(false);
          setMore(false);
        }
      }
    },
    [name, city, skill, me, page]
  );
  // `run` changes with `page`; the effect must only react to the filters, so it keeps its own reference.
  const runRef = useRef(run);
  runRef.current = run;
  useEffect(() => {
    const h = setTimeout(() => runRef.current("replace"), 350);
    return () => clearTimeout(h);
  }, [name, city, skill, me]);

  useEffect(() => {
    mechanicCatalog.skills().then((s) => setCounts(Object.fromEntries(s.map((x) => [x.key, x.count])))).catch(() => {});
  }, []);

  const toggleNear = async () => {
    if (me) {
      locationMemory.current = null;
      setMe(null);
      return;
    }
    const p = await loc.locate();
    if (p) setMe(p);
  };
  const showAll = () => {
    setName("");
    setCity("");
    setSkill(null);
  };

  return (
    <BlueprintPage
      tabs
      refreshing={refreshing}
      onRefresh={() => run("refresh")}
      hero={{
        height: 260,
        tl: "MECHANICS / 04",
        tr: t("Verified by MOTEXA", "موثّق من موتكسا"),
        right: <HeroIconButton icon="map" label={t("View on map", "عرض على الخريطة")} onPress={() => router.push("/customer/mechanics/map")} />,
        art: (
          <View style={{ height: "100%", aspectRatio: 1.6 }}>
            <Wrench animate />
          </View>
        ),
      }}
    >
      {loc.dialog}
      <PageTitle>{t("Mechanics", "الميكانيكيون")}</PageTitle>
      <Sub>{t("Workshops checked in person by our team.", "ورش زارها فريقنا وتحقق منها.")}</Sub>
      <SearchField style={{ marginTop: 24 }} value={name} onChangeText={setName} placeholder={t("Mechanic or workshop name", "اسم الميكانيكي أو الورشة")} />
      <View style={{ marginTop: 16 }}>
        <HStrip>
          <Chip label={city ? cityLabel(city, isArabic) : t("City", "المدينة")} trailing="down" on={!!city || cityOpen} onPress={() => setCityOpen(!cityOpen)} />
          <Chip label={skill ? skillLabel(skill) : t("Skill", "الاختصاص")} trailing="down" on={!!skill || skillOpen} onPress={() => setSkillOpen(!skillOpen)} />
          <Chip icon="pin" label={loc.locating ? t("Finding…", "جارٍ التحديد…") : t("Near me", "بالقرب مني")} on={!!me} onPress={toggleNear} />
        </HStrip>
      </View>
      <LocationProblem loc={loc} />
      <View style={{ marginTop: 12 }}>
        <PrimaryButton variant="outline" icon="map" label={t("View on map", "عرض على الخريطة")} onPress={() => router.push("/customer/mechanics/map")} />
      </View>
      {cityOpen ? (
        <View style={{ marginTop: 12 }}>
          <HStrip>
            <Chip label={t("All cities", "كل المدن")} on={!city} onPress={() => { setCity(""); setCityOpen(false); }} />
            {CITIES.map((x) => (
              <Chip
                key={x.name}
                label={cityLabel(x.name, isArabic)}
                on={city === x.name}
                onPress={() => {
                  setCity(city === x.name ? "" : x.name);
                  setCityOpen(false);
                }}
              />
            ))}
          </HStrip>
        </View>
      ) : null}
      {skillOpen ? (
        <View style={{ marginTop: 12 }}>
          <HStrip>
            <Chip label={t("All skills", "كل الاختصاصات")} on={skill === null} onPress={() => { setSkill(null); setSkillOpen(false); }} />
            {MECHANIC_SKILLS.map((k) => (
              <Chip
                key={k}
                label={counts[k] !== undefined ? `${skillLabel(k)} (${counts[k]})` : skillLabel(k)}
                on={skill === k}
                onPress={() => {
                  setSkill(skill === k ? null : k);
                  setSkillOpen(false);
                }}
              />
            ))}
          </HStrip>
        </View>
      ) : null}

      {error && items.length ? (
        <View style={{ gap: 8, marginTop: 16 }}>
          <Notice tone="danger" icon="alert-circle-outline">{t("Could not refresh. The results below may be out of date.", "تعذّر التحديث. قد تكون النتائج أدناه قديمة.")}</Notice>
          <Button variant="ghost" icon="refresh-outline" label={t("Retry", "إعادة المحاولة")} onPress={() => run("replace")} />
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        {loading && !items.length ? (
          <SkeletonList />
        ) : error && !items.length ? (
          <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
            <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
            <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run("replace")} />
          </View>
        ) : !items.length ? (
          <>
            <EmptyState icon="build-outline" text={filtered ? t("No mechanics match your search yet.", "لا يوجد ميكانيكيون يطابقون بحثك بعد.") : t("No verified mechanics are available yet.", "لا يوجد ميكانيكيون موثّقون بعد.")} />
            {filtered ? <Button variant="ghost" icon="close-circle-outline" label={t("Show all", "عرض الكل")} onPress={showAll} /> : null}
          </>
        ) : (
          <>
            <Text style={[{ color: c.soft, fontSize: 12, marginBottom: 4 }, align]}>
              {total} {total === 1 ? t("mechanic", "ميكانيكي") : t("mechanics", "ميكانيكيين")}
            </Text>
            {items.map((m, i) => (
              <Rise key={m.id} i={i}>
                <Press
                  accessibilityLabel={m.name}
                  onPress={() => router.push(`/customer/mechanic/${m.id}`)}
                  style={[row, { alignItems: "center", gap: 16, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: c.line + "99" }]}
                >
                  <Avatar name={m.name} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={[{ color: c.ink, fontSize: 16, fontWeight: "700" }, align]}>{m.name}</Text>
                    <Text numberOfLines={1} style={[{ color: c.soft, fontSize: 13 }, align]}>{m.workshopName}</Text>
                    <View style={[row, { alignItems: "center", gap: 4 }]}>
                      <Text numberOfLines={1} style={{ color: c.soft, fontSize: 12, flexShrink: 1 }}>{cityLabel(m.city, isArabic)}</Text>
                      {m.distanceKm != null ? (
                        <Ltr style={{ color: c.soft, fontSize: 12 }}>{` · ≈ ${m.distanceKm < 1 ? "<1" : m.distanceKm < 10 ? m.distanceKm.toFixed(1) : Math.round(m.distanceKm)} ${isArabic ? "كم" : "km"}`}</Ltr>
                      ) : null}
                    </View>
                    <View style={{ marginTop: 8 }}>
                      <SkillBadges skills={m.skills} max={2} />
                    </View>
                  </View>
                  <Stamp label={t("Verified", "موثّق")} />
                </Press>
              </Rise>
            ))}
            {hasMore ? (
              <View style={{ marginTop: 16 }}>
                <Button variant="ghost" icon="chevron-down-outline" label={more ? t("Loading…", "جارٍ التحميل…") : t("Show more", "عرض المزيد")} disabled={more} onPress={() => run("more")} />
              </View>
            ) : null}
            {error ? <Notice tone="danger" icon="alert-circle-outline">{error}</Notice> : null}
          </>
        )}
      </View>
    </BlueprintPage>
  );
}
