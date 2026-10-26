import { ReactNode, useEffect, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View, useWindowDimensions } from "react-native";
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useL } from "../../core/hooks/useL";
import { closeMs, ease, M, useReduced } from "../../motion";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";

/**
 * Bottom sheet frame: springs up (no bounce), closes faster than it opens, backdrop fades. `footer` is pinned under the
 * scrolling content (sticky actions). Content is passed as children, so the caller owns its own ScrollView.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  tall = false,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** up to 88% of the screen instead of 70% */
  tall?: boolean;
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
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View
          style={[
            { maxHeight: height * (tall ? 0.88 : 0.7), backgroundColor: c.sheet, borderTopLeftRadius: r.sheet, borderTopRightRadius: r.sheet, paddingTop: 12 },
            sheet,
          ]}
        >
          <View style={{ alignSelf: "center", width: 48, height: 6, borderRadius: 3, backgroundColor: c.line, marginBottom: 10 }} />
          <View style={[row, { paddingHorizontal: 20, paddingBottom: 8, alignItems: "center" }]}>
            <Text style={[{ flex: 1, color: c.ink, fontSize: 20, fontWeight: "700" }, align]}>{title}</Text>
          </View>
          <View style={{ flexShrink: 1 }}>{children}</View>
          {footer ? (
            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 + insets.bottom, borderTopWidth: 1, borderTopColor: c.line }}>{footer}</View>
          ) : (
            <View style={{ height: insets.bottom + 8 }} />
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
