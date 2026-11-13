import fragmentShaderSource from '@assets/shaders/book_fragment.glsl?raw';
import vertexShaderSource from '@assets/shaders/book_vertex.glsl?raw';
import {
  computeFanningPageTransform,
  computePageProgress,
  createBookViewMatrix,
  createPageGridGeometry,
  createPerspectiveMatrix,
} from './bookWebglGeometry';

export {
  type FanningPageTransform,
  type PageGridGeometry,
  computeFanningPageTransform,
  computePageProgress,
  createBookViewMatrix,
  createPageGridGeometry,
  createPerspectiveMatrix,
} from './bookWebglGeometry';

type RgbColor = readonly [number, number, number];

interface BookShaderUniforms {
  readonly aUv: number;
  readonly uProjection: WebGLUniformLocation | null;
  readonly uView: WebGLUniformLocation | null;
  readonly uAngle: WebGLUniformLocation | null;
  readonly uBend: WebGLUniformLocation | null;
  readonly uWidth: WebGLUniformLocation | null;
  readonly uHeight: WebGLUniformLocation | null;
  readonly uLiftY: WebGLUniformLocation | null;
  readonly uBaseColor: WebGLUniformLocation | null;
  readonly uShadowColor: WebGLUniformLocation | null;
  readonly uOpacity: WebGLUniformLocation | null;
}

interface BookGpuResources {
  readonly program: WebGLProgram;
  readonly vbo: WebGLBuffer;
  readonly ibo: WebGLBuffer;
  readonly indexCount: number;
  readonly uniforms: BookShaderUniforms;
}

interface BookSurfaceSpec {
  readonly angle: number;
  readonly bend: number;
  readonly width: number;
  readonly height: number;
  readonly liftY: number;
  readonly baseColor: RgbColor;
  readonly shadowColor: RgbColor;
  readonly opacity: number;
}

const GOLD_BASE: RgbColor = [0.96, 0.62, 0.04];
const GOLD_SHADOW: RgbColor = [0.58, 0.31, 0.02];
const PAPER_BASE: RgbColor = [0.98, 0.97, 0.96];
const PAPER_SHADOW: RgbColor = [0.76, 0.72, 0.66];

const STATIC_BOOK_SURFACES: readonly BookSurfaceSpec[] = [
  {
    angle: 0.06,
    bend: -0.02,
    width: 0.94,
    height: 1.24,
    liftY: -0.03,
    baseColor: GOLD_BASE,
    shadowColor: GOLD_SHADOW,
    opacity: 1,
  },
  {
    angle: Math.PI - 0.06,
    bend: 0.02,
    width: 0.94,
    height: 1.24,
    liftY: -0.03,
    baseColor: GOLD_BASE,
    shadowColor: GOLD_SHADOW,
    opacity: 1,
  },
  {
    angle: 0.11,
    bend: -0.08,
    width: 0.86,
    height: 1.15,
    liftY: 0,
    baseColor: PAPER_BASE,
    shadowColor: PAPER_SHADOW,
    opacity: 1,
  },
  {
    angle: Math.PI - 0.11,
    bend: 0.08,
    width: 0.86,
    height: 1.15,
    liftY: 0,
    baseColor: PAPER_BASE,
    shadowColor: PAPER_SHADOW,
    opacity: 1,
  },
];

const FAN_PAGE_COUNT = 5;
const FAN_CYCLE_SECONDS = 5.2;

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

function createShaderProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
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

