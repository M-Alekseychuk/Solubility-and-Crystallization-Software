import { calculateReactionConcentration, getValidCalibrationPoints } from '../../../src/utils/calculations';
import { mockCalibrationPoints } from '../../fixtures/sample-data';
import { CalibrationResult } from '../../../src/types';

export function runSolubilityTests() {
  const pts = getValidCalibrationPoints(mockCalibrationPoints);
  if (pts.length !== 4) throw new Error('Expected 4 calibration points');
  if (Math.abs(pts[0].x - 0.1) > 1e-4) throw new Error('Expected first x to be 0.1 mg/mL');

  const calib: CalibrationResult = { slope: 12500, intercept: 0, rSquared: 0.9999, valid: true };
  const reactionConc = calculateReactionConcentration(2500, 50, 1.0, calib);
  if (reactionConc === null || Math.abs(reactionConc - 4.2) > 1e-3) {
    throw new Error(`Calculated concentration ${reactionConc} does not match expected 4.2 mg/mL`);
  }
}
