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
  canvasDark: ["#17100C", "#17100C", "#17100C"] as const,
  border: "#C69C6E",
  borderDark: "#9B7852",
  ink: "#432D1E",
  inkDark: "#FFF5EA",
  muted: "#62452D",
  mutedDark: "#BFA99B",
} as const;

/** Warm workspace values shared by the existing mechanic and administration screens. */
export const workspace = {
  cream:'#FFF9EF', surface:'#FFFAF1', chocolate:'#432D1E', primary:'#573822',
  bronze:'#E0A36F', border:'#E5D1B3', muted:'#80664C',
  cardRadius:26, cardPadding:20, controlHeight:48, bodySize:14, captionSize:12,
} as const;

/** Approved MOTEXA automotive palette. References refine composition, not brand colors. */
export const automotive = {
 dark:{canvas:'#17100C',surface:'#2B1C16',soft:'#38261D',ink:'#FFF5EA',muted:'#BFA99B',inactive:'#746258',bronze:'#E0A36F',border:'#513A2D'},
 light:{canvas:'#FFF9EF',surface:'#FFFAF1',soft:'#F1E1CE',ink:'#432D1E',muted:'#80664C',inactive:'#9B8878',bronze:'#986333',border:'#E3CDB4'},
 radius:{hero:34,panel:26,control:17},
 spacing:{page:20,section:28,gap:14},
} as const;
