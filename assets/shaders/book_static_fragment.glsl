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

  vec3 viewDir = normalize(vec3(0.0, 0.35, 1.0));
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(n, halfDir), 0.0), 18.0);
  color += vec3(1.0, 0.9, 0.65) * (spec * 0.22);

  float edgeDist = min(1.0 - vUv.x, (0.5 - abs(vUv.y)) * 1.3);
  float outerBevel = 1.0 - smoothstep(0.0, 0.04, edgeDist);
  float ridgeHighlight = smoothstep(0.025, 0.045, edgeDist) * (1.0 - smoothstep(0.045, 0.08, edgeDist));
  color = mix(color, uShadowColor * 0.55, outerBevel * 0.55);
  color += vec3(0.14, 0.1, 0.03) * ridgeHighlight;

  gl_FragColor = vec4(color * uOpacity, uOpacity);
}
