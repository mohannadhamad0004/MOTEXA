import { useSyncExternalStore } from "react";
import { useReducedMotion } from "react-native-reanimated";

// Reduced motion = the phone's "Remove animations" setting (Reanimated reads it), or the dev Motion lab preview override.
let override: boolean | null = null;
const subs = new Set<() => void>();
export const setReducedOverride = (v: boolean | null) => {
  override = v;
  subs.forEach((f) => f());
};
const sub = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
const get = () => override;

/** true when movement must be replaced by simple 150ms fades / instant changes */
export function useReduced(): boolean {
  const system = useReducedMotion();
  const o = useSyncExternalStore(sub, get, get);
  return o ?? system;
}
