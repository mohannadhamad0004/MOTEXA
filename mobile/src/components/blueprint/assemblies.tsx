import { ReactNode, useEffect, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";
import { ease, M, useReduced } from "../../motion";
import { useTheme } from "../../theme/useTheme";

// CATEGORY ASSEMBLY LIBRARY: eight technical line illustrations in the Blueprint style (viewBox 240 x 160), each built from
// 3-6 groups. In a product hero the groups start 6-14 px outward at 30% opacity and assemble into place (max 700 ms,
// 60 ms apart). Everywhere else (part thumbnails, category tiles) the same drawing is static.

export type AssemblyKind = "brakes" | "engine" | "electrical" | "filters" | "suspension" | "lighting" | "cooling" | "body" | "generic";
type Group = { key: string; dx: number; dy: number; node: ReactNode };

const VB_W = 240;
const VB_H = 160;

const dash = { strokeDasharray: "3 5", opacity: 0.55 } as const;

const GROUPS: Record<AssemblyKind, Group[]> = {
  brakes: [
    {
      key: "disc",
      dx: -12,
      dy: 0,
      node: (
        <>
          <Circle cx="100" cy="80" r="54" />
          <Circle cx="100" cy="80" r="40" />
          <Circle cx="100" cy="80" r="17" />
          <Circle cx="100" cy="80" r="6" />
          {[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
            return <Circle key={i} cx={100 + Math.cos(a) * 11.5} cy={80 + Math.sin(a) * 11.5} r="2.2" />;
          })}
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return <Path key={i} d={`M${100 + Math.cos(a) * 44} ${80 + Math.sin(a) * 44} L${100 + Math.cos(a + 0.12) * 51} ${80 + Math.sin(a + 0.12) * 51}`} opacity={0.7} />;
          })}
        </>
      ),
    },
    { key: "caliper", dx: 14, dy: -6, node: <Path d="M134 36 C162 38 178 56 178 80 C178 104 162 122 134 124 L134 108 C146 106 154 96 154 80 C154 64 146 54 134 52 Z" /> },
    { key: "pad", dx: 10, dy: 8, node: <Path d="M124 54 L136 54 L136 106 L124 106 C128 96 128 64 124 54 Z" /> },
    {
      key: "bolts",
      dx: 8,
      dy: -12,
      node: (
        <>
          <Path d="M170 40 L186 40 M178 40 V28" />
          <Circle cx="178" cy="24" r="4" />
        </>
      ),
    },
  ],
  engine: [
    {
      key: "block",
      dx: 0,
      dy: 8,
      node: (
        <>
          <Rect x="58" y="76" width="124" height="56" rx="4" />
          {[84, 120, 156].map((x) => (
            <Circle key={x} cx={x} cy="104" r="12" />
          ))}
          <Path d="M58 132 H182 M70 132 V144 H170 V132" />
        </>
      ),
    },
    {
      key: "head",
      dx: 0,
      dy: -8,
      node: (
        <>
          <Rect x="54" y="54" width="132" height="22" rx="3" />
          {[84, 120, 156].map((x) => (
            <Path key={x} d={`M${x - 8} 54 V76 M${x + 8} 54 V76`} {...dash} />
          ))}
        </>
      ),
    },
    {
      key: "cover",
      dx: 0,
      dy: -14,
      node: (
        <>
          <Path d="M64 54 V40 H176 V54" />
          <Rect x="108" y="30" width="24" height="10" rx="3" />
        </>
      ),
    },
    {
      key: "pulley",
      dx: -14,
      dy: 0,
      node: (
        <>
          <Circle cx="38" cy="104" r="20" />
          <Circle cx="38" cy="104" r="8" />
          <Path d="M38 84 V124 M18 104 H58" {...dash} />
        </>
      ),
    },
  ],
  electrical: [
    {
      key: "battery",
      dx: 0,
      dy: 8,
      node: (
        <>
          <Rect x="62" y="64" width="116" height="62" rx="5" />
          <Path d="M62 80 H178" />
          <Rect x="76" y="54" width="18" height="10" rx="2" />
          <Rect x="146" y="54" width="18" height="10" rx="2" />
          <Path d="M82 100 H98 M90 92 V108 M142 100 H158" />
        </>
      ),
    },
    { key: "cable", dx: 12, dy: -10, node: <Path d="M164 54 C164 30 196 34 198 62 C200 92 210 100 212 124" /> },
    {
      key: "terminal",
      dx: -10,
      dy: -12,
      node: (
        <>
          <Circle cx="85" cy="40" r="9" />
          <Circle cx="85" cy="40" r="3" />
          <Path d="M94 40 H108 V48 H94" />
        </>
      ),
    },
  ],
  filters: [
    {
      key: "housing",
      dx: 0,
      dy: 10,
      node: (
        <>
          <Path d="M82 52 V128 C82 138 98 142 120 142 C142 142 158 138 158 128 V52" />
          <Path d="M82 128 C82 120 158 120 158 128" {...dash} />
        </>
      ),
    },
    {
      key: "element",
      dx: 0,
      dy: -2,
      node: (
        <>
          <Rect x="94" y="56" width="52" height="68" rx="3" />
          {[102, 110, 118, 126, 134].map((x) => (
            <Path key={x} d={`M${x} 60 V120`} />
          ))}
        </>
      ),
    },
    { key: "cap", dx: 0, dy: -14, node: <Path d="M74 52 H166 V40 C166 34 160 32 154 32 H86 C80 32 74 34 74 40 Z" /> },
    {
      key: "seal",
      dx: 0,
      dy: -8,
      node: (
        <>
          <Path d="M86 52 C86 58 154 58 154 52" />
          <Circle cx="120" cy="22" r="4" />
          <Path d="M120 26 V32" />
        </>
      ),
    },
  ],
  suspension: [
    { key: "spring", dx: -12, dy: 0, node: <Path d="M70 40 L110 50 L70 62 L110 74 L70 86 L110 98 L70 110 L110 122" /> },
    {
      key: "damper",
      dx: 10,
      dy: 0,
      node: (
        <>
          <Rect x="136" y="70" width="26" height="62" rx="3" />
          <Path d="M149 70 V34" />
        </>
      ),
    },
    {
      key: "mount",
      dx: 0,
      dy: -14,
      node: (
        <>
          <Rect x="60" y="24" width="110" height="10" rx="3" />
          <Circle cx="149" cy="26" r="4" />
        </>
      ),
    },
    {
      key: "arm",
      dx: 0,
      dy: 14,
      node: (
        <>
          <Path d="M60 136 H180" />
          <Circle cx="149" cy="136" r="7" />
          <Circle cx="149" cy="136" r="2.5" />
        </>
      ),
    },
  ],
  lighting: [
    { key: "lens", dx: 14, dy: 0, node: <Path d="M150 34 C176 46 186 66 186 80 C186 94 176 114 150 126" /> },
    { key: "reflector", dx: -6, dy: 0, node: <Path d="M150 34 C96 34 62 56 62 80 C62 104 96 126 150 126" /> },
    {
      key: "bulb",
      dx: -12,
      dy: 0,
      node: (
        <>
          <Circle cx="104" cy="80" r="14" />
          <Path d="M96 80 C98 74 102 74 104 80 C106 86 110 86 112 80" />
          <Path d="M96 94 V104 H112 V94" />
        </>
      ),
    },
    { key: "beam", dx: 12, dy: 0, node: <Path d="M196 56 H228 M200 80 H232 M196 104 H228" {...dash} /> },
  ],
  cooling: [
    {
      key: "core",
      dx: -10,
      dy: 0,
      node: (
        <>
          <Rect x="40" y="40" width="92" height="80" rx="4" />
          {[56, 72, 88, 104].map((y) => (
            <Path key={y} d={`M40 ${y} H132`} />
          ))}
          {[58, 76, 94, 112].map((x) => (
            <Path key={x} d={`M${x} 40 V120`} opacity={0.5} />
          ))}
        </>
      ),
    },
    {
      key: "fan",
      dx: 12,
      dy: 0,
      node: (
        <>
          <Circle cx="170" cy="80" r="36" />
          <Circle cx="170" cy="80" r="6" />
          <Path d="M170 74 C166 56 176 46 188 50 C184 62 178 70 170 74 Z" />
          <Path d="M176 80 C194 76 204 86 200 98 C188 94 180 88 176 80 Z" />
          <Path d="M170 86 C174 104 164 114 152 110 C156 98 162 90 170 86 Z" />
          <Path d="M164 80 C146 84 136 74 140 62 C152 66 160 72 164 80 Z" />
        </>
      ),
    },
    { key: "hose", dx: 0, dy: -12, node: <Path d="M132 52 C150 52 150 26 176 26 H208" /> },
    {
      key: "cap",
      dx: -6,
      dy: -14,
      node: (
        <>
          <Rect x="62" y="28" width="22" height="12" rx="3" />
          <Path d="M68 28 V24 H78 V28" />
        </>
      ),
    },
  ],
  body: [
    {
      key: "panel",
      dx: 0,
      dy: 6,
      node: <Path d="M34 112 C34 96 44 86 62 80 L92 56 C100 50 108 48 118 48 H160 C178 48 192 60 200 80 C214 84 222 94 222 112 Z" />,
    },
    {
      key: "mirror",
      dx: -12,
      dy: -10,
      node: (
        <>
          <Path d="M70 78 L56 70 C50 68 46 74 50 80 L64 84" />
          <Path d="M64 84 H74" />
        </>
      ),
    },
    {
      key: "doorline",
      dx: 8,
      dy: 4,
      node: (
        <>
          <Path d="M118 48 V112 M170 52 V112" />
          <Path d="M130 82 H152" />
        </>
      ),
    },
    {
      key: "wheelarch",
      dx: 0,
      dy: 12,
      node: (
        <>
          <Path d="M58 112 C58 94 90 94 90 112" />
          <Path d="M168 112 C168 94 200 94 200 112" />
        </>
      ),
    },
  ],
  generic: [
    { key: "top", dx: 0, dy: -10, node: <Path d="M120 36 L176 58 L120 80 L64 58 Z" /> },
    { key: "left", dx: -10, dy: 6, node: <Path d="M64 58 L120 80 V132 L64 110 Z" /> },
    { key: "right", dx: 10, dy: 6, node: <Path d="M176 58 V110 L120 132 V80" /> },
  ],
};

