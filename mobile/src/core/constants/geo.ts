// Locations. A point is { lat, lng }. Distances are straight lines (haversine), never driving routes.

export type Point = { lat: number; lng: number };

export type LocationFix = {
  point: Point;
  accuracy?: number;
  timestamp: number;
  source: "gps" | "cached";
};

export const LOCATION_FRESHNESS_MS = 60_000;
export const LOCATION_MEMORY_MAX_AGE_MS = 10 * 60_000;

/** Coordinates are kept to 6 decimals (about 11 cm): enough for a pin, and short enough for every validator. */
export const roundCoord = (n: number) => Math.round(n * 1e6) / 1e6;
export const roundPoint = (p: Point): Point => ({ lat: roundCoord(p.lat), lng: roundCoord(p.lng) });

// Process-local only, scoped by authenticated user id. A point from one account must never be
// handed to another account after a sign-out/sign-in without a process restart.
const locationMemoryByUser = new Map<string, Omit<LocationFix, "source">>();

export function rememberLocation(userId: string | null | undefined, fix: Omit<LocationFix, "source">) {
  if (!userId || !isValidPoint(fix.point)) return;
  locationMemoryByUser.set(userId, fix);
}

export function getLocationMemory(userId: string | null | undefined, now = Date.now()): LocationFix | null {
  if (!userId) return null;
  const fix = locationMemoryByUser.get(userId);
  if (!fix) return null;
  if (now - fix.timestamp > LOCATION_MEMORY_MAX_AGE_MS || fix.timestamp > now + 5_000) {
    locationMemoryByUser.delete(userId);
    return null;
  }
  return { ...fix, point: { ...fix.point }, source: "cached" };
}

export function clearLocationMemory(userId: string | null | undefined) {
  if (userId) locationMemoryByUser.delete(userId);
}

/** Legacy unscoped access is intentionally disabled to prevent cross-account location reuse. */
export const locationMemory: { current: Point | null } = Object.defineProperty({}, "current", {
  enumerable: true,
  get: () => null,
  set: () => undefined,
}) as { current: Point | null };

export const isValidPoint = (point: Point) =>
  Number.isFinite(point.lat) && point.lat >= -90 && point.lat <= 90 &&
  Number.isFinite(point.lng) && point.lng >= -180 && point.lng <= 180;

/** "≈ 4.2 km (straight line)" — under 1 km it says "less than 1 km". */
export function distanceLabel(km: number, isArabic: boolean) {
  const n = km < 1 ? null : km < 10 ? km.toFixed(1) : String(Math.round(km));
  if (isArabic) return n === null ? "≈ أقل من 1 كم (خط مستقيم)" : `≈ ${n} كم (خط مستقيم)`;
  return n === null ? "≈ less than 1 km (straight line)" : `≈ ${n} km (straight line)`;
}

/** Great-circle distance in km (same formula as the server and the web app). */
export function haversineKm(a: Point, b: Point) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function hasMeaningfulMovement(a: Point, b: Point, thresholdMeters: number) {
  return haversineKm(a, b) * 1000 >= thresholdMeters;
}

export function isFreshLocation(timestamp: number, now = Date.now()) {
  return Number.isFinite(timestamp) && timestamp <= now + 5_000 && now - timestamp <= LOCATION_FRESHNESS_MS;
}

/** A link that opens the Google Maps app (or the browser) with directions to the point. Needs no API key. */
export const mapsDirectionsUrl = (p: Point) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;

export function shouldRefreshLocationRoute(previous: { requestId: string; from: Point; to: Point } | null, requestId: string, from: Point, to: Point, threshold: number) {
  return !previous || previous.requestId !== requestId || hasMeaningfulMovement(previous.from, from, threshold) || hasMeaningfulMovement(previous.to, to, threshold);
}
