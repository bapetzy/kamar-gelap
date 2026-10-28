import { gsap } from 'gsap';
import { loadTexture } from '../gl/shared';
import { frames } from '../data/frames';
import { DUR, EASE } from '../lib/motion';

// 0. The room is black; the safelight tube strikes (a few irregular flickers) while the
// negatives load. No counter. The light's final level matches the GL glow exactly,
// so when the cover lifts the room underneath looks the same.

const PEAK = 0.28; // = GLOW_PEAK in Stage.ts; the gradient in layers.css carries the falloff
const MAX_WAIT_MS = 4000; // never block on a slow or missing file
// Starter stutter: [time s, light level]. Three strikes, last one holds. Ends at 0.66s.
const STRIKES: Array<[number, number]> = [
  [0.12, PEAK],
  [0.19, 0],
  [0.34, PEAK * 0.7],
  [0.41, 0.05],
  [0.66, PEAK],
];

let el: HTMLElement | null = null;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Strike the tube and wait for fonts (+ textures when WebGL is on), capped at 4s. */
export async function run(withTextures: boolean, reduced: boolean): Promise<void> {
  el = document.querySelector<HTMLElement>('.preloader');
  const light = el?.querySelector<HTMLElement>('.preloader__light');
  if (!el || !light) return;

  const assets = Promise.all([
    document.fonts.ready,
    withTextures ? Promise.all(frames.map((f) => loadTexture(f.src))) : null,
  ]);

  const tube = gsap.timeline();
  if (reduced) tube.set(light, { opacity: PEAK });
  else STRIKES.forEach(([t, level]) => tube.set(light, { opacity: level }, t));

  // Timer fallback too: a hidden tab pauses the ticker, the page must still open.
  const struck = Promise.race([tube.then(() => undefined), wait(1400)]);
  await Promise.all([Promise.race([assets, wait(MAX_WAIT_MS)]), struck]);
}

/** Lift the cover. Resolves at once so the title can start revealing underneath. */
export function exit(reduced: boolean): void {
  if (!el) return;
  const cover = el;
  el = null;
  gsap.to(cover, {
    autoAlpha: 0,
    duration: reduced ? DUR.short : DUR.mid,
    ease: EASE.move,
    onComplete: () => cover.remove(),
  });
}
