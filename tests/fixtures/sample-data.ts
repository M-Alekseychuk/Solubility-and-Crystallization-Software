import { CalibrationPoint, SampleData } from '../../src/types';

export const mockCalibrationPoints: CalibrationPoint[] = [
  { id: 'cal-1', massMg: 10, volMl: 100, area: 1250 },
  { id: 'cal-2', massMg: 25, volMl: 100, area: 3100 },
  { id: 'cal-3', massMg: 50, volMl: 100, area: 6200 },
  { id: 'cal-4', massMg: 100, volMl: 100, area: 12400 }
];

export const mockSamples: SampleData[] = [
  {
    id: 's-1',
    name: 'Sample_25C',
    solvent1: 'Ethanol',
    solvent2: 'Water',
    solvent1Fraction: 100,
    temperature: 25,
    area: 2500,
    volumeTakenUl: 50,
    addedSolventMl: 1.0
  },
  {
    id: 's-2',
    name: 'Sample_50C',
    solvent1: 'Ethanol',
    solvent2: 'Water',
    solvent1Fraction: 100,
    temperature: 50,
    area: 5000,
    volumeTakenUl: 50,
    addedSolventMl: 1.0
  }
];
