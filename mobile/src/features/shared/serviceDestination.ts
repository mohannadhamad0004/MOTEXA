import type { Point } from "../../core/constants/geo";

/** Backend contract: only verified, public-rounded workshop coordinates belong here. */
export type PublicWorkshopLocation = { publicLocation?: Point | null };
export function servicePosition(publicLocation: unknown, fallback: Point | null) {
  const p = publicLocation as Partial<Point> | null | undefined;
  const routeDestination: Point | null = p && typeof p.lat === "number" && typeof p.lng === "number" &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180
    ? { lat: p.lat, lng: p.lng } : null;
  return { displayPosition: routeDestination ?? fallback, routeDestination, approx: !routeDestination };
}
export const serviceRouteIdentity = (provider: { kind: string; id: string }) =>
  `dir:${provider.kind}:${provider.id}`;
