import * as THREE from 'three';
import type { Mode } from '../lib/mode';

// Uniforms every material shares (by reference), their sync with the CSS tokens,
// and a texture cache so each negative is decoded once for the whole page.

export type U<T> = { value: T };

export interface Shared {
  uTime: U<number>;
  uDpr: U<number>;
  uDay: U<number>;
  uGrain: U<number>;
  uBg: U<THREE.Vector3>;
  uSafelight: U<THREE.Vector3>;
  uText: U<THREE.Vector3>;
  uLamp: U<THREE.Vector2>; // hand-held safelight, device px, y up
  uExposure: U<number>; // 1 = normal; >1 = eyes not yet adjusted to the light
}

export function createShared(grain: number): Shared {
  return {
    uTime: { value: 0 },
    uDpr: { value: 1 },
    uDay: { value: 0 },
    uGrain: { value: grain },
    uBg: { value: new THREE.Vector3() },
    uSafelight: { value: new THREE.Vector3() },
    uText: { value: new THREE.Vector3() },
    uLamp: { value: new THREE.Vector2() },
    uExposure: { value: 1 },
  };
}

function readToken(name: string): THREE.Vector3 | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!/^#[0-9a-f]{6}$/i.test(v)) return null;
  const n = parseInt(v.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Copy the live CSS tokens into the shader uniforms so DOM and GL switch together. */
export function syncShared(s: Shared, mode: Mode): void {
  for (const [u, name] of [[s.uBg, '--bg'], [s.uSafelight, '--safelight'], [s.uText, '--text']] as const) {
    const c = readToken(name);
    if (c) u.value.copy(c);
  }
  s.uDay.value = mode === 'day' ? 1 : 0;
}

const cache = new Map<string, Promise<THREE.Texture | null>>();
const loader = new THREE.TextureLoader();

/** Resolves null when the file is missing; callers fall back to the procedural negative. */
export function loadTexture(src: string): Promise<THREE.Texture | null> {
  let p = cache.get(src);
  if (!p) {
    p = loader.loadAsync(src).catch(() => null);
    cache.set(src, p);
  }
  return p;
}

export function disposeTextures(): void {
  cache.forEach((p) => p.then((t) => t?.dispose()));
  cache.clear();
}

/** Uniforms for a plane that shows one negative (texture or procedural stand-in). */
export function negativeUniforms(src: string, seed: number) {
  const u = {
    uTex: { value: null as THREE.Texture | null },
    uHasTex: { value: 0 },
    uTexSize: { value: new THREE.Vector2(1, 1) },
    uSeed: { value: seed },
  };
  loadTexture(src).then((t) => {
    if (!t) return;
    const img = t.image as { width: number; height: number };
    u.uTexSize.value.set(img.width, img.height);
    u.uTex.value = t;
    u.uHasTex.value = 1;
  });
  return u;
}
