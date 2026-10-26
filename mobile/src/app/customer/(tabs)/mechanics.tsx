import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import {
  BlueprintPage,
  Icon,
  InspectionCheck,
  Ltr,
  MechanicAvatar,
  MO_HERO_OVERLAP,
  MoHero,
  Odometer,
  OptionSheet,
  PrimaryButton,
  Press,
  Rise,
  SearchField,
  UnderlineTabs,
} from "../../../components/blueprint";
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
import { M, useIgnition } from "../../../motion";
import { alpha } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";

const kmText = (km: number, ar: boolean) => `≈ ${km < 1 ? "<1" : km < 10 ? km.toFixed(1) : Math.round(km)} ${ar ? "كم" : "km"}`;

/** One mechanic: person first, then name / workshop / city, approved skills, and the verification line last. */
function MechanicCard({ m, i }: { m: MechanicRow; i: number }) {
  const { c, row, align } = useTheme();
  const { t, isArabic } = useL();
  const early = i < 8; // only the first visible batch animates
  const base = i * M.stagger;
  const skillsEnd = base + 160 + Math.min(m.skills.length, 3) * M.staggerFine + 80;
  return (
    <Press
      accessibilityLabel={`${m.name}, ${m.workshopName}`}
      onPress={() => router.push(`/customer/mechanic/${m.id}`)}
      style={[row, { alignItems: "flex-start", gap: 14, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: alpha(c.line, 0.6) }]}
    >
      <Rise i={early ? 0 : 99} delay={base} distance={8}>
        <MechanicAvatar size={58} />
      </Rise>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Rise i={early ? 0 : 99} delay={base + 40} distance={8}>
          <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 17, fontWeight: "700", lineHeight: isArabic ? 25 : 21 }, align]}>{m.name}</Text>
          <Text numberOfLines={2} style={[{ color: c.soft, fontSize: 14, marginTop: 1 }, align]}>{m.workshopName}</Text>
          <View style={[row, { alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" }]}>
            <Icon name="pin" size={13} color={c.soft} />
            <Text numberOfLines={1} style={{ color: c.soft, fontSize: 12, flexShrink: 1 }}>{cityLabel(m.city, isArabic)}</Text>
            {m.distanceKm != null ? <Ltr style={{ color: c.soft, fontSize: 12 }}>{`· ${kmText(m.distanceKm, isArabic)}`}</Ltr> : null}
          </View>
        </Rise>
        <View style={{ marginTop: 8 }}>
          <SkillBadges skills={m.skills} max={3} after={early ? base + 160 : undefined} />
        </View>
        <Rise i={early ? 0 : 99} delay={skillsEnd} distance={4}>
          <View style={[row, { alignItems: "center", gap: 6, marginTop: 8 }]}>
            <InspectionCheck size={15} color={c.bronze} animate={early} delay={skillsEnd} />
            <Text style={{ color: c.bronze, fontSize: 12, fontWeight: "700" }}>{t("Verified by MOTEXA", "موثّق من موتكسا")}</Text>
          </View>
        </Rise>
      </View>
      <View style={{ alignSelf: "center" }}>
        <Icon name="chev" size={15} color={alpha(c.soft, 0.7)} />
      </View>
    </Press>
  );
}

export default function CustomerMechanics() {
  const { c, row } = useTheme();
  const { t, isArabic } = useL();
  const skillLabel = useSkillLabel();
  const ig = useIgnition("mechanics");
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

  // ---- hero: REAL values only. Every listed mechanic has at least one skill approved by MOTEXA ----
  const soft = alpha(c.cream, 0.82);
  const lineText = { color: soft, fontSize: 14 } as const;
  const where = me ? t("near you", "بالقرب منك") : city ? `${t("in", "في")} ${cityLabel(city, isArabic)}` : "";
  const heroLine = (
    <View style={[row, { alignItems: "center", flexWrap: "wrap", columnGap: 5 }]}>
      {total === null ? (
        <Text style={lineText}>{t("Looking for mechanics…", "جارٍ البحث عن ميكانيكيين…")}</Text>
      ) : total === 0 ? (
        <Text style={lineText}>{t("No verified mechanics found", "لا يوجد ميكانيكيون موثّقون")}</Text>
      ) : (
        <>
          <Odometer value={total} size={14} color={c.cream} />
          <Text style={lineText}>{`${total === 1 ? t("verified mechanic", "ميكانيكي موثّق") : t("verified mechanics", "ميكانيكيون موثّقون")}${where ? " " + where : ""}`}</Text>
        </>
      )}
    </View>
  );
  const hint = me || city ? undefined : t("Use your location to find mechanics near you", "استخدم موقعك للعثور على ميكانيكيين بالقرب منك");

  // the skill row shows only skills that really have approved mechanics (all of them while the counts load)
  const skillKeys = (counts ? MECHANIC_SKILLS.filter((k) => (counts[k] ?? 0) > 0) : [...MECHANIC_SKILLS]) as string[];

  return (
    <BlueprintPage
      tabs
      ignition={ig}
      overlap={MO_HERO_OVERLAP}
      refreshing={refreshing}
      onRefresh={() => run("refresh")}
      top={
        <MoHero
          play={ig}
          verified={(total ?? 0) > 0}
          tag="MECHANICS / 04"
          title={t("Mechanics", "الميكانيكيون")}
          line={heroLine}
          primary={
            me
              ? { label: t("Near you", "بالقرب منك"), icon: "pin", active: true, onPress: forgetLocation }
              : { label: t("Use my location", "استخدم موقعي"), icon: "pin", loading: loc.locating, onPress: () => void useMyLocation() }
          }
          secondary={{ label: t("View on map", "الخريطة"), icon: "map", onPress: () => router.push("/customer/mechanics/map") }}
        />
      }
    >
      {loc.dialog}
      <View style={[row, { alignItems: "center", gap: 10 }]}>
        <View style={{ flex: 1 }}>
          <SearchField compact style={{ height: 46, borderRadius: 14, backgroundColor: "transparent" }} value={name} onChangeText={setName} placeholder={t("Mechanic or workshop name", "اسم الميكانيكي أو الورشة")} />
        </View>
        <Press
          accessibilityLabel={t("City", "المدينة")}
          onPress={() => setCityOpen(true)}
          style={{ width: 46, height: 46, borderRadius: 14, borderWidth: 1, borderColor: city ? c.btn : c.line, backgroundColor: city ? c.btn : "transparent", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name="pin" size={20} color={city ? c.btnFg : c.ink} />
        </Press>
      </View>

      {loc.status === "problem" && !me ? (
        <View style={{ marginTop: 10 }}>
          <LocationProblem loc={loc} />
          <PrimaryButton variant="outline" icon="pin" label={t("Choose a city instead", "اختر مدينة بدلًا من ذلك")} onPress={() => setCityOpen(true)} />
        </View>
      ) : null}

      <View style={{ marginTop: 10 }}>
        <UnderlineTabs
          value={skill ?? "ALL"}
          onChange={(k) => setSkill(k === "ALL" ? null : k)}
          items={[{ key: "ALL", label: t("All", "الكل") }, ...skillKeys.map((k) => ({ key: k, label: skillLabel(k) }))]}
        />
      </View>

      <View style={[row, { marginTop: 12, alignItems: "center", flexWrap: "wrap", gap: 8 }]}>
        <View style={[row, { alignItems: "center", gap: 4 }]}>
          {total !== null ? <Odometer value={total} size={13} color={c.soft} /> : null}
          <Text style={{ color: c.soft, fontSize: 13 }}>{total === 1 ? t("mechanic", "ميكانيكي") : t("mechanics", "ميكانيكيين")}</Text>
        </View>
        {city ? (
          <Press accessibilityLabel={cityLabel(city, isArabic)} onPress={() => setCity("")} style={[row, { minHeight: 32, alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: alpha(c.bronze, 0.14), borderWidth: 1, borderColor: alpha(c.bronze, 0.4) }]}>
            <Text style={{ color: c.ink, fontSize: 12, fontWeight: "600" }}>{cityLabel(city, isArabic)}</Text>
            <Icon name="close" size={12} color={c.soft} />
          </Press>
        ) : null}
      </View>

      <View style={{ marginTop: 2 }}>
        {loading && !items.length ? (
          <SkeletonList />
        ) : error && !items.length ? (
          <View style={{ alignItems: "center", paddingVertical: 30, gap: 14 }}>
            <Notice tone="danger" icon="alert-circle-outline">{error}</Notice>
            <Button label={t("Retry", "إعادة المحاولة")} variant="ghost" icon="refresh-outline" onPress={() => run("replace")} />
          </View>
        ) : !items.length ? (
          <>
            <EmptyState
              icon="build-outline"
              text={
                city && !name.trim() && !skill
                  ? t(`No verified mechanics found in ${cityLabel(city, false)}`, `لا يوجد ميكانيكيون موثّقون في ${cityLabel(city, true)}`)
                  : filtered
                    ? t("No mechanics match these filters", "لا يوجد ميكانيكيون يطابقون هذه التصفية")
                    : t("No verified mechanics are available yet.", "لا يوجد ميكانيكيون موثّقون بعد.")
              }
            />
            {filtered ? <Button variant="ghost" icon="close-circle-outline" label={t("Clear filters", "مسح التصفية")} onPress={clearAll} /> : null}
            {city ? <Button variant="ghost" icon="pin" label={t("Choose another city", "اختر مدينة أخرى")} onPress={() => setCityOpen(true)} /> : null}
          </>
        ) : (
          <>
            {error ? <Notice tone="danger" icon="alert-circle-outline">{t("Could not refresh. The results below may be out of date.", "تعذّر التحديث. قد تكون النتائج أدناه قديمة.")}</Notice> : null}
            {items.map((m, i) => (
              <MechanicCard key={m.id} m={m} i={i} />
            ))}
            {hasMore ? (
              <View style={{ marginTop: 16 }}>
                <Button variant="ghost" icon="chevron-down-outline" label={more ? t("Loading…", "جارٍ التحميل…") : t("Show more", "عرض المزيد")} disabled={more} onPress={() => run("more")} />
              </View>
            ) : null}
          </>
        )}
      </View>

      <OptionSheet
        visible={cityOpen}
        onClose={() => setCityOpen(false)}
        title={t("City", "المدينة")}
        value={city || "ALL"}
        header={
          <PrimaryButton
            variant="outline"
            icon="pin"
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
    </BlueprintPage>
  );
}
