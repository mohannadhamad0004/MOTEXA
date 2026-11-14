// Bidi helpers for Arabic (right-to-left) text that contains Latin model codes, brands and numbers.
/** Each Latin run ("BMW", "C W203", "2000–2007") in a left-to-right isolate, so "مرسيدس الفئة C W203" keeps its order. */
export const isoLatin = (s: string) => s.replace(/[A-Za-z0-9][A-Za-z0-9 .\-–/]*[A-Za-z0-9]|[A-Za-z0-9]/g, (m) => `\u2066${m}\u2069`);
/** A whole Arabic line in a right-to-left isolate (an input placeholder on web is laid out left-to-right otherwise). */
export const rtl = (s: string) => `\u2067${s}\u2069`;
