// Road routes from the public OSRM demo server. Pure TypeScript (no React Native imports) so it can be unit-tested.
// A route never blocks anything: on any failure (offline, timeout, bad answer) the caller gets a straight line.
// MOTEXA does not track vehicles, so this is only "pickup -> provider" geometry, never a live position or an ETA.

import { haversineKm } from "../../core/constants/geo";

export type LatLng = { lat: number; lng: number };
export type RouteResult = {
  kind: "road" | "line";
  /** [lat, lng] pairs, ready for Leaflet */
  coords: [number, number][];
  km: number;
  /** estimated drive time without traffic; only for a road route */
  minutes: number | null;
};

const OSRM = "https://router.project-osrm.org/route/v1/driving";
export const ROUTE_TIMEOUT_MS = 5000;

/** The first route of an OSRM answer, or null when the answer is not usable. */
export function parseOsrm(json: any): Pick<RouteResult, "coords" | "km" | "minutes"> | null {
  const r = json?.code === "Ok" ? json?.routes?.[0] : null;
  const pts = r?.geometry?.coordinates;
  if (!r || !Array.isArray(pts) || pts.length < 2 || typeof r.distance !== "number") return null;
  const coords: [number, number][] = [];
  for (const p of pts) {
    if (!Array.isArray(p) || typeof p[0] !== "number" || typeof p[1] !== "number") return null;
    coords.push([p[1], p[0]]); // GeoJSON is [lng, lat]
  }
  return { coords, km: r.distance / 1000, minutes: typeof r.duration === "number" ? Math.max(1, Math.round(r.duration / 60)) : null };
}

export function straightLine(from: LatLng, to: LatLng): RouteResult {
  return { kind: "line", coords: [[from.lat, from.lng], [to.lat, to.lng]], km: haversineKm(from, to), minutes: null };
}

/** Road route, or the straight line when OSRM fails or takes longer than `timeoutMs`. Never throws. */
export async function fetchRoute(from: LatLng, to: LatLng, opts: { timeoutMs?: number; fetchFn?: typeof fetch } = {}): Promise<RouteResult> {
  const { timeoutMs = ROUTE_TIMEOUT_MS, fetchFn = fetch } = opts;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const url = `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetchFn(url, { signal: ctl.signal });
    if (!res.ok) return straightLine(from, to);
    const parsed = parseOsrm(await res.json());
    return parsed ? { kind: "road", ...parsed } : straightLine(from, to);
  } catch {
    return straightLine(from, to);
  } finally {
    clearTimeout(timer);
  }
}

// Session cache: one route per request (and pair of points).
const cache = new Map<string, RouteResult>();
const r5 = (n: number) => n.toFixed(5);
export const routeCacheKey = (id: string, from: LatLng, to: LatLng) => `${id}|${r5(from.lat)},${r5(from.lng)}|${r5(to.lat)},${r5(to.lng)}`;
export const cachedRoute = (key: string) => cache.get(key) ?? null;
export async function getRoute(key: string, from: LatLng, to: LatLng, opts?: Parameters<typeof fetchRoute>[2]) {
  const hit = cache.get(key);
  if (hit) return hit;
  const r = await fetchRoute(from, to, opts);
  // a straight-line fallback is not cached, so a later try can still get the road route
  if (r.kind === "road") cache.set(key, r);
  return r;
}
