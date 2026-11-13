import {
  computePageProgress,
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
});
