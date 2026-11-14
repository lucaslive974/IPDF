import {
  BookWebglContext,
  computeFanningPageTransform,
  computePageProgress,
  computePageShadowProjection,
  createBookViewMatrix,
  createPageGridGeometry,
  createPerspectiveMatrix,
  mountBookWebglScene,
} from '@utils/bookWebglRenderer';
import { describe, expect, it, vi } from 'vitest';

describe('bookWebglRenderer', () => {
  it('creates subdivided page grid geometry with valid vertex and index counts', () => {
    const geo = createPageGridGeometry(10, 2);

    // (10 + 1) * (2 + 1) = 33 vertices, 2 floats each
    expect(geo.vertices).toHaveLength(66);
    // 10 * 2 quads * 2 triangles * 3 indices = 120
    expect(geo.indices).toHaveLength(120);
    expect(geo.indexCount).toBe(120);
    expect(geo.vertices[0]).toBe(0);
    expect(geo.vertices[1]).toBe(-0.5);
  });

  it('builds valid 4x4 perspective and tilted book view matrices', () => {
    const proj = createPerspectiveMatrix(Math.PI / 4, 16 / 9, 0.1, 20);
    expect(proj).toHaveLength(16);
    expect(proj[11]).toBe(-1);

    const view = createBookViewMatrix(0.7, 2.3);
    expect(view).toHaveLength(16);
    expect(view[14]).toBeCloseTo(-2.3);
  });

  it('computes normalized staggered page flip progress in [0, 1)', () => {
    const p0 = computePageProgress(0, 0, 5, 2.5);
    const p1 = computePageProgress(0, 1, 5, 2.5);
    const wrapped = computePageProgress(2.5, 0, 5, 2.5);

    expect(p0).toBe(0);
    expect(p1).toBeCloseTo(0.2);
    expect(wrapped).toBeCloseTo(0);
  });

  it('computes eased angle, curvature bend, and edge fade for fanning pages', () => {
    const start = computeFanningPageTransform(0);
    const mid = computeFanningPageTransform(0.5);
    const end = computeFanningPageTransform(1);

    expect(start.angle).toBeCloseTo(0.36);
    expect(start.bend).toBeCloseTo(0);
    expect(start.opacity).toBe(0);

    expect(mid.angle).toBeCloseTo(Math.PI / 2);
    expect(mid.bend).toBeCloseTo(0.42);
    expect(mid.opacity).toBe(1);

    expect(end.angle).toBeCloseTo(Math.PI - 0.36);
    expect(end.bend).toBeCloseTo(0);
    expect(end.opacity).toBe(0);
  });

  it('computes sinusoidal shadow reach and strength from neighbor page angle', () => {
    const castLeft = computePageShadowProjection(Math.PI - 0.11, 2.2, 1);
    expect(castLeft.reach).toBeGreaterThan(0.5);
    expect(castLeft.strength).toBeGreaterThan(0);

    const noShadow = computePageShadowProjection(1.5, 0.12, 1);
    expect(noShadow).toEqual({ reach: 0, strength: 0 });
  });

  it('falls back gracefully when WebGL context is unavailable', () => {
    const fakeCanvas = {
      getContext: vi.fn().mockReturnValue(null),
    } as unknown as HTMLCanvasElement;

    const cleanup = mountBookWebglScene(fakeCanvas);
    expect(fakeCanvas.getContext).toHaveBeenCalledWith('webgl', {
      alpha: true,
      antialias: true,
    });
    expect(() => cleanup()).not.toThrow();
  });

  it('manages WebGL lifecycle, renders frames, and disposes GPU resources cleanly', () => {
    const mockGl = {
      VERTEX_SHADER: 1,
      FRAGMENT_SHADER: 2,
      COMPILE_STATUS: 3,
      LINK_STATUS: 4,
      ARRAY_BUFFER: 5,
      ELEMENT_ARRAY_BUFFER: 6,
      STATIC_DRAW: 7,
      DEPTH_TEST: 8,
      BLEND: 9,
      ONE: 1,
      SRC_ALPHA: 10,
      ONE_MINUS_SRC_ALPHA: 11,
      COLOR_BUFFER_BIT: 12,
      DEPTH_BUFFER_BIT: 13,
      FLOAT: 14,
      TRIANGLES: 15,
      UNSIGNED_SHORT: 16,
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      deleteShader: vi.fn(),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      getProgramParameter: vi.fn(() => true),
      deleteProgram: vi.fn(),
      createBuffer: vi.fn(() => ({})),
      deleteBuffer: vi.fn(),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      getAttribLocation: vi.fn(() => 0),
      getUniformLocation: vi.fn(() => ({})),
      enable: vi.fn(),
      depthMask: vi.fn(),
      blendFunc: vi.fn(),
      viewport: vi.fn(),
      clearColor: vi.fn(),
      clear: vi.fn(),
      useProgram: vi.fn(),
      enableVertexAttribArray: vi.fn(),
      vertexAttribPointer: vi.fn(),
      uniformMatrix4fv: vi.fn(),
      uniform1f: vi.fn(),
      uniform1fv: vi.fn(),
      uniform3f: vi.fn(),
      drawElements: vi.fn(),
    } as unknown as WebGLRenderingContext;

    const fakeCanvas = {
      clientWidth: 160,
      clientHeight: 160,
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockGl),
    } as unknown as HTMLCanvasElement;

    const originalWindow = globalThis.window;
    globalThis.window = {
      devicePixelRatio: 1,
      requestAnimationFrame: vi.fn(() => 42),
      cancelAnimationFrame: vi.fn(),
    } as unknown as Window & typeof globalThis;

    try {
      const ctx = BookWebglContext.create(fakeCanvas);
      expect(ctx).not.toBeNull();
      if (!ctx) return;

      ctx.start();
      ctx.renderFrame(performance.now() + 100);
      // 4 static cover layers + 2 base pages + 5 fanning pages = 11 drawElements calls
      expect(mockGl.drawElements).toHaveBeenCalledTimes(11);

      ctx.dispose();
      // Idempotent second dispose
      ctx.dispose();
      expect(mockGl.deleteBuffer).toHaveBeenCalledTimes(2);
      expect(mockGl.deleteProgram).toHaveBeenCalledTimes(2);

      const lightCtx = BookWebglContext.create(fakeCanvas, 'light');
      expect(lightCtx).not.toBeNull();
      if (!lightCtx) return;
      lightCtx.renderFrame(performance.now() + 100);
      expect(mockGl.uniform3f).toHaveBeenCalledWith(expect.anything(), 0.85, 0.49, 0.04);
      lightCtx.dispose();
    } finally {
      globalThis.window = originalWindow;
    }
  });
});
