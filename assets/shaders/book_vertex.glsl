attribute vec2 aUv;
uniform mat4 uProjection;
uniform mat4 uView;
uniform float uAngle;
uniform float uBend;
uniform float uWidth;
uniform float uHeight;
uniform float uLiftY;

varying vec2 vUv;
varying vec3 vNormal;

vec3 evalPagePos(float u, float v) {
  float r = u * uWidth;
  float wave = sin(u * 3.14159265) * uBend;
  float localAngle = uAngle - wave;
  float x = cos(localAngle) * r;
  float spineArch = sin(u * 3.14159265) * 0.08 * (1.0 - abs(cos(uAngle)));
  float z = sin(localAngle) * r + spineArch + uLiftY;
  float y = v * uHeight;
  return vec3(x, y, z);
}

void main() {
  vUv = aUv;
  float eps = 0.02;
  vec3 p = evalPagePos(aUv.x, aUv.y);
  vec3 pu = evalPagePos(min(1.0, aUv.x + eps), aUv.y);
  vec3 pv = evalPagePos(aUv.x, aUv.y + eps);
  vec3 tangentU = normalize(pu - p);
  vec3 tangentV = normalize(pv - p);
  vNormal = normalize(cross(tangentV, tangentU));
  gl_Position = uProjection * uView * vec4(p, 1.0);
}
