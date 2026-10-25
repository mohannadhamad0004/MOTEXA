import { ComponentProps, createContext, ReactNode, useContext, useEffect, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, { cancelAnimation, SharedValue, useAnimatedProps, useSharedValue, withDelay, withTiming, runOnJS } from "react-native-reanimated";
import Svg, { Circle, Defs, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/useTheme";
import { ease, M, useReduced } from "../../motion";

// Line drawings: 1.5px bronzeLight strokes, round caps. A drawing renders its shapes twice: once as a soft
// "glow" underlay (strokeWidth 4, opacity .25; RN has no drop-shadow filter) and once as the crisp line. With
// `animate` the line traces itself once per mount (strokeDashoffset 1400 -> 0, `duration` ms, UI thread).

type Mode = { glow: boolean; progress: SharedValue<number> | null; done: boolean };
const Ctx = createContext<Mode>({ glow: false, progress: null, done: true });

const AnimPath = Animated.createAnimatedComponent(Path);
const AnimCircle = Animated.createAnimatedComponent(Circle);
const AnimRect = Animated.createAnimatedComponent(Rect);
const AnimG = Animated.createAnimatedComponent(G);

function make<T extends typeof Path | typeof Circle | typeof Rect>(Plain: T, Anim: any) {
  return function Shape(props: ComponentProps<T>) {
    const { glow, progress, done } = useContext(Ctx);
    const p = props as any;
    const dashed = !!p.strokeDasharray;
    const base = p.opacity ?? 1;
    const ap = useAnimatedProps<any>(() => {
      if (!progress) return {};
      // dashed guide lines cannot be traced with a dash offset: they fade in at the end instead
      if (dashed) return { opacity: base * Math.min(1, Math.max(0, (progress.value - 0.6) / 0.4)) };
      return { strokeDashoffset: 1400 * (1 - progress.value) };
    });
    if (glow) return <Plain {...p} strokeWidth={4} />;
    if (!progress || done) return <Plain {...p} />;
    return dashed ? <Anim {...p} animatedProps={ap} /> : <Anim {...p} strokeDasharray={1400} animatedProps={ap} />;
  };
}
const P = make(Path, AnimPath);
const Ci = make(Circle, AnimCircle);
const Rc = make(Rect, AnimRect);

export type DrawingProps = {
  animate?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  /** trace duration in ms (default: the hero signature, max 900) */
  duration?: number;
  /** ms to wait before the trace starts */
  delay?: number;
  /** called on the JS thread when the trace has finished */
  onDone?: () => void;
};

function Drawing({
  vb,
  animate = false,
  glow = true,
  style,
  duration = M.hero,
  delay = 0,
  onDone,
  overlay,
  children,
}: DrawingProps & { vb: string; children: ReactNode; overlay?: ReactNode }) {
  const { c } = useTheme();
  const reduced = useReduced();
  const progress = useSharedValue(animate ? 0 : 1);
  const [done, setDone] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const fin = () => {
      setDone(true);
      onDone?.();
    };
    const wait = reduced ? 0 : delay;
    progress.value = withDelay(wait, withTiming(1, { duration: reduced ? M.reduced : duration, easing: ease }, (ok) => ok && runOnJS(fin)()));
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, reduced]);

  const line: Mode = { glow: false, progress: animate ? progress : null, done };
  const glowProps = useAnimatedProps(() => ({ opacity: animate && !done ? 0.25 * Math.min(1, Math.max(0, (progress.value - 0.5) / 0.5)) : 0.25 }));
  return (
    <View style={[{ width: "100%", height: "100%" }, style]}>
      <Svg viewBox={vb} width="100%" height="100%" fill="none" stroke={c.bronzeLight} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        {glow && (
          <AnimG animatedProps={glowProps}>
            <Ctx.Provider value={{ glow: true, progress: null, done: true }}>{children}</Ctx.Provider>
          </AnimG>
        )}
        <Ctx.Provider value={line}>{children}</Ctx.Provider>
        {overlay}
      </Svg>
    </View>
  );
}

