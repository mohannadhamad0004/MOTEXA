import { Redirect } from "expo-router";
import { ReactNode, useEffect, useState } from "react";
import { View } from "react-native";
import {
  ASSEMBLY_KINDS,
  AssemblyKind,
  BlueprintSurface,
  CarTop,
  TowHero,
  MascotMo,
  MO,
  HOME_MO,
  HomeMo,
  CompactHero,
  CategoryAssembly,
  CrossFade,
  FadeSwitch,
  FloatingTabBar,
  Flash,
  InspectionCheck,
  Move,
  Odometer,
  Panel,
  PrimaryButton,
  RoadLoader,
  Rise,
  Seg,
  SimplePage,
  Steps,
  Tag,
  VerticalTimeline,
  type TimelineItem,
} from "../../components/blueprint";
import { Text } from "../../components/ui/Text";
import { useL } from "../../core/hooks/useL";
import { ServiceMap } from "../../features/shared/maps";
import { MiniMap } from "../../features/shared/MiniMap";
import { router } from "expo-router";
import { M, hapticSuccess, setReducedOverride, useReduced } from "../../motion";
import { useTheme } from "../../theme/useTheme";

// DEV ONLY (guarded by __DEV__, linked from Profile only in dev builds): every MOTEXA motion piece with a Replay button.
// It renders the same components the real screens use; nothing here is a copy.

function Demo({ title, note, children, replay = true }: { title: string; note?: string; children: (n: number) => ReactNode; replay?: boolean }) {
  const { c, row, align } = useTheme();
  const [n, setN] = useState(0);
  return (
    <Panel style={{ marginTop: 16 }}>
      <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 12 }]}>
        <Text style={[{ flex: 1, color: c.ink, fontSize: 15, fontWeight: "700" }, align]}>{title}</Text>
        {replay ? <PrimaryButton style={{ height: 40, paddingHorizontal: 14 }} variant="outline" label="Replay" onPress={() => setN(n + 1)} /> : null}
      </View>
      {note ? <Text style={[{ color: c.soft, fontSize: 12, marginTop: 4 }, align]}>{note}</Text> : null}
      <View style={{ marginTop: 14 }}>{children(n)}</View>
    </Panel>
  );
}

const STATUSES = ["Requested", "Accepted", "On the way", "Completed"];

function TabIndicatorDemo() {
  const [i, setI] = useState(0);
  const names = ["home", "parts", "mechanics", "tow"];
  const items = names.map((name) => ({ name, label: name, icon: "tow" as const }));
  const state = { index: i, routes: names.map((name) => ({ key: name, name })) };
  const navigation = {
    emit: () => ({ defaultPrevented: false }),
    navigate: (name: string) => setI(names.indexOf(name)),
  };
  return (
    <View style={{ height: 96 }}>
      <View style={{ position: "absolute", left: -12, right: -12, bottom: -12 }}>
        <FloatingTabBar state={state} navigation={navigation as never} items={items} />
      </View>
    </View>
  );
}

function OdometerDemo() {
  const { row } = useTheme();
  const [v, setV] = useState(12);
  return (
    <View style={{ gap: 12 }}>
      <Odometer value={v} size={34} />
      <Odometer value={v * 3.5} format={(n) => `₪ ${n.toFixed(2)}`} size={20} />
      <View style={[row, { gap: 10 }]}>
        <PrimaryButton style={{ flex: 1 }} variant="outline" label="+1" onPress={() => setV(v + 1)} />
        <PrimaryButton style={{ flex: 1 }} variant="outline" label="Random" onPress={() => setV(Math.floor(Math.random() * 1000))} />
      </View>
    </View>
  );
}

function RouteDemo() {
  const { row } = useTheme();
  const [i, setI] = useState(0);
  const [cancelled, setCancelled] = useState(false);
  const done = i === STATUSES.length - 1 && !cancelled;
  const items: TimelineItem[] = STATUSES.map((s, k) => ({
    key: s,
    label: s,
    at: k <= i ? "10:4" + k : undefined,
    state: cancelled && k === i ? "failed" : k < i || (done && k === i) ? "done" : k === i ? "now" : "next",
    tone: done ? "success" : undefined,
  }));
  return (
    <View>
      <Steps labels={STATUSES} index={i} tone={cancelled ? "danger" : done ? "success" : "brand"} />
      <View style={{ height: 24 }} />
      <VerticalTimeline items={items.filter((it, k) => !cancelled || k <= i)} />
      <View style={[row, { gap: 10, marginTop: 14 }]}>
        <PrimaryButton style={{ flex: 1 }} label="Next status" disabled={cancelled || i >= STATUSES.length - 1} onPress={() => setI(i + 1)} />
        <PrimaryButton style={{ flex: 1 }} variant="danger" label="Cancel" disabled={cancelled || done} onPress={() => setCancelled(true)} />
        <PrimaryButton style={{ flex: 1 }} variant="outline" label="Reset" onPress={() => { setI(0); setCancelled(false); }} />
      </View>
    </View>
  );
}

