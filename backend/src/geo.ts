import "dotenv/config";
import { canonicalCity } from "./cities.js";

// Locations: coordinate checks, straight-line distance and the city-centre fallback.
// The accepted area is the strict Palestine box below; change it in backend/.env with
//   GEO_MIN_LAT  GEO_MAX_LAT  GEO_MIN_LNG  GEO_MAX_LNG
// (unset or not a number = the default).

const num = (v: string | undefined, fallback: number) => (v !== undefined && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback);
export const GEO_BOX = {
  minLat: num(process.env.GEO_MIN_LAT, 31.2),
  maxLat: num(process.env.GEO_MAX_LAT, 32.7),
  minLng: num(process.env.GEO_MIN_LNG, 34.2),
  maxLng: num(process.env.GEO_MAX_LNG, 35.6),
};

export const GEO_BOX_MESSAGE = "That location is outside the area MOTEXA serves.";

/** True for a real latitude/longitude pair inside the accepted area. */
export const inBox = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= GEO_BOX.minLat && lat <= GEO_BOX.maxLat && lng >= GEO_BOX.minLng && lng <= GEO_BOX.maxLng;

/** Approximate city centres (from the web app's cities.js): good for sorting and map pins, not for navigation. */
export const CITY_CENTRES: Record<string, { lat: number; lng: number }> = {
  Nablus: { lat: 32.2211, lng: 35.2544 }, Ramallah: { lat: 31.9038, lng: 35.2034 }, "Al-Bireh": { lat: 31.91, lng: 35.216 },
  Jenin: { lat: 32.461, lng: 35.3027 }, Tulkarm: { lat: 32.3104, lng: 35.0286 }, Qalqilya: { lat: 32.1897, lng: 34.9706 },
  Hebron: { lat: 31.5326, lng: 35.0998 }, Bethlehem: { lat: 31.7054, lng: 35.2024 }, "Beit Sahour": { lat: 31.7, lng: 35.225 },
  "Beit Jala": { lat: 31.715, lng: 35.187 }, Jericho: { lat: 31.8611, lng: 35.4617 }, Salfit: { lat: 32.0833, lng: 35.1806 },
  Tubas: { lat: 32.3209, lng: 35.3698 }, Tammun: { lat: 32.2839, lng: 35.3839 }, Birzeit: { lat: 31.972, lng: 35.196 },
  Halhul: { lat: 31.58, lng: 35.1 }, Yatta: { lat: 31.4469, lng: 35.095 }, Dura: { lat: 31.5061, lng: 35.0283 },
  Anabta: { lat: 32.3069, lng: 35.1189 }, Qabatiya: { lat: 32.41, lng: 35.2806 }, Azzun: { lat: 32.1736, lng: 35.0611 },
  Huwara: { lat: 32.1531, lng: 35.2564 },
};

/** The centre of a city by name (any letter case), or null when the name is not in the list. */
export const cityCentre = (name: string) => {
  const c = canonicalCity(name);
  return c ? CITY_CENTRES[c] : null;
};

/** Great-circle distance in km (haversine, same formula as the web app). */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** About 110 m: what customers get of a company's business location. */
export const round3 = (n: number | null) => (n === null ? null : Math.round(n * 1000) / 1000);

/**
 * Reads an optional coordinate pair from a body ({ [latKey]: number, [lngKey]: number }). Both or none; numbers only;
 * inside the accepted area. Returns { lat, lng } (null when absent) or an error message.
 */
export function readPair(body: any, latKey: string, lngKey: string, label: string): { lat: number | null; lng: number | null } | { error: string } {
  const lat = body?.[latKey];
  const lng = body?.[lngKey];
  const none = (v: unknown) => v === undefined || v === null;
  if (none(lat) && none(lng)) return { lat: null, lng: null };
  if (none(lat) || none(lng)) return { error: `${label}: send both ${latKey} and ${lngKey}.` };
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return { error: `${label}: coordinates must be numbers.` };
  if (!inBox(lat, lng)) return { error: `${label}: ${GEO_BOX_MESSAGE}` };
  return { lat, lng };
}
