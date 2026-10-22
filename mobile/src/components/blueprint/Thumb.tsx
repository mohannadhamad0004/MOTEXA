import { Image } from "expo-image";
import { View, ViewStyle } from "react-native";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";
import { DRAWINGS, DrawingKind } from "./drawings";
import { Icon, IconName } from "./Icon";
import { BlueprintSurface } from "./Surface";

const BY_CATEGORY: Record<string, DrawingKind> = {
  BRAKE_SYSTEM: "disc",
  ENGINE: "plug",
  FILTERS: "filter",
  SUSPENSION_STEERING: "shock",
  ELECTRICAL: "battery",
  LIGHTING: "light",
  BODY: "car",
  ENGINE_OIL: "oil",
  TRANSMISSION_FLUID: "oil",
  COOLANT: "oil",
  BRAKE_FLUID: "oil",
  TIRES: "tyre",
  WHEELS: "tyre",
  HAND_TOOLS: "toolbox",
  JACKS_STANDS: "toolbox",
  DIAGNOSTICS: "toolbox",
};

/** The line drawing that belongs to a catalogue category, or null (the thumb then shows a box icon). */
export const drawingForCategory = (key?: string | null): DrawingKind | null => (key ? BY_CATEGORY[key] ?? null : null);

/**
 * Part thumbnail: the shop's real photo when there is one, otherwise a blueprint mini panel with the
 * category's drawing. `size` omitted = fill the width as a square.
 */
export function PartThumb({ category, uri, size, style }: { category?: string | null; uri?: string | null; size?: number; style?: ViewStyle }) {
  const { c } = useTheme();
  const kind = drawingForCategory(category);
  const box: ViewStyle = size ? { width: size, height: size } : { width: "100%", aspectRatio: 1 };
  if (uri)
    return (
      <View style={[box, { borderRadius: 16, overflow: "hidden", backgroundColor: c.pill }, style]}>
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
      </View>
    );
  const D = kind ? DRAWINGS[kind] : null;
  return (
    <BlueprintSurface style={[box, { borderRadius: 16, padding: 8, alignItems: "center", justifyContent: "center" }, style]}>
      {D ? <D glow={false} /> : <Icon name="box" size={Math.round((size ?? 80) * 0.5)} color={c.bronzeLight} />}
    </BlueprintSurface>
  );
}

/** Square blueprint tile holding one line icon (tow company, shop, request type). */
export function IconTile({ icon, size = 56, round = false }: { icon: IconName; size?: number; round?: boolean }) {
  const { c } = useTheme();
  return (
    <BlueprintSurface style={{ width: size, height: size, borderRadius: round ? size / 2 : 14, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={c.bronzeLight} />
    </BlueprintSurface>
  );
}

/** Round blueprint avatar with the first letter of a name. */
export function Avatar({ name, size = 56 }: { name: string; size?: number }) {
  const { c } = useTheme();
  return (
    <BlueprintSurface style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: c.bronzeLight, fontSize: Math.round(size * 0.36), fontWeight: "700" }}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </BlueprintSurface>
  );
}

/** Small round pill-coloured tile with a bronze icon (shop rows, profile items). */
export function RoundIcon({ icon, size = 44 }: { icon: IconName; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.pill, alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={c.bronze} />
    </View>
  );
}

/** Small blueprint panel with one line drawing (request rows: tow, mechanic, question). */
export function DrawingThumb({ kind, size = 64 }: { kind: DrawingKind; size?: number }) {
  const D = DRAWINGS[kind];
  return (
    <BlueprintSurface style={{ width: size, height: size, borderRadius: 16, padding: 6, alignItems: "center", justifyContent: "center" }}>
      <D glow={false} />
    </BlueprintSurface>
  );
}
