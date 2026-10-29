import { palette } from "./DesignTokens";
import { useAppearance } from "./Appearance";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet } from "react-native";

export function PanelFill({
  kind = "light",
  radius = 22,
}: {
  kind?: "light" | "hero" | "accent";
  radius?: number;
}) {
  const { dark } = useAppearance();
  const colors: readonly [string, string, string] =
    kind === "hero"
      ? dark
        ? ["#80583B", "#5A3E2C", "#3C2B20"]
        : ["#DFC09B", "#C99F73", "#B98B5E"]
      : kind === "accent"
        ? dark
          ? ["#69482D", "#513923", "#402D20"]
          : ["#EBCDA4", "#D9B383", "#C59664"]
        : dark
          ? ["#4B3627", "#3D2B20", "#35261D"]
          : ["#FFFCF6", "#FFF7EC", "#F8EAD8"];
  return (
    <LinearGradient
      pointerEvents="none"
      accessible={false}
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          borderWidth: 1.5,
          borderColor: dark ? palette.borderDark : palette.border,
        },
      ]}
    />
  );
}
export function CanvasFill() {
  const { dark } = useAppearance();
  return (
    <LinearGradient
      pointerEvents="none"
      accessible={false}
      colors={dark ? palette.canvasDark : palette.canvas}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBrandPalette() {
  const { dark } = useAppearance();
  return {
    hero: (dark
      ? ["#80583B", "#5A3E2C", "#3C2B20"]
      : ["#DFC09B", "#C99F73", "#B98B5E"]) as [string, string, string],
    ink: dark ? "#FFF1DF" : "#432D1E",
    muted: dark ? "#DEC3A1" : "#62452D",
    accent: dark ? "#E7C18D" : "#664326",
  };
}
