import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Chip, HScroll, Icon, Mono, Pill, PrimaryButton, SearchField, Stamp, Steps } from "../../components/blueprint";
import { Notice } from "../../components/ui/Feedback";
import { Text } from "../../components/ui/Text";
import { cityCentre, cityLabel } from "../../core/constants/cities";
import { Point, locationMemory } from "../../core/constants/geo";
import { goBack } from "../../core/hooks/nav";
import { useL } from "../../core/hooks/useL";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { TowCompanyRow, catalogService } from "../catalog/catalogService";
import { SkillBadges, MechanicStatusBadge, useSkillLabel } from "../mechanics/mechanicBits";
import { MechanicRequestFields, useMechanicRequestForm } from "../mechanics/MechanicRequestForm";
import { CustomerMechanicRequest, MECHANIC_SKILLS, MechanicRow, REFRESH_MS, customerMechanicRequests, mechanicCatalog } from "../mechanics/mechanicsService";
import { TowRequestFields, useTowRequestForm } from "../requests/TowRequestForm";
import { TowStatusBadge } from "../requests/requestBits";
import { CustomerTowRequest, customerTowRequests } from "../requests/requestsService";
import type { TruckType } from "../tow/towService";
import { useTruckLabels } from "../tow/truckBits";
import { MapPanel, SIDE_PANEL_WIDTH, Snap, WIDE_MIN_WIDTH } from "./MapPanel";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "./maps";
import { LocationProblem, useCurrentLocation } from "./useCurrentLocation";
import { RouteSummary, useRoute } from "./useRoute";

type Mode = "tow" | "mechanic";
type Step = "select" | "form" | "route";

type Provider = {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  /** the pin is at the city centre, not at a real base / workshop point */
  approx: boolean;
  distanceKm: number | null;
  tow?: TowCompanyRow;
  mech?: MechanicRow;
};

type Req = { kind: "tow"; data: CustomerTowRequest } | { kind: "mech"; data: CustomerMechanicRequest };

const TERMINAL = ["DECLINED", "CANCELLED", "COMPLETED"];
const TOW_TYPES: TruckType[] = ["FLATBED", "WHEEL_LIFT", "HEAVY_DUTY"];

/** Round overlay button (back). */
function OverlayButton({ icon, label, onPress }: { icon: "back" | "close"; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, alignItems: "center", justifyContent: "center", transform: [{ scale: pressed ? 0.96 : 1 }] })}
    >
      <Icon name={icon} size={20} color={c.ink} />
    </Pressable>
  );
}

/**
 * Full-screen map page for tow companies and mechanics: search and filter, pick a pin, request inside the panel,
 * then watch the request and its route. One component for both routes (customer/tow/map, customer/mechanics/map).
 */
