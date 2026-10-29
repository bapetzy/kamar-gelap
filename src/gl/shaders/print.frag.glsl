// A finished print drying on the wire. At rest it is a little flat and pale;
// hover/focus pushes density and contrast, as if it went back into the developer.
// The bend from the swing turns the paper toward or away from the lamp.

uniform float uDevelop; // 0 = rest, 1 = developed further

varying vec2 vUv;
varying float vSlope;

void main() {
  float lum = negativeLum(vUv);
  float contrast = mix(0.8, 1.3, uDevelop);
  float density = mix(0.08, -0.05, uDevelop);
  float tone = clamp((lum - 0.5) * contrast + 0.5 + density, 0.0, 1.0);
  tone *= mix(0.84, 1.0, lampLight(gl_FragCoord.xy, 800.0));
  tone = clamp(tone * (1.0 + vSlope * 2.5), 0.0, 1.0);
  vec3 col = toneColor(tone) + grain(gl_FragCoord.xy);
  gl_FragColor = vec4(col, 1.0);
}
