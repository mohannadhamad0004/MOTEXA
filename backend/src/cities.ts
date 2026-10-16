// Cities a tow company can list as its service area. Names (English) are what the database stores; they come from
// the web app's logistics/cities.js. Keep in sync with mobile/src/features/shared/cities.ts.
export const SERVICE_CITIES = [
  "Nablus", "Ramallah", "Al-Bireh", "Jenin", "Tulkarm", "Qalqilya", "Hebron", "Bethlehem", "Beit Sahour", "Beit Jala", "Jericho",
  "Salfit", "Tubas", "Tammun", "Birzeit", "Halhul", "Yatta", "Dura", "Anabta", "Qabatiya", "Azzun", "Huwara",
] as const;

/** The canonical spelling of a city (any letter case), or null when it is not in the list. */
export const canonicalCity = (v: unknown) => {
  if (typeof v !== "string") return null;
  const k = v.trim().toLowerCase();
  return SERVICE_CITIES.find((c) => c.toLowerCase() === k) ?? null;
};
