// Page template for every customer screen: page background, safe area, scroll, pull-to-refresh, optional sticky bottom bar.
// Entrance: a main tab's first visit in the session fades the hero and raises the cards 12 px with a 40 ms stagger; later visits
// are a quick fade; detail pages fade + rise 8 px. Reduced motion: no movement.
import { Children, ReactNode, isValidElement, useEffect, useRef, useState } from "react";
import { Animated, Easing, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { firstEntry, useReduced } from "../../motion";
import { gShape, useGarageTheme } from "../../theme/garage";
import { GIcon, GIconName, GText } from "./text";
import { IconButton, Tap } from "./primitives";
import { gType } from "../../theme/garage";

type Mode = "first" | "again" | "detail" | "none";

function Rise({ mode, index, children }: { mode: Mode; index: number; children: ReactNode }) {
  const v = useRef(new Animated.Value(mode === "none" ? 1 : 0)).current;
  useEffect(() => {
    if (mode === "none") return;
    const ms = mode === "first" ? 360 : mode === "detail" ? 240 : 150;
    const delay = mode === "first" ? 120 + Math.min(index, 8) * 40 : 0;
    Animated.timing(v, { toValue: 1, duration: ms, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dy = mode === "first" ? 12 : mode === "detail" ? 8 : 0;
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }] }}>{children}</Animated.View>;
}

/** The entrance mode for this mount: `entry` = main tab key (first visit per session), else a detail page. */
function useMode(entry?: string): Mode {
  const reduced = useReduced();
  const [m] = useState<Mode>(() => (entry ? (firstEntry("garage:" + entry) ? "first" : "again") : "detail"));
  return reduced ? "none" : m;
}

export function GaragePage({
  hero,
  children,
  tabs,
  entry,
  refreshing,
  onRefresh,
  bottom,
  overlap = 22,
  scroll = true,
}: {
  hero?: ReactNode;
  children: ReactNode;
  /** main tab: leaves room for the floating tab bar */
  tabs?: boolean;
  /** main tab key for the first-visit entrance */
  entry?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** sticky bottom bar (StickyActionBar) */
  bottom?: ReactNode;
  /** how far the first content overlaps the hero */
  overlap?: number;
  scroll?: boolean;
}) {
  const { g } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const mode = useMode(entry);
  let i = 0;
  const kids = Children.toArray(children).map((ch) => (
    <Rise key={isValidElement(ch) && ch.key != null ? ch.key : i} mode={mode} index={++i}>
      {ch}
    </Rise>
  ));
  const pad = { paddingHorizontal: 20, paddingTop: hero ? 0 : insets.top + 12, marginTop: hero ? -overlap : 0, paddingBottom: tabs ? 120 + insets.bottom : bottom ? 120 + insets.bottom : 32 + insets.bottom };
  return (
    <View style={{ flex: 1, backgroundColor: g.page }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={g.accent} colors={[g.accent]} progressViewOffset={insets.top} /> : undefined}
        >
          {hero ? <Rise mode={mode === "first" ? "again" : mode} index={0}>{hero}</Rise> : null}
          <View style={pad}>{kids}</View>
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {hero}
          <View style={[pad, { flex: 1 }]}>{children}</View>
        </View>
      )}
      {bottom}
    </View>
  );
}

/**
 * Top of a page on heroTone with rounded bottom corners. Main: greeting/title + one real data line + chip + icon button + a big visual
 * (MoClip or Photo) on the end side. Detail: back button + compact title + optional visual. The four main tabs use
 * hero/HeroLayout instead.
 */
export function GarageHero({
  title,
  line,
  chip,
  action,
  visual,
  banner,
  variant = "main",
  onBack,
  backLabel = "Back",
  children,
  overlap = 22,
}: {
  title: string;
  line?: string;
  chip?: { label: string; icon?: GIconName; onPress?: () => void };
  action?: { icon: GIconName; label: string; onPress: () => void; badge?: number };
  visual?: ReactNode;
  /** full-width visual under the title row (wide clips / photos) */
  banner?: ReactNode;
  variant?: "main" | "detail";
  onBack?: () => void;
  backLabel?: string;
  children?: ReactNode;
  overlap?: number;
}) {
  const { g, row, align } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const main = variant === "main";
  return (
    <View style={{ backgroundColor: g.heroTone, borderBottomLeftRadius: gShape.hero, borderBottomRightRadius: gShape.hero, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 20 + overlap, overflow: "hidden" }}>
      <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: onBack || chip || action ? 44 : 0 }]}>
        <View style={[row, { alignItems: "center", gap: 10, flexShrink: 1 }]}>
          {onBack ? <IconButton icon="arrow-back" label={backLabel} onPress={onBack} flip /> : null}
          {chip ? (
            <Tap
              label={chip.label}
              onPress={chip.onPress}
              style={[row, { minHeight: 40, alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: gShape.pill, backgroundColor: g.card, flexShrink: 1 }]}
            >
              <GIcon name={chip.icon ?? "car-sport-outline"} size={16} />
              <GText numberOfLines={1} style={[gType.caption, { fontWeight: "700", flexShrink: 1 }]}>{chip.label}</GText>
              {chip.onPress ? <GIcon name="chevron-down" size={14} color={g.soft} /> : null}
            </Tap>
          ) : null}
        </View>
        {action ? <IconButton icon={action.icon} label={action.label} onPress={action.onPress} badge={action.badge} /> : null}
      </View>
      <View style={[row, { alignItems: main ? "center" : "flex-start", gap: 12, marginTop: main ? 8 : 12 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <GText accessibilityRole="header" style={[main ? gType.display : { fontSize: 22, lineHeight: 29, fontWeight: "800" }, align]}>
            {title}
          </GText>
          {line ? <GText soft style={[gType.bodySm, align, { marginTop: 4 }]}>{line}</GText> : null}
          {children ? <View style={{ marginTop: 12 }}>{children}</View> : null}
        </View>
        {visual ? <View>{visual}</View> : null}
      </View>
      {banner ? <View style={{ marginTop: 14, alignItems: "center" }}>{banner}</View> : null}
    </View>
  );
}
