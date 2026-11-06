// The ONE hero of Home, Parts, Mechanics and Tow. Tabs pass a HeroConfig (content only); everything else is fixed here:
//   top row: car chip (start) · bell + map (end, 44 px round)
//   body (exactly HERO_BOX tall): title → data line → the action pill pinned to the bottom | media box (end side)
// Arabic mirrors the whole layout through `row`; the clip / photo is never flipped.
import { router } from "expo-router";
import { ActivityIndicator, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useL } from "../../../core/hooks/useL";
import { carName } from "../../../features/catalog/catalogBits";
import { openMyCarPicker, useMyCar } from "../../../features/catalog/myCar";
import { gShape, gType, useGarageTheme } from "../../../theme/garage";
import { HERO_BOX, HERO_CLIPS, MoClip } from "../MoClip";
import { Photo } from "../Photo";
import { IconButton, Tap } from "../primitives";
import { GIcon, GText } from "../text";
import { HERO, HERO_TAB, HeroAction, HeroConfig, titleSize } from "./heroConfig";

export type { HeroAction, HeroConfig } from "./heroConfig";

/** How far the page's first content overlaps the hero (GaragePage `overlap` default). */
const OVERLAP = 22;

function ActionPill({ a }: { a: HeroAction }) {
  const { g, row } = useGarageTheme();
  const filled = a.kind === "button" || a.on;
  const fg = filled ? g.onAccent : g.accentText;
  const icon = a.kind === "toggle" && a.on ? "checkmark" : a.icon;
  return (
    <Tap
      label={a.label}
      onPress={a.onPress}
      disabled={a.busy}
      style={[
        row,
        {
          height: HERO.action,
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          paddingHorizontal: 16,
          borderRadius: gShape.pill,
          backgroundColor: filled ? g.accent : "transparent",
          borderWidth: 1.5,
          borderColor: g.accent,
        },
      ]}
    >
      {a.busy ? <ActivityIndicator color={fg} /> : <GIcon name={icon} size={18} color={fg} />}
      <GText numberOfLines={1} style={[gType.label, { fontWeight: "700", color: fg, flexShrink: 1 }]}>{a.label}</GText>
    </Tap>
  );
}

function MediaBox({ tab }: { tab: HeroConfig["tab"] }) {
  const { g } = useGarageTheme();
  const { t } = useL();
  const clip = HERO_CLIPS[tab];
  return (
    <View style={{ width: HERO_BOX.w, height: HERO_BOX.h, borderRadius: HERO.mediaRadius, overflow: "hidden", backgroundColor: g.tint }}>
      {clip ? (
        <MoClip clip={clip.clip} box={HERO_BOX} framing={clip} radius={0} label={t(...HERO_TAB[tab].media)} />
      ) : (
        <Photo k={`hero.${tab}` as "hero.parts"} radius={0} style={{ width: HERO_BOX.w, height: HERO_BOX.h }} />
      )}
      {/* the one thin border, drawn over the media so the media still fills edge to edge */}
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: HERO.mediaRadius, borderWidth: 1, borderColor: g.line }} />
    </View>
  );
}

/** The customer's top row: car chip (start), requests bell + map (end). Kept apart so provider heroes never touch the customer garage. */
function CustomerTop({ tab }: { tab: HeroConfig["tab"] }) {
  const { row } = useGarageTheme();
  const { g } = useGarageTheme();
  const { t } = useL();
  const { car } = useMyCar();
  const chip = car ? carName(car) : t("Set your car", "حدّد سيارتك");
  return (
    <>
      <View style={[row, { flex: 1, minWidth: 0 }]}>
        <Tap label={chip} onPress={openMyCarPicker} style={[row, { height: HERO.topRow, alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: gShape.pill, backgroundColor: g.card, flexShrink: 1 }]}>
          <GIcon name="car-sport-outline" size={16} />
          <GText numberOfLines={1} style={[gType.caption, { fontWeight: "700", flexShrink: 1 }]}>{chip}</GText>
          <GIcon name="chevron-down" size={14} color={g.soft} />
        </Tap>
      </View>
      <IconButton icon="notifications-outline" label={t("My requests", "طلباتي")} onPress={() => router.push("/customer/requests")} />
      <IconButton icon="map-outline" label={t("Map", "الخريطة")} onPress={() => router.push(HERO_TAB[tab].map as never)} />
    </>
  );
}

export function HeroLayout({ config }: { config: HeroConfig }) {
  const { g, row, align } = useGarageTheme();
  const { t } = useL();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const f = titleSize(config.title, width - HERO.padX * 2 - HERO_BOX.w - HERO.gap);
  return (
    <View style={{ backgroundColor: g.heroTone, borderBottomLeftRadius: gShape.hero, borderBottomRightRadius: gShape.hero, paddingTop: insets.top + 8, paddingHorizontal: HERO.padX, paddingBottom: 20 + OVERLAP, overflow: "hidden" }}>
      <View style={[row, { height: HERO.topRow, alignItems: "center", gap: 10 }]}>
        {config.top ? (
          <>
            <View style={[row, { flex: 1, minWidth: 0 }]}>
              <View style={[row, { height: HERO.topRow, alignItems: "center", paddingHorizontal: 14, borderRadius: gShape.pill, backgroundColor: g.card, flexShrink: 1 }]}>
                <GText numberOfLines={1} style={[gType.caption, { fontWeight: "700", flexShrink: 1 }]}>{config.top.label}</GText>
              </View>
            </View>
            {config.top.actions.map((a) => <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} badge={a.badge} />)}
          </>
        ) : (
          <CustomerTop tab={config.tab} />
        )}
      </View>
      <View style={[row, { height: HERO_BOX.h, gap: HERO.gap, marginTop: HERO.topGap }]}>
        <View style={{ flex: 1, minWidth: 0, justifyContent: "space-between" }}>
          <View>
            <GText accessibilityRole="header" style={[gType.display, align, { fontSize: f, lineHeight: Math.round(f * 1.3) }]}>
              {config.title}
            </GText>
            {config.line ? <GText soft numberOfLines={2} style={[gType.bodySm, align, { marginTop: 4 }]}>{config.line}</GText> : null}
          </View>
          <ActionPill a={config.action} />
        </View>
        <MediaBox tab={config.tab} />
      </View>
    </View>
  );
}
