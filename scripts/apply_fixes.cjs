const fs = require('fs');

// 1. Fix PredictionTab.tsx to default to 3D View
let pt = fs.readFileSync('src/components/PredictionTab.tsx', 'utf8');
pt = pt.replace('const [is3DView, setIs3DView] = useState(false);', 'const [is3DView, setIs3DView] = useState(true);');
fs.writeFileSync('src/components/PredictionTab.tsx', pt);

// 2. Fix models.ts to use log-space for 2D generic models to prevent negative solubility (and fix ridge penalty)
let mt = fs.readFileSync('src/utils/models.ts', 'utf8');

// Use y_log instead of y_lin
mt = mt.replace(/const res_2dlin = multipleLinearRegression\(X_2dlin, y_lin\);/g, 'const res_2dlin = multipleLinearRegression(X_2dlin, y_log);');
mt = mt.replace(/const res_2dpoly = multipleLinearRegression\(X_2dpoly, y_lin\);/g, 'const res_2dpoly = multipleLinearRegression(X_2dpoly, y_log);');
mt = mt.replace(/const res_2dcub = multipleLinearRegression\(X_2dcub, y_lin\);/g, 'const res_2dcub = multipleLinearRegression(X_2dcub, y_log);');

// Change isLog to true in calculateIntervals calls
mt = mt.replace(/predict: \(x: \{f: number, T: number\}\) => calculateIntervals\(\[1, x\.f, x\.T\], res_2dlin\.beta, res_2dlin\.X_T_X_inv, res_2dlin\.stats\.sigma2, res_2dlin\.stats\.n - res_2dlin\.stats\.k, false\)/g, 
'predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T], res_2dlin.beta, res_2dlin.X_T_X_inv, res_2dlin.stats.sigma2, res_2dlin.stats.n - res_2dlin.stats.k, true)');

mt = mt.replace(/predict: \(x: \{f: number, T: number\}\) => calculateIntervals\(\[1, x\.f, x\.T, x\.f\*x\.T, x\.f\*x\.f, x\.T\*x\.T\], res_2dpoly\.beta, res_2dpoly\.X_T_X_inv, res_2dpoly\.stats\.sigma2, res_2dpoly\.stats\.n - res_2dpoly\.stats\.k, false\)/g, 
'predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T, x.f*x.T, x.f*x.f, x.T*x.T], res_2dpoly.beta, res_2dpoly.X_T_X_inv, res_2dpoly.stats.sigma2, res_2dpoly.stats.n - res_2dpoly.stats.k, true)');

mt = mt.replace(/predict: \(x: \{f: number, T: number\}\) => calculateIntervals\(\[1, x\.f, x\.T, x\.f\*x\.f, x\.T\*x\.T, x\.f\*x\.T, Math\.pow\(x\.f, 3\), Math\.pow\(x\.T, 3\), x\.f\*x\.f\*x\.T, x\.f\*x\.T\*x\.T\], res_2dcub\.beta, res_2dcub\.X_T_X_inv, res_2dcub\.stats\.sigma2, res_2dcub\.stats\.n - res_2dcub\.stats\.k, false\)/g, 
'predict: (x: {f: number, T: number}) => calculateIntervals([1, x.f, x.T, x.f*x.f, x.T*x.T, x.f*x.T, Math.pow(x.f, 3), Math.pow(x.T, 3), x.f*x.f*x.T, x.f*x.T*x.T], res_2dcub.beta, res_2dcub.X_T_X_inv, res_2dcub.stats.sigma2, res_2dcub.stats.n - res_2dcub.stats.k, true)');

// Fix ridge regression intercept penalty
const ridgeOld = `    // Stronger Ridge penalty (Tikhonov) to forcefully suppress explosive coefficients in polynomials/logs
    const lambda = 0.05; 
    for (let i = 0; i < k; i++) {
      X_T_X_arr[i][i] += lambda;
    }`;
    
const ridgeNew = `    // Adaptive Ridge penalty (Tikhonov) to suppress explosive coefficients while preserving intercept
    let lambda = 0.05;
    if (k > 5) lambda = 0.1;
    if (n - k < 5) lambda = 0.5;

    for (let i = 0; i < k; i++) {
      // Don't penalize intercept
      if (stds[i] === 1 && means[i] === 0 && X[0][i] === 1) continue;
      X_T_X_arr[i][i] += lambda;
    }`;
mt = mt.replace(ridgeOld, ridgeNew);

fs.writeFileSync('src/utils/models.ts', mt);

// 3. Fix htmlExport.ts for the 2D models
let ht = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

// Block 1: calculatePrediction
ht = ht.replace(/else if \(modelName\.includes\('2D Linear Regression'\)\) \{\n                features = \[1, f, T\];\n            \}/g, 
"else if (modelName.includes('2D Linear Regression')) {\n                features = [1, f, T];\n                isLog = true;\n            }");

ht = ht.replace(/else if \(modelName\.includes\('2D Quadratic Polynomial'\)\) \{\n                features = \[1, f, T, f\*T, f\*f, T\*T\];\n            \}/g, 
"else if (modelName.includes('2D Quadratic Polynomial')) {\n                features = [1, f, T, f*T, f*f, T*T];\n                isLog = true;\n            }");

ht = ht.replace(/else if \(modelName\.includes\('2D Polynomial Regression'\)\) \{\n                features = \[1, f, T, f\*f, T\*T, f\*T, Math\.pow\(f, 3\), Math\.pow\(T, 3\), f\*f\*T, f\*T\*T\];\n            \}/g, 
"else if (modelName.includes('2D Polynomial Regression')) {\n                features = [1, f, T, f*f, T*T, f*T, Math.pow(f, 3), Math.pow(T, 3), f*f*T, f*T*T];\n                isLog = true;\n            }");

// Block 2: calculatePredFor
ht = ht.replace(/else if \(modelName\.includes\('2D Linear Regression'\)\) \{ features = \[1, f, T\]; \}/g, 
"else if (modelName.includes('2D Linear Regression')) { features = [1, f, T]; isLog = true; }");

ht = ht.replace(/else if \(modelName\.includes\('2D Quadratic Polynomial'\)\) \{ features = \[1, f, T, f\*T, f\*f, T\*T\]; \}/g, 
"else if (modelName.includes('2D Quadratic Polynomial')) { features = [1, f, T, f*T, f*f, T*T]; isLog = true; }");

ht = ht.replace(/else if \(modelName\.includes\('2D Polynomial Regression'\)\) \{ features = \[1, f, T, f\*f, T\*T, f\*T, Math\.pow\(f, 3\), Math\.pow\(T, 3\), f\*f\*T, f\*T\*T\]; \}/g, 
"else if (modelName.includes('2D Polynomial Regression')) { features = [1, f, T, f*f, T*T, f*T, Math.pow(f, 3), Math.pow(T, 3), f*f*T, f*T*T]; isLog = true; }");

fs.writeFileSync('src/utils/htmlExport.ts', ht);

console.log('Fixes applied.');