function allocateGpuResources(gl: WebGLRenderingContext): BookGpuResources | null {
  const program = createShaderProgram(gl);
  if (!program) return null;

  const geometry = createPageGridGeometry(22, 4);
  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  if (!vbo || !ibo) {
    if (vbo) gl.deleteBuffer(vbo);
    if (ibo) gl.deleteBuffer(ibo);
    gl.deleteProgram(program);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

  return {
    program,
    vbo,
    ibo,
    indexCount: geometry.indexCount,
    uniforms: {
      aUv: gl.getAttribLocation(program, 'aUv'),
      uProjection: gl.getUniformLocation(program, 'uProjection'),
      uView: gl.getUniformLocation(program, 'uView'),
      uAngle: gl.getUniformLocation(program, 'uAngle'),
      uBend: gl.getUniformLocation(program, 'uBend'),
      uWidth: gl.getUniformLocation(program, 'uWidth'),
      uHeight: gl.getUniformLocation(program, 'uHeight'),
      uLiftY: gl.getUniformLocation(program, 'uLiftY'),
      uBaseColor: gl.getUniformLocation(program, 'uBaseColor'),
      uShadowColor: gl.getUniformLocation(program, 'uShadowColor'),
      uOpacity: gl.getUniformLocation(program, 'uOpacity'),
    },
  };
}

/**
 * Encapsulates the WebGL context, GPU resources, animation loop, and deterministic disposal
 * for the 3D curved-page book scene.
 */
export class BookWebglContext {
  private readonly viewMatrix = createBookViewMatrix(-0.66, 2.75);
  private readonly startTimeMs = performance.now();
  private rafId: number | null = null;
  private isDisposed = false;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly resources: BookGpuResources
  ) {
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  }

  public static create(canvas: HTMLCanvasElement): BookWebglContext | null {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return null;

    const resources = allocateGpuResources(gl);
    if (!resources) return null;

    return new BookWebglContext(canvas, gl, resources);
  }

  public start(): void {
    if (this.isDisposed || this.rafId !== null) return;
    this.rafId = window.requestAnimationFrame(this.onFrame);
  }

  public dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.gl.deleteBuffer(this.resources.vbo);
    this.gl.deleteBuffer(this.resources.ibo);
    this.gl.deleteProgram(this.resources.program);
  }

  private readonly onFrame = (nowMs: number): void => {
    if (this.isDisposed) return;
    this.renderFrame(nowMs);
    this.rafId = window.requestAnimationFrame(this.onFrame);
  };

  private syncViewport(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const displayHeight = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
      this.canvas.width = displayWidth;
      this.canvas.height = displayHeight;
    }
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  private clearBuffer(): void {
    this.syncViewport();
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  private drawSurface(spec: BookSurfaceSpec): void {
    const { uniforms } = this.resources;
    this.gl.uniform1f(uniforms.uAngle, spec.angle);
    this.gl.uniform1f(uniforms.uBend, spec.bend);
    this.gl.uniform1f(uniforms.uWidth, spec.width);
    this.gl.uniform1f(uniforms.uHeight, spec.height);
    this.gl.uniform1f(uniforms.uLiftY, spec.liftY);
    this.gl.uniform3f(uniforms.uBaseColor, spec.baseColor[0], spec.baseColor[1], spec.baseColor[2]);
    this.gl.uniform3f(
      uniforms.uShadowColor,
      spec.shadowColor[0],
      spec.shadowColor[1],
      spec.shadowColor[2]
    );
    this.gl.uniform1f(uniforms.uOpacity, spec.opacity);
    this.gl.drawElements(this.gl.TRIANGLES, this.resources.indexCount, this.gl.UNSIGNED_SHORT, 0);
  }

  public renderFrame(nowMs: number): void {
    this.clearBuffer();

    const { program, vbo, ibo, uniforms } = this.resources;
    this.gl.useProgram(program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.enableVertexAttribArray(uniforms.aUv);
    this.gl.vertexAttribPointer(uniforms.aUv, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);

    const projectionMatrix = createPerspectiveMatrix(
      (42 * Math.PI) / 180,
      this.canvas.width / this.canvas.height,
      0.1,
      20
    );
    this.gl.uniformMatrix4fv(uniforms.uProjection, false, projectionMatrix);
    this.gl.uniformMatrix4fv(uniforms.uView, false, this.viewMatrix);

    for (const surface of STATIC_BOOK_SURFACES) {
      this.drawSurface(surface);
    }

    const elapsedSec = (nowMs - this.startTimeMs) / 1000;
    for (let i = 0; i < FAN_PAGE_COUNT; i += 1) {
      const progress = computePageProgress(elapsedSec, i, FAN_PAGE_COUNT, FAN_CYCLE_SECONDS);
      const { angle, bend, opacity } = computeFanningPageTransform(progress);
      this.drawSurface({
        angle,
        bend,
        width: 0.85,
        height: 1.14,
        liftY: 0.01,
        baseColor: PAPER_BASE,
        shadowColor: PAPER_SHADOW,
        opacity,
      });
    }
  }
}

/**
 * Mounts a 60fps WebGL 3D curved-page book animation onto the provided canvas.
 * Returns a cleanup callback that cancels animation frames and frees GPU resources.
 */
export function mountBookWebglScene(canvas: HTMLCanvasElement): () => void {
  const context = BookWebglContext.create(canvas);
  if (!context) {
    return () => {};
  }
  context.start();
  return () => context.dispose();
}
