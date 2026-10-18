// Cities a tow company can pick as its service area. The stored value is the English name (same list as
// backend/src/cities.ts, taken from the web app's logistics/cities.js); the Arabic label is only for display.
// lat/lng are approximate city centres: good for distances and map pins, not for navigation.

export const CITIES = [
  { name: "Nablus", ar: "نابلس", lat: 32.2211, lng: 35.2544 },
  { name: "Ramallah", ar: "رام الله", lat: 31.9038, lng: 35.2034 },
  { name: "Al-Bireh", ar: "البيرة", lat: 31.91, lng: 35.216 },
  { name: "Jenin", ar: "جنين", lat: 32.461, lng: 35.3027 },
  { name: "Tulkarm", ar: "طولكرم", lat: 32.3104, lng: 35.0286 },
  { name: "Qalqilya", ar: "قلقيلية", lat: 32.1897, lng: 34.9706 },
  { name: "Hebron", ar: "الخليل", lat: 31.5326, lng: 35.0998 },
  { name: "Bethlehem", ar: "بيت لحم", lat: 31.7054, lng: 35.2024 },
  { name: "Beit Sahour", ar: "بيت ساحور", lat: 31.7, lng: 35.225 },
  { name: "Beit Jala", ar: "بيت جالا", lat: 31.715, lng: 35.187 },
  { name: "Jericho", ar: "أريحا", lat: 31.8611, lng: 35.4617 },
  { name: "Salfit", ar: "سلفيت", lat: 32.0833, lng: 35.1806 },
  { name: "Tubas", ar: "طوباس", lat: 32.3209, lng: 35.3698 },
  { name: "Tammun", ar: "طمون", lat: 32.2839, lng: 35.3839 },
  { name: "Birzeit", ar: "بيرزيت", lat: 31.972, lng: 35.196 },
  { name: "Halhul", ar: "حلحول", lat: 31.58, lng: 35.1 },
  { name: "Yatta", ar: "يطا", lat: 31.4469, lng: 35.095 },
  { name: "Dura", ar: "دورا", lat: 31.5061, lng: 35.0283 },
  { name: "Anabta", ar: "عنبتا", lat: 32.3069, lng: 35.1189 },
  { name: "Qabatiya", ar: "قباطية", lat: 32.41, lng: 35.2806 },
  { name: "Azzun", ar: "عزون", lat: 32.1736, lng: 35.0611 },
  { name: "Huwara", ar: "حوارة", lat: 32.1531, lng: 35.2564 },
] as const;

export const MAX_SERVICE_CITIES = 10;

/** The city name in the current language; names that are not in the list (a company's own free-text city) pass through. */
export const cityLabel = (name: string, isArabic: boolean) => (isArabic ? (CITIES.find((c) => c.name === name)?.ar ?? name) : name);

/** The approximate centre of a city by name (any letter case), or null when the name is not in the list. */
export const cityCentre = (name: string) => {
  const k = name.trim().toLowerCase();
  const c = CITIES.find((x) => x.name.toLowerCase() === k);
  return c ? { lat: c.lat, lng: c.lng } : null;
};
