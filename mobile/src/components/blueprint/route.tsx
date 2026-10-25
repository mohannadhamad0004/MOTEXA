import { useEffect, useRef } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from "react-native-reanimated";
import { ease, M, useReduced } from "../../motion";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";
import { Icon } from "./Icon";
import { InspectionCheck } from "./InspectionCheck";
import { Dash, Mono } from "./Primitives";

// The Route system: a progress line whose nodes are statuses. On a status change the line is extended ONLY from the
// previous node to the new one (300 ms stroke), the new node scales 0.8 -> 1.08 -> 1 and pulses once, then stays still.
// First render is always static. End states: success = every node settles green; failed = the line stops and the
// last node turns danger with an "x".

export type NodeState = "done" | "now" | "next" | "failed";
export type Tone = "brand" | "success" | "danger";

function usePrev<T>(v: T): T | undefined {
  const r = useRef<T>(undefined);
  const prev = r.current;
  useEffect(() => {
    r.current = v;
  });
  return prev;
}

/** Dashed track with a solid fill that grows (or shrinks) when `filled` changes. */
function Segment({ filled, color, vertical, delay = 0, style }: { filled: boolean; color: string; vertical?: boolean; delay?: number; style: object }) {
  const { c, isArabic } = useTheme();
  const reduced = useReduced();
  const p = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? withTiming(filled ? 1 : 0, { duration: M.reduced }) : withDelay(delay, withTiming(filled ? 1 : 0, { duration: M.detail, easing: ease }));
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, reduced]);
  const fill = useAnimatedStyle(() => (reduced ? { opacity: p.value, [vertical ? "height" : "width"]: "100%" } : { [vertical ? "height" : "width"]: `${p.value * 100}%` }));
  const base = useAnimatedStyle(() => ({ opacity: 1 - p.value }));
  return (
    <View style={style}>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }, base]}>
        {vertical ? <View style={{ flex: 1, width: 1, borderLeftWidth: 1, borderStyle: "dashed", borderColor: c.line }} /> : <Dash color={c.line} style={{ width: "100%", marginTop: 0 }} />}
      </Animated.View>
      <Animated.View
        style={[
          vertical
            ? { position: "absolute", top: 0, left: 0, width: 1, backgroundColor: color }
            : { position: "absolute", top: 0.5, height: 1, backgroundColor: color, ...(isArabic ? { right: 0 } : { left: 0 }) },
          fill,
        ]}
      />
    </View>
  );
}

/** Round status node. A node that has just been reached scales 0.8 -> 1.08 -> 1 and sends out one ring. */
function Node({ size, state, color, delay, dot }: { size: number; state: NodeState; color: string; delay: number; dot: number }) {
  const { c } = useTheme();
  const reduced = useReduced();
  const prev = usePrev(state);
  const first = useRef(true);
  const sc = useSharedValue(1);
  const ring = useSharedValue(0);
  const arrived = !first.current && prev !== undefined && prev !== state && (state === "now" || state === "failed" || (state === "done" && prev === "next"));
  useEffect(() => {
    first.current = false;
  }, []);
  useEffect(() => {
    if (!arrived || reduced) return;
    sc.value = withDelay(delay, withSequence(withTiming(0.8, { duration: 0 }), withTiming(1.08, { duration: 130, easing: ease }), withTiming(1, { duration: 90, easing: ease })));
    ring.value = withDelay(delay, withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 500, easing: ease })));
    return () => {
      cancelAnimation(sc);
      cancelAnimation(ring);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const body = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  const pulse = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.value), transform: [{ scale: 1 + 1.2 * ring.value }] }));
  const fillColor = state === "failed" ? c.danger : state === "done" ? color : c.sheet;
  const border = state === "next" ? c.line : state === "failed" ? c.danger : color;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: state === "failed" ? c.danger : color }, pulse]} />
      <Animated.View
        style={[{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, alignItems: "center", justifyContent: "center", borderColor: border, backgroundColor: fillColor }, body]}
      >
        {state === "done" ? (
          <Icon name="check" size={size * 0.58} color={c.sheet} />
        ) : state === "failed" ? (
          <InspectionCheck kind="x" size={size * 0.58} color={c.sheet} animate={arrived} delay={delay} />
        ) : state === "now" ? (
          <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
        ) : (
          <View style={{ width: dot * 0.7, height: dot * 0.7, borderRadius: dot, borderWidth: 1, borderColor: c.line }} />
        )}
      </Animated.View>
    </View>
  );
}

