// Parts shops map (native / Expo Go): the shared Leaflet-in-a-WebView ServiceMap with the storefront "shop" marker.
// Only shops with really stored coordinates are passed in; nothing is geocoded. In route mode it also draws the user's
// position and a real road route (both passed in by the screen).
import { useMemo } from "react";
import { ServiceMap } from "../shared/maps";

export type MapPin = { id: string; name: string; lat: number; lng: number; /** greyed (e.g. a shop that is not approved, admin map) */ dim?: boolean };
export type MapRoute = { coords: [number, number][]; key: string };

export function ShopsMap({
  pins,
  selectedId,
  onSelect,
  onBackground,
  height,
  bottomInset = 0,
  me = null,
  route = null,
  fitKey: extraKey = "",
}: {
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBackground: () => void;
  height: number;
  bottomInset?: number;
  me?: { lat: number; lng: number } | null;
  route?: MapRoute | null;
  /** changes when the map should re-fit (filters changed) */
  fitKey?: string;
}) {
  const fit = useMemo(() => (route ? route.coords : pins.map((p) => [p.lat, p.lng] as [number, number])), [pins, route]);
  const sel = pins.find((p) => p.id === selectedId);
  return (
    <ServiceMap
      pins={pins.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: "shop" as const, dim: !!p.dim }))}
      selectedId={selectedId}
      me={me}
      route={route ? { coords: route.coords, dashed: false, key: route.key } : null}
      fit={fit}
      fitKey={route ? `route|${route.key}` : `${pins.map((p) => p.id).join("|")}${extraKey}`}
      pad={{ top: 90, bottom: route ? 300 : 280, left: 24, right: 24 }}
      focus={sel && !route ? { lat: sel.lat, lng: sel.lng, key: sel.id } : null}
      onSelect={onSelect}
      onBackground={onBackground}
      height={height}
      bottomInset={bottomInset}
    />
  );
}
