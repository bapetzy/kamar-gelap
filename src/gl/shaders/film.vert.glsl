// Film never lies flat: a slow travelling wave runs along the strip.
uniform float uCurl; // 0 = flat (reduced motion), 1 = full curl

varying vec2 vUv;
varying float vSlope;

void main() {
  vUv = uv;
  vec3 p = position;
  float a = uv.x * 9.0 + uTime * 0.55;
  float b = uv.x * 3.1 - uTime * 0.31;
  p.y += (sin(a) * 0.6 + sin(b) * 0.4) * 0.045 * uCurl; // plane units: 1 = strip height
  vSlope = (cos(a) * 0.6 * 9.0 + cos(b) * 0.4 * 3.1) * 0.045 * uCurl;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
