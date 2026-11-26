import { useL } from "../../core/hooks/useL";
import type { TowProblem, TowStatus } from "./requestsService";

/** One step of a status timeline (buildTimeline); garageBits.toSteps turns it into the Garage Timeline. */
export type TimelineItem = { key: string; label: string; at?: string; state: "done" | "now" | "next" | "failed"; tone?: "success" };

/** Local date and time, "2026-10-15 18:30". */
export function fmtDateTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function useTowStatusLabels() {
  const { t } = useL();
  // ARRIVED is a step, not a stored status (the driver reached the customer while EN_ROUTE)
  const label: Record<TowStatus | "ARRIVED", string> = {
    REQUESTED: t("Requested", "تم الطلب"),
    ACCEPTED: t("Accepted", "تم القبول"),
    DECLINED: t("Declined", "مرفوض"),
    EN_ROUTE: t("On the way", "في الطريق"),
    ARRIVED: t("Arrived", "وصل"),
    IN_PROGRESS: t("In progress", "قيد التنفيذ"),
    COMPLETED: t("Completed", "مكتمل"),
    CANCELLED: t("Cancelled", "ملغى"),
  };
  return label;
}

export function useProblemLabels() {
  const { t } = useL();
  const label: Record<TowProblem, string> = {
    WONT_START: t("Won't start", "لا تعمل"),
    ACCIDENT: t("Accident", "حادث"),
    FLAT_TIRE: t("Flat tire", "إطار مثقوب"),
    OVERHEATING: t("Overheating", "ارتفاع حرارة المحرك"),
    OUT_OF_FUEL: t("Out of fuel", "نفاد الوقود"),
    OTHER: t("Other", "أخرى"),
  };
  return label;
}

/**
 * Timeline for the status screens: every step that really happened with its real time; for an open request the
 * steps still to come follow, without a time. Declined / cancelled requests only show what happened.
 */
export function buildTimeline<S extends string>(path: S[], happened: { status: S; at: string }[], current: S, label: Record<S, string>): TimelineItem[] {
  const at = new Map(happened.map((h) => [h.status, h.at]));
  const items: TimelineItem[] = [];
  const onPath = path.includes(current);
  for (const st of path) {
    if (at.has(st)) items.push({ key: st, label: label[st], at: fmtDateTime(at.get(st)), state: st === current ? "now" : "done" });
    else if (onPath) items.push({ key: st, label: label[st], state: "next" });
  }
  // statuses outside the path (declined, cancelled) come last, as the current step
  for (const h of happened) if (!path.includes(h.status)) items.push({ key: h.status, label: label[h.status], at: fmtDateTime(h.at), state: h.status === current ? "now" : "done" });
  // end states: declined / cancelled stop the line on a danger node; completed settles every node green
  const last = items[items.length - 1];
  if (last && last.key === current && !path.includes(current)) last.state = "failed";
  else if (last && last.key === current && current === path[path.length - 1]) for (const it of items) { it.state = "done"; it.tone = "success"; }
  return items;
}

/** One sentence that says where a tow request stands. */
export function towHeadline(t: (en: string, ar: string) => string, status: TowStatus, name: string) {
  switch (status) {
    case "REQUESTED":
      return t(`Waiting for ${name} to answer`, `بانتظار رد ${name}`);
    case "ACCEPTED":
      return t(`${name} accepted your request`, `${name} قبلت طلبك`);
    case "EN_ROUTE":
      return t(`${name} is on the way`, `${name} في الطريق إليك`);
    case "IN_PROGRESS":
      return t(`${name} is working on your car`, `${name} تعمل على سيارتك`);
    case "COMPLETED":
      return t("Tow completed", "اكتمل السحب");
    case "DECLINED":
      return t(`${name} declined your request`, `${name} رفضت طلبك`);
    default:
      return t("Request cancelled", "تم إلغاء الطلب");
  }
}
