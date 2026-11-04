# HPLC Solubility Calculator & Crystallization Process Engine

An enterprise web application and scientific computing engine for analytical HPLC solubility determinations, thermodynamic model fitting, Hansen Solubility Parameter (HSP) green solvent substitution, and batch cooling crystallization engineering.

![HPLC Solubility Calculator](public/assets/aistudio/grafik_425428d0.png)

---

## 🌟 Key Capabilities

- **Analytical HPLC Calibration**: Convert peak areas into true solution concentrations with multi-point linear calibration, automated $R^2$ diagnostics, LOD/LOQ estimation, and precise dilution factor accounting.
- **Automated Thermodynamic Modeling**: Fits experimental solid-liquid equilibrium data across temperature and binary solvent compositions using:
  - Modified Apelblat (3-parameter)
  - Clarke-Glew Thermodynamic Expansion
  - van 't Hoff Ideal Solution
  - Jouyban-Acree (Full & Simplified) Cosolvency
  - Yalkowsky Log-Linear Mixing
  - Combined Apelblat + Jouyban-Acree
- **Crystallization Process Engineering**:
  - Phase diagram visualization with dynamic Metastable Zone Width (MSZW) boundaries.
  - Controlled cubic (Mullin-Nývlt) vs. uncontrolled linear operating trajectories.
  - Critical seed loading mass, particle size ($D_{50}$), specific surface area ($SSA$), and volumetric surface area ($A_V$).
  - Jacket cooling ramp schedules and anti-solvent metering rates.
  - Automated Batch Standard Operating Procedure (SOP) recipe generation.
- **Green Chemistry & Solvent Replacement**:
  - 3D Hansen Solubility Parameter coordinate space ($\delta_D, \delta_P, \delta_H$).
  - Single solvent and optimized binary cosolvent replacement recommendations matching hazardous targets (e.g. DCM, DMF, NMP).
  - 3-Pillar EHS Scoring (Health, Safety, Environment) aligned with Pfizer, GSK, and Sanofi green guides.
  - Process Mass Intensity (PMI) metrics and ICH Q3C regulatory classifications.

---

## 📁 Repository Structure

```
├── docs/                      # Comprehensive core and technical documentation suite
│   ├── ARCHITECTURE.md        # Architecture topology and component separation
│   ├── API_REFERENCE.md       # Exported functions, math engines, and types
│   ├── README.md              # Documentation navigation index
│   └── core/                  # In-depth scientific domain specifications
│       ├── CALIBRATION_ANALYSIS.md
│       ├── CRYSTALLIZATION.md
│       ├── DATA_MODELS.md
│       ├── GREEN_CHEMISTRY.md
│       └── SOLUBILITY_MODELS.md
├── public/                    # Static assets, branding, and templates
├── src/                       # Application source code
│   ├── components/            # React 19 UI tabs & Plotly visualizations
│   ├── data/                  # Solvent databases & Hansen coordinates
│   ├── utils/                 # Numerical utilities & export engines
│   ├── types.ts               # Global TypeScript definitions
│   ├── main.tsx               # Application bootstrap
│   └── index.css              # Tailwind CSS styling
├── tests/                     # Unit and integration test suite
│   ├── core/                  # Core scientific engine tests
│   ├── fixtures/              # Reference dataset fixtures
│   └── helpers/               # Numerical testing helpers
├── AGENTS.md                  # Autonomous agent workflow rules & standards
├── CLAUDE.md                  # Developer guide & testing instructions
├── PULL_REQUEST.md            # Pull request specification & checklist
└── package.json               # Dependencies and scripts
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js $\ge 18.0.0$
- npm or bun

### Installation
```bash
# Install dependencies
npm install

# Start local development server (runs on port 3000)
npm run dev

# Run TypeScript type-checking
npm run lint

# Build for production
npm run build
```

---

## 📖 Core Documentation

Detailed scientific documentation, thermodynamic derivations, and API references are available in the **[`docs/`](./docs/README.md)** directory:
- [System Architecture](./docs/ARCHITECTURE.md)
- [Thermodynamic Solubility Models](./docs/core/SOLUBILITY_MODELS.md)
- [Crystallization Engineering](./docs/core/CRYSTALLIZATION.md)
- [Green Chemistry & HSP Replacement](./docs/core/GREEN_CHEMISTRY.md)
- [HPLC Calibration & Dilution Analysis](./docs/core/CALIBRATION_ANALYSIS.md)
- [Data Models & Type Schemas](./docs/core/DATA_MODELS.md)
- [API & Utility Reference](./docs/API_REFERENCE.md)

---

## 📄 Pull Request Details

For detailed change lists and scientific review criteria, refer to **[`PULL_REQUEST.md`](./PULL_REQUEST.md)**.
