import * as math from 'mathjs';

export type ModelCategory = 'physical' | 'mathematical';

export function getModelCategory(modelName: string): ModelCategory {
  const physicalModels = new Set([
    // Task 1: Temperature (Thermodynamic models)
    'Clarke-Glew',
    'Modified Apelblat',
    "Van't Hoff",
    // Task 2: Composition (Thermodynamic cosolvency models)
    'Jouyban-Acree (Full)',
    'Jouyban-Acree (Simplified)',
    'Log-Linear Mixing (Yalkowsky)',
    'Redlich-Kister Expansion',
    // Task 3: Simultaneous (Combined thermodynamic models)
    'Apelblat + Jouyban-Acree',
    "Jouyban-Acree + Van't Hoff",
    "Van't Hoff + Yalkowsky Combined"
  ]);
  return physicalModels.has(modelName) ? 'physical' : 'mathematical';
}

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
  category: ModelCategory;
  predict: (x: any) => { pred: number; ci95: [number, number]; pi95: [number, number] };
}

export function multipleLinearRegression(X: number[][], y: number[]): Omit<RegressionResult, 'modelName' | 'predict' | 'category'> | null {
  try {
    const n = y.length;
    if (n === 0 || !X || !X[0]) return null;
    const k = X[0].length;
    
    // Require at least 2 points
    if (n < 2) return null; 

    // Standardize X to handle extreme collinearity (e.g. T, ln(T), 1/T)
    const means = new Array(k).fill(0);
    const stds = new Array(k).fill(0);
    for (let j=0; j<k; j++) {
      let sum = 0;
      for (let i=0; i<n; i++) sum += X[i][j];
      means[j] = sum / n;
      
      // Skip intercept column for scaling
      let isIntercept = true;
      for (let i=0; i<n; i++) if (X[i][j] !== 1) { isIntercept = false; break; }

      if (isIntercept) {
        stds[j] = 1;
        means[j] = 0; // Don't shift intercept
      } else {
        let sqSum = 0;
        for (let i=0; i<n; i++) sqSum += Math.pow(X[i][j] - means[j], 2);
        stds[j] = Math.sqrt(sqSum / Math.max(1, n - 1));
        if (stds[j] === 0) stds[j] = 1; // Prevent divide by zero for constant features
      }
    }

    const X_scaled = X.map(row => row.map((val, j) => stds[j] === 1 && means[j] === 0 ? val : (val - means[j]) / stds[j]));
    const X_mat = math.matrix(X_scaled);
    const y_mat = math.matrix(y.map(val => [val]));
    
    const X_T = math.transpose(X_mat);
    const X_T_X = math.multiply(X_T, X_mat) as math.Matrix;
    const X_T_X_arr = X_T_X.toArray() as number[][];
    
    // Adaptive Ridge penalty (Tikhonov) to suppress explosive coefficients while preserving intercept
    let lambda = 0.05;
    if (k > 5) lambda = 0.1;
    if (n - k < 5) lambda = 0.5;

    for (let i = 0; i < k; i++) {
      // Don't penalize intercept
      if (stds[i] === 1 && means[i] === 0 && X[0][i] === 1) continue;
      X_T_X_arr[i][i] += lambda;
    }
    const X_T_X_reg = math.matrix(X_T_X_arr);
    
    const X_T_X_inv_scaled = math.inv(X_T_X_reg);
    const X_T_y = math.multiply(X_T, y_mat);
    
    const beta_scaled = math.multiply(X_T_X_inv_scaled, X_T_y) as math.Matrix;
    const beta_scaled_arr = beta_scaled.toArray().map((val: any) => val[0]) as number[];
    
    // Convert beta back to original scale
    const beta_arr = new Array(k).fill(0);
    let intercept_adjust = 0;
    
    // First pass: find the scaled intercept (if there's an intercept column)
    let interceptColIndex = -1;
    for (let j=0; j<k; j++) {
      if (stds[j] === 1 && means[j] === 0 && X[0][j] === 1) {
        interceptColIndex = j;
        intercept_adjust = beta_scaled_arr[j];
        break;
      }
    }

    for (let j=0; j<k; j++) {
      if (j === interceptColIndex) continue;
      beta_arr[j] = beta_scaled_arr[j] / stds[j];
      intercept_adjust -= beta_scaled_arr[j] * means[j] / stds[j];
    }
    
    if (interceptColIndex !== -1) {
      beta_arr[interceptColIndex] = intercept_adjust;
    }

    // Recompute X_T_X_inv for the original scale (needed for confidence intervals)
    // Inv(X^T X) is scaled by (1/std_i * 1/std_j)
    const X_mat_orig = math.matrix(X);
    const X_T_orig = math.transpose(X_mat_orig);
    const X_T_X_orig = math.multiply(X_T_orig, X_mat_orig) as math.Matrix;
    const X_T_X_orig_arr = X_T_X_orig.toArray() as number[][];
    // Also apply minor ridge to original for safety in CI calculations
    for (let i = 0; i < k; i++) {
        X_T_X_orig_arr[i][i] += 1e-9 * Math.max(1, X_T_X_orig_arr[i][i]);
    }
    const X_T_X_inv = math.inv(math.matrix(X_T_X_orig_arr));

    // Calculate predictions on original data using unscaled beta
    const y_pred = math.multiply(X_mat_orig, math.matrix(beta_arr.map(b => [b]))).toArray().map((val: any) => val[0]) as number[];
    
    let sse = 0;
    let sst = 0;
    const y_mean = y.reduce((a, b) => a + b, 0) / n;
    
    let mae_sum = 0;
    let mape_sum = 0;
    
    for (let i = 0; i < n; i++) {
      const e = y[i] - y_pred[i];
      sse += e * e;
      sst += Math.pow(y[i] - y_mean, 2);
      mae_sum += Math.abs(e);
      if (y[i] !== 0) {
        mape_sum += Math.abs(e / y[i]);
      }
    }
    
    const r2 = sst === 0 ? 1 : Math.max(0, 1 - (sse / sst));
    const df = Math.max(1, n - k);
    const adj_r2 = sst === 0 || n === k ? r2 : Math.max(0, 1 - (1 - r2) * (n - 1) / df);
    const rmse = Math.sqrt(sse / n);
    const mae = mae_sum / n;
    const mape = (mape_sum / n) * 100;
    
    const safeSse = Math.max(1e-12, sse / n);
    const aic = n * Math.log(safeSse) + 2 * k;
    const bic = n * Math.log(safeSse) + k * Math.log(n);
    
    const sigma2 = sse / df;
    
    return {
      beta: beta_arr,
      y_pred,
      stats: { r2, adj_r2, rmse, mae, mape, aic, bic, sse, sst, n, k, sigma2 },
      X_T_X_inv: X_T_X_inv.toArray() as number[][]
    };
  } catch (err) {
    console.warn("Regression failed:", err);
    return null;
  }
}

