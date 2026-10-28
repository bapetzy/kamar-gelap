// Fullscreen triangle-pair in clip space; no camera involved.
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