const toneColor = (c: ReturnType<typeof useTheme>["c"], tone: Tone) => (tone === "success" ? c.success : tone === "danger" ? c.danger : c.bronze);

/**
 * Horizontal progress: done = filled node + check, current = ring + dot, future = line colour; the connector fills
 * from the previous node to the new one on change. `tone="success"` settles every node green (completed);
 * `tone="danger"` stops the line and turns the node at `index` into a danger "x" (declined / cancelled).
 */
export function Steps({ labels, index, tone = "brand" }: { labels: string[]; index: number; tone?: Tone }) {
  const { c, row, isArabic } = useTheme();
  const prev = usePrev(index);
  const col = toneColor(c, tone === "danger" ? "brand" : tone);
  return (
    <View style={[row, { marginTop: 16, alignItems: "flex-start" }]}>
      {labels.map((l, k) => {
        const failed = tone === "danger" && k === index;
        const state: NodeState = failed ? "failed" : tone === "success" || k < index ? "done" : k === index ? "now" : "next";
        const reached = tone === "success" || k <= index;
        const lit = (tone === "danger" ? k < index : reached) && k > 0;
        // jump of several steps: connectors fill one after another
        const lag = prev !== undefined && index > prev && k > prev ? (k - prev - 1) * M.detail : 0;
        const conn = isArabic ? { right: "-50%" as const } : { left: "-50%" as const };
        return (
          <View key={k} style={{ flex: 1, alignItems: "center", gap: 8 }}>
            <View style={{ width: "100%", height: 24, alignItems: "center", justifyContent: "center" }}>
              {k > 0 && <Segment filled={lit} color={col} delay={lag} style={[{ position: "absolute", width: "100%", height: 2, top: 11 }, conn]} />}
              <Node size={24} dot={10} state={state} color={col} delay={lag + (k > 0 ? M.detail : 0)} />
            </View>
            <Text numberOfLines={2} style={{ fontSize: 11, textAlign: "center", color: reached ? c.ink : c.soft, fontWeight: reached ? "700" : "400" }}>
              {l}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

export type TimelineItem = { key: string; label: string; at?: string; state: NodeState; tone?: Tone };

/** Status screen timeline: node rail with connectors, real timestamps in mono. Keys are stable so polling never remounts rows. */
export function VerticalTimeline({ items, tone: overall }: { items: TimelineItem[]; tone?: Tone }) {
  const { c, row, align } = useTheme();
  const prevDone = usePrev(items.filter((s) => s.state === "done" || s.state === "now").length);
  const reached = items.filter((s) => s.state === "done" || s.state === "now" || s.state === "failed").length;
  return (
    <View>
      {items.map((s, i) => {
        const t = s.tone ?? overall ?? "brand";
        const col = toneColor(c, t);
        const lag = prevDone !== undefined && reached > prevDone && i >= prevDone - 1 ? Math.max(0, i - (prevDone - 1)) * M.detail : 0;
        return (
          <View key={s.key} style={[row, { gap: 16 }]}>
            <View style={{ alignItems: "center" }}>
              <Node size={28} dot={12} state={s.state} color={col} delay={lag + M.detail} />
              {i < items.length - 1 && <Segment vertical filled={s.state === "done"} color={col} delay={lag} style={{ width: 1, height: 36 }} />}
            </View>
            <View style={[row, { flex: 1, justifyContent: "space-between", paddingTop: 4, gap: 10 }]}>
              <Text style={[{ flex: 1, fontSize: 15, color: s.state === "next" ? c.soft : s.state === "failed" ? c.danger : c.ink, fontWeight: s.state === "next" ? "400" : "700" }, align]}>{s.label}</Text>
              {s.at && s.state !== "next" ? <Mono>{s.at}</Mono> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

