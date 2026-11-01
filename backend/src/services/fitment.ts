// "Does this part fit this car?": ONE rule, used by the catalog filter (as a Prisma where) and for fit labels (in memory).
// A part fits when one of its fitment rows has the same make (and model / year range / trim when given), or when the shop
// marked it universal. A product with no fitment data and not universal is UNKNOWN: never shown as a fit.
import type { Prisma } from "../generated/prisma/client.js";

/** Lowercase, trimmed, inner spaces collapsed: the form fitment rows and vehicles are matched on. */
export const normText = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

export type CarQuery = { make: string; model?: string | null; year?: number | null; trim?: string | null };
type FitRow = { make: string; model: string; yearFrom: number; yearTo: number; trim?: string | null };

/** Products that fit the car: a matching fitment row OR universal. */
export function fitWhere(c: CarQuery): Prisma.PartsProductWhereInput {
  return {
    OR: [
      { isUniversal: true },
      {
        fitments: {
          some: {
            makeNormalized: normText(c.make),
            ...(c.model ? { modelNormalized: normText(c.model) } : {}),
            ...(c.year != null ? { yearFrom: { lte: c.year }, yearTo: { gte: c.year } } : {}),
            ...(c.trim ? { trim: { equals: c.trim, mode: "insensitive" as const } } : {}),
          },
        },
      },
    ],
  };
}

export type FitStatus = "FITS" | "UNIVERSAL" | "NOT_LISTED" | "UNKNOWN";

/** The same rule in memory. FITS wins over UNIVERSAL; NOT_LISTED = has fitment data, but not for this car. */
export function fitStatus(p: { isUniversal: boolean; fitments: FitRow[] }, c: CarQuery): FitStatus {
  const hit = p.fitments.some(
    (f) =>
      normText(f.make) === normText(c.make) &&
      (!c.model || normText(f.model) === normText(c.model)) &&
      (c.year == null || (f.yearFrom <= c.year && c.year <= f.yearTo)) &&
      (!c.trim || normText(f.trim ?? "") === normText(c.trim))
  );
  if (hit) return "FITS";
  if (p.isUniversal) return "UNIVERSAL";
  return p.fitments.length ? "NOT_LISTED" : "UNKNOWN";
}
