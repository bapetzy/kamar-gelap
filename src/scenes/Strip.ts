import * as THREE from 'three';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type Lenis from 'lenis';
import negativeGlsl from '../gl/shaders/negative.glsl?raw';
import printFrag from '../gl/shaders/print.frag.glsl?raw';
import type { PlaneLayout, Stage } from '../gl/Stage';
import { negativeUniforms } from '../gl/shared';
import { frames } from '../data/frames';
import { DUR, EASE, lerpFactor } from '../lib/motion';

// Act III. Six prints clipped to a wire. Scroll drags the wire sideways; each print is a
// damped pendulum that leans against the motion and settles when the wire stops.

const K = 120; // spring stiffness (1/s²)
const DAMPING = 14; // (1/s) → slightly under-damped: a couple of small swings, then rest
const MAX_DEG = 8;
const GAIN = MAX_DEG / 1400; // degrees of lean per px/s of wire speed
const STIFFNESS = [1, 0.92, 1.07, 0.96, 1.1, 0.94]; // each print hangs a little differently

interface Print {
  fig: HTMLElement;
  frame: HTMLElement;
  theta: number; // degrees, CSS-clockwise
  omega: number;
  shown: number;
  k: number;
  pivot: { x: number; y: number }; // in track coords
  local: { x: number; y: number; w: number; h: number }; // frame center from pivot
  develop: { value: number };
  material?: THREE.ShaderMaterial;
}

let prints: Print[] = [];
let tween: gsap.core.Tween | null = null;
let track: HTMLElement | null = null;
let viewport: HTMLElement | null = null;
let section: HTMLElement | null = null;
let stageRef: Stage | null = null;
let trackRect = new DOMRect();
let lastX = Number.NaN;
let wireSpeed = 0;
let still = false; // reduced motion: no pin, no swing
const cleanups: Array<() => void> = [];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function gutter(): number {
  return viewport ? parseFloat(getComputedStyle(viewport).paddingLeft) : 0;
}

/** How far the track must travel so the last print ends at the right margin. */
function distance(): number {
  if (!track || !viewport) return 0;
  return Math.max(0, track.offsetWidth - (viewport.clientWidth - 2 * gutter()));
}

/** Cache pivot and frame offsets. Offsets ignore transforms, so the swing can't skew them. */
function measure(): void {
  for (const p of prints) {
    const [ox, oy] = getComputedStyle(p.fig).transformOrigin.split(' ').map(parseFloat);
    p.pivot = { x: p.fig.offsetLeft + ox, y: p.fig.offsetTop + oy };
    const w = p.frame.offsetWidth;
    const h = p.frame.offsetHeight;
    p.local = { x: p.frame.offsetLeft + w / 2 - ox, y: p.frame.offsetTop + h / 2 - oy, w, h };
  }
}

