// Cities a tow company can pick as its service area. The stored value is the English name (same list as
// backend/src/cities.ts, taken from the web app's logistics/cities.js); the Arabic label is only for display.

export const CITIES = [
  { name: "Nablus", ar: "نابلس" },
  { name: "Ramallah", ar: "رام الله" },
  { name: "Al-Bireh", ar: "البيرة" },
  { name: "Jenin", ar: "جنين" },
  { name: "Tulkarm", ar: "طولكرم" },
  { name: "Qalqilya", ar: "قلقيلية" },
  { name: "Hebron", ar: "الخليل" },
  { name: "Bethlehem", ar: "بيت لحم" },
  { name: "Beit Sahour", ar: "بيت ساحور" },
  { name: "Beit Jala", ar: "بيت جالا" },
  { name: "Jericho", ar: "أريحا" },
  { name: "Salfit", ar: "سلفيت" },
  { name: "Tubas", ar: "طوباس" },
  { name: "Tammun", ar: "طمون" },
  { name: "Birzeit", ar: "بيرزيت" },
  { name: "Halhul", ar: "حلحول" },
  { name: "Yatta", ar: "يطا" },
  { name: "Dura", ar: "دورا" },
  { name: "Anabta", ar: "عنبتا" },
  { name: "Qabatiya", ar: "قباطية" },
  { name: "Azzun", ar: "عزون" },
  { name: "Huwara", ar: "حوارة" },
] as const;

export const MAX_SERVICE_CITIES = 10;

/** The city name in the current language; names that are not in the list (a company's own free-text city) pass through. */
export const cityLabel = (name: string, isArabic: boolean) => (isArabic ? (CITIES.find((c) => c.name === name)?.ar ?? name) : name);
