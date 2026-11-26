// On-duty location for tow drivers and garage mechanics. While a person is Online the app sends his position about every 60 s
// (foreground only in Expo Go; background tracking needs a development build). Rules:
//  - only the LATEST point is stored (lastLat / lastLng / lastAt on the person's own row); going Offline clears it;
//  - the full path is stored only during an active job (TowJobTrail / MechanicJobTrail) and deleted when the job ends;
//  - these points go to the person's own company / garage and that department's admins only. Customers never get them: a customer
//    only sees the person assigned to HIS active job, through the job's own view.
import { haversineKm, inBox } from "../geo.js";

/** pings closer together than this are ignored (the app sends one about every 60 s) */
export const DUTY_MIN_MS = 30_000;
/** a point older than this is shown as "last seen" */
export const DUTY_STALE_MS = 3 * 60_000;

export const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
/** a valid point inside the area MOTEXA serves, rounded to 5 decimals (~1 m), or null */
export function dutyPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && inBox(lat, lng) ? { lat: round5(lat), lng: round5(lng) } : null;
}
export const tooSoon = (lastAt: Date | null, now = Date.now()) => !!lastAt && now - lastAt.getTime() < DUTY_MIN_MS;

export type Presence = { lat: number; lng: number; at: string; stale: boolean };
export const presenceOf = (r: { lastLat: number | null; lastLng: number | null; lastAt: Date | null }, now = Date.now()): Presence | null =>
  r.lastLat !== null && r.lastLng !== null && r.lastAt ? { lat: r.lastLat, lng: r.lastLng, at: r.lastAt.toISOString(), stale: now - r.lastAt.getTime() > DUTY_STALE_MS } : null;

/**
 * "Nearest available": people sorted by distance to `to` (nearest first). A fresh live point is used when there is one, else the
 * fallback (base) point; people with neither come last. Distance in km with one decimal.
 */
export function nearestFirst<T>(people: T[], to: { lat: number; lng: number } | null, where: (x: T) => { live: Presence | null; base: { lat: number; lng: number } | null }) {
  return people
    .map((x) => {
      const w = where(x), live = w.live && !w.live.stale ? w.live : null, p = live ?? w.base;
      const km = to && p ? haversineKm(to, p) : null;
      return { item: x, km, distanceKm: km === null ? null : Math.round(km * 10) / 10, source: (live ? "live" : p ? "base" : "none") as "live" | "base" | "none" };
    })
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
}
