// "Add 3D model": the car a Sketchfab model shows, read from its title and tags ("1997 Mercedes C-class W202") against the managed
// catalog: brand by name or alias, then the brand's model, then the generation by its code ("W202") or by the year. Pure (tested);
// the screen then asks the catalog suggestions endpoint for the generations of that year.
type Brand = { id: string; name: string; aliases: string[] };
type Gen = { id: string; code: string; yearFrom: number; yearTo: number };
type Vehicle = { id: string; brandId: string | null; model: string; generations: Gen[] };

export const normText = (s: string) => ` ${s.toLocaleLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]+/g, " ").trim()} `;

export function guessCar(title: string, tags: string[], tax: { brands: Brand[]; vehicles: Vehicle[] }) {
  const text = normText([title, ...tags].join(" "));
  const has = (s: string | null | undefined) => !!s && normText(s).trim().length > 0 && text.includes(normText(s));
  const yearHit = /\s(19[3-9]\d|20[0-4]\d)\s/.exec(text);
  const year = yearHit ? Number(yearHit[1]) : null;
  const longest = <T,>(xs: T[], len: (x: T) => number) => [...xs].sort((a, b) => len(b) - len(a))[0] ?? null;
  const brand = longest(tax.brands.filter(b => [b.name, ...b.aliases].some(has)), b => b.name.length);
  const model = brand ? longest(tax.vehicles.filter(v => v.brandId === brand.id && has(v.model)), v => v.model.length) : null;
  const gens = model?.generations ?? [];
  // a code inside a word counts too ("w202" holds "202"), but only codes of 3+ characters, so "1" or "Mk" never match by accident
  const byCode = longest(gens.filter(g => g.code.length >= 3 && (has(g.code) || text.includes(normText(g.code).trim()))), g => g.code.length);
  const byYear = year ? gens.filter(g => g.yearFrom <= year && g.yearTo >= year) : [];
  const generation = byCode ?? (byYear.length === 1 ? byYear[0]! : null);
  return { brandId: brand?.id ?? null, modelId: model?.id ?? null, generationId: generation?.id ?? null, make: brand?.name ?? null, model: model?.model ?? null, year };
}
