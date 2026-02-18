#version 300 es

precision highp float;



out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D texture0;
uniform float adiskNoiseLOD;
uniform float adiskSpeed;

uniform float gamma;
uniform float tonemappingEnabled;
uniform float bloomStrength;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution;
  fragColor = texture(texture0, uv);
}