function RelocationDemo() {
  const { c, row } = useTheme();
  const [moved, setMoved] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const jobs = ["Job A", "Job B"];
  const accept = (id: string) => {
    setBusy(id);
    setTimeout(() => {
      hapticSuccess();
      setBusy(null);
      setMoved((m) => [...m, id]);
      setFlash(id);
      setTimeout(() => setFlash(null), 1400);
    }, 1200);
  };
  // one flat parent with stable keys, so a card really moves from New into Current job
  const order = [...jobs.filter((j) => moved.includes(j)), ...jobs.filter((j) => !moved.includes(j))];
  return (
    <View>
      {order.map((j, k) => {
        const isNew = !moved.includes(j);
        const head = (label: string) => (
          <Move key={`h-${label}`}>
            <View style={{ marginVertical: 8 }}>
              <Tag color={c.soft}>{label}</Tag>
            </View>
          </Move>
        );
        const prevNew = k > 0 && !moved.includes(order[k - 1]);
        return (
          <View key={j}>
            {k === 0 && (isNew ? head("New") : head("Current job"))}
            {isNew && !prevNew && k > 0 ? head("New") : null}
            <Move>
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.field, padding: 14, marginBottom: 8 }}>
                <View style={[row, { alignItems: "center", justifyContent: "space-between" }]}>
                  <Text style={{ color: c.ink, fontWeight: "700" }}>{j}</Text>
                  <CrossFade k={isNew ? "REQUESTED" : "ACCEPTED"}>
                    <Text style={{ color: isNew ? c.warning : c.success, fontWeight: "700" }}>{isNew ? "Requested" : "Accepted"}</Text>
                  </CrossFade>
                </View>
                {isNew ? <PrimaryButton style={{ marginTop: 10 }} label="Accept" loading={busy === j} road onPress={() => accept(j)} /> : null}
                <Flash active={flash === j} />
              </View>
            </Move>
          </View>
        );
      })}
      <PrimaryButton variant="outline" label="Reset" onPress={() => setMoved([])} />
    </View>
  );
}

function ContinuityDemo() {
  const { c, row } = useTheme();
  const [i, setI] = useState(0);
  const [mountedAt] = useState(() => new Date().toLocaleTimeString());
  return (
    <View>
      <View style={[row, { justifyContent: "space-between", alignItems: "center" }]}>
        <Text style={{ color: c.soft, fontSize: 12 }}>Card mounted at {mountedAt} (never changes on a poll)</Text>
        <CrossFade k={STATUSES[i]}>
          <Text style={{ color: c.bronze, fontWeight: "700" }}>{STATUSES[i]}</Text>
        </CrossFade>
      </View>
      <Steps labels={STATUSES} index={i} />
      <FadeSwitch show={i < 2}>
        <PrimaryButton style={{ marginTop: 12 }} variant="danger" label="Cancel request (valid only while early)" onPress={() => undefined} />
      </FadeSwitch>
      <PrimaryButton style={{ marginTop: 12 }} variant="outline" label="Simulate a poll with a new status" onPress={() => setI((i + 1) % STATUSES.length)} />
    </View>
  );
}

const MOCK = [
  { id: "a", name: "Mock A", lat: 32.2211, lng: 35.2544, kind: "tow" as const, dim: false },
  { id: "b", name: "Mock B", lat: 32.2305, lng: 35.2701, kind: "tow" as const, dim: false },
  { id: "c", name: "Mock C", lat: 32.2102, lng: 35.2402, kind: "tow" as const, dim: true },
];