export function ServiceMapScreen({ mode }: { mode: Mode }) {
  const { c, row, align } = useTheme();
  const { t, isArabic } = useL();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const wide = width >= WIDE_MIN_WIDTH;
  const { focus: focusParam } = useLocalSearchParams<{ focus?: string }>();
  const { type: truckLabel } = useTruckLabels();
  const skillLabel = useSkillLabel();
  const isTow = mode === "tow";

  // ---- filters + data ----
  const [q, setQ] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [truckType, setTruckType] = useState<TruckType | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([...MECHANIC_SKILLS]);
  const [me, setMe] = useState<Point | null>(locationMemory.current);
  const loc = useCurrentLocation();
  const [tow, setTow] = useState<TowCompanyRow[]>([]);
  const [mech, setMech] = useState<MechanicRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    if (isTow) return;
    mechanicCatalog.skills().then((s) => setSkills(s.filter((x) => x.count > 0).map((x) => x.key))).catch(() => {});
  }, [isTow]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      if (isTow) {
        const r = await catalogService.listTowCompanies({ truckType: truckType ?? undefined, availableOnly, sort: me ? "nearest" : "available", ...(me ? { lat: me.lat, lng: me.lng } : {}) });
        if (mine === seq.current) setTow(r);
      } else {
        // the map shows every match, so all pages are read (the list is small)
        const all: MechanicRow[] = [];
        for (let page = 1; page <= 10; page++) {
          const r = await mechanicCatalog.list({ skill: skill ?? undefined, page, ...(me ? { lat: me.lat, lng: me.lng, sort: "nearest" as const } : {}) });
          all.push(...r.mechanics);
          if (!r.hasMore) break;
        }
        if (mine === seq.current) setMech(all);
      }
    } catch (e: any) {
      if (mine === seq.current) setError(e.message);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [isTow, truckType, availableOnly, skill, me]);
  useEffect(() => {
    const h = setTimeout(load, 250);
    return () => clearTimeout(h);
  }, [load]);

  const providers = useMemo<Provider[]>(() => {
    const needle = q.trim().toLowerCase();
    const hit = (...parts: (string | null | undefined)[]) => !needle || parts.some((x) => x && x.toLowerCase().includes(needle));
    const out: Provider[] = [];
    if (isTow) {
      for (const x of tow) {
        if (!hit(x.name, x.city, cityLabel(x.city, true), ...x.serviceCities)) continue;
        const base = x.baseLat !== null && x.baseLng !== null ? { lat: x.baseLat, lng: x.baseLng } : null;
        const at = base ?? cityCentre(x.city);
        if (at) out.push({ id: x.id, name: x.name, city: x.city, ...at, approx: !base, distanceKm: x.distanceKm ?? null, tow: x });
      }
    } else {
      for (const x of mech) {
        if (!hit(x.name, x.workshopName, x.city, cityLabel(x.city, true))) continue;
        const at = cityCentre(x.city); // MOTEXA stores no workshop coordinates yet: the pin is the city centre
        if (at) out.push({ id: x.id, name: x.name, city: x.city, ...at, approx: true, distanceKm: x.distanceKm ?? null, mech: x });
      }
    }
    return out;
  }, [isTow, tow, mech, q]);

  // ---- selection + request flow ----
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("select");
  const [snap, setSnap] = useState<Snap>("collapsed");
  const [inset, setInset] = useState(0);
  const [topH, setTopH] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: string } | null>(null);
  const [req, setReq] = useState<Req | null>(null);
  const [reqProvider, setReqProvider] = useState<Provider | null>(null);
  const [reqPickup, setReqPickup] = useState<Point | null>(null);
  const [justSent, setJustSent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelErr, setCancelErr] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);

  const selected = step === "select" ? providers.find((p) => p.id === selectedId) ?? null : reqProvider ?? providers.find((p) => p.id === selectedId) ?? null;
  const formProvider = { id: selected?.id ?? "", city: selected?.city ?? "" };
  const towForm = useTowRequestForm(formProvider);
  const mechForm = useMechanicRequestForm(formProvider);
  const form = isTow ? towForm : mechForm;

  const select = (p: Provider) => {
    setSelectedId(p.id);
    setStep("select");
    setSnap("collapsed");
    setFocus({ lat: p.lat, lng: p.lng, key: `${p.id}-${Date.now()}` });
  };
  // "Show on map" from a profile page: select that provider once the data is in
  const focused = useRef(false);
  useEffect(() => {
    if (focusParam && !focused.current) {
      const p = providers.find((x) => x.id === focusParam);
      if (p) {
        focused.current = true;
        select(p);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providers, focusParam]);

  const nearMe = async () => {
    if (me) {
      locationMemory.current = null;
      setMe(null);
      return;
    }
    const p = await loc.locate();
    if (p) {
      setMe(p);
      setFocus({ lat: p.lat, lng: p.lng, key: `me-${Date.now()}` });
    }
  };
  // "Nearest": the closest matching provider (tow: one with a free truck first), once distances are known
  const [wantNearest, setWantNearest] = useState(false);
  const nearest = () => {
    if (!me) loc.locate().then((p) => p && (setMe(p), setWantNearest(true)));
    else setWantNearest(true);
  };
  useEffect(() => {
    if (!wantNearest || loading || !me) return;
    const withKm = providers.filter((p) => p.distanceKm !== null);
    if (!withKm.length) return;
    const pool = isTow && withKm.some((p) => (p.tow?.availableTrucks ?? 0) > 0) ? withKm.filter((p) => (p.tow?.availableTrucks ?? 0) > 0) : withKm;
    const best = [...pool].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))[0];
    setWantNearest(false);
    select(best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantNearest, loading, me, providers]);

  const startForm = () => {
    if (!selected) return;
    setReqProvider(selected);
    setStep("form");
    setSnap("expanded");
    if (!form.spot && me) form.place(me, true);
  };
  const send = async () => {
    if (!selected) return;
    const pickup = form.spot;
    if (isTow) {
      const r = await towForm.submit();
      if (!r) return;
      setReq(r.request ? { kind: "tow", data: r.request } : null);
      setReqId(r.id);
    } else {
      const r = await mechForm.submit();
      if (!r) return;
      setReq({ kind: "mech", data: r });
      setReqId(r.id);
    }
    setReqProvider(selected);
    setReqPickup(pickup);
    setJustSent(true);
    setTimeout(() => setJustSent(false), 8000);
    setStep("route");
    setSnap("collapsed");
  };
  const [reqId, setReqId] = useState<string | null>(null);

  // poll the open request every 15 s while this screen is focused
  useFocusEffect(
    useCallback(() => {
      if (step !== "route" || !reqId) return;
      let live = true;
      const tick = async () => {
        try {
          if (isTow) {
            const r = await customerTowRequests.get(reqId);
            if (live) setReq({ kind: "tow", data: r });
          } else {
            const r = await customerMechanicRequests.get(reqId);
            if (live) setReq({ kind: "mech", data: r });
          }
        } catch {
          /* keep what is on screen */
        }
      };
      tick();
      const timer = setInterval(tick, REFRESH_MS);
      return () => {
        live = false;
        clearInterval(timer);
      };
    }, [step, reqId, isTow])
  );

  const chooseAnother = () => {
    setReq(null);
    setReqId(null);
    setReqProvider(null);
    setReqPickup(null);
    setConfirming(false);
    setCancelErr(null);
    setSelectedId(null);
    setStep("select");
    load();
  };
  const cancelRequest = async () => {
    if (!req) return;
    setCancelBusy(true);
    setCancelErr(null);
    try {
      const r = req.kind === "tow" ? await customerTowRequests.cancel(req.data.id, "") : await customerMechanicRequests.cancel(req.data.id);
      setReq(req.kind === "tow" ? { kind: "tow", data: r as CustomerTowRequest } : { kind: "mech", data: r as CustomerMechanicRequest });
      setConfirming(false);
    } catch (e: any) {
      setCancelErr(e.message);
      setConfirming(false);
    } finally {
      setCancelBusy(false);
    }
  };

  // ---- route ----
  const pickupPoint: Point | null = step === "route" ? (req?.kind === "tow" ? req.data.pickup : req?.kind === "mech" ? req.data.location.point : null) ?? reqPickup : form.spot;
  const toPoint = selected ? { lat: selected.lat, lng: selected.lng } : null;
  const { route, loading: routing } = useRoute(step === "route" ? reqId : null, pickupPoint, toPoint);

  // ---- map props ----
  const allPins: ServicePin[] = providers.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: isTow ? "tow" : "mech", dim: isTow && (p.tow?.availableTrucks ?? 0) === 0 }));
  const pins = step === "select" ? allPins : allPins.filter((p) => p.id === selected?.id).length ? allPins.filter((p) => p.id === selected?.id) : selected ? [{ id: selected.id, name: selected.name, lat: selected.lat, lng: selected.lng, kind: isTow ? "tow" : "mech", dim: false } as ServicePin] : [];
  const fit: [number, number][] =
    step === "select"
      ? [...pins.map((p) => [p.lat, p.lng] as [number, number]), ...(me ? [[me.lat, me.lng] as [number, number]] : [])]
      : [...(toPoint ? [[toPoint.lat, toPoint.lng] as [number, number]] : []), ...(pickupPoint ? [[pickupPoint.lat, pickupPoint.lng] as [number, number]] : [])];
  const fitKey = step === "select" ? `sel:${isTow}:${pins.map((p) => p.id).join(",")}:${me ? 1 : 0}` : step === "form" ? `form:${selected?.id}:${pickupPoint ? 1 : 0}` : `route:${reqId}:${pickupPoint ? 1 : 0}`;
  const panelVisible = step !== "select" || !!selected;
  const pad = { top: topH, bottom: wide ? 0 : inset, left: wide && panelVisible && !isArabic ? SIDE_PANEL_WIDTH : 0, right: wide && panelVisible && isArabic ? SIDE_PANEL_WIDTH : 0 };

  // ---- overlay ----
  const startOffset = wide && panelVisible ? SIDE_PANEL_WIDTH + 12 : 12;
  const overlay = (
    <View
      onLayout={(e) => setTopH(e.nativeEvent.layout.height)}
      style={{
        position: "absolute",
        top: wide ? insets.top + 8 : 0,
        ...(wide ? { borderRadius: 24, borderWidth: 1, [isArabic ? "right" : "left"]: startOffset, [isArabic ? "left" : "right"]: 12 } : { left: 0, right: 0, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderBottomWidth: 1, paddingTop: insets.top }),
        overflow: "hidden",
        borderColor: c.line,
        backgroundColor: alpha(c.sheet, 0.95),
        paddingHorizontal: 20,
        paddingTop: (wide ? 0 : insets.top) + 10,
        paddingBottom: 12,
        gap: 10,
        zIndex: 40,
      }}
    >
      <View style={[row, { alignItems: "center", gap: 10 }]}>
        <OverlayButton icon="back" label={t("Back", "رجوع")} onPress={() => goBack(isTow ? "/customer/tow" : "/customer/mechanics")} />
        <View style={{ flex: 1 }}>
          <SearchField compact value={q} onChangeText={setQ} placeholder={isTow ? t("Company name or city", "اسم الشركة أو المدينة") : t("Mechanic, workshop or city", "ميكانيكي أو ورشة أو مدينة")} />
        </View>
      </View>
      <HScroll>
        <Chip icon="pin" label={loc.locating ? t("Finding…", "جارٍ التحديد…") : t("Near me", "بالقرب مني")} on={!!me} onPress={nearMe} />
        <Chip icon="spark" label={t("Nearest", "الأقرب")} on={wantNearest} onPress={nearest} />
        {isTow ? (
          <>
            <Chip label={t("Available now", "متاح الآن")} on={availableOnly} onPress={() => setAvailableOnly(!availableOnly)} />
            {TOW_TYPES.map((k) => (
              <Chip key={k} label={truckLabel[k]} on={truckType === k} onPress={() => setTruckType(truckType === k ? null : k)} />
            ))}
          </>
        ) : (
          skills.map((k) => <Chip key={k} label={skillLabel(k)} on={skill === k} onPress={() => setSkill(skill === k ? null : k)} />)
        )}
      </HScroll>
      <LocationProblem loc={loc} />
    </View>
  );

  const banner = (text: string, tone: "neutral" | "danger" = "neutral", action?: ReactNode) => (
    <View
      style={{
        position: "absolute",
        top: wide ? topH + insets.top + 16 : topH + 8,
        ...(wide ? { [isArabic ? "right" : "left"]: startOffset } : { alignSelf: "center" }),
        zIndex: 35,
        maxWidth: "88%",
        flexDirection: isArabic ? "row-reverse" : "row",
        alignItems: "center",
        gap: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tone === "danger" ? c.dangerBorder : c.line,
        backgroundColor: alpha(c.sheet, 0.95),
        paddingHorizontal: 14,
        paddingVertical: 8,
      }}
    >
      <Text style={{ color: tone === "danger" ? c.danger : c.ink, fontSize: 12, flexShrink: 1 }}>{text}</Text>
      {action}
    </View>
  );

  // ---- panel pieces ----
  const distText = (p: Provider) =>
    p.distanceKm !== null ? `≈ ${p.distanceKm < 1 ? "<1" : p.distanceKm < 10 ? p.distanceKm.toFixed(1) : Math.round(p.distanceKm)} ${isArabic ? "كم" : "km"}` : null;

  const nameBlock = (p: Provider, right?: ReactNode, sub?: ReactNode) => (
    <View style={[row, { alignItems: "center", gap: 14, marginTop: 6 }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 20, fontWeight: "700" }, align]}>{p.name}</Text>
        <View style={[row, { alignItems: "center", gap: 4, flexWrap: "wrap" }]}>
          <Text style={{ color: c.soft, fontSize: 13 }}>{cityLabel(p.city, isArabic)}</Text>
          {sub}
        </View>
      </View>
      {right}
    </View>
  );

  let header: ReactNode = null;
  let body: ReactNode = null;
  let footer: ReactNode = null;

  if (step === "select" && selected) {
    const km = distText(selected);
    header = nameBlock(
      selected,
      <Stamp label={t("Verified", "موثّق")} />,
      <>
        {km ? <Mono color={c.ink} size={13} bold>{`· ${km}`}</Mono> : null}
        {km ? <Text style={{ color: c.soft, fontSize: 11 }}>{t("straight line", "خط مستقيم")}</Text> : null}
      </>
    );
    body = (
      <View style={{ gap: 12, marginTop: 8 }}>
        {selected.tow ? (
          <>
            <Text style={[{ color: selected.tow.availableTrucks ? c.bronze : c.soft, fontSize: 14, fontWeight: "700" }, align]}>
              {selected.tow.availableTrucks
                ? `${selected.tow.availableTrucks} ${selected.tow.availableTrucks === 1 ? t("truck free", "شاحنة متاحة") : t("trucks free", "شاحنات متاحة")}`
                : t("No free truck right now", "لا توجد شاحنة متاحة الآن")}
            </Text>
            <View style={[row, { flexWrap: "wrap", gap: 6 }]}>
              {selected.tow.truckTypes.map((k) => (
                <Pill key={k}>{truckLabel[k]}</Pill>
              ))}
            </View>
          </>
        ) : selected.mech ? (
          <>
            <Text style={[{ color: c.soft, fontSize: 13 }, align]}>{selected.mech.workshopName}</Text>
            <SkillBadges skills={selected.mech.skills} max={4} />
          </>
        ) : null}
        {selected.approx ? <Text style={[{ color: c.soft, fontSize: 11 }, align]}>{t("Approx. location: the pin is at the city centre.", "موقع تقريبي: الدبوس في مركز المدينة.")}</Text> : null}
      </View>
    );
    footer = (
      <View style={[row, { gap: 10 }]}>
        <PrimaryButton style={{ flex: 1 }} variant="outline" label={t("View profile", "عرض الملف")} onPress={() => router.push(isTow ? `/customer/tow/${selected.id}` : `/customer/mechanic/${selected.id}`)} />
        <PrimaryButton style={{ flex: 1 }} label={t("Request", "اطلب")} disabled={isTow && (selected.tow?.availableTrucks ?? 0) === 0} onPress={startForm} />
      </View>
    );
  } else if (step === "form" && selected) {
    header = (
      <View style={[row, { alignItems: "center", gap: 10, marginTop: 6 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Back", "رجوع")} onPress={() => { setStep("select"); setSnap("collapsed"); }} hitSlop={10} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Icon name="back" size={20} color={c.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[{ color: c.ink, fontSize: 18, fontWeight: "700" }, align]}>{t(`Request to ${selected.name}`, `طلب إلى ${selected.name}`)}</Text>
        </View>
      </View>
    );
    body = (
      <View>
        {isTow ? <TowRequestFields form={towForm} pinMap={false} numbered={false} /> : <MechanicRequestFields form={mechForm} skills={selected.mech?.skills ?? []} pinMap={false} numbered={false} />}
        <Text style={[{ color: c.soft, fontSize: 11, marginTop: 16 }, align]}>
          {isTow
            ? t("The company sees your name, your phone and what you wrote here. Your email is never shared.", "ترى الشركة اسمك ورقم هاتفك وما كتبته هنا فقط. لا تتم مشاركة بريدك الإلكتروني أبدًا.")
            : t("The mechanic sees your name, your car, the problem and the location you wrote. Your email is never shared.", "يرى الميكانيكي اسمك وسيارتك والمشكلة والموقع الذي كتبته. لا تتم مشاركة بريدك الإلكتروني أبدًا.")}
        </Text>
      </View>
    );
    footer = (
      <View style={{ gap: 8 }}>
        {form.err ? <Notice tone="danger" icon="alert-circle-outline">{form.err}</Notice> : null}
        <PrimaryButton icon="arrow" label={t("Send request", "إرسال الطلب")} loading={form.busy} onPress={send} />
      </View>
    );
  } else if (step === "route" && selected && req) {
    const d = req.data;
    const status = d.status as string;
    const idx = (isTow ? { REQUESTED: 0, ACCEPTED: 1, EN_ROUTE: 2, IN_PROGRESS: 2, COMPLETED: 3 } : { REQUESTED: 0, ACCEPTED: 1, IN_PROGRESS: 2, COMPLETED: 3 })[status as "REQUESTED"];
    const labels = isTow
      ? [t("Requested", "تم الطلب"), t("Accepted", "مقبول"), status === "IN_PROGRESS" ? t("In progress", "قيد التنفيذ") : t("On the way", "في الطريق"), t("Completed", "مكتمل")]
      : [t("Requested", "تم الطلب"), t("Accepted", "مقبول"), t("In progress", "قيد التنفيذ"), t("Completed", "مكتمل")];
    const done = TERMINAL.includes(status);
    const pickupText = req.kind === "tow" ? req.data.pickupAddress : req.data.location.text;
    const reason = req.kind === "tow" ? (status === "DECLINED" ? req.data.declineReason : req.data.cancelReason) : req.data.declineReason;
    header = (
      <View style={{ marginTop: 6, gap: 6 }}>
        {justSent ? (
          <Pill icon={<Icon name="check" size={14} color={c.bronze} />}>{t(`Request sent to ${selected.name}`, `تم إرسال الطلب إلى ${selected.name}`)}</Pill>
        ) : null}
        <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 10 }]}>
          <Text numberOfLines={2} style={[{ flex: 1, color: c.ink, fontSize: 18, fontWeight: "700" }, align]}>{selected.name}</Text>
          {req.kind === "tow" ? <TowStatusBadge value={req.data.status} /> : <MechanicStatusBadge value={req.data.status} />}
        </View>
      </View>
    );
    body = (
      <View style={{ gap: 14, marginTop: 4 }}>
        {idx !== undefined ? <Steps labels={labels} index={idx} /> : null}
        {status === "DECLINED" || status === "CANCELLED" ? (
          <Notice tone="danger" icon="close-circle-outline">
            {status === "DECLINED" ? t("Declined by the provider", "رفضه مقدّم الخدمة") : req.kind === "tow" && req.data.cancelledBy === "COMPANY" ? t("Cancelled by the company", "ألغته الشركة") : t("Cancelled by you", "ألغيته أنت")}
            {reason ? `\n${reason}` : ""}
          </Notice>
        ) : null}
        {pickupPoint ? <RouteSummary route={route} loading={routing} /> : <Text style={[{ color: c.soft, fontSize: 12 }, align]}>{t("No pickup point was set, so no route is drawn.", "لم تُحدد نقطة استلام، لذا لا يُرسم مسار.")}</Text>}
        <View style={[row, { gap: 10, alignItems: "flex-start" }]}>
          <Icon name="pin" size={16} color={c.soft} />
          <Text style={[{ flex: 1, color: c.ink, fontSize: 13 }, align]}>{pickupText}</Text>
        </View>
        {selected.approx ? <Text style={[{ color: c.soft, fontSize: 11 }, align]}>{t("The provider pin is approximate (city centre).", "دبوس مقدّم الخدمة تقريبي (مركز المدينة).")}</Text> : null}
        {cancelErr ? <Notice tone="danger" icon="alert-circle-outline">{cancelErr}</Notice> : null}
      </View>
    );
    footer = done ? (
      <View style={{ gap: 8 }}>
        <PrimaryButton label={t("Choose another", "اختر آخر")} onPress={chooseAnother} />
        <PrimaryButton variant="outline" label={t("Request details", "تفاصيل الطلب")} onPress={() => router.push(req.kind === "tow" ? `/customer/towrequest/${d.id}` : `/customer/mechanicrequest/${d.id}`)} />
      </View>
    ) : confirming ? (
      <View style={{ gap: 8 }}>
        <Text style={[{ color: c.ink, fontSize: 14, fontWeight: "700" }, align]}>{t("Cancel this request?", "هل تريد إلغاء هذا الطلب؟")}</Text>
        <View style={[row, { gap: 10 }]}>
          <PrimaryButton style={{ flex: 1 }} variant="outline" label={t("Keep it", "إبقاؤه")} disabled={cancelBusy} onPress={() => setConfirming(false)} />
          <PrimaryButton style={{ flex: 1 }} variant="danger" label={t("Yes, cancel", "نعم، ألغِ")} loading={cancelBusy} onPress={cancelRequest} />
        </View>
      </View>
    ) : (
      <View style={[row, { gap: 10 }]}>
        <PrimaryButton style={{ flex: 1 }} variant="outline" label={t("Request details", "تفاصيل الطلب")} onPress={() => router.push(req.kind === "tow" ? `/customer/towrequest/${d.id}` : `/customer/mechanicrequest/${d.id}`)} />
        {(d as { canCancel: boolean }).canCancel ? <PrimaryButton style={{ flex: 1 }} variant="danger" label={t("Cancel request", "إلغاء الطلب")} onPress={() => setConfirming(true)} /> : null}
      </View>
    );
  }

  if (!MAPS_AVAILABLE) {
    return (
      <View style={{ flex: 1, backgroundColor: c.page, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ color: c.ink, fontSize: 15, textAlign: "center" }}>{t("The map is not available on this platform. Use the list instead.", "الخريطة غير متاحة على هذه المنصة. استخدم القائمة.")}</Text>
        <PrimaryButton label={t("Back", "رجوع")} onPress={() => goBack(isTow ? "/customer/tow" : "/customer/mechanics")} />
      </View>
    );
  }

  const attrSide = isArabic ? { left: 8 } : { right: 8 };
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <ServiceMap
        height={height}
        pins={pins}
        selectedId={step === "select" ? selectedId : selected?.id ?? null}
        me={me}
        pickup={step === "select" ? null : pickupPoint}
        movePickup={step === "form"}
        route={step === "route" && route ? { coords: route.coords, dashed: route.kind === "line" } : null}
        fit={fit}
        fitKey={fitKey}
        pad={pad}
        focus={focus}
        onSelect={(id) => {
          if (step !== "select") return;
          const p = providers.find((x) => x.id === id);
          if (p) select(p);
        }}
        onBackground={() => step === "select" && setSelectedId(null)}
        onPickupMove={(p) => form.place(p, false)}
        onFailedChange={setMapFailed}
      />
      {overlay}
      {!loading && !error && step === "select" && providers.length === 0 ? banner(t("No results", "لا توجد نتائج")) : null}
      {error && step === "select" ? banner(error, "danger", <Pressable accessibilityRole="button" onPress={load} hitSlop={8}><Text style={{ color: c.bronze, fontSize: 12, fontWeight: "700" }}>{t("Retry", "إعادة المحاولة")}</Text></Pressable>) : null}
      {mapFailed ? null : (
        <Text
          pointerEvents="none"
          style={{ position: "absolute", bottom: (wide ? 0 : inset) + 6 + (wide ? insets.bottom : 0), ...attrSide, zIndex: 20, fontSize: 9, color: "#333", backgroundColor: "rgba(255,255,255,0.85)", paddingHorizontal: 6, paddingVertical: 1, writingDirection: "ltr" }}
        >
          © OpenStreetMap contributors
        </Text>
      )}
      <MapPanel visible={panelVisible && !!header} snap={snap} onSnap={setSnap} onInset={setInset} header={header} footer={footer}>
        {body}
      </MapPanel>
    </View>
  );
}
