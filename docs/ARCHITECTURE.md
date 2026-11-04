# System Architecture & Layered Design

## Overview

The **HPLC Solubility Calculator** is an enterprise-grade scientific computing and process engineering web platform. It enables chemical development scientists and process chemists to transform raw analytical HPLC chromatogram data into predictive solubility curves and scalable batch crystallization protocols.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Web Application Layer                           │
│     (React 19, Tailwind CSS v4, Plotly.js 2D/3D, Recharts, MathJax/KaTeX)    │
│                                                                             │
│  [CalibrationTab] ──> [SamplesTab] ──> [PredictionTab] ──> [Crystallization]│
│           │                                                          │      │
│           └────────────────> [GreenReplacementTab] <─────────────────┘      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ calls
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                                Core Engine Layer                            │
│                 (Headless, Pure TypeScript, Isomorphic Math)                │
│                                                                             │
│  ┌───────────────────────┐ ┌──────────────────────┐ ┌────────────────────┐ │
│  │   Thermodynamic Fits  │ │  Process Kinetics    │ │   HSP & Green EHS  │ │
│  │  • Clarke-Glew        │ │  • Seeding Surface   │ │  • 3D Hansen Ra    │ │
│  │  • Modified Apelblat  │ │  • Cubic Cooling T(t)│ │  • Binary Mixtures │ │
│  │  • Jouyban-Acree      │ │  • Anti-Solvent Feed │ │  • 3-Pillar EHS    │ │
│  │  • van 't Hoff        │ │  • Metastable Zone   │ │  • PMI & ICH Q3C   │ │
│  └───────────────────────┘ └──────────────────────┘ └────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ uses
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            Data & Reference Tables                          │
│     (18 Standard Core Solvents, Reference Database, HSP Coordinate Space)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Architectural Layers

### 1.1 Core Scientific Engine (`src/core` & `src/utils`)
The core layer contains zero DOM dependencies and is completely decoupled from UI presentation. It is designed to run in both Node.js/server environments and client-side web workers:

- **`models.ts`**: Multiple linear regression with adaptive Tikhonov (Ridge) regularization, coefficient standardization, statistical model diagnostics ($R^2$, Adjusted $R^2$, RMSE, MAE, MAPE, AIC, BIC), and thermodynamic ranking bonuses.
- **`crystallization.ts`**: Thermodynamic phase boundaries, equilibrium curve extraction, critical supersaturation boundaries, seed surface area loading kinetics, cubic vs. linear cooling schedules, anti-solvent trajectory generation, and automated multi-step SOP recipe creation.
- **`greenChemistry.ts`**: Hansen 3D distance solver, binary mixture cosolvency optimization, Pfizer/GSK/Sanofi aligned 3-pillar EHS scoring (Health, Safety, Environment), and Process Mass Intensity (PMI) calculus.
- **`calculations.ts`**: HPLC calibration curve regression, vial dilution factor propagation, and sample reaction concentration recovery.

### 1.2 Web Presentation Layer (`src/components` & `src/web`)
Interactive, reactive user interface components organized by scientific workflow stage:

- **`CalibrationTab`**: Standard curve builder, multi-level dilution entry, real-time regression equation display with KaTeX, LOD/LOQ indicators, and automated outlier flagging.
- **`SamplesTab`**: Unknown sample measurement table, dilution factor adjustment, temperature/solvent ratio tracking, and auto-computed reaction concentrations.
- **`PredictionTab`**: Autonomous regression fitting across thermodynamic and mathematical model candidates, residual diagnostics, 95% confidence and prediction interval bands, and interactive 2D/3D Plotly response surfaces.
- **`CrystallizationTab`**: Crystallization design dashboard featuring:
  - Phase diagram with dynamic metastable zone width (MSZW) shading.
  - Controlled cubic vs. uncontrolled linear operating trajectory overlays.
  - Interactive seeding parameter sliders (target supersaturation $S_{target}$, seed loading wt%, seed $D_{50}$, crystal density).
  - Volumetric and specific seed surface area calculation cards.
  - Reactor cooling profiles, jacket temperature ramp rates, and anti-solvent feed profiles.
  - Cake wash and filtration parameters (wash ratio, cake volume, deliquoring time).
  - Batch SOP modal generating human-readable and equipment-ready recipes.
- **`GreenReplacementTab`**: Hansen solubility space visualizer, single and binary solvent substitution recommendations, EHS radar charts, and comparative hazard profiles.
- **`SolventsTab`**: Lab solvent inventory manager with software standard persistence (`hplc-solvents-standard`), CAS registry lookups, and auto-enrichment against the chemical reference database.

### 1.3 Server & Tool Interface Layer (`src/server` & `mcp`)
A lightweight Express and MCP (Model Context Protocol) gateway facilitating automated data ingestion, AI-driven parameter optimization, and laboratory information management system (LIMS) data exchanges.

### 1.4 Test Suite Layer (`tests/`)
Comprehensive test coverage split into:
- `tests/core/analysis/`: Unit tests for linear regression, Apelblat fitting, van 't Hoff temperature dependence, and dilution mathematics.
- `tests/core/design/`: Validation of seeding surface area equations, cubic cooling ramp rates, MSZW boundaries, and mass balance conservation.
- `tests/fixtures/`: Real-world validated API solubility datasets (acetaminophen, ibuprofen, benzoic acid).
- `tests/helpers/`: Numerical approximation assertion utilities (`expectWithinTolerance`).

---

## 2. Data Flow & State Lifecycle

```
[Raw HPLC Chromatograms]
         │ (Peak Area, Injection Volume, Dilution)
         ▼
[Calibration Engine] ───> Slope & Intercept (y = mx + c)
         │
         ▼
[Samples Engine] ───────> Reconstructed Solubility (mg/mL or wt%)
         │
         ▼
[Predictive Modeling] ──> Best Thermodynamic Model S*(T, x)
         │
         ├───> [Green Replacement Engine] ───> Benign Solvent Mixture
         │
         ▼
[Crystallization Process Engine]
         │
         ├── Phase Diagram & MSZW
         ├── Seed Surface Area & Loading
         ├── Cubic Cooling Trajectory T(t)
         └── Batch SOP Recipe Generation
```

### State Storage & Synchronization
- **Local Storage Isolation**: Key state elements (`hplc-solvents`, `hplc-solvents-standard`, active calibration, and samples) are persisted locally to prevent accidental data loss during browser reloads.
- **Validation on Ingestion**: All imported spreadsheets (.xlsx, .csv) and JSON files pass through schema validators (`src/utils/importHelper.ts`) to ensure non-negative volumes, positive concentrations, and valid solvent naming conventions.

---

## 3. Computational Performance & Numerical Stability

1. **Collinearity Mitigation**: In multi-parameter thermodynamic regressions where predictors exhibit strong collinearity (e.g., $T$, $\ln(T)$, $1/T$), features are standardized to zero mean and unit variance before inversion:
   $$X_{scaled} = \frac{X - \mu}{\sigma}$$
2. **Adaptive Tikhonov Regularization**: When matrix conditioning is poor ($\kappa(X^T X) \gg 1$), a dynamic Ridge penalty $\lambda$ is added to diagonal elements (excluding the intercept), preventing parameter explosion while preserving asymptotic convergence.
3. **Safe Exponentiation**: Log-space models use boundary-clamped exponentiation ($e^{-700} \le e^x \le e^{700}$) to guard against floating-point underflow/overflow in browser engines.
