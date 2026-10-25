import { ReactNode, useEffect, useRef, useState } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { closeMs, ease, M, useReduced } from "../../motion";
import { InspectionCheck } from "./InspectionCheck";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";

/** Entering / exiting props that skip the very first mount, so nothing animates on first render. */
function useFades() {
  const reduced = useReduced();
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const ms = reduced ? M.reduced : M.chip;
  return {
    entering: mounted.current ? FadeIn.duration(ms) : undefined,
    exiting: FadeOut.duration(reduced ? M.reduced : closeMs(M.chip)),
  };
}

/** StatusContinuity: when `k` changes (a polled status label) the content crossfades over 190 ms; nothing else moves. */
export function CrossFade({ k, children, style }: { k: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const f = useFades();
  return (
    <Animated.View key={k} entering={f.entering} exiting={f.exiting} style={style}>
      {children}
    </Animated.View>
  );
}

/** Content that fades in / out when `show` flips (buttons that became valid / invalid). No animation on first render. */
export function FadeSwitch({ show, children, style }: { show: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const f = useFades();
  return show ? (
    <Animated.View entering={f.entering} exiting={f.exiting} layout={LinearTransition.duration(M.detail)} style={style}>
      {children}
    </Animated.View>
  ) : null;
}

const expandIn = (v: { targetHeight: number }) => {
  "worklet";
  return {
    initialValues: { opacity: 0, height: 0 },
    animations: { opacity: withTiming(1, { duration: M.detail, easing: ease }), height: withTiming(v.targetHeight, { duration: M.detail, easing: ease }) },
  };
};
const collapseOut = (v: { currentHeight: number }) => {
  "worklet";
  return {
    initialValues: { opacity: 1, height: v.currentHeight },
    animations: { opacity: withTiming(0, { duration: closeMs(M.detail), easing: ease }), height: withTiming(0, { duration: closeMs(M.detail), easing: ease }) },
  };
};

/**
 * Context morph: content that belongs to a real state (the Home active-request card) expands into place
 * (height + opacity, 300 ms) when it appears and collapses away (210 ms) when the state ends. Reduced motion: 150 ms fade.
 */
export function Expand({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduced();
  return (
    <Animated.View
      entering={reduced ? FadeIn.duration(M.reduced) : (expandIn as never)}
      exiting={reduced ? FadeOut.duration(M.reduced) : (collapseOut as never)}
      style={[{ overflow: "hidden" }, style]}
    >
      {children}
    </Animated.View>
  );
}

/** One subtle 6 degree "tighten" turn after the hero has traced (first entry only). */
export function TightenOnce({ active, delay, children }: { active: boolean; delay: number; children: ReactNode }) {
  const reduced = useReduced();
  const a = useSharedValue(active && !reduced ? -6 : 0);
  useEffect(() => {
    if (active && !reduced) a.value = withDelay(delay, withTiming(0, { duration: M.detail, easing: ease }));
  }, [active, reduced, delay, a]);
  const st = useAnimatedStyle(() => ({ transform: [{ rotate: `${a.value}deg` }] }));
  return <Animated.View style={[{ width: "100%", height: "100%" }, st]}>{children}</Animated.View>;
}

/** A soft bronze wash over a card that fades out over 1.2 s: "this card just changed" (accepted, approved). Render it while `active`. */
export function Flash({ active, radius = 16 }: { active: boolean; radius?: number }) {
  const { c } = useTheme();
  const reduced = useReduced();
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) return;
    p.value = 1;
    p.value = withTiming(0, { duration: reduced ? M.reduced : 1200, easing: ease });
  }, [active, reduced, p]);
  const st = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: radius, borderWidth: 1, borderColor: c.bronze, backgroundColor: alpha(c.bronze, 0.16) }, st]} />;
}

/**
 * Status badge that RESOLVES when its value changes (never on first render): the label crossfades and an
 * InspectionCheck (check / x / warning "!") sweeps in beside it for a moment. `kind` null = no mark for this value.
 */
export function Resolved({ k, kind, children }: { k: string; kind: "check" | "x" | "warn" | null; children: ReactNode }) {
  const { c, row } = useTheme();
  const first = useRef(true);
  const [mark, setMark] = useState(false);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!kind) return;
    setMark(true);
    const id = setTimeout(() => setMark(false), 1800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  const color = kind === "check" ? c.success : kind === "x" ? c.danger : c.warning;
  return (
    <View style={[row, { alignItems: "center", gap: 6 }]}>
      {mark && kind ? (
        <Animated.View entering={FadeIn.duration(M.chip)} exiting={FadeOut.duration(closeMs(M.chip))}>
          <InspectionCheck kind={kind} size={18} color={color} />
        </Animated.View>
      ) : null}
      <CrossFade k={k}>{children}</CrossFade>
    </View>
  );
}

/** List item that glides to its new place (layout transition, 300 ms) and fades in / out as items arrive or leave. Needs a stable key. */
export function Move({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReduced();
  return (
    <Animated.View
      layout={reduced ? undefined : LinearTransition.duration(M.detail)}
      entering={FadeIn.duration(reduced ? M.reduced : M.chip)}
      exiting={FadeOut.duration(reduced ? M.reduced : closeMs(M.chip))}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
