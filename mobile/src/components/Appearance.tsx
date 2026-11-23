import { useLocalPreference } from "./useLocalPreference";
import React, { createContext, useContext, useMemo } from "react";
import {
  StyleSheet,
  useColorScheme,
  ViewStyle,
  TextStyle,
  ImageStyle,
  StatusBar,
} from "react-native";
type Mode = "light" | "dark" | "system";
const validMode = (value:string):value is Mode => ["light","dark","system"].includes(value);
const Context = createContext<{
  mode: Mode;
  dark: boolean;
  setMode: (mode: Mode) => void;
}>({ mode: "light", dark: false, setMode: () => {} });
export function AppearanceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const [mode, setMode] = useLocalPreference<Mode>("motexa_appearance", "light", validMode);
  const dark = mode === "system" ? system === "dark" : mode === "dark";
  return (
    <Context.Provider value={{ mode, dark, setMode }}>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      {children}
    </Context.Provider>
  );
}
export const useAppearance = () => useContext(Context);
export function useAppearanceStyles<
  T extends Record<string, ViewStyle | TextStyle | ImageStyle>,
>(base: T): T {
  const { dark } = useAppearance();
  return useMemo(() => {
    if (!dark) return base;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(base)) {
      const style = { ...StyleSheet.flatten(value) } as Record<string, unknown>;
      for (const prop of [
        "backgroundColor",
        "color",
        "borderColor",
        "borderTopColor",
        "borderBottomColor",
      ]) {
        const color = style[prop];
        if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color))
          continue;
        const r = parseInt(color.slice(1, 3), 16),
          g = parseInt(color.slice(3, 5), 16),
          b = parseInt(color.slice(5, 7), 16);
        const light = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255;
        if (prop === "color") {
          if (/submitText|primaryButtonText|continueText|buttonText/i.test(key))
            continue;
          if (light < 0.76 && !(r > g * 1.5 && r > b * 1.5))
            style[prop] = "#F4E8D8";
        } else if (prop === "backgroundColor") {
          if (/submitArrow/.test(key)) continue;
          if (light > 0.45) style[prop] = light > 0.85 ? "#352A23" : "#493629";
        } else {
          style[prop] = "#79604A";
        }
      }
      result[key] = style;
    }
    return result as T;
  }, [base, dark]);
}

/** Isolated design-preview appearance: does not overwrite the user's saved preference. */
export function PreviewAppearanceProvider({children}:{children:React.ReactNode}){const [mode,setMode]=React.useState<Mode>('dark'),system=useColorScheme(),dark=mode==='system'?system==='dark':mode==='dark';return <Context.Provider value={{mode,dark,setMode}}>{children}</Context.Provider>;}

/** Owner experience defaults to the reference's dark presentation; choices persist independently. */
export function OwnerAppearanceProvider({children}:{children:React.ReactNode}) {
 const system=useColorScheme();
 const [mode,setMode]=useLocalPreference<Mode>('motexa_owner_appearance','dark',validMode);
 const dark=mode==='system'?system==='dark':mode==='dark';
 return <Context.Provider value={{mode,dark,setMode}}><StatusBar barStyle={dark?'light-content':'dark-content'}/>{children}</Context.Provider>;
}
