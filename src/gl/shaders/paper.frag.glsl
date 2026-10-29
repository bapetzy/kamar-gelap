// Photo paper in the developer tray.
// Development: each pixel darkens from paper-white toward its final tone. Dark tones
// cross their threshold first, highlights last; low-frequency noise makes the developer
// reach some areas sooner. The liquid on top (GPU wave sim) bends the image and catches
// the hand-held safelight on its crests.

uniform float uProgress;     // 0..1 development time
uniform sampler2D uWaves;    // r = surface height
uniform vec2 uWaveTexel;
uniform float uHasWaves;

varying vec2 vUv;

// xy = surface slope, z = height
vec3 surface(vec2 uv) {
  if (uHasWaves < 0.5) return vec3(0.0);
  float l = texture2D(uWaves, uv - vec2(uWaveTexel.x, 0.0)).r;
  float r = texture2D(uWaves, uv + vec2(uWaveTexel.x, 0.0)).r;
  float d = texture2D(uWaves, uv - vec2(0.0, uWaveTexel.y)).r;
  float u = texture2D(uWaves, uv + vec2(0.0, uWaveTexel.y)).r;
  return vec3(r - l, u - d, texture2D(uWaves, uv).r);
}

void main() {
  vec3 s = surface(vUv);
  vec2 uv = clamp(vUv + s.xy * 0.06, 0.0, 1.0); // refraction through the developer
  float lum = negativeLum(uv);

  float unevenness = fbm(uv * 2.5 + 7.0) - 0.5;
  float threshold = lum * 0.82 + unevenness * 0.22;
  float t = uProgress * 1.2 - 0.08;
  float developed = smoothstep(threshold - 0.14, threshold + 0.04, t);
  float tone = mix(1.0, lum, developed);

  // Lamp-lit paper: a little brighter under the hand, never brighter than paper-white.
  float lamp = lampLight(gl_FragCoord.xy, 700.0);
  tone *= mix(0.86, 1.0, lamp);

  // Crests facing the lamp catch light; troughs fall into shadow.
  vec2 toLamp = normalize(uLamp - gl_FragCoord.xy + 1e-4);
  float facing = dot(s.xy * 18.0, toLamp);
  float glint = pow(clamp(facing, 0.0, 1.0), 2.0) * (0.35 + 0.65 * lamp);
  tone = clamp(tone + glint * 0.5 - clamp(-facing, 0.0, 1.0) * 0.08, 0.0, 1.0);

  vec3 col = toneColor(tone) + grain(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
