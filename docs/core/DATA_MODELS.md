# Core Data Models & Schemas

## 1. Type Definitions Reference

All primary TypeScript types reside in `src/types.ts` and `src/utils/`.

---

## 2. Chemical & Solvent Entities

### 2.1 `Solvent`
Represents an organic or aqueous solvent in the lab inventory and reference database:

```typescript
export interface Solvent {
  id: string;
  name: string;
  casNumber?: string;
  molecularFormula?: string;
  molecularWeight?: number | '';
  boilingPoint: number | '';          // °C
  meltingPoint?: number | '';         // °C
  density?: number | '';              // g/cm³ at 20°C
  viscosity?: number | '';            // cP at 20°C
  dielectricConstant: number | '';
  waterMiscibility: 'Fully' | 'Partially' | 'Immiscible' | '';
  polarityProfile: 'Polar Protic' | 'Polar Aprotic' | 'Nonpolar' | '';
  ichClass: 1 | 2 | 3 | '' | 'Exempt';// ICH Q3C guidance limit class
  ehsScore: number | '';              // Composite safety score 1-10 (10 = greenest)
  flashPoint: number | '';            // Closed-cup flash point °C
  polarityIndex: number | '';         // Snyder polarity index
  hansenD: number | '';               // Dispersion parameter δ_D (MPa^0.5)
  hansenP: number | '';               // Polar parameter δ_P (MPa^0.5)
  hansenH: number | '';               // Hydrogen bonding parameter δ_H (MPa^0.5)
  hansenR0?: number | '';             // Interaction radius R_0 (optional)
  costPerKg?: number | '';            // Estimated commercial cost ($/kg)
  notes?: string;
}
```

### 2.2 `EhsBreakdown`
Three-pillar safety and environmental scoring decomposition:

```typescript
export interface EhsBreakdown {
  health: number;       // 1 - 10
  safety: number;       // 1 - 10
  environment: number;  // 1 - 10
  overall: number;      // 1 - 10
  healthNotes?: string;
  safetyNotes?: string;
  envNotes?: string;
}
```

---

## 3. Analytical HPLC & Measurement Entities

### 3.1 `CalibrationPoint`
A single standard calibration dilution point:

```typescript
export interface CalibrationPoint {
  id: string;
  pointNumber: number;
  massMg: number | '';
  volMl: number | '';
  area: number | '';
}
```

### 3.2 `CalibrationResult`
Least-squares regression parameters derived from calibration points:

```typescript
export interface CalibrationResult {
  slope: number;
  intercept: number;
  r2: number;
  valid: boolean;
}
```

### 3.3 `SampleData`
A measured unknown sample from an experimental equilibrium study:

```typescript
export interface SampleData {
  id: string;
  sampleName: string;
  solvent1: string;
  solvent2?: string;
  ratio?: string | number;        // Mass or volume fraction of Solvent 1 (%)
  temperature: string | number;   // °C
  area: string | number;          // Peak area
  volumeTakenUl: string | number; // Aliquot taken (µL)
  addedSolventMl: string | number;// Diluent added (mL)
  notes?: string;
  rawReactionConc?: number | null;// Calculated concentration before rounding
  reactionConc?: string;          // Formatted concentration (mg/mL)
}
```

---

## 4. Modeling & Regression Entities

### 4.1 `RegressionResult`
Outputs produced by thermodynamic and polynomial model fitting:

```typescript
export interface RegressionStats {
  r2: number;
  adj_r2: number;
  rmse: number;
  mae: number;
  mape: number;
  aic: number;
  bic: number;
  sse: number;
  sst: number;
  n: number;
  k: number;
  sigma2: number;
}

export interface RegressionResult {
  beta: number[];
  y_pred: number[];
  stats: RegressionStats;
  X_T_X_inv: number[][];
  modelName: string;
  category: 'physical' | 'mathematical';
  predict: (x: any) => { 
    pred: number; 
    ci95: [number, number]; 
    pi95: [number, number] 
  };
}
```

---

## 5. Crystallization Process Entities

### 5.1 `SeedingParams` & `SeedingResult`
Process inputs and kinetic seeding outputs:

```typescript
export interface SeedingParams {
  targetS: number;          // Target supersaturation ratio (e.g. 1.10)
  seedLoadingPct: number;   // wt% relative to batch API (e.g. 2.0%)
  seedD50Um: number;        // Median seed diameter in microns (e.g. 25 µm)
  mszwScrit: number;        // Critical MSZW boundary (e.g. 1.30)
  agingTimeMin: number;     // Seed hold / aging period (min)
  crystalDensity: number;   // Crystal solid density (g/cm³, default 1.25)
}

export interface SeedingResult {
  saturationT: number | null;
  saturationAntiSolventVol: number | null;
  seedingT: number | null;
  seedingAntiSolventVol: number | null;
  seedingSubcoolingT: number | null;
  seedMassG: number;
  seedMassMg: number;
  totalBatchWithSeedG: number;
  specificSurfaceAreaM2g: number;
  totalSurfaceAreaM2: number;
  volumetricSurfaceAreaM2L: number;
  status: 'optimal' | 'undersaturated_risk' | 'labile_risk' | 'out_of_range';
  statusMessage: string;
  recommendedHoldMin: number;
}
```
