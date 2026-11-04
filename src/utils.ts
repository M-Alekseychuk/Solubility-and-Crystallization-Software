export function calculateLinearRegression(points: { x: number; y: number }[], forceZero: boolean = false) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0, valid: false };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    sumX += points[i].x;
    sumY += points[i].y;
    sumXY += points[i].x * points[i].y;
    sumXX += points[i].x * points[i].x;
  }

  let slope = 0;
  let intercept = 0;

  if (forceZero) {
    if (sumXX === 0) return { slope: 0, intercept: 0, rSquared: 0, valid: false };
    slope = sumXY / sumXX;
    intercept = 0;
  } else {
    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) return { slope: 0, intercept: 0, rSquared: 0, valid: false };
    slope = (n * sumXY - sumX * sumY) / denominator;
    intercept = (sumY - slope * sumX) / n;
  }

  // Calculate R-squared
  const meanY = sumY / n;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const predictedY = slope * points[i].x + intercept;
    ssTot += Math.pow(points[i].y - meanY, 2);
    ssRes += Math.pow(points[i].y - predictedY, 2);
  }

  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared, valid: true };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function roundTo(num: number, decimals: number = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round(num * factor) / factor;
}

export function getExportFileName(experimentName?: string, extension?: string): string {
  const baseName = (experimentName || 'Untitled')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');
  const fileName = `${baseName}_Solubility_Export`;
  if (extension) {
    const ext = extension.startsWith('.') ? extension.slice(1) : extension;
    return `${fileName}.${ext}`;
  }
  return fileName;
}
