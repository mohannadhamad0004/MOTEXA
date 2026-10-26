import { ReactNode, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha } from "../../../theme/tokens";
import { useTheme } from "../../../theme/useTheme";
import { Text } from "../../ui/Text";
import { Icon, IconName } from "../Icon";
import { Press } from "../motion";
import { Tag } from "../Primitives";
import { RoadLoader } from "../RoadLoader";
import { InspectionCheck } from "../InspectionCheck";
import { BlueprintSurface, useHeroStatusBar } from "../Surface";
import { useDelayed } from "../../../motion/useDelayed";
import { MascotMo } from "./MascotMo";
import { MO } from "./moConfig";

export const MO_HERO_HEIGHT = 192;
export const MO_HERO_OVERLAP = 24;

type Cta = { label: string; icon?: IconName; onPress: () => void; loading?: boolean; active?: boolean };

/**
 * Mechanics hero with Mo (EXPERIMENT): real data and the actions on the start side, Mo standing on the bottom edge of the
 * hero on the end side (mirrored to the left in Arabic). Dark in both modes. Tap Mo to replay him.
 */
export function MoHero({
  tag,
  title,
  line,
  primary,
  secondary,
  play,
  verified,
}: {
  tag: string;
  title: string;
  line: ReactNode;
  primary: Cta;
  secondary: Cta;
  play: boolean;
  /** the check only when there is something real to confirm */
  verified: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { c, row, isArabic, align } = useTheme();
  useHeroStatusBar();
  const [replay, setReplay] = useState(0);
  const busy = useDelayed(!!primary.loading, 300);
  const size = width < 380 ? MO.sizeSmall : MO.size;
  const moW = size * MO.ratio;

  const button = (cta: Cta, main: boolean) => (
    <Press
      accessibilityLabel={cta.label}
      onPress={cta.loading ? undefined : cta.onPress}
      style={[
        row,
        {
          flex: main ? 1 : undefined,
          minWidth: main ? 0 : 84,
          minHeight: 46,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          paddingHorizontal: 10,
          backgroundColor: main ? (cta.active ? alpha(c.bronzeLight, 0.16) : c.bronzeLight) : alpha(c.cream, 0.06),
          borderWidth: main && !cta.active ? 0 : 1,
          borderColor: cta.active ? c.bronzeLight : alpha(c.cream, 0.22),
          opacity: cta.loading && !busy ? 0.85 : 1,
        },
      ]}
    >
      {main && busy ? <RoadLoader compact color={c.blueprint} /> : main && cta.active ? <InspectionCheck size={16} color={c.bronzeLight} animate={false} /> : cta.icon ? <Icon name={cta.icon} size={16} color={main ? c.blueprint : alpha(c.cream, 0.85)} /> : null}
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        style={{ flexShrink: 1, textAlign: "center", color: main ? (cta.active ? c.bronzeLight : c.blueprint) : alpha(c.cream, 0.88), fontSize: 13, fontWeight: main ? "700" : "600", lineHeight: isArabic ? 19 : 16 }}
      >
        {cta.label}
      </Text>
    </Press>
  );

  return (
    <BlueprintSurface gridFade={play} style={{ height: insets.top + MO_HERO_HEIGHT }}>
      <View style={{ position: "absolute", left: 20, right: 20, top: insets.top + 10, bottom: MO_HERO_OVERLAP + 8 }}>
        {/* the text column leaves room for Mo on the end side */}
        <View style={[{ flex: 1, justifyContent: "space-between" }, isArabic ? { paddingLeft: moW + 40 } : { paddingRight: moW + 40 }]}>
          <View>
            <Tag color={alpha(c.cream, 0.6)} align={isArabic ? "right" : "left"}>{tag}</Tag>
            <Text numberOfLines={1} style={[{ color: c.cream, fontSize: 28, fontWeight: "700", lineHeight: isArabic ? 38 : 33, marginTop: 4 }, align]}>
              {title}
            </Text>
            <View style={{ marginTop: 4 }}>{line}</View>
          </View>
          <View style={[row, { gap: 8 }]}>
            {button(primary, true)}
            {button(secondary, false)}
          </View>
        </View>
      </View>
      {/* Mo stands on the visible bottom edge (the sheet overlaps the last 24 px) */}
      <View style={{ position: "absolute", bottom: MO_HERO_OVERLAP + 5, ...(isArabic ? { left: 28 } : { right: 28 }) }}>
        <MascotMo size={size} play={play || replay > 0} playKey={replay} mirrored={isArabic} showCheck={verified} onPress={() => setReplay((n) => n + 1)} />
      </View>
    </BlueprintSurface>
  );
}
