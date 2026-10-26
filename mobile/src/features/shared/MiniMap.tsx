import { Pressable, Text, View } from "react-native";
import { Point } from "../../core/constants/geo";
import { useReduced } from "../../motion";
import { MAPS_AVAILABLE, ServiceMap, ServicePin } from "./maps";

/**
 * A small, NON-interactive map preview for a hero (real Leaflet / OSM tiles). Pins resolve one after another the first
 * time they appear, one soft sonar ring runs from your dot while `searching`, and a tap anywhere opens the full map.
 */
export function MiniMap({
  pins,
  me,
  searching = false,
  height,
  fitKey,
  onOpen,
  label,
}: {
  pins: ServicePin[];
  me: Point | null;
  searching?: boolean;
  height: number;
  /** changes when the set of points changes: the preview re-fits */
  fitKey: string;
  onOpen: () => void;
  label: string;
}) {
  const reduced = useReduced();
  if (!MAPS_AVAILABLE) return <View style={{ height }} />;
  const fit: [number, number][] = [...pins.map((p) => [p.lat, p.lng] as [number, number]), ...(me ? [[me.lat, me.lng] as [number, number]] : [])];
  return (
    <View style={{ height }}>
      <ServiceMap
        mini
        height={height}
        pins={pins}
        selectedId={null}
        me={me}
        fit={fit}
        fitKey={fitKey}
        pad={{ top: 14, bottom: 14, left: 14, right: 14 }}
        radar={searching}
        reduced={reduced}
        onSelect={() => undefined}
        onBackground={() => undefined}
      />
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onOpen} style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }} />
      <Text pointerEvents="none" style={{ position: "absolute", right: 4, bottom: 2, fontSize: 7, color: "#333", backgroundColor: "rgba(255,255,255,0.8)", paddingHorizontal: 3, writingDirection: "ltr" }}>
        © OpenStreetMap
      </Text>
    </View>
  );
}
