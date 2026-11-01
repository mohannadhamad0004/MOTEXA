import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Card, Chip, EmptyState, ErrorState, GaragePage, HeroLayout, GButton, GIcon, GText, IconButton, Note, OptionSheet, Rail, SearchBar, SkeletonRows, StatusChip, Tap } from "../../../components/garage";
import { CITIES, cityLabel } from "../../../core/constants/cities";
import { Point, locationMemory, roundPoint } from "../../../core/constants/geo";
import { useL } from "../../../core/hooks/useL";
import { useSkillLabel } from "../../../features/mechanics/mechanicBits";
import { MECHANIC_SKILLS, MechanicRow, mechanicCatalog } from "../../../features/mechanics/mechanicsService";
import { InitialBubble, SkillChips } from "../../../features/requests/garageBits";
import { LocationProblem, useCurrentLocation } from "../../../features/shared/useCurrentLocation";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";

const kmText = (km: number, ar: boolean) => `≈ ${km < 1 ? "<1" : km < 10 ? km.toFixed(1) : Math.round(km)} ${ar ? "كم" : "km"}`;

/** One mechanic: initial, name / workshop / city (+ distance), approved skills, verified chip. */
function MechanicCard({ m }: { m: MechanicRow }) {
  const { g, row, align } = useGarageTheme();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  return (
    <Card onPress={() => router.push(`/customer/mechanic/${m.id}`)} label={`${m.name}, ${m.workshopName}`} pad={14}>
      <View style={[row, { gap: 12, alignItems: "flex-start" }]}>
        <InitialBubble name={m.name} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <GText numberOfLines={2} style={[gType.label, { fontWeight: "800", fontSize: 16 }, align]}>{m.name}</GText>
          <GText soft numberOfLines={2} style={[gType.caption, align]}>{m.workshopName}</GText>
          <View style={[row, { alignItems: "center", gap: 4, flexWrap: "wrap" }]}>
            <GIcon name="location-outline" size={13} color={g.soft} />
            <GText soft numberOfLines={1} style={[gType.caption, { flexShrink: 1 }]}>{cityLabel(m.city, isArabic)}</GText>
            {m.distanceKm != null ? <GText soft style={[gType.caption, { writingDirection: "ltr" }]}>{`· ${kmText(m.distanceKm, isArabic)}`}</GText> : null}
          </View>
          <View style={{ marginTop: 8 }}>
            <SkillChips skills={m.skills} label={skillLabel} />
          </View>
          <View style={{ marginTop: 8 }}>
            <StatusChip tone="success" icon="shield-checkmark" label={t("Verified by MOTEXA", "موثّق من موتكسا")} />
          </View>
        </View>
        <GIcon name="chevron-forward" size={16} color={g.soft} flip />
      </View>
    </Card>
  );
}