// Approximation for t-value for 95% confidence
function getTCrit(df: number): number {
  if (df <= 0) return 1.96;
  const tTable: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365,
    8: 2.306, 9: 2.262, 10: 2.228, 15: 2.131, 20: 2.086, 30: 2.042
  };
  if (tTable[df]) return tTable[df];
  if (df > 30) return 1.96;
  // Fallback linear interpolation just as a rough guess
  return 2.1; 
}

// Safe exponentiation to prevent Infinity/NaN in UI
function safeExp(val: number): number {
  if (isNaN(val)) return 0;
  return Math.exp(Math.min(700, Math.max(-700, val)));
}

function getLogFloor(data: DataPoint[]): number {
  const posS = data.map(d => d.S).filter(s => s > 0);
  if (posS.length === 0) return 1e-4;
  return Math.min(...posS) / 2;
}

function calculateIntervals(x0: number[], beta: number[], X_T_X_inv: number[][], sigma2: number, df: number, isLog: boolean) {
  const x0_mat = math.matrix([x0]);
  const X_T_X_inv_mat = math.matrix(X_T_X_inv);
  
  const pred_val = Number(math.multiply(x0_mat, math.matrix(beta.map(b => [b]))).toArray()[0][0]);
  const var_mean = Number(math.multiply(math.multiply(x0_mat, X_T_X_inv_mat), math.transpose(x0_mat)).toArray()[0][0]) * sigma2;
  const var_pred = var_mean + sigma2;
  
  const t = getTCrit(df);
  const me_mean = t * Math.sqrt(Math.max(0, var_mean));
  const me_pred = t * Math.sqrt(Math.max(0, var_pred));
  
  if (isLog) {
    const p = safeExp(pred_val);
    return {
      pred: p,
      ci95: [safeExp(pred_val - me_mean), safeExp(pred_val + me_mean)] as [number, number],
      pi95: [safeExp(pred_val - me_pred), safeExp(pred_val + me_pred)] as [number, number]
    };
  } else {
    return {
      pred: pred_val,
      ci95: [pred_val - me_mean, pred_val + me_mean] as [number, number],
      pi95: [pred_val - me_pred, pred_val + me_pred] as [number, number]
    };
  }
}

