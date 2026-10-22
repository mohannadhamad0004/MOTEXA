// Design tokens. Colors come from hexes the app already uses (Diala's login / mechanics-admin / panels and the
// earlier provider palette), so her screens and the rest look like one app. One accent: bronze-orange.

export type Colors = {
  bg: string;
  bgGradient: readonly [string, string, string];
  surface: string;
  surfaceRaised: string;
  field: string;
  border: string;
  text: string;
  textMuted: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  accentBorder: string;
  accentFill: string;
  onAccentFill: string;
  success: string;
  successSoft: string;
  successBorder: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  neutralSoft: string;
  neutralBorder: string;
  skeleton: string;
  skeletonHi: string;
  tabBar: string;
  shadow: string;
};

export const darkColors: Colors = {
  bg: "#17100C",
  bgGradient: ["#17100C", "#1C120D", "#17100C"],
  surface: "#2D1F18",
  surfaceRaised: "#352A23",
  field: "rgba(255,245,234,0.05)",
  border: "#49352A",
  text: "#FFF5EA",
  textMuted: "#B5A090",
  textDim: "#9C8A7D",
  accent: "#E0A36F",
  accentSoft: "rgba(224,163,111,0.10)",
  accentBorder: "rgba(224,163,111,0.24)",
  accentFill: "#DFAB78",
  onAccentFill: "#302116",
  success: "#8CAA84",
  successSoft: "rgba(140,170,132,0.10)",
  successBorder: "rgba(140,170,132,0.20)",
  danger: "#F0A28E",
  dangerSoft: "rgba(190,75,65,0.14)",
  dangerBorder: "rgba(240,162,142,0.28)",
  warning: "#E6BE6A",
  warningSoft: "rgba(230,190,106,0.10)",
  warningBorder: "rgba(230,190,106,0.24)",
  neutralSoft: "rgba(255,245,234,0.05)",
  neutralBorder: "rgba(255,245,234,0.12)",
  skeleton: "#3A2C23",
  skeletonHi: "#4A392E",
  tabBar: "#1C120D",
  shadow: "transparent",
};

export const lightColors: Colors = {
  bg: "#E9DECE",
  bgGradient: ["#E4D5C1", "#DDCAB1", "#E9DECE"],
  surface: "#F7EDDD",
  surfaceRaised: "#FFFDF8",
  field: "#FFFDFA",
  border: "#D5BFA1",
  text: "#30241D",
  textMuted: "#695542",
  textDim: "#735B46",
  accent: "#9A602D",
  accentSoft: "rgba(154,96,45,0.10)",
  accentBorder: "rgba(154,96,45,0.28)",
  accentFill: "#302219",
  onAccentFill: "#FFF9EF",
  success: "#4F7A4A",
  successSoft: "rgba(79,122,74,0.10)",
  successBorder: "rgba(79,122,74,0.28)",
  danger: "#A8432F",
  dangerSoft: "rgba(168,67,47,0.09)",
  dangerBorder: "rgba(168,67,47,0.28)",
  warning: "#8A6414",
  warningSoft: "rgba(138,100,20,0.10)",
  warningBorder: "rgba(138,100,20,0.28)",
  neutralSoft: "rgba(48,36,29,0.05)",
  neutralBorder: "rgba(48,36,29,0.14)",
  skeleton: "#DCCBB2",
  skeletonHi: "#EADCC6",
  tabBar: "#F3E8D6",
  shadow: "#5B3820",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, huge: 32, giant: 40, gutter: 18 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 26, pill: 999 } as const;

export const type = {
  display: { fontSize: 32, lineHeight: 40 },
  h1: { fontSize: 26, lineHeight: 34 },
  h2: { fontSize: 20, lineHeight: 28 },
  h3: { fontSize: 16, lineHeight: 24 },
  body: { fontSize: 14, lineHeight: 22 },
  small: { fontSize: 12, lineHeight: 18 },
  caption: { fontSize: 10.5, lineHeight: 14 },
} as const;

// Font weights: Manrope / Cairo are loaded in 400, 600 and 700 only (see components/MotexaVisual).
export const weight = { regular: "400", semibold: "600", bold: "700" } as const;

export const motion = { fast: 120, base: 200, slow: 350, skeleton: 900, press: 0.98 } as const;

export const elevation = (dark: boolean, shadow: string) =>
  dark
    ? ({} as const)
    : ({ shadowColor: shadow, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 } as const);
