import { clamp, easeInOutQuad } from './math';

export interface PageGridGeometry {
  readonly vertices: Float32Array;
  readonly indices: Uint16Array;
  readonly indexCount: number;
}

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

export interface FanningPageTransform {
  readonly angle: number;
  readonly bend: number;
  readonly opacity: number;
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

const MIN_PAGE_REST_ANGLE_RAD = 0.36;
const MAX_PAGE_ARCH_BEND = 0.42;
const EDGE_FADE_WINDOW = 0.12;

/**
 * Computes eased angle, parabolic curvature, and edge opacity for a fanning page at progress t in [0, 1).
 */
export function computeFanningPageTransform(progress: number): FanningPageTransform {
  const t = clamp(progress, 0, 1);
  const eased = easeInOutQuad(t);
  const angleSpan = Math.PI - MIN_PAGE_REST_ANGLE_RAD * 2;
  const angle = MIN_PAGE_REST_ANGLE_RAD + eased * angleSpan;
  const bend = Math.sin(eased * Math.PI) * MAX_PAGE_ARCH_BEND;
  const opacity = Math.min(1, Math.min(t / EDGE_FADE_WINDOW, (1 - t) / EDGE_FADE_WINDOW));

  return { angle, bend, opacity };
}

export interface PageShadowProjection {
  readonly reach: number;
  readonly strength: number;
}

const LIGHT_XZ_SLOPE = 0.35 / 0.55;

/**
 * Computes the sinusoidal shadow reach (along vUv.x in [0, 1]) and strength [0, 1]
 * cast by a higher neighbor page onto a target page.
 */
export function computePageShadowProjection(
  targetAngle: number,
  casterAngle: number,
  casterOpacity: number
): PageShadowProjection {
  const liftDiff = Math.sin(casterAngle) - Math.sin(targetAngle);
  if (liftDiff <= 0.02 || casterOpacity <= 0) {
    return { reach: 0, strength: 0 };
  }

  const xShadow = Math.cos(casterAngle) - Math.sin(casterAngle) * LIGHT_XZ_SLOPE;
  const rawReach = targetAngle > Math.PI / 2 ? Math.max(0, -xShadow) : Math.max(0, xShadow);
  const reach = clamp(rawReach, 0, 1);
  if (reach <= 0.01) {
    return { reach: 0, strength: 0 };
  }

  const proximity = clamp(1 - Math.abs(targetAngle - casterAngle) / 1.4, 0, 1);
  const strength = clamp(
    casterOpacity * Math.min(1, liftDiff * 4) * (0.35 + 0.65 * proximity),
    0,
    1
  );

  return { reach, strength };
}
