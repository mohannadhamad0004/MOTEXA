import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";

/**
 * Standard screen: themed background, a fixed safe-area band on top (content scrolls below it and never slides
 * under the status bar), scroll, optional pull-to-refresh, keyboard avoidance.
 * StatusBar style follows the appearance and is set once by AppearanceProvider.
 */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  tabs = false,
  scroll = true,
  contentStyle,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** true on screens above a tab bar (the bar already reserves the bottom inset) */
  tabs?: boolean;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const { c, s } = useTheme();
  const padding: ViewStyle = {
    paddingHorizontal: s.gutter,
    paddingTop: 14,
    paddingBottom: (tabs ? 0 : insets.bottom) + 40,
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <LinearGradient colors={c.bgGradient} style={StyleSheet.absoluteFill} />
      <View style={{ height: insets.top }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} /> : undefined
            }
            contentContainerStyle={[padding, contentStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
