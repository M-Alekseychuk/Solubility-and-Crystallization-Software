/**
 * Test assertion helper for floating point numbers within relative tolerance.
 */
export function expectWithinTolerance(actual: number, expected: number, tolerancePct: number = 0.5) {
  const diff = Math.abs(actual - expected);
  const maxDiff = Math.abs(expected) * (tolerancePct / 100);
  if (diff > maxDiff) {
    throw new Error(
      `Value ${actual} is not within ${tolerancePct}% of ${expected} (diff: ${diff}, max allowed: ${maxDiff})`
    );
  }
}
