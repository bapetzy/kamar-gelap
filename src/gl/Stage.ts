import * as THREE from 'three';
import { gsap } from 'gsap';
import common from './shaders/common.glsl?raw';
import bgVert from './shaders/background.vert.glsl?raw';
import bgFrag from './shaders/background.frag.glsl?raw';
import planeVert from './shaders/plane.vert.glsl?raw';
import { getMode, onMode, type Mode } from '../lib/mode';
import { isTouch, lerpFactor } from '../lib/motion';

/*
  One fixed canvas behind the DOM. It draws the room (safelight glow + grain) and any
  plane registered with addPlane(), each one glued to a DOM element's rect.
  Single render loop on gsap.ticker; it idles when the tab is hidden or when no
  watched WebGL section is on screen.
*/

type U<T> = { value: T };

export interface Shared {
  uTime: U<number>;
  uDpr: U<number>;
  uDay: U<number>;
  uGrain: U<number>;
  uBg: U<THREE.Vector3>;
  uSafelight: U<THREE.Vector3>;
  uText: U<THREE.Vector3>;
}

interface Plane {
  el: HTMLElement;
  mesh: THREE.Mesh;
  size: U<THREE.Vector2>;
}

const GLOW_PEAK = 0.28; // keeps --text over the brightest glow at ~4.6:1
const GLOW_LERP = 0.08;
const GRAIN = 0.09;

function readToken(name: string): THREE.Vector3 | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!/^#[0-9a-f]{6}$/i.test(v)) return null;
  const n = parseInt(v.slice(1), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export class Stage {
  readonly shared: Shared;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  private readonly quad = new THREE.PlaneGeometry(1, 1);
  private readonly bg: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  private readonly planes = new Set<Plane>();
  private readonly glow = new THREE.Vector2();
  private readonly glowTarget = new THREE.Vector2();
  private readonly inView = new Map<Element, boolean>();
  private readonly io: IntersectionObserver;
  private readonly offMode: () => void;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private active = false;

  static create(): Stage | null {
    try {
      return new Stage();
    } catch (err) {
      console.warn('[stage] WebGL unavailable, keeping static prints.', err);
      return null;
    }
  }

  private constructor() {
    const canvas = document.createElement('canvas');
    canvas.className = 'stage';
    canvas.setAttribute('aria-hidden', 'true');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    document.body.prepend(canvas);

    this.shared = {
      uTime: { value: 0 },
      uDpr: { value: 1 },
      uDay: { value: 0 },
      uGrain: { value: GRAIN },
      uBg: { value: new THREE.Vector3() },
      uSafelight: { value: new THREE.Vector3() },
      uText: { value: new THREE.Vector3() },
    };

    this.bg = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        vertexShader: bgVert,
        fragmentShader: common + bgFrag,
        uniforms: {
          ...this.shared,
          uRes: { value: new THREE.Vector2() },
          uPointer: { value: new THREE.Vector2() },
          uGlow: { value: GLOW_PEAK },
        },
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.bg.frustumCulled = false;
    this.bg.renderOrder = -1;
    this.scene.add(this.bg);

    this.applyMode(getMode());
    this.offMode = onMode((m) => this.applyMode(m));

    this.resize();
    this.glow.set(this.w * 0.62, this.h * 0.42);
    this.glowTarget.copy(this.glow);

    this.io = new IntersectionObserver((entries) => {
      entries.forEach((e) => this.inView.set(e.target, e.isIntersecting));
      this.updateActive();
    });

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.updateActive);
    gsap.ticker.add(this.tick);
  }

  /** Register a section that needs the GL loop while it is on screen. */
  watch(section: Element): void {
    this.inView.set(section, false);
    this.io.observe(section);
  }

  unwatch(section: Element): void {
    this.io.unobserve(section);
    this.inView.delete(section);
    this.updateActive();
  }

  /** Where the hand-held lamp should drift to (client px). */
  setGlowTarget(x: number, y: number): void {
    this.glowTarget.set(x, y);
  }

  /** A plane glued to `el`. Shared uniforms (time, mode colors, grain) are injected. */
  addPlane(el: HTMLElement, fragmentShader: string, uniforms: Record<string, U<unknown>>): THREE.ShaderMaterial {
    const size = { value: new THREE.Vector2(1, 1) };
    const material = new THREE.ShaderMaterial({
      vertexShader: planeVert,
      fragmentShader: common + fragmentShader,
      uniforms: { ...this.shared, ...uniforms, uPlaneSize: size },
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.quad, material);
    this.scene.add(mesh);
    this.planes.add({ el, mesh, size });
    return material;
  }

  removePlane(material: THREE.ShaderMaterial): void {
    for (const p of this.planes) {
      if (p.mesh.material !== material) continue;
      this.scene.remove(p.mesh);
      material.dispose();
      this.planes.delete(p);
    }
  }

  destroy(): void {
    gsap.ticker.remove(this.tick);
    window.removeEventListener('resize', this.resize);
    document.removeEventListener('visibilitychange', this.updateActive);
    this.io.disconnect();
    this.offMode();
    this.planes.forEach((p) => (p.mesh.material as THREE.Material).dispose());
    this.planes.clear();
    this.bg.geometry.dispose();
    this.bg.material.dispose();
    this.quad.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private applyMode(mode: Mode): void {
    const s = this.shared;
    for (const [u, name] of [[s.uBg, '--bg'], [s.uSafelight, '--safelight'], [s.uText, '--text']] as const) {
      const c = readToken(name);
      if (c) u.value.copy(c);
    }
    s.uDay.value = mode === 'day' ? 1 : 0;
  }

  private updateActive = (): void => {
    const anyInView = [...this.inView.values()].some(Boolean);
    this.active = anyInView && !document.hidden;
    this.renderer.domElement.style.visibility = this.active ? 'visible' : 'hidden';
  };

  private resize = (): void => {
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, isTouch() ? 1 : 1.5);
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.w, this.h, false);
    Object.assign(this.camera, { left: -this.w / 2, right: this.w / 2, top: this.h / 2, bottom: -this.h / 2 });
    this.camera.updateProjectionMatrix();
    this.shared.uDpr.value = this.dpr;
    (this.bg.material.uniforms.uRes.value as THREE.Vector2).set(this.w * this.dpr, this.h * this.dpr);
  };

  private syncPlanes(): void {
    for (const p of this.planes) {
      const r = p.el.getBoundingClientRect();
      const visible = r.bottom > 0 && r.top < this.h && r.width > 0;
      p.mesh.visible = visible;
      if (!visible) continue;
      p.mesh.scale.set(r.width, r.height, 1);
      p.mesh.position.set(r.left + r.width / 2 - this.w / 2, this.h / 2 - (r.top + r.height / 2), 0);
      p.size.value.set(r.width, r.height);
    }
  }

  private tick = (time: number, deltaMs: number): void => {
    if (!this.active) return;
    this.shared.uTime.value = time;
    this.glow.lerp(this.glowTarget, lerpFactor(GLOW_LERP, deltaMs / 1000));
    (this.bg.material.uniforms.uPointer.value as THREE.Vector2).set(
      this.glow.x * this.dpr,
      (this.h - this.glow.y) * this.dpr,
    );
    this.syncPlanes();
    this.renderer.render(this.scene, this.camera);
  };
}