/** Two soft bronze headlight glows + short beams at the front of the car. Fades 0 -> .9 -> .6 once, then rests low. */
function Headlights({ delay, reduced }: { delay: number; reduced: boolean }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(
      reduced ? 0 : delay,
      withTiming(0.9, { duration: reduced ? M.reduced : 250, easing: ease }, () => {
        o.value = withTiming(0.6, { duration: reduced ? M.reduced : 250, easing: ease });
      })
    );
    return () => cancelAnimation(o);
  }, [o, delay, reduced]);
  const ap = useAnimatedProps(() => ({ opacity: o.value }));
  return (
    <AnimG animatedProps={ap}>
      <Defs>
        <RadialGradient id="hlGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#E0A36F" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#E0A36F" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id="hlBeam" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#E0A36F" stopOpacity="0.45" />
          <Stop offset="1" stopColor="#E0A36F" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Path d="M286 66 L318 52 L318 80 Z" fill="url(#hlBeam)" stroke="none" />
      <Path d="M286 94 L318 80 L318 108 Z" fill="url(#hlBeam)" stroke="none" />
      <Circle cx="286" cy="67" r="14" fill="url(#hlGlow)" stroke="none" />
      <Circle cx="286" cy="93" r="14" fill="url(#hlGlow)" stroke="none" />
    </AnimG>
  );
}

export function CarTop({ headlights, ...p }: DrawingProps & { headlights?: boolean }) {
  const reduced = useReduced();
  return (
    <Drawing
      vb="0 0 320 160"
      {...p}
      overlay={headlights ? <Headlights delay={(p.delay ?? 0) + (p.duration ?? M.hero)} reduced={reduced} /> : undefined}
    >
      <P d="M40 80 C40 50 60 38 100 36 L220 36 C262 38 285 52 288 80 C285 108 262 122 220 124 L100 124 C60 122 40 110 40 80 Z" />
      <P d="M110 44 L200 44 C215 50 222 64 222 80 C222 96 215 110 200 116 L110 116 C100 108 96 95 96 80 C96 65 100 52 110 44Z" />
      <P d="M222 54 L250 60 C258 70 258 90 250 100 L222 106" />
      <P d="M96 52 L72 58 C66 70 66 90 72 102 L96 108" />
      <P d="M130 44 L130 116 M190 44 L190 116" strokeDasharray="3 5" />
      <Rc x="66" y="26" width="34" height="10" rx="4" />
      <Rc x="66" y="124" width="34" height="10" rx="4" />
      <Rc x="218" y="26" width="34" height="10" rx="4" />
      <Rc x="218" y="124" width="34" height="10" rx="4" />
      <P d="M280 66 L288 70 M280 94 L288 90 M46 64 L42 70 M46 96 L42 90" />
      <P d="M20 80 L300 80" strokeDasharray="2 6" opacity={0.5} />
    </Drawing>
  );
}

export function TowTruck(p: DrawingProps) {
  return (
    <Drawing vb="0 0 300 140" {...p}>
      <P d="M20 100 L20 70 L60 70 L72 46 L110 46 L110 100" />
      <P d="M76 52 L104 52 L104 70 L68 70 Z" />
      <P d="M110 86 L270 86 L270 100 L110 100" />
      <P d="M150 86 L240 40 M240 40 L250 44 L250 60" />
      <P d="M250 60 C250 70 240 70 240 64" />
      <Ci cx="56" cy="104" r="14" />
      <Ci cx="56" cy="104" r="5" />
      <Ci cx="200" cy="104" r="14" />
      <Ci cx="200" cy="104" r="5" />
      <Ci cx="236" cy="104" r="14" />
      <Ci cx="236" cy="104" r="5" />
      <P d="M10 118 L290 118" strokeDasharray="2 6" opacity={0.5} />
    </Drawing>
  );
}

export function BrakeDisc({ dims = false, ...p }: DrawingProps & { dims?: boolean }) {
  return (
    <Drawing vb="0 0 300 200" {...p}>
      <Ci cx="150" cy="100" r="82" />
      <Ci cx="150" cy="100" r="56" />
      <Ci cx="150" cy="100" r="40" />
      <Ci cx="150" cy="100" r="12" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return <Ci key={i} cx={150 + Math.cos(a) * 26} cy={100 + Math.sin(a) * 26} r="5" />;
      })}
      {Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return (
          <P
            key={i}
            d={`M${150 + Math.cos(a) * 58} ${100 + Math.sin(a) * 58} L${150 + Math.cos(a + 0.12) * 78} ${100 + Math.sin(a + 0.12) * 78}`}
            opacity={0.7}
          />
        );
      })}
      {dims && (
        <>
          <P d="M68 190 L232 190 M68 184 L68 196 M232 184 L232 196" />
          <P d="M260 18 L260 182 M254 18 L266 18 M254 182 L266 182" />
          <P d="M150 100 L230 30" strokeDasharray="3 4" />
        </>
      )}
    </Drawing>
  );
}

