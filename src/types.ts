export interface CalibrationPoint {
  id: string;
  massMg: number | string;
  volMl: number | string;
  area: number | string;
}

export interface CalibrationResult {
  slope: number;
  intercept: number;
  rSquared: number;
  valid: boolean;
}

export interface SampleData {
  id: string;
  name: string;
  area: number | string;
  volumeTakenUl: number | string;
  addedSolventMl: number | string;
  solvent1: string;
  solvent2: string;
  solvent1Fraction: number | string;
  temperature: number | string;
  excluded?: boolean;
}

export interface Solvent {
  id: string;
  name: string;
  boilingPoint: number | '';
  meltingPoint: number | '';
  dielectricConstant: number | '';
  waterMiscibility?: 'Fully' | 'Partially' | 'Immiscible' | '';
  miscibilityPercentage?: number | '';
  polarityProfile?: 'Polar Aprotic' | 'Polar Protic' | 'Nonpolar' | '';
  ichClass?: 1 | 2 | 3 | '';
  ehsScore?: number | '';
  flashPoint?: number | '';
  polarityIndex?: number | '';
  hansenD?: number;
  hansenP?: number;
  hansenH?: number;
  costPerKg?: number | '';
  casNumber?: string;
  viscosity?: number | '';
  surfaceTension?: number | '';
  ghsStatements?: string;
}

export interface EhsBreakdown {
  health: number; // 1-10 (10 = least hazardous)
  safety: number; // 1-10 (10 = least hazardous / non-flammable)
  environment: number; // 1-10 (10 = benign / biodegradable / non-VOC)
  overall: number; // 1-10
  healthNotes?: string;
  safetyNotes?: string;
  envNotes?: string;
}

export type TabState = 'experiments' | 'calibration' | 'samples' | 'solvents' | 'prediction' | 'guide' | 'green-replacement' | 'crystallization';

export interface GuideAlert {
  id: string;
  text: string;
  type: 'warning' | 'tip' | 'info';
}

export interface GuideStep {
  id: string;
  title: string;
  content: string;
  alerts?: GuideAlert[];
}

export interface Experiment {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
  calibrationResult: CalibrationResult;
  calibrationData: CalibrationPoint[];
  forceZero?: boolean;
  wavelength?: string;
  hplcUsed?: string;
  samples: SampleData[];
}
