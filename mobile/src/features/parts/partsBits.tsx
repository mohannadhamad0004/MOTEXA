import { Badge, useL } from "../shared/ui";
import { Product, stockState } from "./partsService";

/** One-line fitment summary for a product ("Toyota Corolla 2014–2019 +1"). */
export const fitmentSummary = (p: Product, t: (en: string, ar: string) => string) => {
  if (!p.fitments.length) return t("No fitment listed", "لا يوجد توافق محدد");
  const f = p.fitments[0];
  const first = `${f.make} ${f.model} ${f.yearFrom}–${f.yearTo}`;
  return p.fitments.length > 1 ? `${first} +${p.fitments.length - 1}` : first;
};

export function StockBadge({ stock }: { stock: number }) {
  const { t } = useL();
  const s = stockState(stock);
  if (s === "OUT") return <Badge tone="danger" icon="close-circle-outline" label={t("Out of stock", "نفد المخزون")} />;
  if (s === "LOW") return <Badge tone="accent" icon="alert-circle-outline" label={t("Low stock", "مخزون منخفض")} />;
  return <Badge tone="success" icon="checkmark-circle-outline" label={t("In stock", "متوفر")} />;
}
