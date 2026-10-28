import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { Stage } from '../gl/Stage';
import { setMode, type Mode } from '../lib/mode';
import { DUR, EASE } from '../lib/motion';

// Act IV. A pull cord for the room light. Drag it down past 60px (or click / press it)
// and the fluorescent tube stutters on: three irregular flashes, then daylight.
// Scrolling into the archive without pulling switches the light on anyway.

const THRESHOLD = 60; // px of pull that closes the switch
const MAX_PULL = 110;
const RESIST = 0.35; // cord stretches harder past the switch point
const STARTER_DELAY = 0.08; // switch click → first flash (s)
// Starter stutter, seconds after the switch closes. Last entry stays lit.
const FLICKER: Array<[number, Mode]> = [
  [0, 'day'],
  [0.07, 'dark'],
  [0.21, 'day'],
  [0.27, 'dark'],
  [0.54, 'day'],
];

let lit = false;
let instant = false; // reduced motion: no flicker, no tug
let cord: HTMLButtonElement | null = null;
let section: HTMLElement | null = null;
let stageRef: Stage | null = null;
let auto: ScrollTrigger | null = null;
let flicker: gsap.core.Timeline | null = null;
const cleanups: Array<() => void> = [];

function lightsOn(): void {
  if (lit) return;
  lit = true;
  cord?.setAttribute('aria-label', 'Lampu sudah menyala');
  cord?.setAttribute('data-lit', '');
  if (instant) return setMode('day');
  flicker = gsap.timeline({ delay: STARTER_DELAY });
  FLICKER.forEach(([t, mode]) => flicker!.call(setMode, [mode], t));
}

function on<K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void) {
  el.addEventListener(type, fn);
  cleanups.push(() => el.removeEventListener(type, fn));
}

export function init(stage: Stage | null, reduced: boolean): void {
  instant = reduced;
  section = document.querySelector<HTMLElement>('#lights');
  cord = section?.querySelector<HTMLButtonElement>('[data-cord]') ?? null;
  const line = cord?.querySelector<HTMLElement>('.cord__line');
  const grip = cord ? [...cord.querySelectorAll<HTMLElement>('.cord__pull, .cord__text')] : [];
  if (!section || !cord || !line) return;

  stageRef = stage;
  stage?.watch(section);

  const pull = { y: 0 };
  const apply = () => {
    grip.forEach((el) => (el.style.transform = `translateY(${pull.y}px)`));
    line.style.transform = `scaleY(${1 + pull.y / line.offsetHeight})`;
  };
  const release = (closeSwitch: boolean) => {
    gsap.to(pull, { y: 0, duration: DUR.short, ease: 'power3.out', onUpdate: apply, overwrite: true });
    if (closeSwitch) lightsOn();
  };

  let startY = 0;
  let raw = 0;
  let dragging = false;
  let dragged = false;

  on(cord, 'pointerdown', (e) => {
    if (lit) return;
    dragging = true;
    dragged = false;
    startY = e.clientY;
    raw = 0;
    cord!.setPointerCapture(e.pointerId);
    gsap.killTweensOf(pull);
  });
  on(cord, 'pointermove', (e) => {
    if (!dragging) return;
    raw = Math.max(0, e.clientY - startY);
    if (raw > 4) dragged = true;
    const stretched = raw <= THRESHOLD ? raw : THRESHOLD + (raw - THRESHOLD) * RESIST;
    pull.y = Math.min(stretched, MAX_PULL);
    apply();
  });
  const endDrag = () => {
    if (!dragging) return;
    dragging = false;
    if (dragged) release(raw > THRESHOLD);
  };
  on(cord, 'pointerup', endDrag);
  on(cord, 'pointercancel', endDrag);

  // Click, Enter or Space: the hand gives the cord one tug.
  on(cord, 'click', () => {
    if (dragged) {
      dragged = false;
      return;
    }
    if (lit) return;
    if (instant) return lightsOn();
    gsap.to(pull, {
      y: THRESHOLD + 10,
      duration: DUR.short,
      ease: EASE.move,
      onUpdate: apply,
      onComplete: () => release(true),
      overwrite: true,
    });
  });

  auto = ScrollTrigger.create({ trigger: '#archive', start: 'top 70%', onEnter: lightsOn });
}

export function destroy(): void {
  cleanups.splice(0).forEach((fn) => fn());
  auto?.kill();
  flicker?.kill();
  if (section) stageRef?.unwatch(section);
  auto = flicker = null;
  cord = section = stageRef = null;
  lit = false;
  instant = false;
}
