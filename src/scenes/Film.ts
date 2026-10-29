import * as THREE from 'three';
import { gsap } from 'gsap';
import negativeGlsl from '../gl/shaders/negative.glsl?raw';
import filmVert from '../gl/shaders/film.vert.glsl?raw';
import filmFrag from '../gl/shaders/film.frag.glsl?raw';
import type { PlaneLayout, Stage } from '../gl/Stage';
import { loadTexture } from '../gl/shared';
import { frames } from '../data/frames';
import { DUR, EASE } from '../lib/motion';

// Act I, the found roll. The six negatives sit on one strip that is pulled out of the
// canister when the room opens, curls gently, and drifts away as you scroll on.
// The lamp in your hand backlights it: that is how you read a negative.

const CELL_W = 600; // atlas cell, 3:2 like a 35mm frame
const CELL_H = 400;

let el: HTMLElement | null = null;
let material: THREE.ShaderMaterial | null = null;
let atlas: THREE.CanvasTexture | null = null;
let stageRef: Stage | null = null;
const tweens: gsap.core.Animation[] = [];

/** Six frames side by side in one texture: one sampler, cover-fit like the film gate. */
async function buildAtlas(): Promise<THREE.CanvasTexture | null> {
  const textures = await Promise.all(frames.map((f) => loadTexture(f.src)));
  if (textures.every((t) => !t)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = CELL_W * frames.length;
  canvas.height = CELL_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  textures.forEach((t, i) => {
    const img = t?.image as HTMLImageElement | ImageBitmap | undefined;
    if (!img) return;
    const s = Math.max(CELL_W / img.width, CELL_H / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(i * CELL_W, 0, CELL_W, CELL_H);
    ctx.clip();
    ctx.drawImage(img, i * CELL_W + (CELL_W - w) / 2, (CELL_H - h) / 2, w, h);
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** The strip is rotated in CSS; rotation keeps the center, so measure unrotated size. */
function layout(target: HTMLElement) {
  const rot = (parseFloat(getComputedStyle(target).rotate) || 0) * (Math.PI / 180);
  return (out: PlaneLayout) => {
    const r = target.getBoundingClientRect();
    out.x = r.left + r.width / 2;
    out.y = r.top + r.height / 2;
    out.w = target.offsetWidth;
    out.h = target.offsetHeight;
    out.rot = rot;
  };
}

export function init(stage: Stage | null, reduced: boolean): void {
  el = document.querySelector<HTMLElement>('.filmstrip');
  const section = document.querySelector<HTMLElement>('#safelight');
  if (!el || !section || !stage) return; // no WebGL: the plain inverted <img>s stay
  stageRef = stage;

  const u = {
    uAtlas: { value: null as THREE.Texture | null },
    uHasAtlas: { value: 0 },
    uReveal: { value: reduced ? 1 : 0 },
    uCurl: { value: reduced ? 0 : 1 },
  };
  material = stage.addPlane(el, negativeGlsl + filmFrag, u, {
    layout: layout(el),
    vertexShader: filmVert,
    segments: [96, 1],
  });
  buildAtlas().then((t) => {
    atlas = t;
    u.uAtlas.value = t;
    u.uHasAtlas.value = t ? 1 : 0;
  });

  if (reduced) return;
  // Pulled out of the canister: revealed left to right while it slides into place.
  tweens.push(
    gsap.to(u.uReveal, { value: 1, duration: DUR.long * 1.3, ease: EASE.reveal, delay: 0.25 }),
    gsap.from(el, { x: '12vw', duration: DUR.long * 1.3, ease: EASE.reveal, delay: 0.25 }),
    // Scrolling on, the roll drifts out of frame faster than the page: depth.
    gsap.to(el, {
      xPercent: -22,
      yPercent: -40,
      ease: 'none',
      scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: 0.8 },
    }),
  );
}

export function destroy(): void {
  tweens.splice(0).forEach((t) => {
    t.scrollTrigger?.kill();
    t.kill();
  });
  if (material) stageRef?.removePlane(material);
  atlas?.dispose();
  material = atlas = stageRef = el = null;
}
