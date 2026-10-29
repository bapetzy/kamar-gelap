import * as THREE from 'three';
import vert from './shaders/ripple.vert.glsl?raw';
import frag from './shaders/ripple.frag.glsl?raw';

// The liquid in the developer tray, simulated on the GPU. Two half-float targets
// ping-pong a height field; the paper shader reads the slope to refract the print and
// catch the safelight on wave crests. Pointer and scroll drop impulses into it.

const RES = 256; // texels across the short side
const DROPS = 6;
const SUBSTEPS = 2; // waves travel 2 texels per frame: lively but stable
const DAMPING = 0.986;

export class Ripple {
  readonly texture: { value: THREE.Texture | null } = { value: null };
  readonly texel = new THREE.Vector2();
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material: THREE.ShaderMaterial;
  private readonly drops = Array.from({ length: DROPS }, () => new THREE.Vector4());
  private next = 0;

  /** Rendering to float textures needs this extension; without it the tray stays still. */
  static supported(renderer: THREE.WebGLRenderer): boolean {
    return renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  }

  constructor(aspect: number) {
    const w = Math.round(aspect >= 1 ? RES * aspect : RES);
    const h = Math.round(aspect >= 1 ? RES : RES / aspect);
    const make = () =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
    this.targets = [make(), make()];
    this.texel.set(1 / w, 1 / h);
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: {
        uState: { value: null },
        uTexel: { value: this.texel },
        uAspect: { value: aspect },
        uDamping: { value: DAMPING },
        uDrops: { value: this.drops },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
    this.texture.value = this.targets[0].texture;
  }

  /** Queue an impulse at uv (0..1). Oldest queued drop is overwritten when full. */
  drop(u: number, v: number, radius: number, strength: number): void {
    this.drops[this.next % DROPS].set(u, v, radius, strength);
    this.next++;
  }

  step = (renderer: THREE.WebGLRenderer): void => {
    for (let i = 0; i < SUBSTEPS; i++) {
      const [read, write] = this.targets;
      this.material.uniforms.uState.value = read.texture;
      renderer.setRenderTarget(write);
      renderer.render(this.scene, this.camera);
      this.targets = [write, read];
      if (i === 0) this.drops.forEach((d) => d.set(0, 0, 0, 0)); // impulses land once
    }
    renderer.setRenderTarget(null);
    this.texture.value = this.targets[0].texture;
  };

  dispose(): void {
    this.targets.forEach((t) => t.dispose());
    this.material.dispose();
    (this.scene.children[0] as THREE.Mesh).geometry.dispose();
  }
}
