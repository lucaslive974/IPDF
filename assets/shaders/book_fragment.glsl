precision mediump float;
uniform vec3 uBaseColor;
uniform vec3 uShadowColor;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec3 n = gl_FrontFacing ? normalize(vNormal) : -normalize(vNormal);
  vec3 lightDir = normalize(vec3(0.35, 0.82, 0.55));
  float diffuse = max(dot(n, lightDir), 0.0);
  float ambient = 0.52;
  float spineAo = smoothstep(0.0, 0.16, vUv.x);
  float light = clamp(ambient + diffuse * 0.55, 0.0, 1.0) * (0.76 + 0.24 * spineAo);
  vec3 color = mix(uShadowColor, uBaseColor, light);
  gl_FragColor = vec4(color * uOpacity, uOpacity);
}