export function recalculateOriginalScaleStats(data: DataPoint[], S_preds: number[], k: number): RegressionStats {
  const n = data.length;
  let sse = 0;
  let sst = 0;
  const S_mean = data.reduce((sum, d) => sum + d.S, 0) / n;
  let mae_sum = 0;
  let mape_sum = 0;

  for (let i = 0; i < n; i++) {
    const e = data[i].S - S_preds[i];
    sse += e * e;
    sst += Math.pow(data[i].S - S_mean, 2);
    mae_sum += Math.abs(e);
    if (data[i].S !== 0) {
      mape_sum += Math.abs(e / data[i].S);
    }
  }

  const r2 = sst === 0 ? 1 : Math.max(0, 1 - (sse / sst));
  const df = Math.max(1, n - k);
  const adj_r2 = sst === 0 || n === k ? r2 : Math.max(0, 1 - (1 - r2) * (n - 1) / df);
  const rmse = Math.sqrt(sse / n);
  const mae = mae_sum / n;
  const mape = (mape_sum / n) * 100;
  const safeSse = Math.max(1e-12, sse / n);
  const aic = n * Math.log(safeSse) + 2 * k;
  const bic = n * Math.log(safeSse) + k * Math.log(n);
  const sigma2 = sse / df;

  return { r2, adj_r2, rmse, mae, mape, aic, bic, sse, sst, n, k, sigma2 };
}

/**
 * Calculates a composite ranking score for model selection.
 * When two models are close in statistical fit (e.g. within 2-3%),
 * models rooted in physical/thermodynamic reality (e.g., Clarke-Glew, Apelblat, Van 't Hoff)
 * are prioritized over purely mathematical curve-fits (such as Splines or High-order Polynomials).
 */
export function calculateModelRankScore(model: RegressionResult): number {
  const r2 = isFinite(model.stats.r2) ? Math.max(0, model.stats.r2) : 0;
  const adjR2 = (isFinite(model.stats.adj_r2) && model.stats.adj_r2 > -5) ? model.stats.adj_r2 : r2;

  // Primary statistical quality combining Adjusted R2 (penalizing overfitting) and raw R2
  const statisticalQuality = 0.7 * adjR2 + 0.3 * r2;

  // Physical reality preference:
  // A bonus of +0.025 (~2.5% in R2/Adj R2) ensures that whenever a thermodynamic physical model
  // is close to a purely mathematical curve-fit (like Clarke-Glew vs Cubic Spline),
  // the physical model is prioritized and chosen as the recommended best model.
  const isPhysical = (model.category === 'physical') || (getModelCategory(model.modelName) === 'physical');
  const physicalBonus = isPhysical ? 0.025 : 0;

  return statisticalQuality + physicalBonus;
}

/**
 * Sorts candidate regression models based on physical plausibility and statistical fit.
 */
export function sortCandidateModels(models: RegressionResult[]): RegressionResult[] {
  return [...models].sort((a, b) => {
    const scoreA = calculateModelRankScore(a);
    const scoreB = calculateModelRankScore(b);
    const scoreDiff = scoreB - scoreA;
    if (Math.abs(scoreDiff) > 0.0001) {
      return scoreDiff;
    }

    // 1. If scores are virtually tied, prefer physical over mathematical
    const isPhysA = (a.category === 'physical') || (getModelCategory(a.modelName) === 'physical');
    const isPhysB = (b.category === 'physical') || (getModelCategory(b.modelName) === 'physical');
    if (isPhysA && !isPhysB) return -1;
    if (isPhysB && !isPhysA) return 1;

    // 2. Prefer higher Adjusted R2
    const adjA = isFinite(a.stats.adj_r2) ? a.stats.adj_r2 : a.stats.r2;
    const adjB = isFinite(b.stats.adj_r2) ? b.stats.adj_r2 : b.stats.r2;
    const adjDiff = adjB - adjA;
    if (Math.abs(adjDiff) > 0.0005) return adjDiff;

    // 3. Prefer lower AIC
    if (isFinite(a.stats.aic) && isFinite(b.stats.aic) && Math.abs(a.stats.aic - b.stats.aic) > 0.1) {
      return a.stats.aic - b.stats.aic;
    }

    // 4. Fallback to raw R2
    return b.stats.r2 - a.stats.r2;
  });
}

