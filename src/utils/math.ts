export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Quadratic ease-in-out curve mapping normalized progress t in [0, 1] to [0, 1].
 * Accelerates during the first half [0, 0.5) and decelerates symmetrically during [0.5, 1].
 */
export function easeInOutQuad(progress: number): number {
  const t = clamp(progress, 0, 1);
  if (t < 0.5) {
    const normalizedFirstHalf = 2 * t;
    return normalizedFirstHalf ** 2 / 2;
  }

  const remainingSecondHalf = 2 * (1 - t);
  return 1 - remainingSecondHalf ** 2 / 2;
}
