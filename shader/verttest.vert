attribute vec2 position;

// out vec2 uv;
varying vec2 uv;

void main() {
  uv = (position.xy + 1.0) * 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}