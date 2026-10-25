import { ReactNode, useEffect, useRef, useState } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { M, useReduced } from "../../motion";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";
import { alpha } from "../../theme/tokens";
import { Text } from "../ui/Text";
import { Icon, IconName } from "./Icon";
import { Ltr, PrimaryButton, SettingsControls, Tag } from "./Primitives";
import { useL } from "../../core/hooks/useL";
import { signOut } from "../../core/session/session";

export type TabItem = { name: string; label: string; icon: IconName };
type BarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  navigation: { emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string, params?: object) => void };
};

/**
 * Floating customer tab bar: inset 12, radius 26, sheet at 95% with a line border. The active item is a filled
 * btn / btnFg pill. Items follow `items` order, mirrored in Arabic by the row direction. Screens reserve
 * 112px of bottom padding so nothing is covered.
 */
export function FloatingTabBar({ state, navigation, items }: BarProps & { items: TabItem[] }) {
  const insets = useSafeAreaInsets();
  const { c, row, isArabic } = useTheme();
  const reduced = useReduced();
  const activeName = state.routes[state.index]?.name;
  const shown = items.filter((it) => state.routes.some((r) => r.name === it.name));
  const active = Math.max(0, shown.findIndex((it) => it.name === activeName));
  // the active pill slides between tabs; in Arabic the row is mirrored, so is the slot
  const [inner, setInner] = useState(0);
  const slot = shown.length ? inner / shown.length : 0;
  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!slot) return;
    const target = (isArabic ? shown.length - 1 - active : active) * slot;
    x.value = placed.current && !reduced ? withSpring(target, M.spring) : target;
    placed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, slot, isArabic, reduced]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View
      style={[
        row,
        {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 12 + insets.bottom,
          padding: 6,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: alpha(c.sheet, 0.95),
        },
      ]}
      onLayout={(e) => setInner(e.nativeEvent.layout.width - 14)}
    >
      {slot > 0 && <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 6, top: 6, width: slot, height: 56, borderRadius: 20, backgroundColor: c.btn }, pill]} />}
      {items.map((it) => {
        const route = state.routes.find((r) => r.name === it.name);
        if (!route) return null;
        const on = activeName === it.name;
        const fg = on ? c.btnFg : c.soft;
        return (
          <Pressable
            key={it.name}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={it.label}
            onPress={() => {
              const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!on && !e.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={({ pressed }) => ({
              flex: 1,
              height: 56,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              gap: 2,
                            transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Icon name={it.icon} size={20} color={fg} />
            <Text numberOfLines={1} style={{ color: fg, fontSize: 10, fontWeight: "700" }}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom bar: price (Ltr, 22 bold) + primary button. Pages using it reserve 144px of bottom padding. */
export function StickyActionBar({
  price,
  label,
  icon,
  onPress,
  loading,
  disabled,
  extra,
}: {
  price?: string;
  label: string;
  icon?: IconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c, row } = useTheme();
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        borderTopWidth: 1,
        borderTopColor: c.line,
        backgroundColor: alpha(c.sheet, 0.97),
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 14 + insets.bottom,
      }}
    >
      {extra}
      <View style={[row, { alignItems: "center", gap: 16 }]}>
        {price ? <Ltr style={{ fontSize: 22, fontWeight: "700" }}>{price}</Ltr> : null}
        <PrimaryButton style={{ flex: 1 }} label={label} icon={icon} onPress={onPress} loading={loading} disabled={disabled} />
      </View>
    </View>
  );
}

/** Round 44px translucent icon button for the top corner of a hero (settings on provider / admin screens). */
export function HeroIconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: alpha(c.cream, 0.2),
        backgroundColor: alpha(c.blueprint, 0.6),
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <Icon name={icon} size={20} color={c.cream} />
    </Pressable>
  );
}

/** Bottom sheet with language + appearance (and Sign out when asked). Opened from the hero settings icon. */
export function SettingsSheet({ visible, onClose, signOutButton }: { visible: boolean; onClose: () => void; signOutButton?: boolean }) {
  const insets = useSafeAreaInsets();
  const { c, r } = useTheme();
  const { t } = useL();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t("Close", "إغلاق")} onPress={onClose} style={{ flex: 1, backgroundColor: alpha(c.blueprint, 0.55) }} />
      <View
        style={{
          backgroundColor: c.sheet,
          borderTopLeftRadius: r.sheet,
          borderTopRightRadius: r.sheet,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 24 + insets.bottom,
        }}
      >
        <View style={{ alignSelf: "center", width: 48, height: 6, borderRadius: 3, backgroundColor: c.line, marginBottom: 16 }} />
        <Tag color={c.soft}>{t("Settings", "الإعدادات")}</Tag>
        <SettingsControls />
        {signOutButton ? (
          <PrimaryButton
            style={{ marginTop: 20 }}
            variant="danger"
            icon="logout"
            label={t("Sign out", "تسجيل الخروج")}
            onPress={() => {
              onClose();
              signOut();
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}