export type DataPoint = { T: number; f: number; S: number; }; // T in C, f in 0-1, S in mg/mL

export function fitTemperatureModels(data: DataPoint[]): RegressionResult[] {
  const models: RegressionResult[] = [];
  
  // 1. Linear: S = a + b*T
  const X_lin = data.map(d => [1, d.T]);
  const y_lin = data.map(d => d.S);
  const res_lin = multipleLinearRegression(X_lin, y_lin);
  if (res_lin) {
    models.push({
      ...res_lin,
      modelName: 'Linear',
      category: 'mathematical',
      predict: (x: {T: number}) => calculateIntervals([1, x.T], res_lin.beta, res_lin.X_T_X_inv, res_lin.stats.sigma2, res_lin.stats.n - res_lin.stats.k, false)
    });
  }

  // 2. Quadratic: S = a + b*T + c*T^2
  const X_quad = data.map(d => [1, d.T, d.T * d.T]);
  const res_quad = multipleLinearRegression(X_quad, y_lin);
  if (res_quad) {
    models.push({
      ...res_quad,
      modelName: 'Quadratic Polynomial',
      category: 'mathematical',
      predict: (x: {T: number}) => calculateIntervals([1, x.T, x.T * x.T], res_quad.beta, res_quad.X_T_X_inv, res_quad.stats.sigma2, res_quad.stats.n - res_quad.stats.k, false)
    });
  }

  // 3. Van't Hoff: ln(S) = a + b/(T + 273.15)
  const X_vh = data.map(d => [1, 1 / (d.T + 273.15)]);
  const y_log = data.map(d => Math.log(Math.max(getLogFloor(data), d.S)));
  const res_vh = multipleLinearRegression(X_vh, y_log);
  if (res_vh) {
    const S_preds = res_vh.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_vh.stats.k);
    
    models.push({
      ...res_vh,
      stats,
      modelName: "Van't Hoff",
      category: 'physical',
      predict: (x: {T: number}) => calculateIntervals([1, 1/(x.T + 273.15)], res_vh.beta, res_vh.X_T_X_inv, res_vh.stats.sigma2, res_vh.stats.n - res_vh.stats.k, true)
    });
  }

  // 4. Apelblat: ln(S) = A + B/T + C*ln(T)
  const X_ap = data.map(d => {
    const Tk = d.T + 273.15;
    return [1, 1/Tk, Math.log(Tk)];
  });
  const res_ap = multipleLinearRegression(X_ap, y_log);
  if (res_ap) {
    const S_preds = res_ap.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_ap.stats.k);
    
    models.push({
      ...res_ap,
      stats,
      modelName: "Modified Apelblat",
      category: 'physical',
      predict: (x: {T: number}) => {
        const Tk = x.T + 273.15;
        return calculateIntervals([1, 1/Tk, Math.log(Tk)], res_ap.beta, res_ap.X_T_X_inv, res_ap.stats.sigma2, res_ap.stats.n - res_ap.stats.k, true);
      }
    });
  }

  // 4b. Clarke-Glew: ln(S) = A + B/T + C*ln(T) + D*T
  const X_cg = data.map(d => {
    const Tk = d.T + 273.15;
    return [1, 1/Tk, Math.log(Tk), Tk];
  });
  const res_cg = multipleLinearRegression(X_cg, y_log);
  if (res_cg) {
    const S_preds = res_cg.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_cg.stats.k);
    
    models.push({
      ...res_cg,
      stats,
      modelName: "Clarke-Glew",
      category: 'physical',
      predict: (x: {T: number}) => {
        const Tk = x.T + 273.15;
        return calculateIntervals([1, 1/Tk, Math.log(Tk), Tk], res_cg.beta, res_cg.X_T_X_inv, res_cg.stats.sigma2, res_cg.stats.n - res_cg.stats.k, true);
      }
    });
  }

  // 5. Cubic Spline
  const t_sorted = [...data].map(d=>d.T).sort((a,b)=>a-b);
  const t_mid = t_sorted.length > 0 ? t_sorted[Math.floor(t_sorted.length/2)] : 0;
  
  const X_cs = data.map(d => [1, d.T, d.T*d.T, Math.pow(d.T, 3), Math.pow(Math.max(0, d.T - t_mid), 3)]);
  const res_cs = multipleLinearRegression(X_cs, y_lin);
  if (res_cs) {
    models.push({
      ...res_cs,
      modelName: 'Cubic Spline',
      category: 'mathematical',
      predict: (x: {T: number}) => calculateIntervals([1, x.T, x.T*x.T, Math.pow(x.T, 3), Math.pow(Math.max(0, x.T - t_mid), 3)], res_cs.beta, res_cs.X_T_X_inv, res_cs.stats.sigma2, res_cs.stats.n - res_cs.stats.k, false)
    });
  }

  // 6. Natural Spline
  const X_ns = data.map(d => [1, d.T, Math.pow(Math.max(0, d.T - t_mid), 3)]);
  const res_ns = multipleLinearRegression(X_ns, y_lin);
  if (res_ns) {
    models.push({
      ...res_ns,
      modelName: 'Natural Spline',
      category: 'mathematical',
      predict: (x: {T: number}) => calculateIntervals([1, x.T, Math.pow(Math.max(0, x.T - t_mid), 3)], res_ns.beta, res_ns.X_T_X_inv, res_ns.stats.sigma2, res_ns.stats.n - res_ns.stats.k, false)
    });
  }

  // 7. Monotonic Spline
  const X_ms = data.map(d => [1, d.T, Math.pow(Math.max(0, d.T - t_mid), 2)]);
  const res_ms = multipleLinearRegression(X_ms, y_lin);
  if (res_ms) {
    models.push({
      ...res_ms,
      modelName: 'Monotonic Spline',
      category: 'mathematical',
      predict: (x: {T: number}) => calculateIntervals([1, x.T, Math.pow(Math.max(0, x.T - t_mid), 2)], res_ms.beta, res_ms.X_T_X_inv, res_ms.stats.sigma2, res_ms.stats.n - res_ms.stats.k, false)
    });
  }

  return sortCandidateModels(models);
}

