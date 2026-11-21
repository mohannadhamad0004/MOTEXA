import { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";
import { Icon, IconName } from "./Icon";
import { Tag } from "./Primitives";
import { RoadLoader } from "./RoadLoader";
import { BackButton, BlueprintSurface, useHeroStatusBar } from "./Surface";

/** How far the sheet overlaps a compact hero. */
export const COMPACT_OVERLAP = 24;

/**
 * Compact blueprint hero (main tabs 170-190 px, detail pages 140 px). On the START side: one small tag, the title, ONE
 * line of real data, a primary action and an optional secondary link. On the END side: a compact live visual (a map
 * preview, an animated drawing) at most ~45% wide. Start / end swap in Arabic. The hero is dark in both modes, so its
 * buttons are always bronze-on-dark.
 */
export function CompactHero({
  tag,
  title,
  line,
  primary,
  secondary,
  visual,
  height = 190,
  ignition = false,
  back,
  visualWidth = "38%",
}: {
  tag?: string;
  title: string;
  /** one line of REAL data (a node, so numbers can be Odometers) */
  line?: ReactNode;
  primary?: { label: string; icon?: IconName; onPress: () => void; loading?: boolean; active?: boolean };
  secondary?: { label: string; icon?: IconName; onPress: () => void };
  visual?: ReactNode;
  height?: number;
  ignition?: boolean;
  /** detail pages: fallback route for the round back button */
  back?: Parameters<typeof BackButton>[0]["fallback"];
  visualWidth?: `${number}%`;
}) {
  const insets = useSafeAreaInsets();
  const { c, row, isArabic, align } = useTheme();
  useHeroStatusBar();
  const cream = c.cream;
  return (
    <BlueprintSurface construction gridFade={ignition} style={{ height: insets.top + height }}>
      <View style={{ position: "absolute", left: 20, right: 20, top: insets.top + 8, bottom: COMPACT_OVERLAP + 6 }}>
        {tag ? (
          <View style={{ marginBottom: 2 }}>
            <Tag color={alpha(cream, 0.6)} align={isArabic ? "right" : "left"}>{tag}</Tag>
          </View>
        ) : null}
        <View style={[row, { flex: 1, gap: 12, alignItems: "stretch" }]}>
          <View style={{ flex: 1, minWidth: 0, justifyContent: "space-between" }}>
            <View>
              <Text numberOfLines={1} style={[{ color: cream, fontSize: 27, fontWeight: "700", lineHeight: isArabic ? 36 : 31 }, align]}>
                {title}
              </Text>
              {line ? <View style={{ marginTop: 3 }}>{line}</View> : null}
            </View>
            <View style={{ gap: 4 }}>
              {primary ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={primary.label}
                  onPress={primary.loading ? undefined : primary.onPress}
                  style={({ pressed }) => [
                    row,
                    {
                      minHeight: 44,
                      borderRadius: 999,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      backgroundColor: primary.active ? alpha(c.bronzeLight, 0.22) : c.bronzeLight,
                      borderWidth: primary.active ? 1 : 0,
                      borderColor: c.bronzeLight,
                      opacity: primary.loading ? 0.7 : 1,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    },
                  ]}
                >
                  {primary.loading ? <RoadLoader compact color={c.blueprint} /> : primary.icon ? <Icon name={primary.icon} size={18} color={primary.active ? c.bronzeLight : c.blueprint} /> : null}
                  <Text numberOfLines={2} style={{ flexShrink: 1, textAlign: "center", color: primary.active ? c.bronzeLight : c.blueprint, fontSize: 12.5, fontWeight: "700", lineHeight: isArabic ? 18 : 16 }}>
                    {primary.label}
                  </Text>
                </Pressable>
              ) : null}
              {secondary ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={secondary.label}
                  onPress={secondary.onPress}
                  hitSlop={{ top: 6, bottom: 6 }}
                  style={[row, { minHeight: 28, alignItems: "center", gap: 6 }]}
                >
                  {secondary.icon ? <Icon name={secondary.icon} size={14} color={c.bronzeLight} /> : null}
                  <Text numberOfLines={1} style={{ color: c.bronzeLight, fontSize: 12, fontWeight: "700" }}>
                    {secondary.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
          {visual ? <View style={{ width: visualWidth, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: alpha(cream, 0.16) }}>{visual}</View> : null}
        </View>
      </View>
      {back ? <BackButton fallback={back} /> : null}
    </BlueprintSurface>
  );
}
