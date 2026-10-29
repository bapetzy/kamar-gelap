// Developer surface: a height field stepped with the 2D wave equation.
// State texel: r = height now, g = height one step ago.

#define DROPS 6

uniform sampler2D uState;
uniform vec2 uTexel;          // 1 / sim resolution
uniform float uAspect;        // tray width / height
uniform float uDamping;
uniform vec4 uDrops[DROPS];   // xy = uv, z = radius (uv of height), w = strength (0 = unused)

varying vec2 vUv;

void main() {
  vec4 s = texture2D(uState, vUv);
  float n = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r
          + texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r
          + texture2D(uState, vUv + vec2(0.0, uTexel.y)).r
          + texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;
  float next = (n * 0.5 - s.g) * uDamping;

  for (int i = 0; i < DROPS; i++) {
    vec4 d = uDrops[i];
    if (d.w == 0.0) continue;
    float dist = length((vUv - d.xy) * vec2(uAspect, 1.0));
    next += d.w * (0.5 + 0.5 * cos(3.14159 * min(dist / d.z, 1.0))) * step(dist, d.z);
  }

  gl_FragColor = vec4(next, s.r, 0.0, 1.0);
}
