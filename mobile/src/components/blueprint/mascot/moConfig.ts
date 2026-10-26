// Tuned defaults for the Mo mascot. Dev Motion Lab -> "Mo" has steppers for every number here; copy the values you like back
// into this single object. Fractions are 0-1 of the image (x from the left, y from the top).
export const MO = {
  /** both images share one trimmed frame of 252 x 473 px */
  ratio: 252 / 473,
  /** hero heights (px) */
  size: 160,
  sizeSmall: 130,
  /** arm image height as a fraction of the body height (the arm art is drawn larger than the body, so it is scaled down) */
  armScale: 0.4,
  /** the shoulder joint inside the ARM image (centre of the dark cuff) */
  pivot: { x: 0.76, y: 0.27 },
  /** where that joint sits on the BODY image (centre of the dark shoulder cap) */
  armOffset: { x: 0.91, y: 0.45 },
  /** arm angles in degrees (positive = clockwise): start pose, top of the turn, final pose */
  restAngle: -8,
  peakAngle: 22,
  endAngle: 12,
  /** wrench head inside the ARM image, and the torque arc around it (in a 252 x 473 box) */
  head: { x: 36, y: 262, r: 70 },
  /** the check next to the wrench, as fractions of the whole mascot box */
  check: { x: 0.97, y: 0.48 },
} as const;

export type MoConfig = { [K in keyof typeof MO]: (typeof MO)[K] extends number ? number : { [P in keyof (typeof MO)[K]]: number } };