function RadarDemo({ n }: { n: number }) {
  const { row } = useTheme();
  const reduced = useReduced();
  const [radar, setRadar] = useState(false);
  const [hl, setHl] = useState<{ id: string; key: string } | null>(null);
  return (
    <View>
      <View style={{ height: 260, borderRadius: 16, overflow: "hidden" }}>
        <ServiceMap
          key={n}
          height={260}
          pins={MOCK}
          selectedId={null}
          me={{ lat: 32.2205, lng: 35.2605 }}
          fit={[...MOCK.map((p) => [p.lat, p.lng] as [number, number]), [32.2205, 35.2605]]}
          fitKey={`lab${n}`}
          pad={{ top: 10, bottom: 10, left: 10, right: 10 }}
          radar={radar}
          highlight={hl}
          reduced={reduced}
          onSelect={() => undefined}
          onBackground={() => undefined}
        />
      </View>
      <View style={[row, { gap: 10, marginTop: 10 }]}>
        <PrimaryButton style={{ flex: 1 }} variant="outline" label={radar ? "Stop sonar" : "Sonar on"} onPress={() => setRadar(!radar)} />
        <PrimaryButton style={{ flex: 1 }} variant="outline" label="Highlight nearest" onPress={() => setHl({ id: "b", key: String(Date.now()) })} />
      </View>
    </View>
  );
}

/** One tunable number: label, value and - / + steppers. */
function Stepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (v: number) => void }) {
  const { c, row } = useTheme();
  const round = (v: number) => Math.round(v * 1000) / 1000;
  return (
    <View style={[row, { alignItems: "center", gap: 8, marginTop: 6 }]}>
      <Text style={{ flex: 1, color: c.ink, fontSize: 13 }}>{label}</Text>
      <PrimaryButton variant="outline" label="-" style={{ height: 36, paddingHorizontal: 14 }} onPress={() => onChange(round(value - step))} />
      <Text style={{ width: 56, textAlign: "center", color: c.ink, fontWeight: "700" }}>{String(value)}</Text>
      <PrimaryButton variant="outline" label="+" style={{ height: 36, paddingHorizontal: 14 }} onPress={() => onChange(round(value + step))} />
    </View>
  );
}

/** Mo (experiment): replay + steppers for every alignment number; copy the values you like into mascot/moConfig.ts. */
function MoDemo({ n }: { n: number }) {
  const { c } = useTheme();
  const [k, setK] = useState(0);
  const [v, setV] = useState({
    px: MO.pivot.x, py: MO.pivot.y, ox: MO.armOffset.x, oy: MO.armOffset.y, rest: MO.restAngle, peak: MO.peakAngle, end: MO.endAngle,
    scale: MO.armScale, cx: MO.check.x, cy: MO.check.y, size: MO.size,
  });
  const set = (key: keyof typeof v) => (x: number) => setV((cur) => ({ ...cur, [key]: x }));
  return (
    <View>
      <BlueprintSurface style={{ borderRadius: 20, height: v.size + 60, alignItems: "center", justifyContent: "flex-end", paddingBottom: 24 }}>
        <MascotMo
          key={n}
          size={v.size}
          pivot={{ x: v.px, y: v.py }}
          armOffset={{ x: v.ox, y: v.oy }}
          armScale={v.scale}
          restAngle={v.rest}
          peakAngle={v.peak}
          endAngle={v.end}
          check={{ x: v.cx, y: v.cy }}
          playKey={k}
          onPress={() => setK(k + 1)}
        />
      </BlueprintSurface>
      <PrimaryButton style={{ marginTop: 10 }} label="Replay" onPress={() => setK(k + 1)} />
      <Text style={{ color: c.soft, fontSize: 12, marginTop: 10 }}>Pivot = shoulder joint in the ARM image; offset = where it sits on the BODY.</Text>
      <Stepper label="pivot x" value={v.px} step={0.01} onChange={set("px")} />
      <Stepper label="pivot y" value={v.py} step={0.01} onChange={set("py")} />
      <Stepper label="armOffset x" value={v.ox} step={0.01} onChange={set("ox")} />
      <Stepper label="armOffset y" value={v.oy} step={0.01} onChange={set("oy")} />
      <Stepper label="armScale" value={v.scale} step={0.01} onChange={set("scale")} />
      <Stepper label="restAngle" value={v.rest} step={1} onChange={set("rest")} />
      <Stepper label="peakAngle" value={v.peak} step={1} onChange={set("peak")} />
      <Stepper label="endAngle" value={v.end} step={1} onChange={set("end")} />
      <Stepper label="check x" value={v.cx} step={0.02} onChange={set("cx")} />
      <Stepper label="check y" value={v.cy} step={0.02} onChange={set("cy")} />
      <Stepper label="size (px)" value={v.size} step={10} onChange={set("size")} />
    </View>
  );
}

