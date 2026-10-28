// One negative on a plane: the real photo (cover-fit) or a procedural stand-in.

uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uTexSize;
uniform vec2 uPlaneSize; // CSS px
uniform float uSeed;

vec2 coverUv(vec2 uv, vec2 plane, vec2 tex) {
  float pr = plane.x / plane.y;
  float tr = tex.x / tex.y;
  vec2 s = pr > tr ? vec2(1.0, tr / pr) : vec2(pr / tr, 1.0);
  return (uv - 0.5) * s + 0.5;
}

// Stand-in when /frames/0X.webp is missing: sky, a ridge, a low sun. Seed varies the scene.
float placeholder(vec2 uv, float seed) {
  vec2 o = vec2(seed * 3.7, seed * 1.9);
  float sky = 0.62 + 0.3 * uv.y + 0.12 * (fbm(uv * vec2(2.0, 5.0) + o + 3.0) - 0.5);
  float ridge = 0.3 + 0.08 * fract(seed * 0.37) + 0.07 * sin(uv.x * (4.0 + seed) + seed) + 0.06 * fbm(uv * 6.0 + o);
  float hill = 1.0 - smoothstep(ridge - 0.004, ridge + 0.004, uv.y);
  float ground = 0.08 + 0.3 * fbm(uv * vec2(9.0, 14.0) + o) * (0.4 + uv.y);
  vec2 sunPos = vec2(0.25 + 0.5 * fract(seed * 0.61), 0.58 + 0.15 * fract(seed * 0.29));
  float sun = 1.0 - smoothstep(0.06, 0.075, length((uv - sunPos) * vec2(1.0, 1.25)));
  return clamp(max(mix(sky, ground, hill), sun), 0.0, 1.0);
}

float negativeLum(vec2 uv) {
  if (uHasTex < 0.5) return placeholder(uv, uSeed);
  vec3 c = texture2D(uTex, coverUv(uv, uPlaneSize, uTexSize)).rgb;
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}
