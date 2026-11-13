export interface PageGridGeometry {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array;
  readonly indexCount: number;
}

const VERTEX_SHADER_SOURCE = `
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
`;

const FRAGMENT_SHADER_SOURCE = `
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
    gl_FragColor = vec4(color, uOpacity);
  }
`;

/**
 * Generates a subdivided 2D grid (u in [0, 1], v in [-0.5, 0.5]) for smooth 3D page bending.
 */
export function createPageGridGeometry(cols = 20, rows = 4): PageGridGeometry {
  const safeCols = Math.max(2, cols);
  const safeRows = Math.max(1, rows);
  const vertCount = (safeCols + 1) * (safeRows + 1);
  const vertices = new Float32Array(vertCount * 2);

  let ptr = 0;
  for (let r = 0; r <= safeRows; r += 1) {
    const v = r / safeRows - 0.5;
    for (let c = 0; c <= safeCols; c += 1) {
      const u = c / safeCols;
      vertices[ptr] = u;
      vertices[ptr + 1] = v;
      ptr += 2;
    }
  }

  const indices = new Uint16Array(safeCols * safeRows * 6);
  let iPtr = 0;
  const stride = safeCols + 1;
  for (let r = 0; r < safeRows; r += 1) {
    for (let c = 0; c < safeCols; c += 1) {
      const topLeft = r * stride + c;
      const topRight = topLeft + 1;
      const bottomLeft = (r + 1) * stride + c;
      const bottomRight = bottomLeft + 1;

      indices[iPtr] = topLeft;
      indices[iPtr + 1] = bottomLeft;
      indices[iPtr + 2] = topRight;
      indices[iPtr + 3] = topRight;
      indices[iPtr + 4] = bottomLeft;
      indices[iPtr + 5] = bottomRight;
      iPtr += 6;
    }
  }

  return {
    vertices,
    indices,
    indexCount: indices.length,
  };
}

/**
 * Builds a column-major 4x4 perspective projection matrix.
 */
export function createPerspectiveMatrix(
  fovRad: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1.0 / Math.tan(fovRad / 2);
  const nf = 1 / (near - far);
  const safeAspect = aspect > 0 ? aspect : 1;

  return new Float32Array([
    f / safeAspect,
    0,
    0,
    0,
    0,
    f,
    0,
    0,
    0,
    0,
    (far + near) * nf,
    -1,
    0,
    0,
    2 * far * near * nf,
    0,
  ]);
}

/**
 * Builds a column-major 4x4 view matrix tilted for an elevated 3/4 view of the open book.
 */
export function createBookViewMatrix(tiltRad: number, distance: number): Float32Array {
  const c = Math.cos(tiltRad);
  const s = Math.sin(tiltRad);

  return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, -0.14, -distance, 1]);
}

/**
 * Computes normalized [0, 1) flip progress for a staggered page at the given timestamp.
 */