export default function CustomerMechanics() {
  const { g, row } = useGarageTheme();
  const { t, isArabic } = useL();
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
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
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
    mechanicCatalog.skills().then((s) => setCounts(Object.fromEntries(s.map((x) => [x.key, x.count])))).catch(() => setCounts({}));
  }, []);

  const useMyLocation = async () => {
    const p = await loc.locate();
    if (p) setMe(p);
    return p;
  };
  const forgetLocation = () => {
    locationMemory.current = null;
    setMe(null);
  };
  const clearAll = () => {
    setName("");
    setCity("");
    setSkill(null);
  };


  const where = me ? t("near you", "بالقرب منك") : city ? `${t("in", "في")} ${cityLabel(city, isArabic)}` : "";
  const line =
    total === null
      ? t("Looking for mechanics…", "جارٍ البحث عن ميكانيكيين…")
      : total === 0
        ? t("No verified mechanics found", "لا يوجد ميكانيكيون موثّقون")
        : `${total} ${total === 1 ? t("verified mechanic", "ميكانيكي موثّق") : t("verified mechanics", "ميكانيكيون موثّقون")}${where ? " " + where : ""}`;

  // the skill row shows only skills that really have approved mechanics (all of them while the counts load)
  const skillKeys = (counts ? MECHANIC_SKILLS.filter((k) => (counts[k] ?? 0) > 0) : [...MECHANIC_SKILLS]) as string[];

  return (
    <GaragePage
      tabs
      entry="mechanics"
      refreshing={refreshing}
      onRefresh={() => run("refresh")}
      hero={
        <HeroLayout
          config={{
            tab: "mechanics",
            title: t("Mechanics", "الميكانيكيون"),
            line,
            action: me
              ? { kind: "toggle", on: true, icon: "navigate", label: t("Near you", "بالقرب منك"), onPress: forgetLocation }
              : { kind: "toggle", on: false, icon: "navigate-outline", label: t("Use my location", "استخدم موقعي"), busy: loc.locating, onPress: () => void useMyLocation() },
          }}
        />
      }
    >
      {loc.dialog}
      <View style={[row, { alignItems: "center", gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <SearchBar value={name} onChangeText={setName} placeholder={t("Mechanic or workshop name", "اسم الميكانيكي أو الورشة")} />
        </View>
        <IconButton icon="location-outline" label={t("City", "المدينة")} onPress={() => setCityOpen(true)} tone={city ? "accent" : "card"} />
      </View>

      {loc.status === "problem" && !me ? (
        <View style={{ marginTop: 10 }}>
          <LocationProblem loc={loc} />
          <GButton variant="secondary" icon="location-outline" label={t("Choose a city instead", "اختر مدينة بدلًا من ذلك")} onPress={() => setCityOpen(true)} />
        </View>
      ) : null}

      <View style={{ marginTop: 12 }}>
        <Rail gap={8}>
          <Chip label={t("All", "الكل")} on={!skill} onPress={() => setSkill(null)} />
          {skillKeys.map((k) => (
            <Chip key={k} label={skillLabel(k)} on={skill === k} count={counts?.[k]} onPress={() => setSkill(skill === k ? null : k)} />
          ))}
        </Rail>
      </View>

      <View style={[row, { marginTop: 12, alignItems: "center", flexWrap: "wrap", gap: 8, minHeight: 34 }]}>
        <GText soft style={[gType.caption, { fontWeight: "700" }]}>{total !== null ? `${total} ${total === 1 ? t("mechanic", "ميكانيكي") : t("mechanics", "ميكانيكيين")}` : " "}</GText>
        {city ? (
          <Tap label={cityLabel(city, isArabic)} onPress={() => setCity("")} style={[row, { minHeight: 34, alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: gShape.pill, backgroundColor: g.tint }]}>
            <GText style={[gType.caption, { fontWeight: "700" }]}>{cityLabel(city, isArabic)}</GText>
            <GIcon name="close" size={13} color={g.soft} />
          </Tap>
        ) : null}
      </View>

      <View style={{ marginTop: 8, gap: 12 }}>
        {loading && !items.length ? (
          <SkeletonRows count={4} />
        ) : error && !items.length ? (
          <ErrorState text={error} onRetry={() => run("replace")} retryLabel={t("Retry", "إعادة المحاولة")} />
        ) : !items.length ? (
          <>
            <EmptyState
              photo="empty.search"
              text={
                city && !name.trim() && !skill
                  ? t(`No verified mechanics found in ${cityLabel(city, false)}`, `لا يوجد ميكانيكيون موثّقون في ${cityLabel(city, true)}`)
                  : filtered
                    ? t("No mechanics match these filters", "لا يوجد ميكانيكيون يطابقون هذه التصفية")
                    : t("No verified mechanics are available yet.", "لا يوجد ميكانيكيون موثّقون بعد.")
              }
              action={filtered ? { label: t("Clear filters", "مسح التصفية"), onPress: clearAll } : undefined}
            />
            {city ? <GButton variant="ghost" icon="location-outline" label={t("Choose another city", "اختر مدينة أخرى")} onPress={() => setCityOpen(true)} /> : null}
          </>
        ) : (
          <>
            {error ? <Note tone="danger" icon="alert-circle-outline">{t("Could not refresh. The results below may be out of date.", "تعذّر التحديث. قد تكون النتائج أدناه قديمة.")}</Note> : null}
            {items.map((m) => (
              <MechanicCard key={m.id} m={m} />
            ))}
            {hasMore ? <GButton variant="secondary" icon="chevron-down-outline" label={more ? t("Loading…", "جارٍ التحميل…") : t("Show more", "عرض المزيد")} disabled={more} onPress={() => run("more")} /> : null}
          </>
        )}
      </View>

      <OptionSheet
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        closeLabel={t("Close", "إغلاق")}
        title={t("City", "المدينة")}
        value={city || "ALL"}
        header={
          <GButton
            variant="secondary"
            icon="navigate-outline"
            label={me ? t("Stop using my location", "إيقاف استخدام موقعي") : loc.locating ? t("Finding your location…", "جارٍ تحديد موقعك…") : t("Use my location", "استخدم موقعي")}
            onPress={async () => {
              if (me) {
                forgetLocation();
                setCityOpen(false);
              } else if (await useMyLocation()) setCityOpen(false);
            }}
          />
        }
        options={[{ key: "ALL", label: t("All cities", "كل المدن") }, ...CITIES.map((x) => ({ key: x.name as string, label: cityLabel(x.name, isArabic) }))]}
        onSelect={(k) => {
          setCity(k === "ALL" ? "" : k);
          setCityOpen(false);
        }}
      />
    </GaragePage>
  );
}
