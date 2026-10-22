import { ReactNode } from "react";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useTheme } from "../../theme/useTheme";

const P = (d: string) => <Path d={d} />;
const ICONS = {
  home: P("M3 11 L12 4 L21 11 M5 10 V20 H19 V10"),
  parts: (
    <>
      <Circle cx="12" cy="12" r="8" />
      <Circle cx="12" cy="12" r="3" />
    </>
  ),
  mech: P("M14 6 a4 4 0 0 0 5 5 L11 19 a2 2 0 0 1 -3 -3 Z"),
  tow: (
    <>
      <Path d="M2 16 V11 H8 L10 7 H14 V16 M14 13 H22 V16" />
      <Circle cx="7" cy="17" r="2" />
      <Circle cx="18" cy="17" r="2" />
    </>
  ),
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21 C4 16 8 14 12 14 C16 14 20 16 20 21" />
    </>
  ),
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M16 16 L21 21" />
    </>
  ),
  shield: P("M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z M9 12 L11 14 L15 10"),
  check: P("M5 12 L10 17 L19 7"),
  arrow: P("M5 12 H19 M13 6 L19 12 L13 18"),
  back: P("M19 12 H5 M11 6 L5 12 L11 18"),
  chev: P("M9 6 L15 12 L9 18"),
  down: P("M6 9 L12 15 L18 9"),
  filter: P("M4 6 H20 M7 12 H17 M10 18 H14"),
  pin: (
    <>
      <Path d="M12 21 C12 21 5 14 5 9 a7 7 0 0 1 14 0 C19 14 12 21 12 21 Z" />
      <Circle cx="12" cy="9" r="2.5" />
    </>
  ),
  spark: P("M12 3 L13.5 10.5 L21 12 L13.5 13.5 L12 21 L10.5 13.5 L3 12 L10.5 10.5 Z"),
  shop: P("M4 9 L5 4 H19 L20 9 M4 9 H20 V20 H4 Z M9 20 V14 H15 V20"),
  chat: P("M4 5 H20 V16 H9 L5 20 V16 H4 Z"),
  globe: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12 H21 M12 3 C15 7 15 17 12 21 C9 17 9 7 12 3" />
    </>
  ),
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2 V4 M12 20 V22 M2 12 H4 M20 12 H22 M5 5 L6.5 6.5 M17.5 17.5 L19 19 M5 19 L6.5 17.5 M17.5 6.5 L19 5" />
    </>
  ),
  help: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M9.5 9.5 a2.5 2.5 0 1 1 3.5 2.3 C12.3 12.2 12 12.8 12 13.5 M12 17 V17.2" />
    </>
  ),
  car: (
    <>
      <Path d="M3 15 V11 L6 6 H18 L21 11 V15 Z M3 15 V18 H6 V15 M18 15 V18 H21 V15" />
      <Circle cx="7.5" cy="12" r="1" />
      <Circle cx="16.5" cy="12" r="1" />
    </>
  ),
  box: P("M4 8 L12 4 L20 8 V16 L12 20 L4 16 Z M4 8 L12 12 L20 8 M12 12 V20"),
  // additions used by the screens (same 24px line style)
  close: P("M6 6 L18 18 M18 6 L6 18"),
  plus: P("M12 5 V19 M5 12 H19"),
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7 V12 L15 14" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 3 V6 M12 18 V21 M3 12 H6 M18 12 H21 M5.6 5.6 L7.7 7.7 M16.3 16.3 L18.4 18.4 M5.6 18.4 L7.7 16.3 M16.3 7.7 L18.4 5.6" />
    </>
  ),
  alert: P("M12 4 L21 19 H3 Z M12 10 V14 M12 16.5 V16.6"),
  phone: P("M6 3 H10 L12 8 L9.5 9.5 C10.5 12 12 13.5 14.5 14.5 L16 12 L21 14 V18 C21 19.5 19.5 21 18 21 C10 20.5 3.5 14 3 6 C3 4.5 4.5 3 6 3 Z"),
  image: (
    <>
      <Path d="M4 5 H20 V19 H4 Z" />
      <Circle cx="9" cy="10" r="1.6" />
      <Path d="M4 17 L9 13 L13 16 L16 13 L20 17" />
    </>
  ),
  edit: P("M4 20 H8 L19 9 L15 5 L4 16 Z M13 7 L17 11"),
  logout: P("M10 4 H5 V20 H10 M9 12 H21 M17 8 L21 12 L17 16"),
  list: P("M8 6 H21 M8 12 H21 M8 18 H21 M3 6 H4 M3 12 H4 M3 18 H4"),
  map: P("M3 6 L9 4 L15 6 L21 4 V18 L15 20 L9 18 L3 20 Z M9 4 V18 M15 6 V20"),
  star: P("M12 3 L14.8 9 L21 9.6 L16.3 13.8 L17.7 20 L12 16.7 L6.3 20 L7.7 13.8 L3 9.6 L9.2 9 Z"),
  trash: P("M4 7 H20 M9 7 V4 H15 V7 M6 7 L7 20 H17 L18 7"),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;
const FLIPS: IconName[] = ["arrow", "back", "chev", "logout"];

/** Line icon (24px grid, 1.6 stroke). Arrows and chevrons flip in Arabic. */
export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const { c, isArabic } = useTheme();
  const flip = isArabic && FLIPS.includes(name);
  // the View keeps the svg above absolutely positioned layers on web (a bare svg is not positioned)
  return (
    <View style={{ width: size, height: size }}>
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? c.ink}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      {ICONS[name]}
    </Svg>
    </View>
  );
}
