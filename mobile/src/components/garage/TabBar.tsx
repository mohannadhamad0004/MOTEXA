// Customer tab bar, garage style: a floating pill that follows the theme (light: white + warm shadow; dark: #241812 + line border).
// The active tab is a filled pill with icon + label, the others are icon only.
// Order follows `items`, mirrored in Arabic by the row direction.
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { gShape, useGarageTheme } from "../../theme/garage";
import { GIcon, GIconName, GText } from "./text";

export type GarageTabItem = { name: string; label: string; icon: GIconName; iconOn: GIconName };
type BarProps = {
  state: { index: number; routes: { key: string; name: string; params?: object }[] };
  navigation: { emit: (e: { type: "tabPress"; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }; navigate: (name: string, params?: object) => void };
};

export function GarageTabBar({ state, navigation, items }: BarProps & { items: GarageTabItem[] }) {
  const { g, row, dark } = useGarageTheme();
  const insets = useSafeAreaInsets();
  const activeName = state.routes[state.index]?.name;
  return (
    <View
      style={[
        row,
        {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 10 + insets.bottom,
          padding: 6,
          gap: 4,
          borderRadius: gShape.pill,
          backgroundColor: g.bar,
          borderWidth: dark ? 1 : 0,
          borderColor: g.line,
          // light: white bar on a soft warm shadow; dark: a 1px line border instead of a shadow
          shadowColor: "#50321A",
          shadowOpacity: dark ? 0 : 0.14,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 8 },
          elevation: dark ? 0 : 8,
        },
      ]}
    >
      {items.map((it) => {
        const route = state.routes.find((r) => r.name === it.name);
        if (!route) return null;
        const on = activeName === it.name;
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
            style={({ pressed }) => [
              row,
              {
                flexGrow: on ? 2.4 : 1,
                flexBasis: 0,
                height: 50,
                borderRadius: gShape.pill,
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingHorizontal: on ? 12 : 0,
                backgroundColor: on ? g.barActive : "transparent",
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}
          >
            <GIcon name={on ? it.iconOn : it.icon} size={21} color={on ? g.barActiveInk : g.barInk} />
            {on ? (
              <GText numberOfLines={1} style={{ fontSize: 13, lineHeight: 17, fontWeight: "800", color: g.barActiveInk, flexShrink: 1 }}>
                {it.label}
              </GText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