const BY_CATEGORY: Record<string, AssemblyKind> = {
  BRAKE_SYSTEM: "brakes",
  BRAKE_FLUID: "brakes",
  TIRES: "brakes",
  WHEELS: "brakes",
  ENGINE: "engine",
  ENGINE_OIL: "engine",
  TRANSMISSION: "engine",
  TRANSMISSION_FLUID: "engine",
  HAND_TOOLS: "engine",
  ELECTRICAL: "electrical",
  CAR_ELECTRONICS: "electrical",
  DIAGNOSTICS: "electrical",
  FILTERS: "filters",
  SUSPENSION_STEERING: "suspension",
  JACKS_STANDS: "suspension",
  LIGHTING: "lighting",
  COOLING: "cooling",
  COOLANT: "cooling",
  BODY: "body",
  EXTERIOR_ACCESSORIES: "body",
  INTERIOR_ACCESSORIES: "body",
};

/** Which assembly illustration belongs to a catalogue category key (unknown / missing -> the generic part box). */
export const assemblyForCategory = (key?: string | null): AssemblyKind => (key ? BY_CATEGORY[key] ?? "generic" : "generic");

export const ASSEMBLY_KINDS: AssemblyKind[] = ["brakes", "engine", "electrical", "filters", "suspension", "lighting", "cooling", "body"];
export const assemblyGroupCount = (kind: AssemblyKind) => GROUPS[kind].length;

