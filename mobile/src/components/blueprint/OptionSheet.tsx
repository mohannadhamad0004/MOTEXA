import { ReactNode, useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useL } from "../../core/hooks/useL";
import { closeMs, ease, M, useReduced } from "../../motion";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";
import { InspectionCheck } from "./InspectionCheck";
import { Press } from "./motion";
import { Tag } from "./Primitives";

export type SheetOption<K extends string> = { key: K; label: string; sub?: string };

/**
 * Bottom sheet that lists choices (truck type, city, sort). It springs up (no bounce), closes faster than it opens, and
 * puts a check on the chosen row. `header` is for one extra action above the list (e.g. "Use my location").
 */
export function OptionSheet<K extends string>({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  header,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: SheetOption<K>[];
  value: K | null;
  onSelect: (k: K) => void;
  header?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { c, r, row, align } = useTheme();
  const { t } = useL();
  const reduced = useReduced();
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(0);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      p.value = reduced ? withTiming(1, { duration: M.reduced }) : withSpring(1, M.spring);
    } else if (mounted) {
      cancelAnimation(p);
      p.value = withTiming(0, { duration: reduced ? M.reduced : closeMs(M.detail), easing: ease }, (ok) => {
        if (ok) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduced]);
  const shift = reduced ? 0 : height * 0.5;
  const sheet = useAnimatedStyle(() => ({ opacity: reduced ? p.value : Math.min(1, p.value * 3), transform: [{ translateY: (1 - p.value) * shift }] }));
  const back = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: alpha(c.blueprint, 0.55) }, back]}>
        <Pressable accessibilityLabel={t("Close", "إغلاق")} onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={[
            {
              maxHeight: height * 0.7,
              backgroundColor: c.sheet,
              borderTopLeftRadius: r.sheet,
              borderTopRightRadius: r.sheet,
              paddingTop: 12,
              paddingBottom: 12 + insets.bottom,
            },
            sheet,
          ]}
        >
          <View style={{ alignSelf: "center", width: 48, height: 6, borderRadius: 3, backgroundColor: c.line, marginBottom: 14 }} />
          <View style={{ paddingHorizontal: 20, marginBottom: 6 }}>
            <Tag color={c.soft} align={align.textAlign}>{title}</Tag>
          </View>
          {header ? <View style={{ paddingHorizontal: 20, paddingBottom: 6 }}>{header}</View> : null}
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
            {options.map((o) => {
              const on = o.key === value;
              return (
                <Press
                  key={o.key}
                  accessibilityState={{ selected: on }}
                  onPress={() => onSelect(o.key)}
                  style={[row, { minHeight: 52, alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: alpha(c.line, 0.6) }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[{ color: c.ink, fontSize: 15, fontWeight: on ? "700" : "400" }, align]}>{o.label}</Text>
                    {o.sub ? <Text style={[{ color: c.soft, fontSize: 12 }, align]}>{o.sub}</Text> : null}
                  </View>
                  <View style={{ width: 20, height: 20 }}>{on ? <InspectionCheck size={20} color={c.bronze} /> : null}</View>
                </Press>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
