# API & Utility Reference

## 1. Mathematical & Modeling Engines (`src/utils/models.ts`)

### `multipleLinearRegression(X: number[][], y: number[]): RegressionResult | null`
Performs ordinary least-squares regression with column standardization and dynamic Ridge regularization.
- **Parameters**:
  - `X`: Independent feature matrix $[N \times K]$.
  - `y`: Target observations vector $[N]$.
- **Returns**: OLS beta vector, variance-covariance matrix $(X^T X)^{-1}$, and residual metrics.

### `calculateModelRankScore(model: RegressionResult): number`
Computes an objective ranking index balancing explanatory power against parameter complexity, incorporating a $+0.025$ physical thermodynamic bonus.

### `fitTemperatureModels(data: DataPoint[]): RegressionResult[]`
Fits the complete suite of temperature-dependent models:
- Modified Apelblat
- Clarke-Glew
- van 't Hoff
- Quadratic & Cubic Polynomials
- Exponential

### `fitCompositionModels(data: DataPoint[]): RegressionResult[]`
Fits binary cosolvency models across solvent fractions:
- Jouyban-Acree (Full & Simplified)
- Yalkowsky Log-Linear Mixing
- Redlich-Kister Expansion

---

## 2. Crystallization Process Kinetics (`src/utils/crystallization.ts`)

### `calculateSeedingParameters(params, batchAPIg, batchVolL, ...): SeedingResult`
Computes required seed loading mass, specific surface area ($SSA$), and volumetric surface area ($A_V$).

### `generatePhaseDiagramData(model, ...): PhaseDiagramPoint[]`
Generates discretized phase boundaries including equilibrium curve ($C^*$), critical metastable boundary ($C_{crit}$), and cubic vs. linear operating trajectories.

### `autoFitModelFromExperiment(samples, calibrationResult, ...): AutoFitResult`
Automatically extracts sample concentrations, detects whether the study is a temperature, composition, or simultaneous study, and returns the top-ranked model.

---

## 3. Green Chemistry & Hansen Utilities (`src/utils/greenChemistry.ts`)

### `getEhsBreakdown(solvent: Solvent): EhsBreakdown`
Deconstructs solvent properties into 3-pillar EHS scores (Health, Safety, Environment) calibrated against pharmaceutical green chemistry standards.

### `calculateHansenDistance(s1: Solvent, s2: Solvent): number`
Calculates 3D Hansen affinity distance:
$$R_a = \sqrt{4(\Delta\delta_D)^2 + (\Delta\delta_P)^2 + (\Delta\delta_H)^2}$$

### `findBinaryMixtures(targetSolvent: Solvent, labSolvents: Solvent[]): BinaryMixtureCandidate[]`
Iteratively sweeps solvent pairs and blend ratios to find green binary mixtures that mimic hazardous target solvents.

---

## 4. HPLC Calibration Utilities (`src/utils/calculations.ts`)

### `calculateReactionConcentration(area, volTakenUl, addedSolventMl, calib): number | null`
Converts raw HPLC peak area into true reactor concentration, rigorously propagating vial dilution factors.

### `enrichSamplesWithConcentration(samples, calibrationResult, decimals = 1)`
Maps an array of raw unknown samples into enriched objects containing both raw and rounded reaction concentrations.
