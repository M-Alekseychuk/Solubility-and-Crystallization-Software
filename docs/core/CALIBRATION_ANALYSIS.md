# HPLC Calibration & Analytical Quantification

## 1. Principles of HPLC UV Quantification

In reverse-phase and normal-phase High-Performance Liquid Chromatography (HPLC), analyte detection is governed by the Beer-Lambert law:

$$A = \epsilon \cdot b \cdot c$$

Where:
- $A$: Absorbance or peak area $[\text{mAU}\cdot\text{s}]$.
- $\epsilon$: Molar extinction coefficient $[\text{L}\cdot\text{mol}^{-1}\cdot\text{cm}^{-1}]$.
- $b$: Flow-cell optical path length $[\text{cm}]$.
- $c$: Solute concentration $[\text{mg/mL}]$ or $[\text{mol/L}]$.

Within the detector's linear dynamic range, the integrated chromatographic peak area $y$ is linearly proportional to the sample vial concentration $x$.

---

## 2. Calibration Curve Generation

The calibration model is established using $N$ standard calibration points:

$$y = m \cdot x + c$$

Where:
- $x = \frac{\text{Mass (mg)}}{\text{Volume (mL)}}$: Standard concentration.
- $y = \text{Area}$: UV peak integration area.
- $m$: Calibration slope (detector response factor).
- $c$: Intercept (blank or baseline offset).

### 2.1 Least-Squares Linear Regression
$$m = \frac{N \sum (x_i y_i) - (\sum x_i)(\sum y_i)}{N \sum x_i^2 - (\sum x_i)^2}$$

$$c = \frac{\sum y_i - m \sum x_i}{N}$$

### 2.2 Limit of Detection (LOD) & Limit of Quantitation (LOQ)
In accordance with ICH Q2(R1) Validation of Analytical Procedures:

$$\text{LOD} = \frac{3.3 \cdot \sigma_y}{m}$$

$$\text{LOQ} = \frac{10 \cdot \sigma_y}{m}$$

Where $\sigma_y$ is the standard deviation of the response or the standard error of the regression residuals:
$$\sigma_y = \sqrt{\frac{\sum (y_i - \hat{y}_i)^2}{N - 2}}$$

---

## 3. Sample Vial Dilution Propagation

In experimental solubility determinations, saturated aliquots are often too concentrated for direct HPLC analysis and must be diluted into the linear range of the detector.

```
[Slurry / Saturated Aliquot]
         │
         │ Take Aliquot Volume: V_sample (µL)  [e.g. 50 µL]
         ▼
[HPLC Autosampler Vial]
         │ Add Diluent Solvent: V_added (mL)   [e.g. 1.0 mL]
         ▼
[Detector Measurement] ───> Measured Vial Concentration (C_vial)
```

### 3.1 Vial Concentration
$$C_{vial} = \frac{\text{Area} - c}{m}\quad [\text{mg/mL}]$$

### 3.2 Dilution Factor ($DF$)
Converting $V_{sample}$ from microliters ($\mu\text{L}$) to milliliters ($\text{mL}$):
$$V_{sample,\text{mL}} = \frac{V_{sample,\mu\text{L}}}{1000}$$

$$V_{total} = V_{added,\text{mL}} + V_{sample,\text{mL}}$$

$$DF = \frac{V_{total}}{V_{sample,\text{mL}}} = \frac{V_{added,\text{mL}} + (V_{sample,\mu\text{L}} / 1000)}{V_{sample,\mu\text{L}} / 1000}$$

### 3.3 Reconstructed Reaction / Slurry Concentration
$$C_{reaction} = C_{vial} \cdot DF\quad [\text{mg/mL}]$$

This reconstructed concentration $C_{reaction}$ directly feeds into the solid-liquid equilibrium regression models in `PredictionTab` and `CrystallizationTab`.
