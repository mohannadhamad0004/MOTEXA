import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { EmptyState, Notice } from "../../../components/ui/Feedback";
import { Header } from "../../../components/layout/DashboardLayout";
import { SearchBar } from "../../../components/ui/Input";
import { SkeletonList } from "../../../components/ui/Skeleton";
import { Chip, ChipRow } from "../../../components/ui/Chip";
import { useL } from "../../../core/hooks/useL";
import { Screen } from "../../../components/layout/Screen";
import { Text } from "../../../components/ui/Text";
import { useTheme } from "../../../theme/useTheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { CITIES, cityLabel } from "../../../core/constants/cities";
import { Point, distanceLabel, locationMemory, roundPoint } from "../../../core/constants/geo";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { InitialAvatar, SkillBadges, VerifiedBadge, useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MECHANIC_SKILLS, MechanicRow, mechanicCatalog } from "../../../features/mechanics/mechanicsService";

export default function CustomerMechanics() {
  const { c: col } = useTheme();
  const { t, row, align, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [skill, setSkill] = useState<string | null>(null);
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

  const useMyLocation = async () => {
    const p = await loc.locate();
    if (p) setMe(p);
  };
  const forgetLocation = () => {
    locationMemory.current = null;
    setMe(null);
  };
  const showAll = () => {
    setName("");
    setCity("");
    setSkill(null);
  };

  return (
    <Screen tabs refreshing={refreshing} onRefresh={() => run("refresh")}>
      <Header brand="MOTEXA" title={t("Mechanics", "الميكانيكيون")} subtitle={t("Find a trusted mechanic", "اعثر على ميكانيكي موثوق")} />
      {loc.dialog}
      <SearchBar value={name} onChange={setName} placeholder={t("Mechanic or workshop name", "اسم الميكانيكي أو الورشة")} />
      <View style={{ gap: 10, marginBottom: 12 }}>
        <Button
          variant={me ? "primary" : "ghost"}
          icon="locate-outline"
          label={loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : me ? t("Update my location", "تحديث موقعي") : t("Use my location", "استخدم موقعي")}
          disabled={loc.locating}
          onPress={useMyLocation}
        />
        {me ? <Button variant="ghost" icon="close-circle-outline" label={t("Stop using my location", "إيقاف استخدام موقعي")} onPress={forgetLocation} /> : null}
      </View>
      <LocationProblem loc={loc} />

      <ChipRow>
        <Chip icon="location-outline" label={city ? cityLabel(city, isArabic) : t("All cities", "كل المدن")} on={!!city} onPress={() => setCityOpen(!cityOpen)} />
        {city ? <Chip icon="close" label={t("Clear city", "مسح المدينة")} on={false} onPress={() => setCity("")} /> : null}
      </ChipRow>
      {cityOpen ? (
        <ChipRow>
          {CITIES.map((c) => (
            <Chip
              key={c.name}
              label={cityLabel(c.name, isArabic)}
              on={city === c.name}
              onPress={() => {
                setCity(city === c.name ? "" : c.name);
                setCityOpen(false);
              }}
            />
          ))}
        </ChipRow>
      ) : null}
      <ChipRow>
        <Chip label={t("All skills", "كل المهارات")} on={skill === null} onPress={() => setSkill(null)} />
        {MECHANIC_SKILLS.map((k) => (
          <Chip key={k} label={counts[k] !== undefined ? `${skillLabel(k)} (${counts[k]})` : skillLabel(k)} on={skill === k} onPress={() => setSkill(skill === k ? null : k)} />
        ))}
      </ChipRow>

      {error && items.length ? (
        <View style={{ gap: 8, marginBottom: 12 }}>
          <Notice tone="danger" icon="alert-circle-outline">{t("Could not refresh. The results below may be out of date.", "تعذّر التحديث. قد تكون النتائج أدناه قديمة.")}</Notice>
          <Button variant="ghost" icon="refresh-outline" label={t("Retry", "إعادة المحاولة")} onPress={() => run("replace")} />
        </View>
      ) : null}

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
          <Text style={[{ color: col.textDim, fontSize: 11, marginBottom: 8 }, align]}>
            {total} {total === 1 ? t("mechanic", "ميكانيكي") : t("mechanics", "ميكانيكيين")}
          </Text>
          {items.map((m) => (
            <Card key={m.id} label={m.name} onPress={() => router.push(`/customer/mechanic/${m.id}`)}>
              <View style={[row, { alignItems: "flex-start", gap: 12 }]}>
                <InitialAvatar name={m.name} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[{ color: col.text, fontSize: 16, fontWeight: "800" }, align]}>{m.name}</Text>
                  <Text numberOfLines={1} style={[{ color: col.textMuted, fontSize: 12, marginTop: 3 }, align]}>
                    {m.workshopName} · {cityLabel(m.city, isArabic)}
                  </Text>
                  {m.distanceKm != null ? (
                    <Text numberOfLines={1} style={[{ color: col.accent, fontSize: 12, fontWeight: "800", marginTop: 4 }, align]}>
                      {distanceLabel(m.distanceKm, isArabic)}
                      {m.distanceSource === "city" ? ` · ${t("from the city centre", "من مركز المدينة")}` : ""}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name={isArabic ? "chevron-back" : "chevron-forward"} size={19} color={col.accent} />
              </View>
              <View style={{ marginTop: 12, gap: 8 }}>
                <SkillBadges skills={m.skills} />
                <VerifiedBadge />
              </View>
            </Card>
          ))}
          {hasMore ? <Button variant="ghost" icon="chevron-down-outline" label={more ? t("Loading…", "جارٍ التحميل…") : t("Show more", "عرض المزيد")} disabled={more} onPress={() => run("more")} /> : null}
          {error ? <Notice tone="danger" icon="alert-circle-outline">{error}</Notice> : null}
        </>
      )}
    </Screen>
  );
}
