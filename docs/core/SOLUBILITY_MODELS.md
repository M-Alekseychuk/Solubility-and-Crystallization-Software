# Core Thermodynamic & Mathematical Solubility Models

## 1. Introduction

Accurate mathematical modeling of solid-liquid equilibrium (SLE) is essential for predicting active pharmaceutical ingredient (API) solubility across temperature gradients and solvent mixture compositions. The core engine fits multiple candidate models simultaneously and ranks them based on both statistical fit and thermodynamic physical plausibility.

---

## 2. Temperature-Dependent Models (Task 1)

### 2.1 van 't Hoff Model (Two-Parameter Ideal Solution)
Derived from the Gibbs-Helmholtz relation under the assumption of temperature-independent dissolution enthalpy ($\Delta H_{sol}$):

$$\ln(x) = A - \frac{\Delta H_{sol}}{R T} = A + \frac{B}{T}$$

Where:
- $x$: Mole fraction or standardized concentration (mg/mL) of solute.
- $T$: Absolute temperature in Kelvin ($T_K = T_{^\circ\text{C}} + 273.15$).
- $R$: Universal gas constant ($8.314462618 \text{ J}\cdot\text{mol}^{-1}\cdot\text{K}^{-1}$).
- $A$: Dimensionless entropy term ($\Delta S_{sol} / R$).
- $B$: Enthalpy parameter ($-\Delta H_{sol} / R$).

### 2.2 Modified Apelblat Model (Three-Parameter)
Accounts for the temperature dependence of dissolution enthalpy and heat capacity differences ($\Delta C_p$):

$$\ln(x) = A + \frac{B}{T} + C \ln(T)$$

Where:
- $A, B, C$: Empirical regression parameters.
- $C$: Related to the differential heat capacity of dissolution ($\Delta C_p / R$).

### 2.3 Clarke-Glew Thermodynamic Model
Expands the standard chemical potential around a reference temperature $T_\theta$ (commonly 298.15 K):

$$R \ln(x) = -\frac{\Delta G^\circ(T_\theta)}{T_\theta} + \Delta H^\circ(T_\theta)\left(\frac{1}{T_\theta} - \frac{1}{T}\right) + \Delta C_p^\circ(T_\theta)\left[\frac{T_\theta}{T} - 1 + \ln\left(\frac{T}{T_\theta}\right)\right]$$

This formulation minimizes parameter correlation and yields physically meaningful values for standard dissolution enthalpy and heat capacity.

---

## 3. Composition-Dependent Cosolvency Models (Task 2)

When predicting solubility in binary solvent mixtures at constant temperature ($x_1 + x_2 = 1$):

### 3.1 Yalkowsky Log-Linear Mixing Model
The simplest cosolvency model assuming ideal solvent blending:

$$\ln(S_{mix}) = w_1 \ln(S_1) + w_2 \ln(S_2)$$

Where:
- $w_1, w_2$: Mass or volume fractions of Solvent 1 and Solvent 2.
- $S_1, S_2$: Pure solvent solubilities.

### 3.2 Jouyban-Acree Model
Accounts for non-ideal solute-solvent and solvent-solvent intermolecular interactions in mixed solvent systems:

$$\ln(S_{mix}) = w_1 \ln(S_1) + w_2 \ln(S_2) + w_1 w_2 \sum_{j=0}^{M} \frac{J_j}{T} (w_1 - w_2)^j$$

- **Simplified Jouyban-Acree**: $M = 0$ (single interaction parameter $J_0$).
- **Full Jouyban-Acree**: $M = 2$ (interaction parameters $J_0, J_1, J_2$).

### 3.3 Redlich-Kister Polynomial Expansion
Expresses excess solubility as a function of solvent composition:

$$\ln(S_{mix}) - [w_1 \ln(S_1) + w_2 \ln(S_2)] = w_1 w_2 \sum_{k=0}^{P} A_k (w_1 - w_2)^k$$

---

## 4. Combined Temperature & Composition Models (Task 3)

### 4.1 Combined Apelblat + Jouyban-Acree
Allows simultaneous prediction across both temperature and solvent blending ratios:

$$\ln(S_{mix}, T) = w_1 \left(A_1 + \frac{B_1}{T} + C_1 \ln(T)\right) + w_2 \left(A_2 + \frac{B_2}{T} + C_2 \ln(T)\right) + w_1 w_2 \sum_{j=0}^{M} \frac{J_j}{T}(w_1 - w_2)^j$$

---

## 5. Statistical Diagnostics & Model Selection

### 5.1 Goodness-of-Fit Metrics

1. **Coefficient of Determination ($R^2$)**:
   $$R^2 = 1 - \frac{\sum (y_i - \hat{y}_i)^2}{\sum (y_i - \bar{y})^2}$$

2. **Adjusted Coefficient of Determination ($R_{adj}^2$)**:
   Penalizes excessive parameter count $k$ relative to sample size $n$:
   $$R_{adj}^2 = 1 - (1 - R^2)\frac{n - 1}{n - k}$$

3. **Root Mean Square Error (RMSE)**:
   $$\text{RMSE} = \sqrt{\frac{1}{n} \sum_{i=1}^n (y_i - \hat{y}_i)^2}$$

4. **Mean Absolute Percentage Error (MAPE)**:
   $$\text{MAPE} = \frac{100\%}{n} \sum_{i=1}^n \left|\frac{y_i - \hat{y}_i}{y_i}\right|$$

5. **Akaike & Bayesian Information Criteria (AIC / BIC)**:
   $$\text{AIC} = n \ln\left(\frac{\text{SSE}}{n}\right) + 2k$$
   $$\text{BIC} = n \ln\left(\frac{\text{SSE}}{n}\right) + k \ln(n)$$

### 5.2 Physical Reality Ranking Bonus
Purely mathematical models (such as high-order polynomials) can easily overfit experimental points while creating unphysical local minima or maxima between data points. To guard against this, the algorithm applies a **physical model preference score**:

$$\text{Rank Score} = (0.7 \cdot R_{adj}^2 + 0.3 \cdot R^2) + \text{Bonus}_{physical}$$

Where $\text{Bonus}_{physical} = +0.025$ is awarded to validated thermodynamic equations (Clarke-Glew, Modified Apelblat, van 't Hoff, Jouyban-Acree). If a physical model and an unconstrained polynomial achieve comparable fits (within ~2.5%), the physical model is automatically recommended as the best model.
