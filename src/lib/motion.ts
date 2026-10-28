// Motion vocabulary from the brief. Nothing else should invent eases or durations.

export const EASE = {
  reveal: 'expo.out',
  move: 'power3.inOut',
} as const;

export const DUR = {
  short: 0.4,
  mid: 0.8,
  long: 1.4,
} as const;

const mq = (q: string) => window.matchMedia(q).matches;

export const prefersReducedMotion = () => mq('(prefers-reduced-motion: reduce)');

/** Touch-first device: no hover, coarse pointer. Ripple is off here, DPR capped at 1. */
export const isTouch = () => mq('(hover: none), (pointer: coarse)');

/** Frame-rate independent lerp factor. `k` is the per-frame factor at 60fps. */
export const lerpFactor = (k: number, dtSeconds: number) => 1 - Math.pow(1 - k, dtSeconds * 60);