export function SparkPlug(p: DrawingProps) {
  return (
    <Drawing vb="0 0 120 200" {...p}>
      <P d="M50 10 L70 10 L70 30 L50 30 Z M46 30 L74 30 L74 70 L46 70 Z" />
      <P d="M40 70 L80 70 L80 100 L40 100 Z M44 78 L76 78 M44 92 L76 92" />
      <P d="M50 100 L50 150 L70 150 L70 100 M50 110 L70 116 M50 122 L70 128 M50 134 L70 140" />
      <P d="M58 150 L58 168 L72 168" />
    </Drawing>
  );
}

export function Wrench(p: DrawingProps) {
  return (
    <Drawing vb="0 0 300 180" {...p}>
      <P d="M70 40 C50 40 38 58 44 76 L56 70 L66 80 L60 92 C78 98 96 86 96 66 L200 150 C208 158 222 146 214 138 L110 54 C112 46 106 40 98 40" />
      <Ci cx="205" cy="144" r="3" />
      <Ci cx="230" cy="62" r="20" />
      <P d="M200 120 C200 96 214 86 230 86 C246 86 260 96 260 120" />
      <P d="M216 56 L244 56" strokeDasharray="2 3" />
      <P d="M20 160 L280 160" strokeDasharray="2 6" opacity={0.5} />
    </Drawing>
  );
}

export function MapPin(p: DrawingProps) {
  return (
    <Drawing vb="0 0 120 160" {...p}>
      <P d="M60 142 C60 142 22 98 22 60 a38 38 0 0 1 76 0 C98 98 60 142 60 142 Z" />
      <Ci cx="60" cy="60" r="15" />
      <P d="M28 150 L92 150" strokeDasharray="2 5" opacity={0.5} />
    </Drawing>
  );
}

export function OilCan(p: DrawingProps) {
  return (
    <Drawing vb="0 0 300 200" {...p}>
      <P d="M70 80 L70 150 C70 160 76 166 86 166 L170 166 C180 166 186 160 186 150 L186 80 C186 72 180 66 170 66 L86 66 C76 66 70 72 70 80Z" />
      <P d="M110 66 L110 54 L146 54 L146 66" />
      <P d="M186 100 L238 56 L254 56 M254 50 L254 62" />
      <P d="M70 92 C44 92 36 112 44 128 C50 138 62 138 70 132" />
      <P d="M92 100 L164 100 M92 120 L150 120" strokeDasharray="3 5" />
      <P d="M20 180 L280 180" strokeDasharray="2 6" opacity={0.5} />
    </Drawing>
  );
}

export function OilFilter(p: DrawingProps) {
  return (
    <Drawing vb="0 0 200 200" {...p}>
      <P d="M60 70 L60 150 C60 160 70 166 100 166 C130 166 140 160 140 150 L140 70" />
      <P d="M60 70 C60 60 80 54 100 54 C120 54 140 60 140 70 C140 80 120 86 100 86 C80 86 60 80 60 70Z" />
      <P d="M84 70 a16 8 0 1 0 32 0 a16 8 0 1 0 -32 0" />
      <P d="M60 112 C60 120 80 124 100 124 C120 124 140 120 140 112" opacity={0.7} />
      <P d="M60 130 C60 138 80 142 100 142 C120 142 140 138 140 130" opacity={0.7} />
      <P d="M72 166 L72 178 L128 178 L128 166 M80 178 L80 186 M120 178 L120 186" />
    </Drawing>
  );
}

export function Battery(p: DrawingProps) {
  return (
    <Drawing vb="0 0 300 200" {...p}>
      <Rc x="50" y="70" width="200" height="92" rx="8" />
      <Rc x="78" y="58" width="26" height="12" rx="2" />
      <Rc x="196" y="58" width="26" height="12" rx="2" />
      <P d="M84 44 H98 M91 37 V51 M202 44 H216" />
      <P d="M156 86 L138 118 H158 L146 148" />
      <P d="M110 70 V162 M190 70 V162" strokeDasharray="3 5" opacity={0.6} />
      <P d="M20 182 L280 182" strokeDasharray="2 6" opacity={0.5} />
    </Drawing>
  );
}

export function Headlight(p: DrawingProps) {
  return (
    <Drawing vb="0 0 300 200" {...p}>
      <Ci cx="170" cy="100" r="70" />
      <Ci cx="170" cy="100" r="48" />
      <Ci cx="170" cy="100" r="22" />
      <Ci cx="170" cy="100" r="58" strokeDasharray="2 6" opacity={0.6} />
      <P d="M96 64 L40 44 M90 100 L28 100 M96 136 L40 156" />
      <P d="M240 100 L268 100 M268 88 V112" />
    </Drawing>
  );
}

