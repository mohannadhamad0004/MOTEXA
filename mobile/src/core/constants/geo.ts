// Locations. A point is { lat, lng }. Distances are straight lines (haversine), never driving routes.

export type Point = { lat: number; lng: number };

/** Coordinates are kept to 6 decimals (about 11 cm): enough for a pin, and short enough for every validator. */
export const roundCoord = (n: number) => Math.round(n * 1e6) / 1e6;
export const roundPoint = (p: Point): Point => ({ lat: roundCoord(p.lat), lng: roundCoord(p.lng) });

/** The customer's position, kept in memory for this app session only (never saved on the phone, never tracked). */
export const locationMemory: { current: Point | null } = { current: null };

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

/** A link that opens the Google Maps app (or the browser) with directions to the point. Needs no API key. */
export const mapsDirectionsUrl = (p: Point) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