/** Mo at his desk (Home): the one-shot entrance with a Replay button and a size stepper. */
function HomeMoDemo({ n }: { n: number }) {
  const { c } = useTheme();
  const [k, setK] = useState(0);
  const [size, setSize] = useState(170);
  const [arm, setArm] = useState({ dx: HOME_MO.restArm.dx, dy: HOME_MO.restArm.dy, scale: HOME_MO.restArm.scale });
  return (
    <View>
      <BlueprintSurface style={{ borderRadius: 20, height: size + 40, alignItems: "center", justifyContent: "flex-end", paddingBottom: 14 }}>
        <HomeMo key={n} size={size} playKey={k} delay={0} sipDelay={400} restArm={arm} />
      </BlueprintSurface>
      <PrimaryButton style={{ marginTop: 10 }} label="Replay" onPress={() => setK(k + 1)} />
      <Text style={{ color: c.soft, fontSize: 12, marginTop: 10 }}>Fade in, rise 10 px, settle 0.98 to 1; then one sip (arm crossfade 350 ms, hold 0.9 s, back) with steam over the mug. Tap Mo or Replay to sip again. Arabic keeps the artwork unflipped.</Text>
      <Stepper label="size (px)" value={size} step={10} onChange={setSize} />
      <Text style={{ color: c.ink, fontSize: 13, fontWeight: "700", marginTop: 14 }}>Resting arm: sleeve cap fit</Text>
      <Stepper label="offset x (frame px)" value={arm.dx} step={2} onChange={(v) => setArm((a) => ({ ...a, dx: v }))} />
      <Stepper label="offset y (frame px)" value={arm.dy} step={2} onChange={(v) => setArm((a) => ({ ...a, dy: v }))} />
      <Stepper label="scale" value={arm.scale} step={0.02} onChange={(v) => setArm((a) => ({ ...a, scale: v }))} />
      <Text style={{ color: c.soft, fontSize: 12, marginTop: 8 }}>{`Copy into moConfig.ts HOME_MO.restArm: { dx: ${arm.dx}, dy: ${arm.dy}, scale: ${arm.scale} }`}</Text>
    </View>
  );
}

export default function MotionLab() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Lab />;
}

