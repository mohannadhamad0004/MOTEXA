import { ReactNode, useEffect, useRef } from "react";
import { View, useWindowDimensions } from "react-native";
import Animated, { cancelAnimation, SharedValue, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { ease, M, useReduced } from "../../../motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { Text } from "../../ui/Text";
import { Icon, IconName } from "../Icon";
import { CrossFade } from "../FadeSwitch";
import { Press } from "../motion";
import { BlueprintSurface, useHeroStatusBar } from "../Surface";
import { HomeMo } from "./HomeMo";
import { HOME_MO } from "./moConfig";

export const HOME_HERO_HEIGHT = 200;
export const HOME_HERO_OVERLAP = 24;

type Cta = { label: string; icon?: IconName; onPress: () => void };

/** One hero element that resolves (fade + 8 px rise) `delay` ms after it mounts. Static when `play` is false; a plain fade with reduced motion. */
function Resolve({ delay, play, children }: { delay: number; play: boolean; children: ReactNode }) {
  const reduced = useReduced();
  const p = useSharedValue(play ? 0 : 1);
  useEffect(() => {
    if (!play) return;
    p.value = withDelay(reduced ? 0 : delay, withTiming(1, { duration: reduced ? M.reduced : M.entrance, easing: ease }));
    return () => cancelAnimation(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, reduced]);
  const st = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: reduced ? 0 : (1 - p.value) * 8 }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
}

/** One node of the route: filled up to the real step, the current one half filled and pulsing once when it is reached. */
function StepNode({ k, index, prog, pulse }: { k: number; index: number; prog: SharedValue<number>; pulse: SharedValue<number> }) {
  const { c } = useTheme();
  const cap = k < index ? 1 : 0.45;
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(cap, Math.max(0, (prog.value - (k - 0.5)) * 2)) }));
  const ring = useAnimatedStyle(() => ({ opacity: k === index ? 0.55 * (1 - pulse.value) : 0, transform: [{ scale: 1 + 1.2 * pulse.value }] }));
  return (
    <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: c.bronzeLight }, ring]} />
      <View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: k <= index ? c.bronzeLight : alpha(c.cream, 0.3) }} />
      <Animated.View style={[{ position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: c.bronzeLight }, fill]} />
    </View>
  );
}

/**
 * A thin real progress line, one node per step. On the first visit it draws from the start ONLY up to the real current step
 * and the current node pulses once; when the real step changes while Home is open, only the new segment and node animate.
 * Later visits and reduced motion: the final state, no draw, no pulse.
 */
function MiniSteps({ count, index, play, lead }: { count: number; index: number; play: boolean; lead: number }) {
  const { c, row, isArabic } = useTheme();
  const reduced = useReduced();
  const prog = useSharedValue(play ? 0 : index);
  const pulse = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    const animate = !reduced && (play || !first.current);
    const wait = first.current ? lead : 0;
    first.current = false;
    if (!animate) {
      prog.value = index;
      return;
    }
    const dur = 190 * Math.max(1, index - Math.floor(prog.value));
    prog.value = withDelay(wait, withTiming(index, { duration: dur, easing: ease }));
    pulse.value = 0;
    pulse.value = withDelay(wait + dur, withTiming(1, { duration: 500, easing: ease }));
    return () => {
      cancelAnimation(prog);
      cancelAnimation(pulse);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, play, reduced]);
  return (
    <View style={[row, { alignItems: "center", marginTop: 8 }]}>
      {Array.from({ length: count }, (_, k) => (
        <View key={k} style={[row, { flex: k < count - 1 ? 1 : undefined, alignItems: "center" }]}>
          <StepNode k={k} index={index} prog={prog} pulse={pulse} />
          {k < count - 1 ? <StepLine k={k} prog={prog} track={alpha(c.cream, 0.22)} color={c.bronzeLight} rtl={isArabic} /> : null}
        </View>
      ))}
    </View>
  );
}

function StepLine({ k, prog, track, color, rtl }: { k: number; prog: SharedValue<number>; track: string; color: string; rtl: boolean }) {
  const st = useAnimatedStyle(() => ({ width: `${Math.min(1, Math.max(0, prog.value - k)) * 100}%` }));
  return (
    <View style={{ flex: 1, height: 1, backgroundColor: track }}>
      <Animated.View style={[{ position: "absolute", top: 0, height: 1, backgroundColor: color }, rtl ? { right: 0 } : { left: 0 }, st]} />
    </View>
  );
}

/**
 * Home hero (about 198 px, dark in both modes): a time-based greeting, the customer's real car (tap to change), then ONE
 * context line - the real active request with its progress (tap opens it), or the two everyday actions. Mo drinks his
 * coffee on the end side (left in Arabic); tapping him replays the sip.
 */
