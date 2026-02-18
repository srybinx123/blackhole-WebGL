#version 300 es

precision highp float;



in vec2 uv;

out vec4 fragColor;

uniform vec2 resolution;
uniform sampler2D texture0;
uniform sampler2D texture1;
// uniform float adiskNoiseLOD;
// uniform float adiskSpeed;

// uniform float gamma;
// uniform float tonemappingEnabled;
// uniform float bloomStrength;

void main() {
  vec2 inputTexelSize = 1.0 / resolution * 0.5;
  vec4 o = inputTexelSize.xyxy * vec4(-1.0, -1.0, 1.0, 1.0); // Offset
  fragColor =
      0.25 * (texture(texture0, uv + o.xy) + texture(texture0, uv + o.zy) +
              texture(texture0, uv + o.xw) + texture(texture0, uv + o.zw));

  fragColor += texture(texture1, uv);
  fragColor.a = 1.0;
}