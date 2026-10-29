// Wet paper is not rigid: while a print swings, its lower edge lags behind the clip.
uniform float uBend;      // swing speed (deg/s, signed)
uniform vec2 uPlaneSize;  // CSS px

varying vec2 vUv;
varying float vSlope;

void main() {
  vUv = uv;
  vec3 p = position;
  float t = 1.0 - uv.y; // 0 at the clip, 1 at the bottom edge
  float k = clamp(uBend * 0.0011, -0.07, 0.07);
  p.x += k * t * t * (uPlaneSize.y / uPlaneSize.x);
  vSlope = 2.0 * k * t;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
