/** Existing MOTEXA values: keep the established visual identity. */
export const motion = {
  press: 120,
  release: 180,
  reveal: 380,
  selection: 220,
} as const;
export const layout = {
  pagePadding: 20,
  contentWidth: 760,
  fieldHeight: 56,
  touchTarget: 44,
  cardRadius: 24,
} as const;
export const palette = {
  canvas: ["#FFF9EF", "#FBF0E0", "#F3DFC4"] as const,
  canvasDark: ["#30231B", "#251C17", "#39281D"] as const,
  border: "#C69C6E",
  borderDark: "#9B7852",
  ink: "#432D1E",
  inkDark: "#FFF1DF",
  muted: "#62452D",
  mutedDark: "#DEC3A1",
} as const;
