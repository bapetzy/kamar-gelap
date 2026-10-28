import * as THREE from 'three';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import negativeGlsl from '../gl/shaders/negative.glsl?raw';
import paperFrag from '../gl/shaders/paper.frag.glsl?raw';
import type { Stage } from '../gl/Stage';
import { negativeUniforms } from '../gl/shared';
import { frames, pad2 } from '../data/frames';
import { isTouch } from '../lib/motion';

// Act II. Scroll is development time: the pin holds the tray while 00:00 → 01:30 runs.
// Moving the pointer over the tray agitates the developer (ripples from the last 8 points).

const DEV_SECONDS = 90;
const PIN_LENGTH = '+=150%'; // pinned scroll; section spans ~250vh in total
const RIPPLES = 8;
const RIPPLE_GAP_MS = 70;

let trigger: ScrollTrigger | null = null;
let material: THREE.ShaderMaterial | null = null;
let paper: HTMLElement | null = null;
let section: HTMLElement | null = null;
let stageRef: Stage | null = null;
let onAgitate: ((e: PointerEvent) => void) | null = null;

function formatTime(seconds: number): string {
  return `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;
}

function mountPaper(stage: Stage, el: HTMLElement, progress: { value: number }, agitate: boolean): void {
  const ripples = Array.from({ length: RIPPLES }, () => new THREE.Vector3(0, 0, -1));
  material = stage.addPlane(el, negativeGlsl + paperFrag, {
    ...negativeUniforms(frames[0].src, 0),
    uProgress: progress,
    uRipples: { value: ripples },
  });
  el.classList.add('is-gl');

  if (!agitate || isTouch()) return; // ripple: desktop only, never with reduced motion

  let next = 0;
  let last = 0;
  onAgitate = (e: PointerEvent) => {
    if (e.timeStamp - last < RIPPLE_GAP_MS) return;
    last = e.timeStamp;
    const r = el.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = 1 - (e.clientY - r.top) / r.height;
    ripples[next % RIPPLES].set(u, v, stage.shared.uTime.value);
    next++;
  };
  el.addEventListener('pointermove', onAgitate);
}

export function init(stage: Stage | null, reduced: boolean): void {
  section = document.querySelector<HTMLElement>('#develop');
  paper = section?.querySelector<HTMLElement>('.tray .frame') ?? null;
  const timer = section?.querySelector<HTMLElement>('[data-timer]');
  if (!section || !paper || !timer) return;

  // Reduced motion: no pin, no scrub; the print is shown fully developed.
  const progress = { value: reduced ? 1 : 0 };
  stageRef = stage;
  if (stage) {
    stage.watch(section);
    mountPaper(stage, paper, progress, !reduced);
  }
  if (reduced) {
    timer.textContent = formatTime(DEV_SECONDS);
    return;
  }

  let shown = -1;
  trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: PIN_LENGTH,
    pin: true,
    onUpdate(self) {
      progress.value = self.progress;
      const s = Math.round(self.progress * DEV_SECONDS);
      if (s !== shown) {
        shown = s;
        timer.textContent = formatTime(s);
      }
    },
  });
}

export function destroy(): void {
  trigger?.kill(true);
  if (paper && onAgitate) paper.removeEventListener('pointermove', onAgitate);
  paper?.classList.remove('is-gl');
  if (material) stageRef?.removePlane(material);
  if (section) stageRef?.unwatch(section);
  trigger = material = paper = section = stageRef = onAgitate = null;
}
