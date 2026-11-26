import { Fitment } from "./partsService";

/** One-line fitment summary for a product ("Toyota Corolla 2014–2019 +1"). */
export const fitmentSummary = (p: { fitments: Fitment[] }, t: (en: string, ar: string) => string) => {
  if (!p.fitments.length) return t("No fitment listed", "لا يوجد توافق محدد");
  const f = p.fitments[0];
  const first = `${f.make} ${f.model} ${f.yearFrom}–${f.yearTo}`;
  return p.fitments.length > 1 ? `${first} +${p.fitments.length - 1}` : first;
};