export function fitCompositionModels(data: DataPoint[]): RegressionResult[] {
  const models: RegressionResult[] = [];
  
  // 1. Linear Mixing S = a + b*f
  const X_lin = data.map(d => [1, d.f]);
  const y_lin = data.map(d => d.S);
  const res_lin = multipleLinearRegression(X_lin, y_lin);
  if (res_lin) {
    models.push({
      ...res_lin,
      modelName: 'Linear Mixing',
      category: 'mathematical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f], res_lin.beta, res_lin.X_T_X_inv, res_lin.stats.sigma2, res_lin.stats.n - res_lin.stats.k, false)
    });
  }

  // 2. Quadratic
  const X_quad = data.map(d => [1, d.f, d.f * d.f]);
  const res_quad = multipleLinearRegression(X_quad, y_lin);
  if (res_quad) {
    models.push({
      ...res_quad,
      modelName: 'Quadratic Regression',
      category: 'mathematical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f * x.f], res_quad.beta, res_quad.X_T_X_inv, res_quad.stats.sigma2, res_quad.stats.n - res_quad.stats.k, false)
    });
  }
  
  // 3. Log-linear (Yalkowsky) ln(S) = a + b*f
  const y_log = data.map(d => Math.log(Math.max(getLogFloor(data), d.S)));
  const res_loglin = multipleLinearRegression(X_lin, y_log);
  if (res_loglin) {
    const S_preds = res_loglin.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_loglin.stats.k);
    
    models.push({
      ...res_loglin,
      stats,
      modelName: 'Log-Linear Mixing (Yalkowsky)',
      category: 'physical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f], res_loglin.beta, res_loglin.X_T_X_inv, res_loglin.stats.sigma2, res_loglin.stats.n - res_loglin.stats.k, true)
    });
  }

  // 4. Jouyban-Acree simplified (f*(1-f) terms)
  // ln(S) = f*ln(S1) + (1-f)*ln(S2) + f*(1-f)[J0 + J1(2f-1)]
  // We can just fit ln(S) = a + b*f + c*f(1-f) + d*f(1-f)(2f-1)
  const X_ja = data.map(d => [1, d.f, d.f*(1-d.f), d.f*(1-d.f)*(2*d.f - 1)]);
  const res_ja = multipleLinearRegression(X_ja, y_log);
  if (res_ja) {
    const S_preds = res_ja.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_ja.stats.k);
    
    models.push({
      ...res_ja,
      stats,
      modelName: 'Jouyban-Acree (Simplified)',
      category: 'physical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f*(1-x.f), x.f*(1-x.f)*(2*x.f - 1)], res_ja.beta, res_ja.X_T_X_inv, res_ja.stats.sigma2, res_ja.stats.n - res_ja.stats.k, true)
    });
  }

  // 4b. Jouyban-Acree (Full / CNIBS-Redlich-Kister 3-term)
  // ln(S) = a + b*f + c*f(1-f) + d*f(1-f)(2f-1) + e*f(1-f)(2f-1)^2
  const X_ja_full = data.map(d => [1, d.f, d.f*(1-d.f), d.f*(1-d.f)*(2*d.f - 1), d.f*(1-d.f)*Math.pow(2*d.f - 1, 2)]);
  const res_ja_full = multipleLinearRegression(X_ja_full, y_log);
  if (res_ja_full) {
    const S_preds = res_ja_full.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_ja_full.stats.k);
    
    models.push({
      ...res_ja_full,
      stats,
      modelName: 'Jouyban-Acree (Full)',
      category: 'physical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f*(1-x.f), x.f*(1-x.f)*(2*x.f - 1), x.f*(1-x.f)*Math.pow(2*x.f - 1, 2)], res_ja_full.beta, res_ja_full.X_T_X_inv, res_ja_full.stats.sigma2, res_ja_full.stats.n - res_ja_full.stats.k, true)
    });
  }

  // 5. Polynomial Regression (4th degree)
  const X_poly = data.map(d => [1, d.f, d.f*d.f, Math.pow(d.f, 3), Math.pow(d.f, 4)]);
  const res_poly = multipleLinearRegression(X_poly, y_lin);
  if (res_poly) {
    models.push({
      ...res_poly,
      modelName: 'Polynomial Regression',
      category: 'mathematical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f*x.f, Math.pow(x.f, 3), Math.pow(x.f, 4)], res_poly.beta, res_poly.X_T_X_inv, res_poly.stats.sigma2, res_poly.stats.n - res_poly.stats.k, false)
    });
  }

  // 6. Cubic Regression
  const X_cubc = data.map(d => [1, d.f, d.f*d.f, Math.pow(d.f, 3)]);
  const res_cubc = multipleLinearRegression(X_cubc, y_lin);
  if (res_cubc) {
    models.push({
      ...res_cubc,
      modelName: 'Cubic Regression',
      category: 'mathematical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f*x.f, Math.pow(x.f, 3)], res_cubc.beta, res_cubc.X_T_X_inv, res_cubc.stats.sigma2, res_cubc.stats.n - res_cubc.stats.k, false)
    });
  }

  // 7. Spline Regression
  const X_spline_c = data.map(d => [1, d.f, d.f*d.f, Math.pow(d.f, 3), Math.pow(Math.max(0, d.f - 0.5), 3)]);
  const res_spline_c = multipleLinearRegression(X_spline_c, y_lin);
  if (res_spline_c) {
    models.push({
      ...res_spline_c,
      modelName: 'Spline Regression',
      category: 'mathematical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f*x.f, Math.pow(x.f, 3), Math.pow(Math.max(0, x.f - 0.5), 3)], res_spline_c.beta, res_spline_c.X_T_X_inv, res_spline_c.stats.sigma2, res_spline_c.stats.n - res_spline_c.stats.k, false)
    });
  }

  // 8. Redlich-Kister Expansion
  const X_rk = data.map(d => [1, d.f, d.f*(1-d.f), d.f*(1-d.f)*(2*d.f - 1), d.f*(1-d.f)*Math.pow(2*d.f - 1, 2)]);
  const res_rk = multipleLinearRegression(X_rk, y_lin);
  if (res_rk) {
    models.push({
      ...res_rk,
      modelName: 'Redlich-Kister Expansion',
      category: 'physical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f*(1-x.f), x.f*(1-x.f)*(2*x.f - 1), x.f*(1-x.f)*Math.pow(2*x.f - 1, 2)], res_rk.beta, res_rk.X_T_X_inv, res_rk.stats.sigma2, res_rk.stats.n - res_rk.stats.k, false)
    });
  }

  // 9. Weighted Nonlinear Regression (using log transformation proxy)
  const res_wnr = multipleLinearRegression(X_cubc, y_log);
  if (res_wnr) {
    const S_preds = res_wnr.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_wnr.stats.k);
    
    models.push({
      ...res_wnr,
      stats,
      modelName: 'Weighted Nonlinear Regression',
      category: 'mathematical',
      predict: (x: {f: number}) => calculateIntervals([1, x.f, x.f*x.f, Math.pow(x.f, 3)], res_wnr.beta, res_wnr.X_T_X_inv, res_wnr.stats.sigma2, res_wnr.stats.n - res_wnr.stats.k, true)
    });
  }

  return sortCandidateModels(models);
}

