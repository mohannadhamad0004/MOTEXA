// Car generations ("C-Class W202"): the master list is docs/3d/generations-master.tsv (Make, Model, Generation, Years, Status,
// Model title, URL, Notes). Pure helpers shared by the seed (src/seed/generations.ts), the 3D / photo scripts and the API.

export type TsvRow = { make: string; model: string; code: string; years: string; status: string; title: string; url: string; notes: string };

/** The TSV's make names -> our vehicle list's. */
const MAKE_ALIAS: Record<string, string> = { "mercedes-benz": "Mercedes", seat: "Seat" };
export const listMake = (make: string) => MAKE_ALIAS[make.trim().toLowerCase()] ?? make.trim();

export function parseTsv(text: string): TsvRow[] {
  return text
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const [make = "", model = "", code = "", years = "", status = "", title = "", url = "", notes = ""] = l.split("\t").map((x) => x.trim());
      return { make, model, code, years, status, title, url, notes };
    });
}

/**
 * "1993–2000" -> [1993, 2000]; "2018–present" / "2017+ ..." -> up to next year. Odd forms take the widest reading:
 * "1998–2004/08" -> 2008 (the later market end), "1997–2004+" -> 2004. exact=false marks those, so the seed can list them.
 */
export function parseYears(s: string, now = new Date().getFullYear()): { from: number; to: number; exact: boolean } | null {
  const t = s.trim().replace(/\s*[–—-]\s*/g, "-");
  let m = t.match(/^(\d{4})-(\d{4}|present)$/i);
  if (m) {
    const from = +m[1];
    const to = m[2].toLowerCase() === "present" ? now + 1 : +m[2];
    return from <= to ? { from, to, exact: true } : null;
  }
  m = t.match(/^(\d{4})-(\d{4})\/(\d{2,4})$/); // 1998-2004/08
  if (m) {
    const to = m[3].length === 2 ? Math.floor(+m[2] / 100) * 100 + +m[3] : +m[3];
    return { from: +m[1], to: Math.max(+m[2], to), exact: false };
  }
  m = t.match(/^(\d{4})-(\d{4})\+/); // 1997-2004+
  if (m) return { from: +m[1], to: +m[2], exact: false };
  m = t.match(/^(\d{4})\+/); // 2017+ select markets
  if (m) return { from: +m[1], to: now + 1, exact: false };
  return null;
}

/** Every generation whose years cover this model year (overlaps give more than one: the customer picks). */
export const generationsForYear = <G extends { yearFrom: number; yearTo: number }>(gens: G[], year: number) =>
  gens.filter((g) => g.yearFrom <= year && year <= g.yearTo).sort((a, b) => b.yearFrom - a.yearFrom);

/** "toyota-corolla-e170-e180": folder / file key for a generation. */
export const genKey = (make: string, model: string, code: string) =>
  [listMake(make), model, code]
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The Sketchfab model id at the end of a real /3d-models/ page URL (embed links and other sites: null). */
export const sketchfabUid = (url: string) => url.match(/^https:\/\/sketchfab\.com\/3d-models\/[^/?#]*?([0-9a-f]{32})\/?$/)?.[1] ?? null;
