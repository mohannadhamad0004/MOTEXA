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
import { useL } from "../../core/hooks/useL";
import { HERO_BOX, HERO_CLIPS, HeroTab, MoClip } from "./MoClip";
import { Photo } from "./Photo";

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
 * (MoClip or Photo) on the end side. Detail: back button + compact title + optional visual. Tab: the shared hero of the four
 * main tabs (see TabHero).
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
  children,
  overlap = 22,
  tab,
  onMap,
}: {
  title: string;
  line?: string;
  chip?: { label: string; icon?: GIconName; onPress?: () => void };
  action?: { icon: GIconName; label: string; onPress: () => void; badge?: number };
  visual?: ReactNode;
  /** full-width visual under the title row (wide clips / photos) */
  banner?: ReactNode;
  variant?: "main" | "detail" | "tab";
  onBack?: () => void;
  children?: ReactNode;
  overlap?: number;
  /** variant "tab": which main tab (picks its clip from HERO_CLIPS) */
  tab?: HeroTab;
  /** variant "tab": the round Map button, always in the hero's top end corner */
  onMap?: () => void;
}) {
  const { g, row, align } = useGarageTheme();
  const insets = useSafeAreaInsets();
  if (variant === "tab" && tab) return <TabHero {...{ tab, title, line, chip, action, onMap, overlap }}>{children}</TabHero>;
  const main = variant === "main";
  return (
    <View style={{ backgroundColor: g.heroTone, borderBottomLeftRadius: gShape.hero, borderBottomRightRadius: gShape.hero, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 20 + overlap, overflow: "hidden" }}>
      <View style={[row, { alignItems: "center", justifyContent: "space-between", gap: 10, minHeight: onBack || chip || action ? 44 : 0 }]}>
        <View style={[row, { alignItems: "center", gap: 10, flexShrink: 1 }]}>
          {onBack ? <IconButton icon="arrow-back" label="Back" onPress={onBack} flip /> : null}
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

const HERO_LABEL: Record<HeroTab, [string, string]> = {
  home: ["Mo, the MOTEXA mechanic", "مو، ميكانيكي موتكسا"],
  parts: ["Mo at the parts shop", "مو في متجر القطع"],
  mechanics: ["Mechanics", "الميكانيكيون"],
  tow: ["Mo with the tow truck", "مو مع شاحنة السحب"],
};

/**
 * The ONE hero of Home, Parts, Mechanics and Tow: identical height and layout, only the content changes. Top row: optional chip
 * (start) + optional icon button + the Map button in the top END corner. Body (exactly HERO_BOX tall): title + one real data line
 * at the top of the START side, the tab's one action pinned to its bottom; Mo (or the photo placeholder) on the END side.
 * Arabic mirrors the sides; Mo is never flipped.
 */
function TabHero({
  tab,
  title,
  line,
  chip,
  action,
  onMap,
  overlap,
  children,
}: {
  tab: HeroTab;
  title: string;
  line?: string;
  chip?: { label: string; icon?: GIconName; onPress?: () => void };
  action?: { icon: GIconName; label: string; onPress: () => void; badge?: number };
  onMap?: () => void;
  overlap: number;
  children?: ReactNode;
}) {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const insets = useSafeAreaInsets();
  const clip = HERO_CLIPS[tab];
  const label = t(...HERO_LABEL[tab]);
  return (
    <View style={{ backgroundColor: g.heroTone, borderBottomLeftRadius: gShape.hero, borderBottomRightRadius: gShape.hero, paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 20 + overlap, overflow: "hidden" }}>
      <View style={[row, { height: 44, alignItems: "center", gap: 10 }]}>
        <View style={[row, { flex: 1, minWidth: 0, alignItems: "center" }]}>
          {chip ? (
            <Tap
              label={chip.label}
              onPress={chip.onPress}
              style={[row, { minHeight: 44, alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: gShape.pill, backgroundColor: g.card, flexShrink: 1 }]}
            >
              <GIcon name={chip.icon ?? "car-sport-outline"} size={16} />
              <GText numberOfLines={1} style={[gType.caption, { fontWeight: "700", flexShrink: 1 }]}>{chip.label}</GText>
              {chip.onPress ? <GIcon name="chevron-down" size={14} color={g.soft} /> : null}
            </Tap>
          ) : null}
        </View>
        {action ? <IconButton icon={action.icon} label={action.label} onPress={action.onPress} badge={action.badge} /> : null}
        {onMap ? <IconButton icon="map-outline" label={t("Map", "الخريطة")} onPress={onMap} /> : null}
      </View>
      <View style={[row, { height: HERO_BOX.h, gap: 12, marginTop: 10 }]}>
        <View style={{ flex: 1, minWidth: 0, justifyContent: "space-between" }}>
          <View>
            <GText accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} style={[gType.display, align]}>
              {title}
            </GText>
            {line ? <GText soft numberOfLines={2} style={[gType.bodySm, align, { marginTop: 4 }]}>{line}</GText> : null}
          </View>
          {children}
        </View>
        {clip ? (
          <MoClip clip={clip} box={HERO_BOX} label={label} />
        ) : (
          <Photo k={`hero.${tab}` as "hero.parts"} radius={gShape.cardLg} style={{ width: HERO_BOX.w, height: HERO_BOX.h }} />
        )}
      </View>
    </View>
  );
}
