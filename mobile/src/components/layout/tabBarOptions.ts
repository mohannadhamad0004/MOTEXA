import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/useTheme";

/** Bottom tab bar look shared by the tab layouts (themed, safe-area aware). */
export function useTabBarOptions() {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  return {
    headerShown: false,
    tabBarActiveTintColor: c.accent,
    tabBarInactiveTintColor: c.textDim,
    tabBarLabelStyle: { fontSize: 11, fontWeight: "700" as const },
    tabBarStyle: {
      backgroundColor: c.tabBar,
      borderTopColor: c.border,
      borderTopWidth: 1,
      height: 65 + insets.bottom,
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 12),
      elevation: 0,
    },
  };
}
