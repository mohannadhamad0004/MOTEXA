import { LinearGradient } from "expo-linear-gradient";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { C } from "../shared/palette";

/**
 * Same look as the shared `Screen`, plus pull-to-refresh. The customer tabs need it and the shared Screen
 * has no refresh hook; it is not changed so the provider/admin screens stay exactly as they are.
 */
export function CustomerScreen({
  children,
  onRefresh,
  refreshing = false,
  tabs = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** true on screens that sit above the tab bar (it already reserves the bottom inset) */
  tabs?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <LinearGradient colors={C.gradient} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} colors={[C.accent]} /> : undefined}
          contentContainerStyle={{
            paddingHorizontal: 18,
            paddingTop: insets.top + 14,
            paddingBottom: (tabs ? 0 : insets.bottom) + 40,
          }}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