function Lab() {
  const { c, row } = useTheme();
  const { isArabic } = useL();
  const [mode, setMode] = useState<"system" | "on" | "off">("system");
  useEffect(() => {
    setReducedOverride(mode === "system" ? null : mode === "on");
    return () => setReducedOverride(null);
  }, [mode]);
  const reduced = useReduced();
  const kinds: AssemblyKind[] = ASSEMBLY_KINDS;
  return (
    <SimplePage kind="toolbox" tl="DEV / MOTION" title="Motion lab" sub={`Every motion piece, same components as the real screens. Reduced motion: ${reduced ? "ON" : "off"}${isArabic ? " · RTL" : ""}`} back="/customer/profile">
      <View style={[row, { marginTop: 8, alignItems: "center", gap: 10 }]}>
        <Text style={{ color: c.soft, fontSize: 12 }}>Reduced motion preview</Text>
        <Seg value={mode} onChange={setMode} options={[{ key: "system", label: "System" }, { key: "on", label: "On" }, { key: "off", label: "Off" }]} />
      </View>

      <Demo title="Ignition entrance" note="Grid fades in, hero traces, headlights glow, content staggers (first entry of a tab).">
        {(n) => (
          <BlueprintSurface key={n} gridFade style={{ borderRadius: 20, height: 190, padding: 12 }}>
            <CarTop animate delay={M.grid} headlights />
          </BlueprintSurface>
        )}
      </Demo>

      <Demo title="PrecisionReveal" note="Fade + 9 px rise, 270 ms, 45 ms stagger.">
        {(n) => (
          <View key={n} style={{ gap: 8 }}>
            {[0, 1, 2, 3].map((k) => (
              <Rise key={k} i={k}>
                <View style={{ height: 40, borderRadius: 12, backgroundColor: c.pill }} />
              </Rise>
            ))}
          </View>
        )}
      </Demo>

      <Demo title="Tab indicator" note="Tap a tab: the pill slides (spring, no bounce). Switch language to see it mirror." replay={false}>
        {() => <TabIndicatorDemo />}
      </Demo>

      <Demo title="Odometer" note="Digits roll only when the value changes." replay={false}>
        {() => <OdometerDemo />}
      </Demo>

      <Demo title="RoadLoader" note="Location lookup, route calculation, sending, accepting.">
        {(n) => (
          <View key={n} style={{ gap: 14 }}>
            <RoadLoader label="Finding your location…" />
            <View style={{ alignItems: "center" }}>
              <RoadLoader compact />
            </View>
          </View>
        )}
      </Demo>

      <Demo title="InspectionCheck" note="Fits my car · Your car · Verified · admin decisions.">
        {(n) => (
          <View key={n} style={[row, { gap: 28, alignItems: "center" }]}>
            <InspectionCheck size={32} color={c.bronze} />
            <InspectionCheck kind="x" size={32} color={c.danger} delay={M.stagger} />
            <InspectionCheck kind="warn" size={32} color={c.warning} delay={2 * M.stagger} />
          </View>
        )}
      </Demo>

      <Demo title="Route: Steps + VerticalTimeline" note="Next status extends the line only from the previous node. Cancel stops it on a danger node." replay={false}>
        {() => <RouteDemo />}
      </Demo>

      <Demo title="Category assemblies (8)" note="Groups assemble outward → in place, 60 ms apart, ≤ 700 ms.">
        {(n) => (
          <View key={n} style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {kinds.map((k) => (
              <BlueprintSurface key={k} style={{ width: "48%", height: 110, borderRadius: 14, padding: 4 }}>
                <CategoryAssembly kind={k} assemble />
              </BlueprintSurface>
            ))}
          </View>
        )}
      </Demo>

      <Demo title="Headlights" note="Two soft bronze glows after the trace, then a low glow.">
        {(n) => (
          <BlueprintSurface key={n} style={{ borderRadius: 20, height: 150, padding: 10 }}>
            <CarTop animate headlights />
          </BlueprintSurface>
        )}
      </Demo>

      <Demo title="Mo — Home (desk scene)" note="Tap Mo or Replay: fade in and settle.">
        {(n) => <HomeMoDemo n={n} />}
      </Demo>

      <Demo title="Mo (mascot experiment)" note="Tap Mo or Replay. Steppers align the arm: set pivot / offset until the cuff hides the seam.">
        {(n) => <MoDemo n={n} />}
      </Demo>

      <Demo title="Tow Discovery hero (Ignition)" note="Road draws, truck settles in, availability dot resolves; then still. Tap the scene to replay it.">
        {(n) => (
          <View key={n} style={{ marginHorizontal: -20, marginTop: -4 }}>
            <TowHero
              play
              available
              tag="TOW / 02"
              title="Tow trucks"
              line={<Text style={{ color: c.cream, fontSize: 14 }}>3 tow companies available</Text>}
              hint="Choose your location to find nearby towing"
              primary={{ label: "Request nearest available", icon: "tow", onPress: () => hapticSuccess() }}
              secondary={{ label: "View map", icon: "map", onPress: () => router.push("/customer/tow/map" as never) }}
            />
          </View>
        )}
      </Demo>

      <Demo title="Hero v2: Tow (mini live map, earlier idea)" note="Compact hero: real-line + primary action + non-interactive map. Dev mock pins around Nablus; the real Tow tab uses real companies.">
        {(n) => (
          <View key={n} style={{ marginHorizontal: -20, marginTop: -4 }}>
            <CompactHero
              ignition
              tag="TOW / 02"
              title="Tow trucks"
              line={<Text style={{ color: c.cream, fontSize: 13 }}>Showing Nablus — use my location</Text>}
              primary={{ label: "Request nearest available", icon: "tow", onPress: () => hapticSuccess() }}
              secondary={{ label: "View on map", icon: "map", onPress: () => router.push("/customer/tow/map" as never) }}
              visual={<MiniMap pins={MOCK} me={{ lat: 32.2205, lng: 35.2605 }} searching height={128} fitKey={`lab-hero${n}`} onOpen={() => undefined} label="Open the map" />}
            />
          </View>
        )}
      </Demo>

      <Demo title="Sonar + pin highlight (Leaflet)" note="Mock pins around Nablus. Needs internet for the map tiles.">
        {(n) => <RadarDemo n={n} />}
      </Demo>

      <Demo title="Card relocation" note="Accept: RoadLoader on the button, haptic, highlight, the card moves into Current job." replay={false}>
        {() => <RelocationDemo />}
      </Demo>

      <Demo title="StatusContinuity" note="A poll changes the status: only the label, the line/node and the valid buttons animate. The card never remounts." replay={false}>
        {() => <ContinuityDemo />}
      </Demo>
    </SimplePage>
  );
}
