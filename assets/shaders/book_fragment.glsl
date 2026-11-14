precision mediump float;
uniform vec3 uBaseColor;
uniform vec3 uShadowColor;
uniform float uOpacity;
uniform float uShadowReach;
uniform float uShadowStrength;

varying vec2 vUv;
varying vec3 vNormal;

float hashLine(float n) {
  return fract(sin(n * 127.1 + 31.7) * 43758.5453);
}

float evalBookTextMask(vec2 uv) {
  float xLeft = 0.16;
  float xRight = 0.86;
  float yTop = 0.37;
  float yBottom = -0.37;

  float inY = smoothstep(yBottom, yBottom + 0.02, uv.y) * (1.0 - smoothstep(yTop - 0.02, yTop, uv.y));
  if (inY <= 0.001) {
    return 0.0;
  }

  float yNorm = (yTop - uv.y) / (yTop - yBottom);
  float lineCount = 11.0;
  float lineCoord = yNorm * lineCount;
  float lineIdx = floor(lineCoord);
  float lineF = fract(lineCoord);

  // Leave a subtle paragraph break on line 5
  if (abs(lineIdx - 5.0) < 0.1) {
    return 0.0;
  }

  float stripe = smoothstep(0.24, 0.38, lineF) * (1.0 - smoothstep(0.60, 0.74, lineF));
  float isParaEnd = step(3.5, mod(lineIdx, 5.0));
  float rnd = hashLine(lineIdx);
  float lineEnd = mix(xRight - 0.07 * rnd, xLeft + 0.24 + 0.26 * rnd, isParaEnd);

  float inX = smoothstep(xLeft - 0.02, xLeft + 0.01, uv.x) * (1.0 - smoothstep(lineEnd - 0.02, lineEnd + 0.01, uv.x));
  return inY * inX * stripe;
}

void main() {
  vec3 n = gl_FrontFacing ? normalize(vNormal) : -normalize(vNormal);
  vec3 lightDir = normalize(vec3(0.35, 0.82, 0.55));
  float diffuse = max(dot(n, lightDir), 0.0);
  float ambient = 0.52;
  float spineAo = smoothstep(0.0, 0.16, vUv.x);
  float light = clamp(ambient + diffuse * 0.55, 0.0, 1.0) * (0.76 + 0.24 * spineAo);
  vec3 color = mix(uShadowColor, uBaseColor, light);

  if (uShadowStrength > 0.001 && uShadowReach > 0.001) {
    float shadowMask = uShadowStrength * (1.0 - smoothstep(max(0.0, uShadowReach - 0.28), uShadowReach + 0.08, vUv.x));
    color = mix(color, uShadowColor * 0.62, shadowMask * 0.42);
  }

  float inkMask = evalBookTextMask(vUv);
  vec3 inkColor = uShadowColor * 0.6;
  color = mix(color, inkColor, inkMask * 0.36);

  gl_FragColor = vec4(color * uOpacity, uOpacity);
}
