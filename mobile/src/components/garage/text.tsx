// Garage type: Plus Jakarta Sans (English) / Cairo (Arabic), chosen per text content like the app's Text does.
// Only the weights in the repo are used: 400 -> Regular, 500/600 -> SemiBold, 700/800 -> Bold.
import { Ionicons } from "@expo/vector-icons";
import { ComponentProps, ReactNode, createContext, isValidElement, useContext } from "react";
import { StyleSheet, TextProps } from "react-native";
import { useFonts } from "expo-font";
import { Text } from "../ui/Text";
import { useGarageTheme } from "../../theme/garage";

const Ready = createContext(false);

/** Loads the garage fonts once (customer layout). Never blocks rendering: until loaded, text uses the default family. */
export function GarageFonts({ children }: { children: ReactNode }) {
  const [ok] = useFonts({
    GJakarta: require("../../../assets/fonts/PlusJakartaSans-Regular.ttf"),
    GJakartaSemi: require("../../../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
    GJakartaBold: require("../../../assets/fonts/PlusJakartaSans-Bold.ttf"),
    GCairo: require("../../../assets/fonts/Cairo-Regular.ttf"),
    GCairoSemi: require("../../../assets/fonts/Cairo-SemiBold.ttf"),
    GCairoBold: require("../../../assets/fonts/Cairo-Bold.ttf"),
  });
  return <Ready.Provider value={ok}>{children}</Ready.Provider>;
}

const plain = (v: ReactNode): string =>
  typeof v === "string" || typeof v === "number" ? String(v) : Array.isArray(v) ? v.map(plain).join("") : isValidElement<{ children?: ReactNode }>(v) ? plain(v.props.children) : "";

/** Text in the garage fonts. Colour defaults to ink; pass `soft` for secondary text. */
export function GText({ style, children, soft, ...props }: TextProps & { soft?: boolean }) {
  const ready = useContext(Ready);
  const { g } = useGarageTheme();
  const flat = StyleSheet.flatten(style) || {};
  const w = flat.fontWeight === "bold" ? 700 : Number(flat.fontWeight || 400);
  const arabic = /[؀-ۿ]/.test(plain(children));
  const family = arabic ? (w >= 700 ? "GCairoBold" : w >= 500 ? "GCairoSemi" : "GCairo") : w >= 700 ? "GJakartaBold" : w >= 500 ? "GJakartaSemi" : "GJakarta";
  return (
    <Text {...props} style={[{ color: soft ? g.soft : g.ink }, style, ready && { fontFamily: family, fontWeight: "normal" }]}>
      {children}
    </Text>
  );
}

export type GIconName = ComponentProps<typeof Ionicons>["name"];

/** Rounded stroke icons (Ionicons outline set). Never mirrored unless `flip` (arrows / chevrons in Arabic). */
export function GIcon({ name, size = 20, color, flip }: { name: GIconName; size?: number; color?: string; flip?: boolean }) {
  const { g, isArabic } = useGarageTheme();
  return <Ionicons name={name} size={size} color={color ?? g.accentText} style={flip && isArabic ? { transform: [{ scaleX: -1 }] } : undefined} />;
}
