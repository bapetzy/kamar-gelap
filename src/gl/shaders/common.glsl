// Shared helpers: hash, value noise, fbm, film grain.
// Every material includes this so grain lives inside the main shaders (no post pass).

uniform float uTime;
uniform float uDpr;
uniform float uDay;       // 0 = safelight, 1 = lights on
uniform float uGrain;     // grain strength
uniform vec3 uBg;
uniform vec3 uSafelight;
uniform vec3 uText;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// Silver grain: one sample per CSS pixel, re-rolled 24 times a second like film frames.
// Tinted by the room light so it never adds an off-palette hue.
vec3 grain(vec2 fragCoord) {
  vec2 cell = floor(fragCoord / uDpr);
  float frame = floor(uTime * 24.0);
  float g = hash12(cell + frame * vec2(37.0, 17.0)) - 0.5;
  vec3 tint = mix(uSafelight, vec3(0.55), uDay);
  return tint * g * uGrain;
}
