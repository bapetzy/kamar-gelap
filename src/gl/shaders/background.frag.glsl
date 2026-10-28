// The room: base dark, a hand-held safelight (radial falloff) and grain over all of it.

uniform vec2 uRes;      // device px
uniform vec2 uPointer;  // device px, y up
uniform float uGlow;    // peak glow mix, keeps --text contrast >= 4.5:1

void main() {
  vec2 p = gl_FragCoord.xy;
  float r = length(p - uPointer) / (max(uRes.x, uRes.y) * 0.5);
  float falloff = exp(-r * r * 2.6);

  vec3 col = mix(uBg, uSafelight, falloff * uGlow * (1.0 - uDay));
  col += grain(p);
  gl_FragColor = vec4(col, 1.0);
}
