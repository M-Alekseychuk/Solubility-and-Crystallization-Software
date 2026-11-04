# Pull Request: Core Documentation & Architecture Specification Suite

**PR Branch**: `feature/core-docs`  
**Target Branch**: `main`  
**PR Title**: `feat(docs): Establish Core Architecture, Science Engines & Comprehensive Documentation Suite`  
**Status**: Ready for Review / Merge  

---

## 📌 Executive Summary

This Pull Request introduces a comprehensive, enterprise-grade documentation and architectural foundation for the **HPLC Solubility Calculator & Crystallization Engine**, directly fulfilling the repository layout and core documentation blueprint shown in the project inspiration specifications:

- **Root Documentation**: Added `README.md`, `AGENTS.md`, `CLAUDE.md`, and `PULL_REQUEST.md`.
- **Core Documentation Suite (`docs/`)**:
  - `docs/README.md`: Central navigation index and domain overview.
  - `docs/ARCHITECTURE.md`: High-level system architecture, decoupling client UI (`web`), scientific computation (`core`), server integrations (`server`), and testing infrastructure (`tests`).
  - `docs/core/SOLUBILITY_MODELS.md`: Mathematical derivations and validation criteria for thermodynamic solid-liquid equilibrium models (van 't Hoff, Modified Apelblat, Clarke-Glew, Jouyban-Acree, Yalkowsky log-linear mixing, Tikhonov regularization, and AIC/BIC ranking).
  - `docs/core/CRYSTALLIZATION.md`: Crystallization kinetics, Metastable Zone Width (MSZW), supersaturation ratio $S = C/C^*$, specific seed surface area ($SSA$), and controlled cubic vs. uncontrolled linear cooling trajectories.
  - `docs/core/GREEN_CHEMISTRY.md`: 3D Hansen Solubility Parameters ($R_a$), binary cosolvent blending optimization, 3-pillar EHS scoring (Health, Safety, Environment), and Process Mass Intensity (PMI) calculus.
  - `docs/core/CALIBRATION_ANALYSIS.md`: Analytical HPLC UV response calibration, Beer-Lambert regression, vial dilution factor propagation, and LOD/LOQ validation.
  - `docs/core/DATA_MODELS.md`: Complete TypeScript interface dictionary and schemas.
  - `docs/API_REFERENCE.md`: Public API contracts and utility reference.
- **Testing & Tooling Scaffolding**: Added `vitest.config.ts`, `data.json`, and sample unit test structures in `tests/core/` and `tests/fixtures/` aligned with the inspiration directory tree.

---

## 🏛 Structural Blueprint (Reflecting Project Inspiration)

```
├── .aistudio/                 # AI Studio metadata and brain artifacts
├── docs/                      # Core documentation suite
│   ├── ARCHITECTURE.md        # Architecture overview & layer decoupling
│   ├── API_REFERENCE.md       # Utility functions and computational engines
│   ├── README.md              # Documentation navigation index
│   └── core/                  # In-depth scientific specifications
│       ├── CALIBRATION_ANALYSIS.md
│       ├── CRYSTALLIZATION.md
│       ├── DATA_MODELS.md
│       ├── GREEN_CHEMISTRY.md
│       └── SOLUBILITY_MODELS.md
├── public/                    # Static assets, branding, and templates
├── scripts/                   # Automation scripts
├── src/
│   ├── core/                  # Scientific calculation engines
│   ├── components/            # React 19 UI tabs & Plotly visualizations
│   ├── data/                  # Solvent databases & Hansen coordinates
│   ├── server/                # Express & MCP server interfaces
│   ├── utils/                 # Numerical utilities & export engines
│   ├── types.ts               # Global TypeScript definitions
│   ├── main.tsx               # Application bootstrap
│   └── vite-env.d.ts          # Vite ambient types
├── tests/
│   ├── core/
│   │   ├── analysis/          # HPLC calibration & regression tests
│   │   └── design/            # Crystallization kinetics & seeding tests
│   ├── fixtures/              # Validated chemical reference datasets
│   └── helpers/               # Numerical tolerance assertion helpers
├── .env.example               # Environment variable templates
├── .gitignore                 # Version control exclusions
├── AGENTS.md                  # Autonomous agent workflow rules & standards
├── CLAUDE.md                  # Development guide & testing instructions
├── data.json                  # Sample data payload
├── index.html                 # HTML entry point
├── metadata.json              # Applet identity & permissions
├── package.json               # Dependencies and scripts
├── PULL_REQUEST.md            # This PR specification
├── README.md                  # Root project overview
├── server.ts                  # Backend server entry point
├── tsconfig.json              # TypeScript compilation rules
├── vite.config.ts             # Vite bundler configuration
└── vitest.config.ts           # Vitest test runner configuration
```

---

## 🔍 Key Technical Highlights

### 1. Thermodynamic Plausibility Weighting
Documented and validated the composite model rank scoring function in `docs/core/SOLUBILITY_MODELS.md`:
$$\text{Rank Score} = (0.7 \cdot R_{adj}^2 + 0.3 \cdot R^2) + \text{Bonus}_{physical}$$
Ensures thermodynamic physical models (Clarke-Glew, Apelblat, van 't Hoff) are prioritized over unconstrained high-degree polynomials that lack asymptotic physical extrapolation behavior.

### 2. Controlled Cubic Cooling vs. Linear Cooling
Formally documented the Mullin-Nývlt cubic cooling trajectory:
$$T(t) = T_0 - (T_0 - T_f)\left(\frac{t}{\tau}\right)^3$$
in `docs/core/CRYSTALLIZATION.md`. Explains why constant linear cooling rates cause spontaneous secondary nucleation in early batch phases, whereas cubic profiles balance supersaturation generation against available crystal surface area.

### 3. Hansen Distance ($R_a$) & Binary Cosolvent Optimization
Detailed the 3D Hansen solubility distance equation:
$$R_a = \sqrt{4(\Delta\delta_D)^2 + (\Delta\delta_P)^2 + (\Delta\delta_H)^2}$$
and the iterative parameter sweep used to construct benign binary replacement mixtures matching hazardous target solvents (e.g., replacing DCM with 2-MeTHF/EtOAc blends).

---

## ✅ Verification & Validation Checklist

- [x] All mathematical formulas verified against chemical engineering literature and `src/utils/`.
- [x] Decoupled architecture documented with zero regression on existing UI tabs.
- [x] TypeScript contracts in `docs/core/DATA_MODELS.md` synchronized with `src/types.ts`.
- [x] Root project files (`README.md`, `AGENTS.md`, `CLAUDE.md`, `vitest.config.ts`, `data.json`) established.
- [x] Linter (`tsc --noEmit`) passes cleanly with zero errors.
- [x] Applet build (`npm run build`) compiles successfully.
