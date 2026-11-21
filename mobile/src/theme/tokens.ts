// Design tokens — "Blueprint Editorial". Warm paper (light) / espresso (dark) with a bronze accent. The hero
// panels are dark blueprint sheets in BOTH modes. The first block is the palette; the legacy names below it
// (bg, surface, text, accent…) are aliases so every existing screen follows the palette.

export type Colors = {
  // palette
  page: string;
  sheet: string;
  ink: string;
  soft: string;
  line: string;
  pill: string;
  bronze: string;
  bronzeLight: string;
  blueprint: string;
  blueprint2: string;
  cream: string;
  field: string;
  customer: string;
  btn: string;
  btnFg: string;
  danger: string;
  success: string;
  warning: string;
  // aliases used across the app
  bg: string;
  bgGradient: readonly [string, string, string];
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentFill: string;
  onAccentFill: string;
  successSoft: string;
  successBorder: string;
  dangerSoft: string;
  dangerBorder: string;
  warningSoft: string;
  warningBorder: string;
  neutralSoft: string;
  neutralBorder: string;
  skeleton: string;
  skeletonHi: string;
  tabBar: string;
  shadow: string;
};

/** "#RRGGBB" + opacity -> rgba(). */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

type Palette = Pick<
  Colors,
  | "page" | "sheet" | "ink" | "soft" | "line" | "pill" | "bronze" | "bronzeLight" | "blueprint" | "blueprint2"
  | "cream" | "field" | "customer" | "btn" | "btnFg" | "danger" | "success" | "warning"
>;

const build = (p: Palette, skeleton: [string, string], shadow: string): Colors => ({
  ...p,
  bg: p.page,
  bgGradient: [p.page, p.page, p.page],
  surface: p.field,
  surfaceRaised: p.sheet,
  border: p.line,
  text: p.ink,
  textMuted: p.soft,
  textDim: p.soft,
  accent: p.bronze,
  accentSoft: alpha(p.bronze, 0.1),
  accentBorder: alpha(p.bronze, 0.3),
  accentFill: p.btn,
  onAccentFill: p.btnFg,
  successSoft: alpha(p.success, 0.12),
  successBorder: alpha(p.success, 0.3),
  dangerSoft: alpha(p.danger, 0.1),
  dangerBorder: alpha(p.danger, 0.3),
  warningSoft: alpha(p.warning, 0.12),
  warningBorder: alpha(p.warning, 0.3),
  neutralSoft: alpha(p.ink, 0.05),
  neutralBorder: alpha(p.ink, 0.14),
  skeleton: skeleton[0],
  skeletonHi: skeleton[1],
  tabBar: p.sheet,
  shadow,
});

export const darkColors: Colors = build(
  {
    page: "#17100C", sheet: "#2D1F18", ink: "#FFF5EA", soft: "#B5A090", line: "#49352A", pill: "#3A2A20",
    bronze: "#E0A36F", bronzeLight: "#E0A36F", blueprint: "#160E0A", blueprint2: "#241710", cream: "#FBF5EC",
    field: "#33241C", customer: "#4A90E2", btn: "#E0A36F", btnFg: "#1F150F",
    danger: "#EF8A73", success: "#8CAA84", warning: "#E6BE6A",
  },
  ["#3A2A20", "#4A372A"],
  "transparent"
);

export const lightColors: Colors = build(
  {
    page: "#E9DFD2", sheet: "#FBF5EC", ink: "#2B1F18", soft: "#7A6656", line: "#C9A98A", pill: "#EFE3D3",
    bronze: "#9A602D", bronzeLight: "#E0A36F", blueprint: "#1F150F", blueprint2: "#2A1C14", cream: "#FBF5EC",
    field: "#FFFBF5", customer: "#4A90E2", btn: "#2B1F18", btnFg: "#FBF5EC",
    danger: "#B3412E", success: "#4F7A4A", warning: "#8A6414",
  },
  ["#E4D6C4", "#EFE3D3"],
  "#5B3820"
);

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32, giant: 40, gutter: 20, section: 40 } as const;
// base 18 · small cards / thumbs 16 · cards / fields 20 · tab bar 26 · sheet top 32
export const radius = { sm: 10, md: 16, lg: 20, xl: 26, base: 18, sheet: 32, pill: 999 } as const;

export const type = {
  display: { fontSize: 36, lineHeight: 38 },
  title: { fontSize: 34, lineHeight: 36 },
  h1: { fontSize: 26, lineHeight: 32 },
  h2: { fontSize: 18, lineHeight: 26 },
  h3: { fontSize: 16, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 17 },
  tag: { fontSize: 11, lineHeight: 15 },
  mono: { fontSize: 12, lineHeight: 17 },
} as const;

// Font weights: Manrope / Cairo are loaded in 400, 600 and 700 only (see components/MotexaVisual).
export const weight = { regular: "400", semibold: "600", bold: "700" } as const;

export const motion = { fast: 120, base: 200, slow: 350, skeleton: 900, press: 0.98, rise: 600, stagger: 70, draw: 2200 } as const;

export const elevation = (dark: boolean, shadow: string) =>
  dark
    ? ({} as const)
    : ({ shadowColor: shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 } as const);