function Layer({
  g,
  i,
  n,
  assemble,
  delay,
  size,
  color,
  onDone,
}: {
  g: Group;
  i: number;
  n: number;
  assemble: boolean;
  delay: number;
  size: { w: number; h: number };
  color: string;
  onDone?: () => void;
}) {
  const reduced = useReduced();
  const p = useSharedValue(assemble ? 0 : 1);
  useEffect(() => {
    if (!assemble) {
      p.value = 1;
      return;
    }
    p.value = 0;
    // whole assembly <= 700 ms: groups start 60 ms apart and share the rest
    const dur = reduced ? M.reduced : Math.max(240, 700 - (n - 1) * 60);
    p.value = withDelay(
      reduced ? 0 : delay + i * 60,
      withTiming(1, { duration: dur, easing: ease }, (ok) => {
        if (ok && i === n - 1 && onDone) runOnJS(onDone)();
      })
    );
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assemble, reduced]);
  // plain numbers only: a worklet must never capture `g` (it holds React elements, which cannot be sent to the UI thread)
  const ox = g.dx * (size.w / VB_W);
  const oy = g.dy * (size.h / VB_H);
  const st = useAnimatedStyle(() => ({
    opacity: reduced ? p.value : 0.3 + 0.7 * p.value,
    transform: reduced ? [] : [{ translateX: ox * (1 - p.value) }, { translateY: oy * (1 - p.value) }],
  }));
  const common = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }, st]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${VB_W} ${VB_H}`} {...common}>
        <G stroke={color} strokeWidth={4} opacity={0.25}>
          {g.node}
        </G>
        <G stroke={color} strokeWidth={1.5}>
          {g.node}
        </G>
      </Svg>
    </Animated.View>
  );
}

/**
 * Technical illustration for a part category. `assemble` plays the product-hero assembly once per mount (groups
 * fly in from 6-14 px outward, 30% -> 100% opacity, <= 700 ms). Without it the drawing is static.
 */
export function CategoryAssembly({
  kind,
  assemble = false,
  delay = 0,
  onDone,
  style,
}: {
  kind: AssemblyKind;
  assemble?: boolean;
  delay?: number;
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const groups = GROUPS[kind];
  return (
    <View style={[{ width: "100%", height: "100%" }, style]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {size.w > 0 &&
        groups.map((g, i) => (
          <Layer key={kind + g.key} g={g} i={i} n={groups.length} assemble={assemble} delay={delay} size={size} color={c.bronzeLight} onDone={onDone} />
        ))}
    </View>
  );
}