export function HomeHero({
  greeting,
  carLabel,
  onCar,
  active,
  primary,
  secondary,
  play,
}: {
  greeting: string;
  carLabel: string;
  onCar: () => void;
  active: { who: string; stage: string; steps: number; index: number; onPress: () => void } | null;
  primary: Cta;
  secondary: Cta;
  play: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c, row, isArabic, align } = useTheme();
  useHeroStatusBar();
  // Mo is decorative: about a third of the hero width (a little smaller on narrow phones, a little larger on wide ones), never wider than 150
  const moW = Math.round(Math.min(140, Math.max(100, width * 0.3)));
  const size = moW / HOME_MO.ratio;
  const edge = 8;
  // the text zone is an explicit width (about 59%), so nothing can run under Mo
  const textW = width - 40 - (moW + edge) - 4;
  const t0 = useRef(Date.now());
  const reqDelay = play ? Math.max(0, 600 - (Date.now() - t0.current)) : 0;

  const button = (cta: Cta, main: boolean) => (
    <Press
      accessibilityLabel={cta.label}
      onPress={cta.onPress}
      style={[
        row,
        {
          flex: main ? 1.2 : 1,
          minWidth: 0,
          minHeight: 46,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: 8,
          backgroundColor: main ? c.bronzeLight : alpha(c.cream, 0.06),
          borderWidth: main ? 0 : 1,
          borderColor: alpha(c.cream, 0.22),
        },
      ]}
    >
      {cta.icon ? <Icon name={cta.icon} size={16} color={main ? c.blueprint : alpha(c.cream, 0.85)} /> : null}
      <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8} style={{ flexShrink: 1, textAlign: "center", color: main ? c.blueprint : alpha(c.cream, 0.88), fontSize: 13, fontWeight: main ? "700" : "600", lineHeight: isArabic ? 19 : 16 }}>
        {cta.label}
      </Text>
    </Press>
  );

  return (
    <BlueprintSurface gridFade={play} style={{ height: insets.top + HOME_HERO_HEIGHT }}>
      <View
        style={[
          { position: "absolute", top: insets.top + 12, bottom: HOME_HERO_OVERLAP + 20, width: textW, justifyContent: "space-between" },
          isArabic ? { right: 20 } : { left: 20 },
        ]}
      >
        {/* first visit order: grid -> greeting (120 ms) -> car chip (+50) -> Mo (260) -> request / actions (600) */}
        <View>
          <Resolve delay={120} play={play}>
            <Text numberOfLines={2} style={[{ color: c.cream, fontSize: 20, fontWeight: "700", lineHeight: isArabic ? 29 : 25 }, align]}>
              {greeting}
            </Text>
          </Resolve>
          <Resolve delay={170} play={play}>
            <Press
              accessibilityLabel={carLabel}
              onPress={onCar}
              style={[row, { alignSelf: isArabic ? "flex-end" : "flex-start", maxWidth: "100%", minHeight: 34, marginTop: 8, alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: alpha(c.cream, 0.25), backgroundColor: alpha(c.cream, 0.06) }]}
            >
              <Icon name="car" size={14} color={c.bronzeLight} />
              <Text numberOfLines={1} style={{ flexShrink: 1, color: alpha(c.cream, 0.9), fontSize: 12, fontWeight: "600" }}>
                {carLabel}
              </Text>
            </Press>
          </Resolve>
        </View>
        {active ? (
          <Resolve delay={reqDelay} play={play}>
            <Press accessibilityLabel={`${active.who} · ${active.stage}`} onPress={active.onPress} style={{ minHeight: 52, justifyContent: "center" }}>
              <View style={[row, { alignItems: "center", gap: 6 }]}>
                {/* a status change crossfades only this label */}
                <CrossFade k={active.stage} style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[{ color: c.cream, fontSize: 14, fontWeight: "700", lineHeight: isArabic ? 21 : 18 }, align]}>{`${active.who} · ${active.stage}`}</Text>
                </CrossFade>
                <Icon name="chev" size={14} color={c.bronzeLight} />
              </View>
              <MiniSteps count={active.steps} index={active.index} play={play} lead={play ? reqDelay + 160 : 0} />
            </Press>
          </Resolve>
        ) : (
          <Resolve delay={reqDelay} play={play}>
            <View style={[row, { gap: 8 }]}>
              {button(primary, true)}
              {button(secondary, false)}
            </View>
          </Resolve>
        )}
      </View>
      {/* Mo is hero artwork, not a card: bottom aligned on the end side, cropped by the sheet (head, torso, arms and the top of the desk stay visible) */}
      <View pointerEvents="box-none" style={{ position: "absolute", bottom: HOME_HERO_OVERLAP - 6, ...(isArabic ? { left: edge } : { right: edge }) }}>
        <HomeMo size={size} play={play} delay={260} />
      </View>
    </BlueprintSurface>
  );
}
