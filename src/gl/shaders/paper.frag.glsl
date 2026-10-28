// Photo paper in the developer tray.
// Development: each pixel darkens from paper-white toward its final tone.
// Dark tones cross their threshold first, highlights last; low-freq noise makes the
// developer reach some areas sooner, like uneven agitation.

#define RIPPLES 8

uniform sampler2D uTex;
uniform float uHasTex;
uniform vec2 uTexSize;
uniform vec2 uPlaneSize;        // CSS px, for aspect-correct ripples and cover fit
uniform float uProgress;        // 0..1 development time
uniform vec3 uRipples[RIPPLES]; // xy = uv, z = start time (negative = unused)

varying vec2 vUv;

vec2 coverUv(vec2 uv, vec2 plane, vec2 tex) {
  float pr = plane.x / plane.y;
  float tr = tex.x / tex.y;
  vec2 s = pr > tr ? vec2(1.0, tr / pr) : vec2(pr / tr, 1.0);
  return (uv - 0.5) * s + 0.5;
}

// Stand-in negative when /frames/01.webp is missing: hills, sky, a low sun.
float placeholder(vec2 uv) {
  float sky = 0.62 + 0.3 * uv.y + 0.12 * (fbm(uv * vec2(2.0, 5.0) + 3.0) - 0.5);
  float ridge = 0.34 + 0.07 * sin(uv.x * 5.0 + 1.3) + 0.06 * fbm(uv * 6.0);
  float hill = 1.0 - smoothstep(ridge - 0.004, ridge + 0.004, uv.y);
  float ground = 0.08 + 0.3 * fbm(uv * vec2(9.0, 14.0)) * (0.4 + uv.y);
  float sun = 1.0 - smoothstep(0.06, 0.075, length((uv - vec2(0.68, 0.66)) * vec2(1.0, 1.25)));
  return clamp(max(mix(sky, ground, hill), sun), 0.0, 1.0);
}

// xy = refraction offset, z = light caught by the wave crest (developer is a liquid)
vec3 agitation(vec2 uv) {
  vec2 aspect = vec2(uPlaneSize.x / uPlaneSize.y, 1.0);
  vec3 offset = vec3(0.0);
  for (int i = 0; i < RIPPLES; i++) {
    vec3 r = uRipples[i];
    float age = uTime - r.z;
    if (r.z < 0.0 || age > 2.5) continue;
    vec2 d = (uv - r.xy) * aspect;
    float dist = length(d);
    float wave = sin(dist * 70.0 - age * 9.0) * exp(-age * 1.8) * exp(-dist * 7.0);
    offset.xy += (d / max(dist, 1e-4)) * wave * 0.006;
    offset.z += wave * 0.07;
  }
  return offset;
}

void main() {
  vec3 ag = agitation(vUv);
  vec2 uv = vUv + ag.xy;

  float lum = uHasTex > 0.5
    ? dot(texture2D(uTex, coverUv(uv, uPlaneSize, uTexSize)).rgb, vec3(0.2126, 0.7152, 0.0722))
    : placeholder(uv);

  float unevenness = fbm(uv * 2.5 + 7.0) - 0.5;
  float threshold = lum * 0.82 + unevenness * 0.22;
  float t = uProgress * 1.2 - 0.08;
  float developed = smoothstep(threshold - 0.14, threshold + 0.04, t);
  float tone = clamp(mix(1.0, lum, developed) + ag.z, 0.0, 1.0);

  // Safelight: paper-white reads as bright red, blacks sink into the room.
  vec3 dark = mix(uBg, uSafelight, smoothstep(0.0, 0.65, tone));
  dark = mix(dark, uText, smoothstep(0.65, 1.0, tone));
  // Lights on: true black-and-white print in the daylight tokens.
  vec3 day = mix(uText, uBg, tone);

  vec3 col = mix(dark, day, uDay);
  col += grain(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
