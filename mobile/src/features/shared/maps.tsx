import { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { MapPressEvent, Marker, Region } from "react-native-maps";
import { Point } from "./geo";
import { C } from "./palette";

// Maps (react-native-maps; works in Expo Go). Every map is small and optional: the screens always have the text too.
// Web has no react-native-maps, so maps.web.tsx replaces this file there.

export const MAPS_AVAILABLE = true;

export type Pin = { id: string; name: string; lat: number; lng: number; free: boolean };

/** A region that shows all the points with some room around them. */
function regionFor(points: Point[]): Region {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.02),
  };
}

const frame = (height: number) => ({ height, borderRadius: 16, overflow: "hidden" as const, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 12 });

/** Tow companies as pins (the selected one is highlighted), and your own position as a blue dot. */
export function CompaniesMap({ pins, me, selectedId, onSelect, height = 320 }: { pins: Pin[]; me: Point | null; selectedId: string | null; onSelect: (id: string) => void; height?: number }) {
  const points: Point[] = [...pins, ...(me ? [me] : [])];
  const region = points.length ? regionFor(points) : { latitude: 32.0, longitude: 35.2, latitudeDelta: 1.2, longitudeDelta: 1.2 };
  const ref = useRef<MapView>(null);
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  useEffect(() => {
    if (points.length) ref.current?.animateToRegion(regionFor(points), 300);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- only when the set of points changes
  }, [key]);
  return (
    <View style={frame(height)}>
      <MapView ref={ref} style={{ flex: 1 }} initialRegion={region} toolbarEnabled={false}>
        {pins.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }} title={p.name} pinColor={p.id === selectedId ? "red" : p.free ? "orange" : "gray"} onPress={() => onSelect(p.id)} />
        ))}
        {me ? <Marker coordinate={{ latitude: me.lat, longitude: me.lng }} pinColor="blue" title="•" /> : null}
      </MapView>
    </View>
  );
}

/** One movable pin. Tap the map or drag the pin (on Android: press and hold first) to move it. */
export function PinMap({ point, onChange, height = 200 }: { point: Point; onChange?: (p: Point) => void; height?: number }) {
  const ref = useRef<MapView>(null);
  useEffect(() => {
    ref.current?.animateToRegion({ latitude: point.lat, longitude: point.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 250);
  }, [point.lat, point.lng]);
  const tap = (e: MapPressEvent) => onChange?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude });
  return (
    <View style={frame(height)}>
      <MapView ref={ref} style={{ flex: 1 }} initialRegion={{ latitude: point.lat, longitude: point.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }} onPress={onChange ? tap : undefined} toolbarEnabled={false}>
        <Marker
          coordinate={{ latitude: point.lat, longitude: point.lng }}
          draggable={!!onChange}
          onDragEnd={(e) => onChange?.({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
        />
      </MapView>
    </View>
  );
}

/** Pickup (and, when there is one, destination) of a tow request. Read only. */
export function TripMap({ pickup, dropoff, height = 200 }: { pickup: Point; dropoff?: Point | null; height?: number }) {
  const points = dropoff ? [pickup, dropoff] : [pickup];
  return (
    <View style={frame(height)}>
      <MapView style={{ flex: 1 }} initialRegion={regionFor(points)} toolbarEnabled={false}>
        <Marker coordinate={{ latitude: pickup.lat, longitude: pickup.lng }} pinColor="orange" title="A" />
        {dropoff ? <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }} pinColor="green" title="B" /> : null}
      </MapView>
    </View>
  );
}