export function computePageProgress(
  timeSec: number,
  pageIndex: number,
  totalPages: number,
  cycleSec = 2.6
): number {
  const safeTotal = Math.max(1, totalPages);
  const safeCycle = Math.max(0.1, cycleSec);
  const raw = (timeSec / safeCycle + pageIndex / safeTotal) % 1;
  return raw < 0 ? raw + 1 : raw;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
  if (!vertex || !fragment) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    return null;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

/**
 * Mounts a 60fps WebGL 3D curved-page book animation onto the provided canvas.
 * Returns a cleanup callback that cancels animation frames and frees GPU resources.
 */
export function mountBookWebglScene(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  if (!gl) {
    return () => {};
  }

  const program = createProgram(gl);
  if (!program) {
    return () => {};
  }

  const geometry = createPageGridGeometry(22, 4);
  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  if (!vbo || !ibo) {
    if (vbo) gl.deleteBuffer(vbo);
    if (ibo) gl.deleteBuffer(ibo);
    gl.deleteProgram(program);
    return () => {};
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

  const aUvLoc = gl.getAttribLocation(program, 'aUv');
  const uProjectionLoc = gl.getUniformLocation(program, 'uProjection');
  const uViewLoc = gl.getUniformLocation(program, 'uView');
  const uAngleLoc = gl.getUniformLocation(program, 'uAngle');
  const uBendLoc = gl.getUniformLocation(program, 'uBend');
  const uWidthLoc = gl.getUniformLocation(program, 'uWidth');
  const uHeightLoc = gl.getUniformLocation(program, 'uHeight');
  const uLiftYLoc = gl.getUniformLocation(program, 'uLiftY');
  const uBaseColorLoc = gl.getUniformLocation(program, 'uBaseColor');
  const uShadowColorLoc = gl.getUniformLocation(program, 'uShadowColor');
  const uOpacityLoc = gl.getUniformLocation(program, 'uOpacity');

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const viewMatrix = createBookViewMatrix(-0.66, 2.75);
  const startTime = performance.now();
  let rafId = 0;
  let isDisposed = false;

  const drawPlane = (
    angle: number,
    bend: number,
    width: number,
    height: number,
    liftY: number,
    baseColor: readonly [number, number, number],
    shadowColor: readonly [number, number, number],
    opacity: number
  ) => {
    gl.uniform1f(uAngleLoc, angle);
    gl.uniform1f(uBendLoc, bend);
    gl.uniform1f(uWidthLoc, width);
    gl.uniform1f(uHeightLoc, height);
    gl.uniform1f(uLiftYLoc, liftY);
    gl.uniform3f(uBaseColorLoc, baseColor[0], baseColor[1], baseColor[2]);
    gl.uniform3f(uShadowColorLoc, shadowColor[0], shadowColor[1], shadowColor[2]);
    gl.uniform1f(uOpacityLoc, opacity);
    gl.drawElements(gl.TRIANGLES, geometry.indexCount, gl.UNSIGNED_SHORT, 0);
  };

  const renderFrame = (now: number) => {
    if (isDisposed) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);

    const projectionMatrix = createPerspectiveMatrix(
      (42 * Math.PI) / 180,
      canvas.width / canvas.height,
      0.1,
      20
    );
    gl.uniformMatrix4fv(uProjectionLoc, false, projectionMatrix);
    gl.uniformMatrix4fv(uViewLoc, false, viewMatrix);

    // Antique Gold hardcover base plates (#F59E0B / #D97706)
    const goldBase: readonly [number, number, number] = [0.96, 0.62, 0.04];
    const goldShadow: readonly [number, number, number] = [0.58, 0.31, 0.02];
    drawPlane(0.06, -0.02, 0.94, 1.24, -0.03, goldBase, goldShadow, 1);
    drawPlane(Math.PI - 0.06, 0.02, 0.94, 1.24, -0.03, goldBase, goldShadow, 1);

    // Warm Parchment resting page stacks (#FAF8F5 / #C9C1B4)
    const paperBase: readonly [number, number, number] = [0.98, 0.97, 0.96];
    const paperShadow: readonly [number, number, number] = [0.76, 0.72, 0.66];
    drawPlane(0.11, -0.08, 0.86, 1.15, 0, paperBase, paperShadow, 1);
    drawPlane(Math.PI - 0.11, 0.08, 0.86, 1.15, 0, paperBase, paperShadow, 1);

    // 5 fanning curved pages continuously flipping from right to left at a calm pace
    const elapsedSec = (now - startTime) / 1000;
    const totalFanPages = 5;
    for (let i = 0; i < totalFanPages; i += 1) {
      const t = computePageProgress(elapsedSec, i, totalFanPages, 5.2);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const angle = 0.12 + eased * (Math.PI - 0.24);
      const bend = Math.sin(eased * Math.PI) * 0.42;
      const edgeFade = Math.min(1, Math.min(t / 0.12, (1 - t) / 0.12));
      drawPlane(angle, bend, 0.85, 1.14, 0.01, paperBase, paperShadow, edgeFade);
    }

    rafId = window.requestAnimationFrame(renderFrame);
  };

  rafId = window.requestAnimationFrame(renderFrame);

  return () => {
    isDisposed = true;
    window.cancelAnimationFrame(rafId);
    gl.deleteBuffer(vbo);
    gl.deleteBuffer(ibo);
    gl.deleteProgram(program);
  };
}
