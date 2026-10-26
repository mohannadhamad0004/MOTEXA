import { Image } from "expo-image";
import { useState } from "react";
import { View, ViewStyle } from "react-native";
import { isDevSeedTile } from "../../core/constants/files";
import { M } from "../../motion";
import { alpha } from "../../theme/tokens";
import { useTheme } from "../../theme/useTheme";
import { Text } from "../ui/Text";
import { CategoryAssembly, assemblyForCategory } from "./assemblies";
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
  const box: ViewStyle = size ? { width: size, height: size } : { width: "100%", aspectRatio: 1 };
  // a photo that fails to load falls back to the category illustration
  const [failed, setFailed] = useState(false);
  if (uri && !failed)
    return (
      <View style={[box, { borderRadius: 16, overflow: "hidden", backgroundColor: c.pill }, style]}>
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={M.detail} onError={() => setFailed(true)} onLoad={(e) => isDevSeedTile(e.source.width, e.source.height) && setFailed(true)} />
      </View>
    );
  // the same technical illustration as the product hero, static here; an unknown category shows the generic part box
  return (
    <BlueprintSurface style={[box, { borderRadius: 16, padding: 4, alignItems: "center", justifyContent: "center" }, style]}>
      <CategoryAssembly kind={assemblyForCategory(category)} />
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

/** Designed placeholder for a mechanic (there is no profile photo in the data): a person line mark on the blueprint plate. */
export function MechanicAvatar({ size = 56 }: { size?: number }) {
  const { c } = useTheme();
  return (
    <BlueprintSurface style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: alpha(c.bronzeLight, 0.3) }}>
      <Icon name="user" size={Math.round(size * 0.5)} color={c.bronzeLight} />
    </BlueprintSurface>
  );
}