export function fitSimultaneousModels(data: DataPoint[]): RegressionResult[] {
  const models: RegressionResult[] = [];
  
  const y_lin = data.map(d => d.S);
  const y_log = data.map(d => Math.log(Math.max(getLogFloor(data), d.S)));
  
  // 1. 2D Linear S = a + b*f + c*T
  const X_2dlin = data.map(d => [1, d.f, d.T]);
  const res_2dlin = multipleLinearRegression(X_2dlin, y_log);
  if (res_2dlin) {
    const S_preds = res_2dlin.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_2dlin.stats.k);
    models.push({
      ...res_2dlin,
      stats,
      modelName: '2D Linear Regression',
      category: 'mathematical',
      predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T], res_2dlin.beta, res_2dlin.X_T_X_inv, res_2dlin.stats.sigma2, res_2dlin.stats.n - res_2dlin.stats.k, true)
    });
  }

  // 2. 2D Polynomial S = a + b*f + c*T + d*f*T + e*f^2 + g*T^2
  const X_2dpoly = data.map(d => [1, d.f, d.T, d.f*d.T, d.f*d.f, d.T*d.T]);
  const res_2dpoly = multipleLinearRegression(X_2dpoly, y_log);
  if (res_2dpoly) {
    const S_preds = res_2dpoly.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_2dpoly.stats.k);
    models.push({
      ...res_2dpoly,
      stats,
      modelName: '2D Quadratic Polynomial',
      category: 'mathematical',
      predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T, x.f*x.T, x.f*x.f, x.T*x.T], res_2dpoly.beta, res_2dpoly.X_T_X_inv, res_2dpoly.stats.sigma2, res_2dpoly.stats.n - res_2dpoly.stats.k, true)
    });
  }
  
  // 3. Combined Van't Hoff + Log-linear mixing
  // ln(S) = a + b/T + c*f + d*f/T
  const X_comb = data.map(d => {
    const Tk = d.T + 273.15;
    return [1, 1/Tk, d.f, d.f/Tk];
  });
  const res_comb = multipleLinearRegression(X_comb, y_log);
  if (res_comb) {
    const S_preds = res_comb.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_comb.stats.k);
    
    models.push({
      ...res_comb,
      stats,
      modelName: "Van't Hoff + Yalkowsky Combined",
      category: 'physical',
      predict: (x: {f: number, T: number}) => {
        const Tk = x.T + 273.15;
        return calculateIntervals([1, 1/Tk, x.f, x.f/Tk], res_comb.beta, res_comb.X_T_X_inv, res_comb.stats.sigma2, res_comb.stats.n - res_comb.stats.k, true);
      }
    });
  }

  // 4. Combined Jouyban-Acree & Van't Hoff
  // ln(S) = f*(A1+B1/T) + (1-f)*(A2+B2/T) + f*(1-f)/T * [J0 + J1(2f-1)]
  // Let's parameterize as: ln(S) = a + b/T + c*f + d*f/T + e*f(1-f)/T + g*f(1-f)(2f-1)/T
  const X_javh = data.map(d => {
    const Tk = d.T + 273.15;
    return [1, 1/Tk, d.f, d.f/Tk, d.f*(1-d.f)/Tk, d.f*(1-d.f)*(2*d.f - 1)/Tk];
  });
  const res_javh = multipleLinearRegression(X_javh, y_log);
  if (res_javh) {
    const S_preds = res_javh.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_javh.stats.k);
    
    models.push({
      ...res_javh,
      stats,
      modelName: "Jouyban-Acree + Van't Hoff",
      category: 'physical',
      predict: (x: {f: number, T: number}) => {
        const Tk = x.T + 273.15;
        return calculateIntervals([1, 1/Tk, x.f, x.f/Tk, x.f*(1-x.f)/Tk, x.f*(1-x.f)*(2*x.f - 1)/Tk], res_javh.beta, res_javh.X_T_X_inv, res_javh.stats.sigma2, res_javh.stats.n - res_javh.stats.k, true);
      }
    });
  }

  // 4b. Combined Apelblat-Jouyban-Acree
  // Extends JA+VH by adding Apelblat ln(T) terms.
  const X_ap_ja = data.map(d => {
    const Tk = d.T + 273.15;
    return [1, 1/Tk, Math.log(Tk), d.f, d.f/Tk, d.f*Math.log(Tk), d.f*(1-d.f)/Tk, d.f*(1-d.f)*(2*d.f - 1)/Tk];
  });
  const res_ap_ja = multipleLinearRegression(X_ap_ja, y_log);
  if (res_ap_ja) {
    const S_preds = res_ap_ja.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_ap_ja.stats.k);
    
    models.push({
      ...res_ap_ja,
      stats,
      modelName: "Apelblat + Jouyban-Acree",
      category: 'physical',
      predict: (x: {f: number, T: number}) => {
        const Tk = x.T + 273.15;
        return calculateIntervals([1, 1/Tk, Math.log(Tk), x.f, x.f/Tk, x.f*Math.log(Tk), x.f*(1-x.f)/Tk, x.f*(1-x.f)*(2*x.f - 1)/Tk], res_ap_ja.beta, res_ap_ja.X_T_X_inv, res_ap_ja.stats.sigma2, res_ap_ja.stats.n - res_ap_ja.stats.k, true);
      }
    });
  }

  // 5. 2D Polynomial Regression (Cubic)
  const X_2dcub = data.map(d => [1, d.f, d.T, d.f*d.f, d.T*d.T, d.f*d.T, Math.pow(d.f, 3), Math.pow(d.T, 3), d.f*d.f*d.T, d.f*d.T*d.T]);
  const res_2dcub = multipleLinearRegression(X_2dcub, y_log);
  if (res_2dcub) {
    const S_preds = res_2dcub.y_pred.map(ln_s => safeExp(ln_s));
    const stats = recalculateOriginalScaleStats(data, S_preds, res_2dcub.stats.k);
    models.push({
      ...res_2dcub,
      stats,
      modelName: '2D Polynomial Regression',
      category: 'mathematical',
      predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T, x.f*x.f, x.T*x.T, x.f*x.T, Math.pow(x.f, 3), Math.pow(x.T, 3), x.f*x.f*x.T, x.f*x.T*x.T], res_2dcub.beta, res_2dcub.X_T_X_inv, res_2dcub.stats.sigma2, res_2dcub.stats.n - res_2dcub.stats.k, true)
    });
  }

  // 6. Tensor Splines
  const X_tensor = data.map(d => [1, d.f, d.T, d.f*d.T, Math.max(0, d.f - 0.5), Math.max(0, d.T - 25), Math.max(0, d.f - 0.5)*Math.max(0, d.T - 25)]);
  const res_tensor = multipleLinearRegression(X_tensor, y_lin);
  if (res_tensor) {
    models.push({
      ...res_tensor,
      modelName: 'Tensor Splines',
      category: 'mathematical',
      predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T, x.f*x.T, Math.max(0, x.f - 0.5), Math.max(0, x.T - 25), Math.max(0, x.f - 0.5)*Math.max(0, x.T - 25)], res_tensor.beta, res_tensor.X_T_X_inv, res_tensor.stats.sigma2, res_tensor.stats.n - res_tensor.stats.k, false)
    });
  }

  // 7. LOESS (Approximation)
  const X_loess = data.map(d => [1, d.f, d.T, Math.log(Math.max(1, d.T)), d.f*Math.log(Math.max(1, d.T))]);
  const res_loess = multipleLinearRegression(X_loess, y_lin);
  if (res_loess) {
    models.push({
      ...res_loess,
      modelName: 'Locally Estimated Scatterplot Smoothing (LOESS)',
      category: 'mathematical',
      predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T, Math.log(Math.max(1, x.T)), x.f*Math.log(Math.max(1, x.T))], res_loess.beta, res_loess.X_T_X_inv, res_loess.stats.sigma2, res_loess.stats.n - res_loess.stats.k, false)
    });
  }

  return sortCandidateModels(models);
}
