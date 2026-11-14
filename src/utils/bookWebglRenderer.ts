import fragmentShaderSource from '@assets/shaders/book_fragment.glsl?raw';
import staticFragmentShaderSource from '@assets/shaders/book_static_fragment.glsl?raw';
import vertexShaderSource from '@assets/shaders/book_vertex.glsl?raw';
import {
  computeFanningPageTransform,
  computePageProgress,
  computePageShadowProjection,
  createBookViewMatrix,
  createPageGridGeometry,
  createPerspectiveMatrix,
} from './bookWebglGeometry';

export {
  type FanningPageTransform,
  type PageGridGeometry,
  type PageShadowProjection,
  computeFanningPageTransform,
  computePageProgress,
  computePageShadowProjection,
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
  readonly uShadowReach: WebGLUniformLocation | null;
  readonly uShadowStrength: WebGLUniformLocation | null;
}

interface BookProgramBundle {
  readonly program: WebGLProgram;
  readonly uniforms: BookShaderUniforms;
}

interface BookGpuResources {
  readonly staticBundle: BookProgramBundle;
  readonly fanBundle: BookProgramBundle;
  readonly vbo: WebGLBuffer;
  readonly ibo: WebGLBuffer;
  readonly indexCount: number;
}

export type BookWebglTheme = 'light' | 'dark';

interface BookWebglPalette {
  readonly goldBase: RgbColor;
  readonly goldShadow: RgbColor;
  readonly paperBase: RgbColor;
  readonly paperShadow: RgbColor;
}

interface BookSurfaceSpec {
  readonly angle: number;
  readonly bend: number;
  readonly width: number;
  readonly height: number;
  readonly liftY: number;
  readonly colorKind: 'gold' | 'paper';
  readonly opacity: number;
  readonly shadowReach?: number;
  readonly shadowStrength?: number;
}

const BOOK_PALETTES: Record<BookWebglTheme, BookWebglPalette> = {
  light: {
    goldBase: [0.85, 0.49, 0.04],
    goldShadow: [0.5, 0.25, 0.02],
    paperBase: [0.99, 0.98, 0.96],
    paperShadow: [0.68, 0.63, 0.56],
  },
  dark: {
    goldBase: [0.96, 0.62, 0.04],
    goldShadow: [0.58, 0.31, 0.02],
    paperBase: [0.98, 0.97, 0.96],
    paperShadow: [0.76, 0.72, 0.66],
  },
};

const STATIC_COVER_SURFACES: readonly BookSurfaceSpec[] = [
  {
    angle: 0.295,
    bend: -0.02,
    width: 0.945,
    height: 1.245,
    liftY: -0.052,
    colorKind: 'gold',
    opacity: 1,
  },
  {
    angle: Math.PI - 0.295,
    bend: 0.02,
    width: 0.945,
    height: 1.245,
    liftY: -0.052,
    colorKind: 'gold',
    opacity: 1,
  },
  {
    angle: 0.3,
    bend: -0.02,
    width: 0.94,
    height: 1.24,
    liftY: -0.03,
    colorKind: 'gold',
    opacity: 1,
  },
  {
    angle: Math.PI - 0.3,
    bend: 0.02,
    width: 0.94,
    height: 1.24,
    liftY: -0.03,
    colorKind: 'gold',
    opacity: 1,
  },
];