export function Tyre(p: DrawingProps) {
  return (
    <Drawing vb="0 0 200 200" {...p}>
      <Ci cx="100" cy="100" r="84" />
      <Ci cx="100" cy="100" r="64" />
      <Ci cx="100" cy="100" r="42" />
      <Ci cx="100" cy="100" r="12" />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return <Ci key={i} cx={100 + Math.cos(a) * 27} cy={100 + Math.sin(a) * 27} r="4" />;
      })}
      {Array.from({ length: 28 }, (_, i) => {
        const a = (i / 28) * Math.PI * 2;
        return <P key={i} d={`M${100 + Math.cos(a) * 70} ${100 + Math.sin(a) * 70} L${100 + Math.cos(a + 0.1) * 84} ${100 + Math.sin(a + 0.1) * 84}`} opacity={0.7} />;
      })}
    </Drawing>
  );
}

export function Shock(p: DrawingProps) {
  return (
    <Drawing vb="0 0 120 220" {...p}>
      <Ci cx="60" cy="20" r="11" />
      <Ci cx="60" cy="20" r="4" />
      <P d="M60 31 V88" />
      <P d="M44 88 H76 V168 H44 Z" />
      <P d="M34 98 L86 108 L34 118 L86 128 L34 138 L86 148 L34 158" />
      <P d="M60 168 V188" />
      <Ci cx="60" cy="200" r="11" />
      <Ci cx="60" cy="200" r="4" />
    </Drawing>
  );
}

export function Toolbox(p: DrawingProps) {
  return (
    <Drawing vb="0 0 300 200" {...p}>
      <Rc x="40" y="90" width="220" height="82" rx="8" />
      <P d="M40 120 H260" />
      <P d="M110 90 V72 C110 64 116 60 124 60 H176 C184 60 190 64 190 72 V90" />
      <Rc x="138" y="108" width="24" height="22" rx="3" />
      <P d="M62 144 H92 M208 144 H238" strokeDasharray="3 5" />
      <P d="M20 184 L280 184" strokeDasharray="2 6" opacity={0.5} />
    </Drawing>
  );
}

export function Shop(p: DrawingProps) {
  return (
    <Drawing vb="0 0 300 200" {...p}>
      <P d="M50 70 L66 34 H234 L250 70 Z" />
      <P d="M50 70 C50 84 76 84 76 70 C76 84 102 84 102 70 C102 84 128 84 128 70 C128 84 154 84 154 70 C154 84 180 84 180 70 C180 84 206 84 206 70 C206 84 232 84 232 70 C232 84 250 84 250 70" />
      <P d="M62 82 V168 H238 V82" />
      <Rc x="130" y="112" width="40" height="56" rx="2" />
      <Rc x="76" y="104" width="40" height="36" rx="2" />
      <Rc x="184" y="104" width="40" height="36" rx="2" />
      <P d="M20 180 L280 180" strokeDasharray="2 6" opacity={0.5} />
    </Drawing>
  );
}

/** Faint construction lines behind a hero (circles, diagonals, a dashed vertical). */
export function Construction() {
  const { c } = useTheme();
  return (
    <Svg
      pointerEvents="none"
      style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}
      width="100%"
      height="100%"
      viewBox="0 0 390 300"
      preserveAspectRatio="none"
      fill="none"
      stroke={c.bronzeLight}
      strokeWidth={0.6}
      opacity={0.18}
    >
      <Circle cx="320" cy="60" r="140" />
      <Circle cx="320" cy="60" r="90" strokeDasharray="2 6" />
      <Circle cx="40" cy="300" r="180" />
      <Path d="M-20 260 L410 20 M0 300 L390 120" />
      <Path d="M195 0 L195 300" strokeDasharray="4 8" />
    </Svg>
  );
}

export const DRAWINGS = {
  car: CarTop,
  tow: TowTruck,
  disc: BrakeDisc,
  plug: SparkPlug,
  wrench: Wrench,
  pin: MapPin,
  oil: OilCan,
  filter: OilFilter,
  battery: Battery,
  light: Headlight,
  tyre: Tyre,
  shock: Shock,
  toolbox: Toolbox,
  shop: Shop,
} as const;
export type DrawingKind = keyof typeof DRAWINGS;
