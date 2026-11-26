// The bulk fits screen's selection, kept pure (tests/fit-selection.test.mjs). Either rows picked one by one (at most 500 ids), or
// "everything matching the filter" minus a few unticked rows: that one is sent as the filter itself, never as thousands of ids.
import type { FitFilter, FitSelectionBody } from "./api";

export type Selection = { all: false; ids: ReadonlySet<string> } | { all: true; exclude: ReadonlySet<string> };
export const MAX_PICKED = 500;
export const NONE: Selection = { all: false, ids: new Set() };
export const ALL_MATCHING: Selection = { all: true, exclude: new Set() };

export const isSelected = (s: Selection, id: string) => (s.all ? !s.exclude.has(id) : s.ids.has(id));
export const selectedCount = (s: Selection, total: number) => (s.all ? Math.max(0, total - s.exclude.size) : s.ids.size);

/** Tick / untick one row. Picking stops at MAX_PICKED (then "Select all matching" is the way). */
export function toggle(s: Selection, id: string): Selection {
  if (s.all) {
    const exclude = new Set(s.exclude);
    if (exclude.has(id)) exclude.delete(id); else if (exclude.size < MAX_PICKED) exclude.add(id);
    return { all: true, exclude };
  }
  const ids = new Set(s.ids);
  if (ids.has(id)) ids.delete(id); else if (ids.size < MAX_PICKED) ids.add(id);
  return { all: false, ids };
}
/** "Select all" in the header: the rows on screen (up to MAX_PICKED); again = none. */
export function toggleRows(s: Selection, rows: string[]): Selection {
  if (s.all) return NONE;
  if (rows.length && rows.every(id => s.ids.has(id))) return NONE;
  return { all: false, ids: new Set([...s.ids, ...rows].slice(0, MAX_PICKED)) };
}
export const atLimit = (s: Selection) => (s.all ? s.exclude.size : s.ids.size) >= MAX_PICKED;
/** At the limit a row's checkbox only goes the way that does not grow the list: picked mode can untick, "all matching" mode can tick
 *  an excluded row back (unticking one more would be the 501st left out, which the server refuses). */
export const rowBlocked = (s: Selection, id: string) => atLimit(s) && (s.all ? isSelected(s, id) : !isSelected(s, id));

export function selectionBody(s: Selection, filter: FitFilter): FitSelectionBody {
  return s.all ? { filter, exclude: [...s.exclude] } : { generationIds: [...s.ids] };
}

/** "about 25 min left" from the job's estimate; null while there is none yet. Minutes are rounded up (never "0 min left"). */
export function etaText(seconds: number | null, ar: boolean): string | null {
  if (seconds === null) return null;
  if (seconds < 60) return ar ? "أقل من دقيقة متبقية" : "less than a minute left";
  const min = Math.ceil(seconds / 60);
  if (min < 60) return ar ? `نحو ${min} دقيقة متبقية` : `about ${min} min left`;
  const h = Math.floor(min / 60), m = min % 60;
  return ar ? `نحو ${h} ساعة${m ? ` و${m} دقيقة` : ""} متبقية` : `about ${h} h${m ? ` ${m} min` : ""} left`;
}

/** 5000 -> "5,000" (Latin digits, as everywhere in the app; no Intl needed on Hermes). */
export const num = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