const STATIC_BASE_PAGES: readonly BookSurfaceSpec[] = [
  {
    angle: 0.35,
    bend: -0.02,
    width: 0.85,
    height: 1.14,
    liftY: 0,
    colorKind: 'paper',
    opacity: 1,
    shadowReach: 0.75,
    shadowStrength: 0.25,
  },
  {
    angle: Math.PI - 0.35,
    bend: 0.02,
    width: 0.85,
    height: 1.14,
    liftY: 0,
    colorKind: 'paper',
    opacity: 1,
    shadowReach: 0.92,
    shadowStrength: 0.58,
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

function createShaderProgram(gl: WebGLRenderingContext, fragSource: string): WebGLProgram | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
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

function readUniforms(gl: WebGLRenderingContext, program: WebGLProgram): BookShaderUniforms {
  return {
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
    uShadowReach: gl.getUniformLocation(program, 'uShadowReach'),
    uShadowStrength: gl.getUniformLocation(program, 'uShadowStrength'),
  };
}

function allocateGpuResources(gl: WebGLRenderingContext): BookGpuResources | null {
  const staticProgram = createShaderProgram(gl, staticFragmentShaderSource);
  const fanProgram = createShaderProgram(gl, fragmentShaderSource);
  if (!staticProgram || !fanProgram) {
    if (staticProgram) gl.deleteProgram(staticProgram);
    if (fanProgram) gl.deleteProgram(fanProgram);
    return null;
  }

  const geometry = createPageGridGeometry(22, 4);
  const vbo = gl.createBuffer();
  const ibo = gl.createBuffer();
  if (!vbo || !ibo) {
    if (vbo) gl.deleteBuffer(vbo);
    if (ibo) gl.deleteBuffer(ibo);
    gl.deleteProgram(staticProgram);
    gl.deleteProgram(fanProgram);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, geometry.vertices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

  return {
    staticBundle: {
      program: staticProgram,
      uniforms: readUniforms(gl, staticProgram),
    },
    fanBundle: {
      program: fanProgram,
      uniforms: readUniforms(gl, fanProgram),
    },
    vbo,
    ibo,
    indexCount: geometry.indexCount,
  };
}

/**
 * Encapsulates the WebGL context, GPU resources, animation loop, and deterministic disposal
 * for the 3D curved-page book scene.
 */
export class BookWebglContext {
  private readonly viewMatrix = createBookViewMatrix(-0.66, 3.05);
  private readonly startTimeMs = performance.now();
  private readonly fanAngles = new Float32Array(FAN_PAGE_COUNT);
  private readonly fanBends = new Float32Array(FAN_PAGE_COUNT);
  private readonly fanOpacities = new Float32Array(FAN_PAGE_COUNT);
  private rafId: number | null = null;
  private isDisposed = false;
  private palette: BookWebglPalette;

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gl: WebGLRenderingContext,
    private readonly resources: BookGpuResources,
    theme: BookWebglTheme
  ) {
    this.palette = BOOK_PALETTES[theme];
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
  }

  public static create(
    canvas: HTMLCanvasElement,
    theme: BookWebglTheme = 'dark'
  ): BookWebglContext | null {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
    if (!gl) return null;

    const resources = allocateGpuResources(gl);
    if (!resources) return null;

    return new BookWebglContext(canvas, gl, resources, theme);
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
    this.gl.deleteProgram(this.resources.staticBundle.program);
    this.gl.deleteProgram(this.resources.fanBundle.program);
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

  private drawSurface(bundle: BookProgramBundle, spec: BookSurfaceSpec): void {
    const { uniforms } = bundle;
    const baseColor = spec.colorKind === 'gold' ? this.palette.goldBase : this.palette.paperBase;
    const shadowColor =
      spec.colorKind === 'gold' ? this.palette.goldShadow : this.palette.paperShadow;

    this.gl.uniform1f(uniforms.uAngle, spec.angle);
    this.gl.uniform1f(uniforms.uBend, spec.bend);
    this.gl.uniform1f(uniforms.uWidth, spec.width);
    this.gl.uniform1f(uniforms.uHeight, spec.height);
    this.gl.uniform1f(uniforms.uLiftY, spec.liftY);
    this.gl.uniform3f(uniforms.uBaseColor, baseColor[0], baseColor[1], baseColor[2]);
    this.gl.uniform3f(uniforms.uShadowColor, shadowColor[0], shadowColor[1], shadowColor[2]);
    this.gl.uniform1f(uniforms.uOpacity, spec.opacity);
    if (uniforms.uShadowReach !== null) {
      this.gl.uniform1f(uniforms.uShadowReach, spec.shadowReach ?? 0);
    }
    if (uniforms.uShadowStrength !== null) {
      this.gl.uniform1f(uniforms.uShadowStrength, spec.shadowStrength ?? 0);
    }
    this.gl.depthMask(spec.opacity >= 0.99);
    this.gl.drawElements(this.gl.TRIANGLES, this.resources.indexCount, this.gl.UNSIGNED_SHORT, 0);
  }

  private bindProgram(bundle: BookProgramBundle, projectionMatrix: Float32Array): void {
    const { program, uniforms } = bundle;
    this.gl.useProgram(program);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.resources.vbo);
    this.gl.enableVertexAttribArray(uniforms.aUv);
    this.gl.vertexAttribPointer(uniforms.aUv, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.resources.ibo);
    this.gl.uniformMatrix4fv(uniforms.uProjection, false, projectionMatrix);
    this.gl.uniformMatrix4fv(uniforms.uView, false, this.viewMatrix);
  }

  private drawStaticSurfaces(projectionMatrix: Float32Array): void {
    const { staticBundle } = this.resources;
    this.bindProgram(staticBundle, projectionMatrix);
    for (const surface of STATIC_COVER_SURFACES) {
      this.drawSurface(staticBundle, surface);
    }
  }

  private updateFanningTransforms(elapsedSec: number): void {
    for (let i = 0; i < FAN_PAGE_COUNT; i += 1) {
      const progress = computePageProgress(elapsedSec, i, FAN_PAGE_COUNT, FAN_CYCLE_SECONDS);
      const { angle, bend, opacity } = computeFanningPageTransform(progress);
      this.fanAngles[i] = angle;
      this.fanBends[i] = bend;
      this.fanOpacities[i] = opacity;
    }
  }

  private drawFanningPages(projectionMatrix: Float32Array): void {
    const { fanBundle } = this.resources;
    this.bindProgram(fanBundle, projectionMatrix);
    for (const page of STATIC_BASE_PAGES) {
      this.drawSurface(fanBundle, page);
    }
    for (let i = 0; i < FAN_PAGE_COUNT; i += 1) {
      const angle = this.fanAngles[i] ?? 0;
      const prevIdx = (i - 1 + FAN_PAGE_COUNT) % FAN_PAGE_COUNT;
      const shadow = computePageShadowProjection(
        angle,
        this.fanAngles[prevIdx] ?? 0,
        this.fanOpacities[prevIdx] ?? 0
      );

      this.drawSurface(fanBundle, {
        angle,
        bend: this.fanBends[i] ?? 0,
        width: 0.85,
        height: 1.14,
        liftY: 0.005,
        colorKind: 'paper',
        opacity: this.fanOpacities[i] ?? 0,
        shadowReach: shadow.reach,
        shadowStrength: shadow.strength,
      });
    }
  }

  public renderFrame(nowMs: number): void {
    this.gl.depthMask(true);
    this.clearBuffer();

    const projectionMatrix = createPerspectiveMatrix(
      (42 * Math.PI) / 180,
      this.canvas.width / this.canvas.height,
      0.1,
      20
    );

    this.drawStaticSurfaces(projectionMatrix);
    this.updateFanningTransforms((nowMs - this.startTimeMs) / 1000);
    this.drawFanningPages(projectionMatrix);
  }
}

/**
 * Mounts a 60fps WebGL 3D curved-page book animation onto the provided canvas.
 * Returns a cleanup callback that cancels animation frames and frees GPU resources.
 */
export function mountBookWebglScene(
  canvas: HTMLCanvasElement,
  theme: BookWebglTheme = 'dark'
): () => void {
  const context = BookWebglContext.create(canvas, theme);
  if (!context) {
    return () => {};
  }
  context.start();
  return () => context.dispose();
}