function layoutFor(p: Print) {
  return (out: PlaneLayout) => {
    const rad = (p.theta * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    out.x = trackRect.left + p.pivot.x + p.local.x * c - p.local.y * s;
    out.y = trackRect.top + p.pivot.y + p.local.x * s + p.local.y * c;
    out.w = p.local.w;
    out.h = p.local.h;
    out.rot = rad;
  };
}

// Runs on gsap.ticker before the Stage draws, so DOM captions and GL prints agree.
function step(_time: number, deltaMs: number): void {
  if (!track) return;
  trackRect = track.getBoundingClientRect();
  const dt = Math.min(deltaMs / 1000, 1 / 30);
  if (dt <= 0) return;

  if (still) return;
  const x = trackRect.left;
  const raw = Number.isNaN(lastX) ? 0 : (x - lastX) / dt;
  lastX = x;
  wireSpeed += (raw - wireSpeed) * lerpFactor(0.3, dt);
  // Wire moving left (negative) swings the bottoms right, which is a negative CSS angle.
  const target = clamp(wireSpeed * GAIN, -MAX_DEG, MAX_DEG);

  for (const p of prints) {
    const accel = -K * p.k * (p.theta - target) - DAMPING * p.omega;
    p.omega += accel * dt;
    p.theta = clamp(p.theta + p.omega * dt, -MAX_DEG, MAX_DEG);
    if (Math.abs(p.theta - p.shown) > 0.005) {
      p.shown = p.theta;
      p.fig.style.transform = `rotate(${p.theta.toFixed(3)}deg)`;
    }
  }
}

function listen(el: HTMLElement, type: string, fn: EventListener): void {
  el.addEventListener(type, fn);
  cleanups.push(() => el.removeEventListener(type, fn));
}

/** Keyboard users: tabbing to a print scrolls the pinned strip until it is centered. */
function revealOnFocus(p: Print, lenis: Lenis | null): void {
  const st = tween?.scrollTrigger;
  const d = distance();
  if (!st || !viewport || d === 0) return;
  const visible = viewport.clientWidth - 2 * gutter();
  const want = clamp(p.pivot.x - visible / 2, 0, d);
  const y = st.start + (want / d) * (st.end - st.start);
  if (lenis) lenis.scrollTo(y, { duration: DUR.mid });
  else window.scrollTo(0, y);
}

export function init(stage: Stage | null, lenis: Lenis | null, reduced: boolean): void {
  section = document.querySelector<HTMLElement>('#strip');
  track = section?.querySelector<HTMLElement>('.strip__track') ?? null;
  viewport = section?.querySelector<HTMLElement>('.strip__viewport') ?? null;
  if (!section || !track || !viewport) return;
  stageRef = stage;
  still = reduced;

  prints = [...track.querySelectorAll<HTMLElement>('.print figure')].map((fig, i) => ({
    fig,
    frame: fig.querySelector<HTMLElement>('.frame')!,
    theta: 0,
    omega: 0,
    shown: 0,
    k: STIFFNESS[i % STIFFNESS.length],
    pivot: { x: 0, y: 0 },
    local: { x: 0, y: 0, w: 0, h: 0 },
    develop: { value: 0 },
  }));
  measure();
  ScrollTrigger.addEventListener('refresh', measure); // any resize, pinned or not
  cleanups.push(() => ScrollTrigger.removeEventListener('refresh', measure));

  prints.forEach((p, i) => {
    const toward = (value: number, duration: number) => () =>
      gsap.to(p.develop, { value, duration, ease: EASE.reveal, overwrite: true });
    for (const t of ['pointerenter', 'focus']) listen(p.fig, t, toward(1, reduced ? 0 : DUR.mid));
    for (const t of ['pointerleave', 'blur']) listen(p.fig, t, toward(0, reduced ? 0 : DUR.long));
    if (!reduced) listen(p.fig, 'focus', () => revealOnFocus(p, lenis));

    if (!stage) return;
    p.material = stage.addPlane(
      p.frame,
      negativeGlsl + printFrag,
      { ...negativeUniforms(frames[i].src, i + 1), uDevelop: p.develop },
      layoutFor(p),
    );
    p.frame.classList.add('is-gl');
  });

  stage?.watch(section);
  gsap.ticker.add(step);
  if (reduced) return; // native horizontal scroll, see layers.css

  section.classList.add('is-pinned');
  tween = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: section,
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
    },
  });
}

export function destroy(): void {
  gsap.ticker.remove(step);
  tween?.scrollTrigger?.kill(true);
  tween?.kill();
  cleanups.splice(0).forEach((fn) => fn());
  for (const p of prints) {
    if (p.material) stageRef?.removePlane(p.material);
    p.frame.classList.remove('is-gl');
    p.fig.style.transform = '';
  }
  if (section) {
    stageRef?.unwatch(section);
    section.classList.remove('is-pinned');
  }
  if (track) gsap.set(track, { clearProps: 'transform' });
  prints = [];
  tween = null;
  track = viewport = section = stageRef = null;
  lastX = Number.NaN;
  wireSpeed = 0;
  still = false;
}
