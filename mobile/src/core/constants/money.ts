// The platform sells in one currency, shekel (ILS). Stored prices are plain numbers; this is the only place that
// decides how they are shown.

export const CURRENCY = { code: "ILS", symbol: "₪" } as const;

const LRI = "⁦"; // left-to-right isolate
const PDI = "⁩"; // pop directional isolate
const NBSP = " ";

/** Any text with the currency symbol in front, isolated the same way (used for ranges like "50–200"). */
export const priceTag = (text: string) => `${LRI}${CURRENCY.symbol}${NBSP}${text}${PDI}`;

/** "₪ 120.00". The isolates keep the symbol attached to the number inside right-to-left (Arabic) text. */
export const formatPrice = (value: number | string) => `${LRI}${CURRENCY.symbol}${NBSP}${Number(value).toFixed(2)}${PDI}`;
