import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import negativeGlsl from '../gl/shaders/negative.glsl?raw';
import paperFrag from '../gl/shaders/paper.frag.glsl?raw';
import type { Stage } from '../gl/Stage';
import { Ripple } from '../gl/Ripple';
import { negativeUniforms } from '../gl/shared';
import { frames, pad2 } from '../data/frames';
import { isTouch, lerpFactor } from '../lib/motion';

// Act II. Scroll is development time: the pin holds the tray while 00:00 → 01:30 runs.
// Time has inertia (the image keeps developing a moment after you stop). The liquid is a
// GPU wave sim: the pointer stirs it, and scrolling rocks the tray, sending waves in
// from the edge, like agitating by hand.

const DEV_SECONDS = 90;
const PIN_LENGTH = '+=150%'; // pinned scroll; section spans ~250vh in total
const TIME_LERP = 0.07; // development catches up with scroll, softly
const ROCK_GAIN = 0.9; // scroll speed → wave strength from the tray edge

let trigger: ScrollTrigger | null = null;
let material: THREE.ShaderMaterial | null = null;
let ripple: Ripple | null = null;
let paper: HTMLElement | null = null;
let section: HTMLElement | null = null;
let stageRef: Stage | null = null;
let io: IntersectionObserver | null = null;
const cleanups: Array<() => void> = [];

const formatTime = (s: number) => `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;

function mountPaper(stage: Stage, el: HTMLElement, progress: { value: number }, liquid: boolean): void {
  const f = frames[0];
  const waves = { uWaves: { value: null as THREE.Texture | null }, uWaveTexel: { value: new THREE.Vector2() }, uHasWaves: { value: 0 } };
  material = stage.addPlane(el, negativeGlsl + paperFrag, { ...negativeUniforms(f.src, 0), uProgress: progress, ...waves });
  el.classList.add('is-gl');
  if (!liquid || isTouch() || !Ripple.supported(stage.renderer)) return; // desktop only

  const sim = new Ripple(f.w / f.h);
  ripple = sim;
  material.uniforms.uWaves = sim.texture; // its value flips between ping-pong targets
  material.uniforms.uWaveTexel.value = sim.texel;
  material.uniforms.uHasWaves.value = 1;

  // Only simulate while the tray is on screen.
  let live = false;
  io = new IntersectionObserver(([e]) => (live = e.isIntersecting));
  io.observe(el);
  let lastP = progress.value;
  cleanups.push(
    stage.addPass((renderer, _t, dt) => {
      if (!live) return;
      const speed = Math.abs(progress.value - lastP) / Math.max(dt, 1e-3);
      lastP = progress.value;
      if (speed > 0.02) sim.drop(0.02, Math.random(), 0.12, Math.min(speed * ROCK_GAIN, 0.6) * 0.05);
      sim.step(renderer);
    }),
  );

  let last = { x: 0, y: 0, t: 0 };
  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const dist = Math.hypot(e.clientX - last.x, e.clientY - last.y);
    const dt = Math.max(e.timeStamp - last.t, 1);
    last = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    if (dist < 2) return;
    const strength = Math.min(0.015 + (dist / dt) * 0.02, 0.08);
    sim.drop((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, 0.035, strength);
  };
  el.addEventListener('pointermove', onMove);
  cleanups.push(() => el.removeEventListener('pointermove', onMove));
}

export function init(stage: Stage | null, reduced: boolean): void {
  section = document.querySelector<HTMLElement>('#develop');
  paper = section?.querySelector<HTMLElement>('.tray .frame') ?? null;
  const timer = section?.querySelector<HTMLElement>('[data-timer]');
  if (!section || !paper || !timer) return;

  // Reduced motion: no pin, no scrub, no liquid; the print is shown fully developed.
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

  let target = 0;
  let shown = -1;
  trigger = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: PIN_LENGTH,
    pin: true,
    onUpdate: (self) => (target = self.progress),
  });
  const ease = (_t: number, deltaMs: number) => {
    progress.value += (target - progress.value) * lerpFactor(TIME_LERP, deltaMs / 1000);
    const s = Math.round(progress.value * DEV_SECONDS);
    if (s !== shown) {
      shown = s;
      timer.textContent = formatTime(s);
    }
  };
  gsap.ticker.add(ease);
  cleanups.push(() => gsap.ticker.remove(ease));
}

export function destroy(): void {
  trigger?.kill(true);
  cleanups.splice(0).forEach((fn) => fn());
  io?.disconnect();
  ripple?.dispose();
  paper?.classList.remove('is-gl');
  if (material) stageRef?.removePlane(material);
  if (section) stageRef?.unwatch(section);
  trigger = material = ripple = paper = section = stageRef = io = null;
}
