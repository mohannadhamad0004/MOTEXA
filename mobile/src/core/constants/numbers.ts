/** Normalize Arabic-Indic and Persian digits without discarding malformed input. */
export function normalizeNumberText(value: string): string {
  return value.replace(/[\u0660-\u0669]/g, c => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, c => String(c.charCodeAt(0) - 0x06f0)).replace(/\u066b/g, ".");
}
export function strictNumber(value: unknown, integer = false, max = Number.MAX_SAFE_INTEGER): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = normalizeNumberText(String(value)).trim();
  if (!(integer ? /^\d+$/ : /^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/).test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= max && (!integer || Number.isSafeInteger(n)) ? n : null;
}
