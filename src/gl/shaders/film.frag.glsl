// The found roll: six B&W negatives on a strip, backlit by the hand-held safelight.
// Dense silver (bright scenes) blocks light, clear base and sprocket holes let it through,
// so moving the lamp along the strip is how you read it.

uniform sampler2D uAtlas;  // 6 frames side by side, 3:2 cells
uniform float uHasAtlas;
uniform float uReveal;     // 0..1: how much strip has been pulled out of the canister

varying vec2 vUv;
varying float vSlope;

const float LEN = 230.0;   // mm
const float H = 35.0;
const float PITCH = 38.0;
const float LEAD = 2.0;

float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  if (vUv.x > uReveal) discard;
  vec2 mm = vec2(vUv.x * LEN, (1.0 - vUv.y) * H);

  // Sprocket holes, both edges.
  float hx = mod(mm.x, 4.75) - 2.375;
  float holes = min(roundBox(vec2(hx, mm.y - 2.6), vec2(0.95, 1.0), 0.35),
                    roundBox(vec2(hx, mm.y - 32.4), vec2(0.95, 1.0), 0.35));
  float hole = 1.0 - smoothstep(-0.06, 0.06, holes);

  // Frame cell.
  float x = mm.x - LEAD;
  float cell = floor(x / PITCH);
  vec2 f = vec2(x - cell * PITCH - 1.0, mm.y - 5.5); // 36 x 24 mm image area
  float inFrame = step(0.0, f.x) * step(f.x, 36.0) * step(0.0, f.y) * step(f.y, 24.0)
                * step(0.0, cell) * step(cell, 5.0);

  float trans = 0.5; // bare film base
  if (inFrame > 0.5) {
    vec2 c = vec2(f.x / 36.0, 1.0 - f.y / 24.0);
    float lum = uHasAtlas > 0.5
      ? dot(texture2D(uAtlas, vec2((cell + c.x) / 6.0, c.y)).rgb, vec3(0.2126, 0.7152, 0.0722))
      : placeholder(c, cell + 1.0);
    trans = mix(0.92, 0.05, lum); // negative: bright scene = dense silver
  }
  trans = mix(trans, 1.0, hole);

  float light = 0.035 + 1.5 * lampLight(gl_FragCoord.xy, 300.0);
  light *= 1.0 + vSlope * 0.6; // curl tilts the film toward or away from the lamp
  float t = clamp(trans * light, 0.0, 1.0);

  vec3 dark = mix(uBg, uSafelight, smoothstep(0.0, 0.7, t));
  dark = mix(dark, uText, smoothstep(0.7, 1.0, t));
  vec3 day = mix(uText, uBg, trans); // held up to the daylight
  vec3 col = mix(dark, day, uDay) + grain(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
