import { Solvent } from '../../../src/types';

export function runHansenDistanceTest() {
  const s1: Solvent = {
    id: '1',
    name: 'Solvent A',
    boilingPoint: 100,
    meltingPoint: 0,
    dielectricConstant: 20,
    waterMiscibility: 'Fully',
    polarityProfile: 'Polar Protic',
    ichClass: 3,
    ehsScore: 8,
    flashPoint: 20,
    polarityIndex: 5,
    hansenD: 16.0,
    hansenP: 10.0,
    hansenH: 12.0
  };

  const s2: Solvent = {
    id: '2',
    name: 'Solvent B',
    boilingPoint: 80,
    meltingPoint: -10,
    dielectricConstant: 18,
    waterMiscibility: 'Fully',
    polarityProfile: 'Polar Protic',
    ichClass: 3,
    ehsScore: 8,
    flashPoint: 12,
    polarityIndex: 4.8,
    hansenD: 15.0,
    hansenP: 9.0,
    hansenH: 10.0
  };

  // Ra = sqrt(4*(16-15)^2 + (10-9)^2 + (12-10)^2) = sqrt(4 + 1 + 4) = 3.0
  const dD = (s1.hansenD ?? 0) - (s2.hansenD ?? 0);
  const dP = (s1.hansenP ?? 0) - (s2.hansenP ?? 0);
  const dH = (s1.hansenH ?? 0) - (s2.hansenH ?? 0);
  const ra = Math.sqrt(4 * dD * dD + dP * dP + dH * dH);

  if (Math.abs(ra - 3.0) > 1e-4) {
    throw new Error(`Calculated Ra ${ra} does not match 3.0`);
  }
}
