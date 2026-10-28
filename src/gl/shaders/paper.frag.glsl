// Photo paper in the developer tray.
// Development: each pixel darkens from paper-white toward its final tone.
// Dark tones cross their threshold first, highlights last; low-freq noise makes the
// developer reach some areas sooner, like uneven agitation.

#define RIPPLES 8

uniform float uProgress;        // 0..1 development time
uniform vec3 uRipples[RIPPLES]; // xy = uv, z = start time (negative = unused)

varying vec2 vUv;

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
  float lum = negativeLum(uv);

  float unevenness = fbm(uv * 2.5 + 7.0) - 0.5;
  float threshold = lum * 0.82 + unevenness * 0.22;
  float t = uProgress * 1.2 - 0.08;
  float developed = smoothstep(threshold - 0.14, threshold + 0.04, t);
  float tone = clamp(mix(1.0, lum, developed) + ag.z, 0.0, 1.0);

  vec3 col = toneColor(tone) + grain(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
