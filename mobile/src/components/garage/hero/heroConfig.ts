// What a main tab may tell its hero: content only. Layout, sizes, the car chip, bell and map button all belong to HeroLayout.
import type { HeroTab } from "../MoClip";
import type { GIconName } from "../text";

/** The one 52 px pill at the bottom of the text column. "toggle": on = filled accent with a check, off = outlined. */
export type HeroAction =
  | { kind: "button"; label: string; icon: GIconName; onPress: () => void; busy?: boolean }
  | { kind: "toggle"; label: string; icon: GIconName; on: boolean; onPress: () => void; busy?: boolean };

export type HeroConfig = {
  tab: HeroTab;
  /** max 2 lines; the font shrinks to fit, never truncated */
  title: string;
  /** one real data line (1–2 lines); left out until its number is known */
  line?: string;
  /** omitted on screens whose one main action is in the page itself (provider Home) */
  action?: HeroAction;
  /** providers: replaces the customer's car chip / bell / map row with their own label (start) and round icon buttons (end) */
  top?: { label: string; actions: { icon: GIconName; label: string; onPress: () => void; badge?: number }[] };
};

/** Per-tab fixed parts: the Map button's route and the media's accessibility label. */
export const HERO_TAB: Record<HeroTab, { map: string; media: [string, string] }> = {
  home: { map: "/customer/map", media: ["Mo, the MOTEXA mechanic", "مو، ميكانيكي موتكسا"] },
  parts: { map: "/customer/parts/map", media: ["Mo at the parts shop", "مو في متجر القطع"] },
  mechanics: { map: "/customer/mechanics/map", media: ["Mechanics", "الميكانيكيون"] },
  tow: { map: "/customer/tow/map", media: ["Mo with the tow truck", "مو مع شاحنة السحب"] },
};

/** The fixed geometry shared by all four heroes. */
export const HERO = { padX: 20, topRow: 44, topGap: 10, gap: 12, mediaRadius: 24, action: 52, titleMax: 26, titleMin: 18 } as const;

/**
 * Largest title size (titleMax..titleMin, step 2) whose words wrap into ≤ 2 lines in `width`. Lets the title shrink the same way
 * on Android and web (web has no adjustsFontSizeToFit) without ever cutting it with "…".
 * ponytail: average glyph width 0.6 × size, not measured; switch to onTextLayout if a real title still wraps to 3 lines.
 */
export function titleSize(title: string, width: number): number {
  const words = title.split(/\s+/).filter(Boolean);
  for (let f: number = HERO.titleMax; f > HERO.titleMin; f -= 2) {
    const perLine = Math.max(1, Math.floor(width / (f * 0.6)));
    let lines = 1;
    let used = 0;
    for (const w of words) {
      const need = used ? used + 1 + w.length : w.length;
      if (need <= perLine) used = need;
      else {
        lines += used ? 1 : 0;
        lines += Math.ceil(w.length / perLine) - 1;
        used = w.length % perLine || perLine;
      }
    }
    if (lines <= 2) return f;
  }
  return HERO.titleMin;
}
