# HPLC Solubility Calculator & Crystallization Engine — Core Documentation

Welcome to the internal core documentation suite for the **HPLC Solubility Calculator & Crystallization Process Engineering Engine**.

This repository combines analytical HPLC UV-spectroscopy calibration, thermodynamic solubility modeling (van 't Hoff, Apelblat, Jouyban-Acree), Hansen Solubility Parameters (HSP) green solvent substitution, and crystallization batch engineering (metastable zone width, seeding kinetics, controlled cooling schedules, SOP generation).

---

## 📚 Documentation Index

| Document | Topic | Key Concepts |
| :--- | :--- | :--- |
| **[System Architecture](./ARCHITECTURE.md)** | System Design & Topology | Layered architecture (`core`, `web`, `server/mcp`, `tests`), state lifecycles, and export pipelines. |
| **[Thermodynamic Solubility Models](./core/SOLUBILITY_MODELS.md)** | Mathematical Modeling | Modified Apelblat, Clarke-Glew, van 't Hoff, Jouyban-Acree cosolvency, Yalkowsky log-linear, Tikhonov regularization, AIC/BIC model ranking. |
| **[Crystallization Process Engineering](./core/CRYSTALLIZATION.md)** | Process Design & Kinetics | Metastable Zone Width (MSZW), supersaturation ratio $S = C/C^*$, critical seed loading, specific surface area $SSA$, cubic controlled cooling $T(t)$, anti-solvent dosing. |
| **[Green Chemistry & Solvent Replacement](./core/GREEN_CHEMISTRY.md)** | Sustainability & Safety | Hansen 3D solubility distance $R_a$, binary cosolvent blending optimization, 3-pillar EHS scoring (Health, Safety, Environment), ICH Q3C limits, Process Mass Intensity (PMI). |
| **[HPLC Calibration & Analysis](./core/CALIBRATION_ANALYSIS.md)** | Analytical Chemistry | UV detector linearity, multi-point linear/polynomial regression, dilution factor calculations, LOD/LOQ, unknown concentration determination. |
| **[Data Models & Schemas](./core/DATA_MODELS.md)** | Type Definitions & Data Contracts | Complete TypeScript schemas for solvents, samples, calibration points, regression results, crystallization trajectories, and SOP recipes. |
| **[API & Utility Reference](./API_REFERENCE.md)** | Developer Guide | Core utility functions, exports, mathematical functions, chart exporters, and server endpoints. |

---

## 🏛 Architecture at a Glance

The project follows a decoupled, domain-driven structure as illustrated in the system blueprint:

```
├── docs/                      # Comprehensive core and technical documentation suite
│   ├── ARCHITECTURE.md        # Architecture topology and component separation
│   ├── API_REFERENCE.md       # Exported functions, math engines, and types
│   └── core/                  # Scientific and algorithmic domain specifications
│       ├── SOLUBILITY_MODELS.md
│       ├── CRYSTALLIZATION.md
│       ├── GREEN_CHEMISTRY.md
│       ├── CALIBRATION_ANALYSIS.md
│       └── DATA_MODELS.md
├── src/
│   ├── core/                  # Pure scientific computation engines (isomorphic, headless)
│   ├── web/ or components/    # React 19 UI tabs, interactive controls, and Plotly visualizations
│   ├── server/                # Express API server & Model Context Protocol (MCP) agents
│   └── data/                  # Solvent database and Hansen parameter tables
├── tests/
│   ├── core/
│   │   ├── analysis/          # HPLC regression and analytical math tests
│   │   └── design/            # Crystallization kinetics, seeding, and cooling trajectory tests
│   ├── fixtures/              # Validated chemical data fixtures
│   └── helpers/               # Numerical tolerance and assertion helpers
├── AGENTS.md                  # Autonomous agent workflow rules and domain constraints
├── CLAUDE.md                  # Developer instructions and test commands
├── PULL_REQUEST.md            # Pull request summary, rationale, and review checklist
└── README.md                  # Project overview, installation, and quick start
```

---

## 🔬 Core Domain Principles

1. **Physical Reality Over Pure Curve-Fitting**:
   When fitting experimental solubility data, thermodynamic models grounded in statistical mechanics (Clarke-Glew, Apelblat, van 't Hoff) receive rank prioritization over unconstrained high-degree polynomials that lack physical extrapolation bounds.

2. **Supersaturation Control & Nucleation Avoidance**:
   Crystallization processes operate within the metastable zone ($1.0 < S < S_{crit}$). Controlled cubic cooling profiles maintain a stable supersaturation level, suppressing spontaneous secondary nucleation and promoting uniform crystal growth.

3. **Responsible Solvent Selection**:
   Solvent replacement utilizes 3D Hansen Solubility Parameters ($\delta_D, \delta_P, \delta_H$) to identify benign single solvents or binary mixtures that preserve solubility while eliminating toxic ICH Class 1 & 2 solvents.

---

For development workflows and pull request guidelines, refer to **[PULL_REQUEST.md](../PULL_REQUEST.md)**.
