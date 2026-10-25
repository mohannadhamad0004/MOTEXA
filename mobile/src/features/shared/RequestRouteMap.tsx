import { useWindowDimensions } from "react-native";
import { Point } from "../../core/constants/geo";
import { useReduced } from "../../motion";
import { MAPS_AVAILABLE, ServiceMap } from "./maps";
import type { RouteResult } from "./routing";

/** The map of a request status screen: provider pin, pickup pin and the route between them (same helper as the map page). */
export function RequestRouteMap({
  reqId,
  kind,
  provider,
  pickup,
  route,
  height,
}: {
  reqId: string;
  kind: "tow" | "mech";
  provider: Point & { name: string };
  pickup: Point;
  route: RouteResult | null;
  height: number;
}) {
  const { width } = useWindowDimensions();
  const reduced = useReduced();
  if (!MAPS_AVAILABLE) return null;
  return (
    <ServiceMap
      height={height}
      bottomInset={36}
      pins={[{ id: "p", name: provider.name, lat: provider.lat, lng: provider.lng, kind, dim: false }]}
      selectedId="p"
      me={null}
      pickup={pickup}
      route={route ? { coords: route.coords, dashed: route.kind === "line", key: reqId } : null}
      reduced={reduced}
      fit={[[provider.lat, provider.lng], [pickup.lat, pickup.lng]]}
      fitKey={`req:${reqId}:${width}`}
      pad={{ top: 24, bottom: 56, left: 0, right: 0 }}
      onSelect={() => {}}
      onBackground={() => {}}
    />
  );
}
