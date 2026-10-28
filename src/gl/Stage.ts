import * as THREE from 'three';
import { gsap } from 'gsap';
import common from './shaders/common.glsl?raw';
import bgVert from './shaders/background.vert.glsl?raw';
import bgFrag from './shaders/background.frag.glsl?raw';
import planeVert from './shaders/plane.vert.glsl?raw';
import { createShared, disposeTextures, syncShared, type Shared, type U } from './shared';
import { getMode, onMode } from '../lib/mode';
import { isTouch, lerpFactor } from '../lib/motion';

/*
  One fixed canvas behind the DOM. It draws the room (safelight glow + grain) and any
  plane registered with addPlane(), each one glued to a DOM element.
  Single render loop on gsap.ticker (added by start(), after the scenes, so scene
  updates land before the frame is drawn). It idles when the tab is hidden or when no
  watched WebGL section is on screen.
*/

/** Plane placement in client px: center, size, clockwise rotation (radians, like CSS). */
export interface PlaneLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}
export type LayoutFn = (out: PlaneLayout) => void;

interface Plane {
  el: HTMLElement;
  mesh: THREE.Mesh;
  size: U<THREE.Vector2>;
  layout?: LayoutFn;
}

const GLOW_PEAK = 0.28; // keeps --text over the brightest glow at ~4.6:1
const GLOW_LERP = 0.08;
const GRAIN = 0.09;

export class Stage {
  readonly shared: Shared = createShared(GRAIN);
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
  private readonly afterRenders = new Set<() => void>();
  private readonly box: PlaneLayout = { x: 0, y: 0, w: 0, h: 0, rot: 0 };
  private w = 0;
  private h = 0;
  private dpr = 1;
  private active = false;
  private readonly frozen: boolean; // reduced motion: grain holds still

  static create(reducedMotion = false): Stage | null {
    try {
      return new Stage(reducedMotion);
    } catch (err) {
      console.warn('[stage] WebGL unavailable, keeping static prints.', err);
      return null;
    }
  }

  private constructor(reducedMotion: boolean) {
    this.frozen = reducedMotion;
    const canvas = document.createElement('canvas');
    canvas.className = 'stage';
    canvas.setAttribute('aria-hidden', 'true');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    document.body.prepend(canvas);

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

    syncShared(this.shared, getMode());
    this.offMode = onMode((m) => syncShared(this.shared, m));

    this.resize();
    this.glow.set(this.w * 0.62, this.h * 0.42);
    this.glowTarget.copy(this.glow);

    this.io = new IntersectionObserver((entries) => {
      entries.forEach((e) => this.inView.set(e.target, e.isIntersecting));
      this.updateActive();
    });

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.updateActive);
  }

  /** Begin drawing. Call after scenes have registered their own ticker callbacks. */
  start(): void {
    gsap.ticker.add(this.tick);
  }

  /** DOM writes that must wait until this frame's layout reads are done (avoids forced reflow). */
  afterRender(fn: () => void): () => void {
    this.afterRenders.add(fn);
    return () => this.afterRenders.delete(fn);
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

  /**
   * A plane glued to `el` (its bounding rect), or placed by `layout` when the element
   * is rotated. Shared uniforms (time, mode colors, grain) are injected.
   */
  addPlane(
    el: HTMLElement,
    fragmentShader: string,
    uniforms: Record<string, U<unknown>>,
    layout?: LayoutFn,
  ): THREE.ShaderMaterial {
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
    this.planes.add({ el, mesh, size, layout });
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
    disposeTextures();
    this.renderer.dispose();
    this.renderer.domElement.remove();
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
    const b = this.box;
    for (const p of this.planes) {
      if (p.layout) {
        p.layout(b);
      } else {
        const r = p.el.getBoundingClientRect();
        Object.assign(b, { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, rot: 0 });
      }
      const reach = Math.max(b.w, b.h); // generous cull radius, covers rotation
      const visible = b.w > 0 && b.y + reach > 0 && b.y - reach < this.h && b.x + reach > 0 && b.x - reach < this.w;
      p.mesh.visible = visible;
      if (!visible) continue;
      p.mesh.scale.set(b.w, b.h, 1);
      p.mesh.position.set(b.x - this.w / 2, this.h / 2 - b.y, 0);
      p.mesh.rotation.z = -b.rot;
      p.size.value.set(b.w, b.h);
    }
  }

  private tick = (time: number, deltaMs: number): void => {
    if (!this.active) {
      this.afterRenders.forEach((fn) => fn());
      return;
    }
    this.shared.uTime.value = this.frozen ? 0 : time;
    this.glow.lerp(this.glowTarget, lerpFactor(GLOW_LERP, deltaMs / 1000));
    (this.bg.material.uniforms.uPointer.value as THREE.Vector2).set(
      this.glow.x * this.dpr,
      (this.h - this.glow.y) * this.dpr,
    );
    this.syncPlanes();
    this.renderer.render(this.scene, this.camera);
    this.afterRenders.forEach((fn) => fn());
  };
}
