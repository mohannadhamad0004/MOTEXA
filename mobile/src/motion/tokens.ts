import { Easing } from "react-native-reanimated";

/** MOTEXA motion language. Every animation duration/distance in screens comes from here. */
export const M = {
  feedback: 120,
  chip: 190,
  entrance: 270,
  detail: 300,
  hero: 900,
  grid: 200,
  stagger: 45,
  staggerFine: 35,
  rise: 12,
  riseDetail: 9,
  press: 0.98,
  reduced: 150,
  /** closing/exit = 0.7 x opening */
  closing: 0.7,
  /** no bounce */
  spring: { damping: 20, stiffness: 180, mass: 1, overshootClamping: true },
} as const;

export const ease = Easing.bezier(0.2, 0, 0, 1);
/** duration of a closing animation for an opening of `ms` */
export const closeMs = (ms: number) => Math.round(ms * M.closing);
