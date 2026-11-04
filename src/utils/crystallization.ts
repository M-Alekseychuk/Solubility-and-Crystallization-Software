import { SampleData, CalibrationResult } from '../types';
import { fitTemperatureModels, fitCompositionModels, fitSimultaneousModels, RegressionResult } from './models';
import { enrichSamplesWithConcentration } from './calculations';

export interface SeedingParams {
  targetS: number; // e.g. 1.10
  seedLoadingPct: number; // wt% relative to batch API, e.g. 2.0%
  seedD50Um: number; // particle size D50 in microns, e.g. 25 um
  mszwScrit: number; // critical supersaturation limit, e.g. 1.30
  agingTimeMin: number; // seed aging hold time in minutes, e.g. 45 min
  crystalDensity: number; // g/cm^3, default 1.25
}

export interface SeedingResult {
  saturationT: number | null;
  saturationAntiSolventVol: number | null;
  saturationSolvent1Fraction: number | null;
  
  seedingT: number | null;
  seedingAntiSolventVol: number | null;
  seedingSolvent1Fraction: number | null;
  seedingSubcoolingT: number | null; // T_sat - T_seed
  seedingProgressPct: number; // 0 to 100%
  
  seedMassG: number;
  seedMassMg: number;
  totalBatchWithSeedG: number;
  
  specificSurfaceAreaM2g: number;
  totalSurfaceAreaM2: number;
  volumetricSurfaceAreaM2L: number;
  
  status: 'optimal' | 'undersaturated_risk' | 'labile_risk' | 'out_of_range';
  statusMessage: string;
  recommendedHoldMin: number;
}

export interface PhaseDiagramPoint {
  x: number; // Temperature (°C) or Solvent 1 Fraction (%)
  cStar: number; // Equilibrium solubility (mg/mL)
  cCrit: number; // Metastable boundary (mg/mL)
  metastableDelta: number; // cCrit - cStar for area fill
  cBatch?: number; // Controlled cubic operating trajectory
  cBatchLinear?: number; // Uncontrolled linear operating trajectory
  S?: number;
  SLinear?: number;
  stage?: string;
  isTrajectoryNode?: boolean;
}

export interface BatchTrajectoryPoint {
  x: number;
  cBatch: number;
  cBatchLinear?: number;
  cStar: number;
  cCrit: number;
  S: number;
  SLinear?: number;
  stage: 'undersaturated' | 'metastable_cooling' | 'seeding' | 'growth' | 'endpoint';
  stepPct: number;
  label?: string;
}

export interface MilestoneMarker {
  name: string;
  x: number;
  y: number;
  s: number;
  color: string;
  description: string;
}

const parseNumeric = (val: any): number => {
  if (val === null || val === undefined || val === '') return NaN;
  const str = String(val).replace(',', '.').trim();
  const n = Number(str);
  return isNaN(n) ? NaN : n;
};

/**
 * Auto-detect and fit the best model from experiment samples if PredictionTab has not been visited.
 */
export function autoFitModelFromExperiment(
  samples: SampleData[],
  calibrationResult: CalibrationResult,
  preferredSolvent1?: string,
  preferredSolvent2?: string
): {
  model: RegressionResult | null;
  models: RegressionResult[];
  predictionTask: 'temperature' | 'composition' | 'simultaneous' | null;
  selectedSolvent1: string;
  selectedSolvent2: string;
} {
  const enriched = enrichSamplesWithConcentration(samples, calibrationResult);

  // Find default or available solvents
  const sampleWithSolvent = samples.find(s => s.solvent1);
  const s1 = preferredSolvent1?.trim() || sampleWithSolvent?.solvent1 || 'Solvent 1';
  const s2 = preferredSolvent2 !== undefined ? preferredSolvent2.trim() : (sampleWithSolvent?.solvent2 || '');

  // Filter dataset by solvents if samples contain multiple solvent pairs
  const normS1 = s1.toLowerCase();
  const normS2 = s2.toLowerCase();

  const filteredSamples = enriched.filter(s => {
    const sampleS1 = (s.solvent1 || '').trim().toLowerCase();
    const sampleS2 = (s.solvent2 || '').trim().toLowerCase();
    const frac = parseNumeric(s.solvent1Fraction);
    const rawFrac = isNaN(frac) ? 100 : frac;

    if (!normS1) return true;

    if (!normS2) {
      if (sampleS1 === normS1 && (sampleS2 === '' || sampleS2 === normS1 || rawFrac === 100)) return true;
      if (sampleS2 === normS1 && (sampleS1 === '' || rawFrac === 0)) return true;
      return false;
    }

    if ((sampleS1 === normS1 && sampleS2 === normS2) || (sampleS1 === normS2 && sampleS2 === normS1)) return true;
    if (sampleS1 === normS1 && (sampleS2 === '' || rawFrac === 100)) return true;
    if (sampleS2 === normS1 && (sampleS1 === '' || rawFrac === 0)) return true;
    if (sampleS1 === normS2 && (sampleS2 === '' || rawFrac === 100)) return true;
    if (sampleS2 === normS2 && (sampleS1 === '' || rawFrac === 0)) return true;
    return false;
  });

  const datasetToUse = filteredSamples.length > 0 ? filteredSamples : enriched;

  const rawValidData = datasetToUse
    .map(s => {
      const tempC = parseNumeric(s.temperature);
      const frac = parseNumeric(s.solvent1Fraction);
      const f = !isNaN(frac) ? frac / 100 : 1;
      const conc = s.rawReactionConc;
      return {
        T: tempC,
        f: Math.max(0, Math.min(1, f)),
        S: conc !== null && conc !== undefined && !isNaN(conc) ? Math.max(0, conc) : NaN
      };
    })
    .filter(d => !isNaN(d.T) && !isNaN(d.f) && !isNaN(d.S) && d.S > 0);

  if (rawValidData.length === 0) {
    return { model: null, models: [], predictionTask: null, selectedSolvent1: s1, selectedSolvent2: s2 };
  }

  const uniqueT = new Set(rawValidData.map(d => d.T)).size;
  const uniqueF = new Set(rawValidData.map(d => d.f)).size;

  let task: 'temperature' | 'composition' | 'simultaneous' | null = null;
  if (uniqueT > 1 && uniqueF > 1) {
    task = 'simultaneous';
  } else if (uniqueT > 1) {
    task = 'temperature';
  } else if (uniqueF > 1) {
    task = 'composition';
  }

  let models: RegressionResult[] = [];
  if (task === 'temperature') models = fitTemperatureModels(rawValidData);
  else if (task === 'composition') models = fitCompositionModels(rawValidData);
  else if (task === 'simultaneous') models = fitSimultaneousModels(rawValidData);

  return {
    model: models[0] || null,
    models,
    predictionTask: task,
    selectedSolvent1: s1,
    selectedSolvent2: s2
  };
}

/**
 * Computes exact seeding parameters, saturation point, seed loading, and particle area.
 */
export function calculateSeedingStrategy(
  getSolubility: (T: number, f: number) => number,
  task: 'temperature' | 'composition' | 'simultaneous',
  apiMassG: number,
  initVolMl: number,
  tStart: number,
  tFinal: number,
  fStart: number,
  fFinal: number,
  totalAddedAntiSolvent: number,
  vPrimary: number,
  seedingParams: SeedingParams
): SeedingResult {
  const { targetS, seedLoadingPct, seedD50Um, mszwScrit, agingTimeMin, crystalDensity } = seedingParams;
  const apiMassMg = apiMassG * 1000;
  const c0 = apiMassMg / initVolMl;

  // Mass calculations
  const seedMassG = apiMassG * (seedLoadingPct / 100);
  const seedMassMg = seedMassG * 1000;
  const totalBatchWithSeedG = apiMassG + seedMassG;

  // Specific surface area calculation (m^2/g)
  // A_spec = 6 / (rho * d) where rho in g/m^3 (rho_cm * 1e6), d in m (d_um * 1e-6)
  // rho * d = rho_cm * d_um
  // A_spec = 6 / (crystalDensity * seedD50Um) [m^2/g]
  const specificSurfaceAreaM2g = seedD50Um > 0 && crystalDensity > 0
    ? 6 / (crystalDensity * seedD50Um)
    : 0;
  const totalSurfaceAreaM2 = seedMassG * specificSurfaceAreaM2g;
  const volumetricSurfaceAreaM2L = (initVolMl / 1000) > 0 ? totalSurfaceAreaM2 / (initVolMl / 1000) : 0;

  let saturationT: number | null = null;
  let saturationAntiSolventVol: number | null = null;
  let saturationSolvent1Fraction: number | null = null;

  let seedingT: number | null = null;
  let seedingAntiSolventVol: number | null = null;
  let seedingSolvent1Fraction: number | null = null;
  let seedingSubcoolingT: number | null = null;
  let seedingProgressPct = 0;

  // 1. Temperature-driven crystallization
  if (task === 'temperature') {
    const minT = Math.min(tStart, tFinal);
    const maxT = Math.max(tStart, tFinal);
    const steps = 300;
    const stepSize = (maxT - minT) / steps;

    // Search for T_sat where C*(T) = c0 (from high T downwards)
    let prevDiffSat: number | null = null;
    let prevDiffSeed: number | null = null;
    const targetCSeed = c0 / targetS;

    for (let i = steps; i >= 0; i--) {
      const T = minT + i * stepSize;
      const cStar = getSolubility(T, 100);

      // Saturation (C* = c0)
      const diffSat = cStar - c0;
      if (prevDiffSat !== null && diffSat * prevDiffSat <= 0 && saturationT === null) {
        saturationT = Math.round(T * 10) / 10;
      }
      prevDiffSat = diffSat;

      // Seeding (C* = c0 / targetS)
      const diffSeed = cStar - targetCSeed;
      if (prevDiffSeed !== null && diffSeed * prevDiffSeed <= 0 && seedingT === null) {
        seedingT = Math.round(T * 10) / 10;
      }
      prevDiffSeed = diffSeed;
    }

    if (saturationT !== null && seedingT !== null) {
      seedingSubcoolingT = Math.max(0, Math.round((saturationT - seedingT) * 10) / 10);
      const totalDeltaT = tStart - tFinal;
      if (Math.abs(totalDeltaT) > 0.001) {
        seedingProgressPct = Math.max(0, Math.min(100, Math.round(((tStart - seedingT) / totalDeltaT) * 100)));
      }
    }
  } 
  // 2. Anti-solvent or Simultaneous crystallization
  else {
    const steps = 300;
    let prevDiffSat: number | null = null;
    let prevDiffSeed: number | null = null;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps; // 0 to 1
      const T = tStart + progress * (tFinal - tStart);
      const vAdd = progress * totalAddedAntiSolvent;
      const vTot = initVolMl + vAdd;
      const f = (vPrimary / vTot) * 100;

      const cBatch = apiMassMg / vTot;
      const cStar = getSolubility(T, f);
      const S = cStar > 0 ? cBatch / cStar : 0;

      // Saturation (S = 1.0)
      const diffSat = S - 1.0;
      if (prevDiffSat !== null && diffSat * prevDiffSat <= 0 && saturationAntiSolventVol === null) {
        saturationAntiSolventVol = Math.round(vAdd * 10) / 10;
        saturationT = Math.round(T * 10) / 10;
        saturationSolvent1Fraction = Math.round(f * 10) / 10;
      }
      prevDiffSat = diffSat;

      // Seeding (S = targetS)
      const diffSeed = S - targetS;
      if (prevDiffSeed !== null && diffSeed * prevDiffSeed <= 0 && seedingAntiSolventVol === null) {
        seedingAntiSolventVol = Math.round(vAdd * 10) / 10;
        seedingT = Math.round(T * 10) / 10;
        seedingSolvent1Fraction = Math.round(f * 10) / 10;
        seedingProgressPct = Math.round(progress * 100);
      }
      prevDiffSeed = diffSeed;
    }

    if (saturationT !== null && seedingT !== null) {
      seedingSubcoolingT = Math.max(0, Math.round((saturationT - seedingT) * 10) / 10);
    }
  }

  // Diagnostic Status and Feasibility Evaluation
  let status: 'optimal' | 'undersaturated_risk' | 'labile_risk' | 'out_of_range' = 'optimal';
  let statusMessage = 'Optimal Seeding Window: Controlled secondary nucleation & high crystalline uniformity.';

  const cStarStart = getSolubility(tStart, fStart);
  const startS = cStarStart > 0 ? c0 / cStarStart : 1.0;

  if (startS > 1.05) {
    status = 'labile_risk';
    statusMessage = `Warning: Initial batch is already supersaturated (S₀ = ${startS.toFixed(2)}). Ensure complete thermal dissolution before starting.`;
  } else if (targetS <= 1.0) {
    status = 'undersaturated_risk';
    statusMessage = 'Critical Alert: Target S ≤ 1.0! Seed crystals will completely dissolve in the undersaturated solution.';
  } else if (targetS >= mszwScrit) {
    status = 'labile_risk';
    statusMessage = `Warning: Target S (${targetS.toFixed(2)}) is near/above critical MSZW limit (${mszwScrit.toFixed(2)}). Risk of uncontrolled primary nucleation.`;
  } else if ((task === 'temperature' && seedingT === null) || (task !== 'temperature' && seedingAntiSolventVol === null)) {
    status = 'out_of_range';
    statusMessage = `Target supersaturation S = ${targetS.toFixed(2)} is not reached within the specified process range. Expand cooling or anti-solvent volume.`;
  }

  return {
    saturationT,
    saturationAntiSolventVol,
    saturationSolvent1Fraction,
    seedingT,
    seedingAntiSolventVol,
    seedingSolvent1Fraction,
    seedingSubcoolingT,
    seedingProgressPct,
    seedMassG,
    seedMassMg,
    totalBatchWithSeedG,
    specificSurfaceAreaM2g,
    totalSurfaceAreaM2,
    volumetricSurfaceAreaM2L,
    status,
    statusMessage,
    recommendedHoldMin: agingTimeMin
  };
}

/**
 * Generates the full equilibrium solubility curve and metastable limit curve for Phase Diagram overlay.
 */
export function generatePhaseDiagram(
  getSolubility: (T: number, f: number) => number,
  task: 'temperature' | 'composition' | 'simultaneous',
  tStart: number,
  tFinal: number,
  fStart: number,
  fFinal: number,
  mszwScrit: number,
  batchC0: number,
  seedingT: number | null,
  seedingAntiSolventVol: number | null,
  saturationT: number | null,
  cFinal: number
): {
  phaseCurve: PhaseDiagramPoint[];
  trajectory: BatchTrajectoryPoint[];
  markers: MilestoneMarker[];
  xLabel: string;
  xUnit: string;
} {
  const phaseCurve: PhaseDiagramPoint[] = [];
  const trajectory: BatchTrajectoryPoint[] = [];
  const markers: MilestoneMarker[] = [];

  const isTempAxis = task === 'temperature' || task === 'simultaneous';
  const xLabel = isTempAxis ? 'Temperature' : 'Primary Solvent Fraction';
  const xUnit = isTempAxis ? '°C' : '%';

  // 1. Determine exact domain boundaries and collect all milestone / sampling X coordinates
  const xCoordSet = new Set<number>();

  if (isTempAxis) {
    const pMin = Math.min(tStart, tFinal);
    const pMax = Math.max(tStart, tFinal);
    const axisMin = pMin >= 10 ? Math.floor(pMin / 10) * 10 : 0;
    const axisMax = Math.ceil(pMax / 10) * 10;

    // Regular uniform grid (step 1°C for high resolution)
    const step = 1.0;
    for (let t = axisMin; t <= axisMax + 0.001; t += step) {
      xCoordSet.add(Math.round(t * 10) / 10);
    }

    // Critical milestone exact coordinates
    xCoordSet.add(Math.round(tStart * 10) / 10);
    xCoordSet.add(Math.round(tFinal * 10) / 10);
    if (saturationT !== null && saturationT >= axisMin && saturationT <= axisMax) {
      xCoordSet.add(Math.round(saturationT * 10) / 10);
    }
    if (seedingT !== null && seedingT >= axisMin && seedingT <= axisMax) {
      xCoordSet.add(Math.round(seedingT * 10) / 10);
    }
  } else {
    // Pure composition axis (Solvent 1 fraction %)
    const pMin = Math.min(fStart, fFinal);
    const pMax = Math.max(fStart, fFinal);
    const axisMin = Math.max(0, Math.floor(pMin / 10) * 10);
    const axisMax = Math.min(100, Math.ceil(pMax / 10) * 10);

    const step = 1.0;
    for (let f = axisMin; f <= axisMax + 0.001; f += step) {
      xCoordSet.add(Math.round(f * 10) / 10);
    }
    xCoordSet.add(Math.round(fStart * 10) / 10);
    xCoordSet.add(Math.round(fFinal * 10) / 10);
  }

  const sortedX = Array.from(xCoordSet).sort((a, b) => a - b);

  // 2. Generate Phase Curve Points & Batch Operating Trajectories
  const seedX = isTempAxis ? seedingT : null;
  const satX = isTempAxis ? saturationT : null;
  const minOperatingX = isTempAxis ? Math.min(tStart, tFinal) : Math.min(fStart, fFinal);
  const maxOperatingX = isTempAxis ? Math.max(tStart, tFinal) : Math.max(fStart, fFinal);

  // Compute seed supersaturation S_seed
  let seedS = 1.10;
  if (isTempAxis && seedingT !== null) {
    const cStarSeed = getSolubility(seedingT, fStart);
    if (cStarSeed > 0) seedS = batchC0 / cStarSeed;
  }

  sortedX.forEach(x => {
    // Determine coupled T and f for solubility evaluation
    let T = x;
    let f = 100;

    if (isTempAxis) {
      T = x;
      if (task === 'simultaneous') {
        const ratio = Math.abs(tStart - tFinal) > 0 ? (tStart - T) / (tStart - tFinal) : 0;
        const clampedRatio = Math.max(0, Math.min(1, ratio));
        f = fStart + clampedRatio * (fFinal - fStart);
      } else {
        f = fStart;
      }
    } else {
      T = tStart;
      f = x;
    }

    const cStar = getSolubility(T, f);
    const cCrit = cStar * mszwScrit;
    const metastableDelta = Math.max(0, cCrit - cStar);

    // Check if within the operating window of the batch
    const inBatchRange = x >= minOperatingX - 0.001 && x <= maxOperatingX + 0.001;

    let cBatch: number | undefined = undefined;
    let cBatchLinear: number | undefined = undefined;
    let S: number | undefined = undefined;
    let SLinear: number | undefined = undefined;
    let stage: BatchTrajectoryPoint['stage'] | undefined = undefined;

    if (inBatchRange) {
      // Is current point in the pre-seeding cooling stage?
      // In cooling, tStart > tFinal, so pre-seeding is for T >= seedingT.
      const isPreSeeding = isTempAxis
        ? (seedX !== null ? (tStart >= tFinal ? x >= seedX - 0.001 : x <= seedX + 0.001) : x >= (tStart + tFinal) / 2)
        : x >= (fStart + fFinal) / 2;

      if (isPreSeeding) {
        // Pre-seeding: Homogeneous solution, NO crystal seeds present yet.
        // Concentration in solution is STRICTLY CONSTANT at batchC0!
        cBatch = batchC0;
        cBatchLinear = batchC0;
        S = cStar > 0 ? Number((batchC0 / cStar).toFixed(2)) : 1.0;
        SLinear = S;
        if (satX !== null) {
          stage = (tStart >= tFinal ? x > satX : x < satX) ? 'undersaturated' : 'metastable_cooling';
        } else {
          stage = cBatch <= cStar ? 'undersaturated' : 'metastable_cooling';
        }
      } else {
        // Seeded growth stage: Seeds grow, consuming solute down towards equilibrium
        const growthSpan = isTempAxis && seedX !== null ? Math.abs(tFinal - seedX) : Math.abs(fFinal - fStart) * 0.5;
        const prog = isTempAxis && seedX !== null && growthSpan > 0
          ? Math.abs(seedX - x) / growthSpan
          : 0.5;
        const xi = Math.max(0, Math.min(1, prog)); // 0 (at seeding) to 1 (at isolation endpoint)

        // Controlled Profile: Seeds consume supersaturation stably, staying inside safe MSZW corridor
        let S_controlled: number;
        if (xi <= 0.85) {
          S_controlled = seedS - 0.015 * Math.sin(xi * Math.PI);
        } else {
          const u = (xi - 0.85) / 0.15;
          S_controlled = 1.00 + (seedS - 1.00) * (1 - u * u);
        }

        cBatch = Number((cStar * S_controlled).toFixed(2));
        S = Number(S_controlled.toFixed(2));
        stage = xi > 0.95 ? 'endpoint' : 'growth';

        // Uncontrolled Linear Profile: Rapid constant cooling generates supersaturation faster than initial seed area
        // can consume, causing trajectory to excursion above C_crit into the Labile Zone!
        let S_lin: number;
        const peakS = Math.min(1.42, mszwScrit + 0.06);
        if (xi <= 0.35) {
          const u = xi / 0.35;
          S_lin = seedS + (peakS - seedS) * Math.sin((u * Math.PI) / 2);
        } else if (xi <= 0.85) {
          const v = (xi - 0.35) / 0.50;
          const endS = seedS - 0.02;
          S_lin = endS + (peakS - endS) * Math.cos((v * Math.PI) / 2);
        } else {
          const w = (xi - 0.85) / 0.15;
          const endS = seedS - 0.02;
          S_lin = 1.00 + (endS - 1.00) * (1 - w * w);
        }

        cBatchLinear = Number((cStar * S_lin).toFixed(2));
        SLinear = Number(S_lin.toFixed(2));
      }
    }

    const point: PhaseDiagramPoint = {
      x,
      cStar: Math.round(cStar * 100) / 100,
      cCrit: Math.round(cCrit * 100) / 100,
      metastableDelta: Math.round(metastableDelta * 100) / 100,
      cBatch,
      cBatchLinear,
      S,
      SLinear,
      stage,
      isTrajectoryNode: inBatchRange
    };

    phaseCurve.push(point);

    if (inBatchRange && cBatch !== undefined && S !== undefined && stage !== undefined) {
      trajectory.push({
        x,
        cBatch,
        cBatchLinear,
        cStar: point.cStar,
        cCrit: point.cCrit,
        S,
        SLinear,
        stage,
        stepPct: Math.round((Math.abs(x - tStart) / Math.max(1, Math.abs(tFinal - tStart))) * 100)
      });
    }
  });

  // 3. Exact Milestone Markers
  // Marker 1: Initial State (dissolved charge at starting condition)
  const cStarStart = getSolubility(tStart, fStart);
  markers.push({
    name: 'Initial State',
    x: isTempAxis ? tStart : fStart,
    y: batchC0,
    s: cStarStart > 0 ? Number((batchC0 / cStarStart).toFixed(2)) : 1.0,
    color: '#0284c7', // sky-600
    description: `Clear homogeneous solution charged at ${isTempAxis ? `${tStart}°C` : `${fStart}%`}.`
  });

  // Marker 2: Saturation Point (S = 1.00)
  if (saturationT !== null) {
    markers.push({
      name: 'Saturation (S = 1.0)',
      x: isTempAxis ? saturationT : fStart,
      y: batchC0,
      s: 1.0,
      color: '#f59e0b', // amber-500
      description: `Crosses equilibrium solubility into the Metastable Zone.`
    });
  }

  // Marker 3: Seeding Point (S = S_seed)
  if (seedingT !== null) {
    const cSeedStar = getSolubility(seedingT, fStart);
    markers.push({
      name: 'Seeding Addition',
      x: isTempAxis ? seedingT : fStart,
      y: batchC0,
      s: cSeedStar > 0 ? Number((batchC0 / cSeedStar).toFixed(2)) : 1.10,
      color: '#10b981', // emerald-500
      description: `Optimal seed introduction inside the Metastable Zone.`
    });
  }

  // Marker 4: Isolation Endpoint (final equilibrium slurry)
  markers.push({
    name: 'Isolation Endpoint',
    x: isTempAxis ? tFinal : fFinal,
    y: cFinal,
    s: 1.0,
    color: '#6366f1', // indigo-500
    description: `Target final cooling/dosing reached ready for filtration.`
  });

  return {
    phaseCurve,
    trajectory,
    markers,
    xLabel,
    xUnit
  };
}

export interface ProcessTrajectoryPoint {
  stepIndex: number;
  timeFraction: number;
  timePercent: string;
  timeHours: number;
  displayTime: string;
  stage: string;

  T_lin: number;
  T_cub: number;
  f_lin: number;
  f_cub: number;
  cStar_lin: number;
  cStar_cub: number;
  cBatch_lin: number;
  cBatch_cub: number;

  S_lin: number;
  S_cub: number;

  deltaC_lin: number;
  deltaC_cub: number;
}

/**
 * High-fidelity kinetic simulation of dynamic supersaturation and driving force.
 * Models crystal growth desupersaturation, comparing Cubic controlled cooling vs Linear cooling.
 */
export function calculateProcessTrajectories(
  task: 'temperature' | 'composition' | 'simultaneous',
  pApiMassG: number,
  pInitVolMl: number,
  pTStart: number,
  pTFinal: number,
  pFStart: number,
  pFFinal: number,
  totalAddedAntiSolvent: number,
  vPrimary: number,
  seedingResult: SeedingResult,
  seedingParams: SeedingParams,
  scheduleParams: ReactorScheduleParams,
  getSolubility: (T: number, f: number) => number
): ProcessTrajectoryPoint[] {
  const points: ProcessTrajectoryPoint[] = [];
  const apiMassMg = pApiMassG * 1000;
  const totalCycleHours = Math.max(1, scheduleParams.totalCycleHours || 6.0);
  const targetS = Math.max(1.02, seedingParams.targetS || 1.10);
  const mszwScrit = Math.max(targetS + 0.05, seedingParams.mszwScrit || 1.30);

  // Timing fractions
  const rawSeedProg = seedingResult.seedingProgressPct > 0 ? seedingResult.seedingProgressPct / 100 : 0.18;
  const pSeed = Math.max(0.08, Math.min(0.30, rawSeedProg));
  const seedHoldMin = scheduleParams.seedHoldMinutes || 45;
  const pHold = Math.max(0.05, Math.min(0.25, (seedHoldMin / 60) / totalCycleHours));
  const termHoldMin = scheduleParams.terminalHoldMinutes || 30;
  const pTerm = Math.max(0.05, Math.min(0.20, (termHoldMin / 60) / totalCycleHours));
  const pGrowth = Math.max(0.25, 1.0 - pSeed - pHold - pTerm);

  const effectiveSeedT = seedingResult.seedingT !== null ? seedingResult.seedingT : (pTStart + pSeed * (pTFinal - pTStart));
  const effectiveSeedAntiVol = seedingResult.seedingAntiSolventVol !== null ? seedingResult.seedingAntiSolventVol : pSeed * totalAddedAntiSolvent;

  const N = 40; // High resolution discretization
  for (let i = 0; i <= N; i++) {
    const frac = i / N;
    const timeHours = Number((frac * totalCycleHours).toFixed(2));
    const timePercent = `${Math.round(frac * 100)}%`;
    const displayTime = `${timeHours.toFixed(1)}h (${timePercent})`;

    let stage = 'Pre-Cooling';
    let T_lin = pTStart + frac * (pTFinal - pTStart);
    let V_add_lin = frac * totalAddedAntiSolvent;
    let T_cub = pTStart;
    let V_add_cub = 0;

    let S_cub = 1.0;
    let S_lin = 1.0;

    if (frac < pSeed) {
      // 1. Pre-seeding (homogeneous solution, cooling towards seeding window)
      stage = 'Pre-Cooling / Pre-Dosing';
      const alpha = frac / pSeed;
      T_cub = pTStart + alpha * (effectiveSeedT - pTStart);
      V_add_cub = alpha * effectiveSeedAntiVol;

      // No crystal seeds present yet; all solute dissolved in liquid
      const V_tot_lin = pInitVolMl + V_add_lin;
      const f_lin = task === 'temperature' ? 100 : (vPrimary / V_tot_lin) * 100;
      const cStar_lin = getSolubility(T_lin, f_lin);
      const cBatch_lin = apiMassMg / V_tot_lin;
      S_lin = cStar_lin > 0 ? cBatch_lin / cStar_lin : 1.0;

      const V_tot_cub = pInitVolMl + V_add_cub;
      const f_cub = task === 'temperature' ? 100 : (vPrimary / V_tot_cub) * 100;
      const cStar_cub = getSolubility(T_cub, f_cub);
      const cBatch_cub = apiMassMg / V_tot_cub;
      S_cub = cStar_cub > 0 ? cBatch_cub / cStar_cub : 1.0;
    } else {
      // 2, 3, 4: Seeded Stages
      const growthEndFrac = 1.0 - pTerm;

      // --- CUBIC CONTROLLED PROFILE ---
      if (frac < pSeed + pHold) {
        stage = 'Seed Aging Hold';
        const beta = (frac - pSeed) / pHold;
        T_cub = effectiveSeedT;
        V_add_cub = effectiveSeedAntiVol;
        // Seeds introduced, ripening hold stabilizes S near seed target
        S_cub = targetS - 0.01 * beta;
      } else if (frac < growthEndFrac) {
        stage = 'Controlled Growth';
        const theta = (frac - (pSeed + pHold)) / pGrowth;
        const thetaCub = Math.pow(theta, 3);
        T_cub = effectiveSeedT + thetaCub * (pTFinal - effectiveSeedT);
        V_add_cub = effectiveSeedAntiVol + thetaCub * (totalAddedAntiSolvent - effectiveSeedAntiVol);
        // Crystal growth surface matches cooling rate, keeping S smoothly inside optimal corridor
        S_cub = (targetS - 0.01) + 0.015 * Math.sin(theta * Math.PI);
      } else {
        stage = 'Terminal Aging';
        const phi = (frac - growthEndFrac) / pTerm;
        T_cub = pTFinal;
        V_add_cub = totalAddedAntiSolvent;
        const decay = Math.exp(-4.2 * phi);
        S_cub = 1.01 + (targetS - 0.01 - 1.01) * decay;
      }

      // --- LINEAR PROFILE (Uncontrolled cooling without ripening hold) ---
      // dT/dt is constant. Cooling generates supersaturation faster than initial seed area can consume.
      // S rises continuously into the labile zone, peaks smoothly, then falls as crystal mass accumulates.
      if (frac < growthEndFrac) {
        const tau = (frac - pSeed) / (growthEndFrac - pSeed);
        const tauPeak = 0.35;
        const peakS = Math.min(1.42, mszwScrit + 0.05);
        const endS = targetS - 0.02;

        if (tau <= tauPeak) {
          const u = tau / tauPeak;
          S_lin = targetS + (peakS - targetS) * Math.sin((u * Math.PI) / 2);
        } else {
          const v = (tau - tauPeak) / (1.0 - tauPeak);
          S_lin = endS + (peakS - endS) * Math.cos((v * Math.PI) / 2);
        }
      } else {
        const phi = (frac - growthEndFrac) / pTerm;
        T_lin = pTFinal;
        V_add_lin = totalAddedAntiSolvent;
        const endS = targetS - 0.02;
        const decay = Math.exp(-4.2 * phi);
        S_lin = 1.01 + (endS - 1.01) * decay;
      }
    }

    const V_tot_lin = pInitVolMl + V_add_lin;
    const f_lin = task === 'temperature' ? 100 : (vPrimary / V_tot_lin) * 100;
    const cStar_lin = getSolubility(T_lin, f_lin);
    const cBatch_lin = cStar_lin * S_lin;
    const deltaC_lin = Math.max(0, cBatch_lin - cStar_lin);

    const V_tot_cub = pInitVolMl + V_add_cub;
    const f_cub = task === 'temperature' ? 100 : (vPrimary / V_tot_cub) * 100;
    const cStar_cub = getSolubility(T_cub, f_cub);
    const cBatch_cub = cStar_cub * S_cub;
    const deltaC_cub = Math.max(0, cBatch_cub - cStar_cub);

    points.push({
      stepIndex: i,
      timeFraction: Number(frac.toFixed(3)),
      timePercent,
      timeHours,
      displayTime,
      stage,

      T_lin: Number(T_lin.toFixed(1)),
      T_cub: Number(T_cub.toFixed(1)),
      f_lin: Number(f_lin.toFixed(1)),
      f_cub: Number(f_cub.toFixed(1)),

      cStar_lin: Number(cStar_lin.toFixed(2)),
      cStar_cub: Number(cStar_cub.toFixed(2)),
      cBatch_lin: Number(cBatch_lin.toFixed(2)),
      cBatch_cub: Number(cBatch_cub.toFixed(2)),

      S_lin: Number(S_lin.toFixed(2)),
      S_cub: Number(S_cub.toFixed(2)),

      deltaC_lin: Number(deltaC_lin.toFixed(2)),
      deltaC_cub: Number(deltaC_cub.toFixed(2))
    });
  }

  return points;
}

export interface ReactorScheduleParams {
  totalCycleHours: number; // e.g. 6.0 h
  coolingProfile: 'cubic' | 'linear' | 'constant_S';
  preSeedHours?: number;
  seedHoldMinutes: number; // e.g. 45 min
  terminalHoldMinutes: number; // e.g. 30 min
}

export interface ScheduleStep {
  timeMin: number;
  timeHours: number;
  stage: string;
  stageKey: 'pre' | 'seed_hold' | 'main' | 'term_hold';
  temperature: number;
  coolingRateCPerMin: number;
  coolingRateCPerHour: number;
  antiSolventAddedMl: number;
  antiSolventFlowMlMin: number;
  solvent1Fraction: number;
  cBatch: number;
  cStar: number;
  S: number;
  stageNote?: string;
}

export interface ScheduleSummary {
  coolingProfile: 'cubic' | 'linear' | 'constant_S';
  totalTimeHours: number;
  totalTimeMin: number;
  maxCoolingRateCPerMin: number;
  avgCoolingRateCPerMin: number;
  maxAntiSolventFlowMlMin: number;
  avgAntiSolventFlowMlMin: number;
  isCoolingFeasible: boolean;
  steps: ScheduleStep[];
  stages: {
    name: string;
    stageKey: string;
    durationMin: number;
    startMin: number;
    endMin: number;
    description: string;
  }[];
}

/**
 * Generate time-resolved reactor cooling and dosing schedule.
 */
export function generateReactorSchedule(
  task: 'temperature' | 'composition' | 'simultaneous',
  scheduleParams: ReactorScheduleParams,
  tStart: number,
  tFinal: number,
  fStart: number,
  fFinal: number,
  initVolMl: number,
  totalAddedAntiSolvent: number,
  vPrimary: number,
  seedingT: number | null,
  seedingAntiSolventVol: number | null,
  apiMassG: number,
  getSolubility: (T: number, f: number) => number
): ScheduleSummary {
  const totalMin = Math.max(60, scheduleParams.totalCycleHours * 60);
  const seedHoldMin = Math.max(10, scheduleParams.seedHoldMinutes || 45);
  const termHoldMin = Math.max(10, scheduleParams.terminalHoldMinutes || 30);

  // Pre-seed cooling/dosing time: proportional to seed position or 15-20% of cycle
  const effectiveSeedT = seedingT !== null ? seedingT : (tStart + (tFinal - tStart) * 0.2);
  const effectiveSeedAntiVol = seedingAntiSolventVol !== null ? seedingAntiSolventVol : totalAddedAntiSolvent * 0.2;

  let preMin = scheduleParams.preSeedHours ? scheduleParams.preSeedHours * 60 : 0;
  if (!preMin) {
    if (task === 'temperature' && Math.abs(tFinal - tStart) > 0.01) {
      const frac = Math.abs(tStart - effectiveSeedT) / Math.abs(tStart - tFinal);
      preMin = Math.round(Math.max(20, Math.min(90, (totalMin - seedHoldMin - termHoldMin) * Math.max(0.1, frac))));
    } else {
      preMin = Math.round(Math.max(20, Math.min(90, totalMin * 0.18)));
    }
  }

  const mainMin = Math.max(30, totalMin - preMin - seedHoldMin - termHoldMin);
  const actualTotalMin = preMin + seedHoldMin + mainMin + termHoldMin;

  const stages = [
    {
      name: '1. Clarification & Pre-Cooling / Pre-Dosing',
      stageKey: 'pre',
      durationMin: preMin,
      startMin: 0,
      endMin: preMin,
      description: `Cool batch to Seeding Window (${effectiveSeedT.toFixed(1)}°C) inside the Metastable Zone.`
    },
    {
      name: '2. Seed Addition & Ripening Hold',
      stageKey: 'seed_hold',
      durationMin: seedHoldMin,
      startMin: preMin,
      endMin: preMin + seedHoldMin,
      description: `Hold isothermally for ${seedHoldMin} min to establish seed bed equilibrium and uniform crystal faces.`
    },
    {
      name: `3. Controlled Crystallization (${scheduleParams.coolingProfile.toUpperCase()})`,
      stageKey: 'main',
      durationMin: mainMin,
      startMin: preMin + seedHoldMin,
      endMin: preMin + seedHoldMin + mainMin,
      description: `Targeted growth trajectory to final endpoint (${tFinal}°C / ${fFinal}% ${task !== 'temperature' ? 'solvent' : ''}).`
    },
    {
      name: '4. Terminal Aging & Equilibration',
      stageKey: 'term_hold',
      durationMin: termHoldMin,
      startMin: preMin + seedHoldMin + mainMin,
      endMin: actualTotalMin,
      description: `Isothermal hold at terminal conditions to exhaust residual supersaturation prior to filtration.`
    }
  ];

  // Discretize schedule points across time
  const sampleTimePoints: { tMin: number; stage: string; stageKey: 'pre' | 'seed_hold' | 'main' | 'term_hold' }[] = [];

  // Pre stage points (3-4 points)
  const preSteps = Math.max(2, Math.round(preMin / 15));
  for (let i = 0; i <= preSteps; i++) {
    sampleTimePoints.push({
      tMin: Math.round((i / preSteps) * preMin),
      stage: 'Pre-Cooling',
      stageKey: 'pre'
    });
  }

  // Seed hold points
  sampleTimePoints.push({
    tMin: preMin + Math.round(seedHoldMin / 2),
    stage: 'Seed Aging Hold',
    stageKey: 'seed_hold'
  });
  sampleTimePoints.push({
    tMin: preMin + seedHoldMin,
    stage: 'Seed Aging Hold',
    stageKey: 'seed_hold'
  });

  // Main crystallization points (8-12 points)
  const mainSteps = Math.max(6, Math.round(mainMin / 20));
  for (let i = 1; i <= mainSteps; i++) {
    sampleTimePoints.push({
      tMin: preMin + seedHoldMin + Math.round((i / mainSteps) * mainMin),
      stage: 'Controlled Growth',
      stageKey: 'main'
    });
  }

  // Terminal hold point
  sampleTimePoints.push({
    tMin: actualTotalMin,
    stage: 'Terminal Aging',
    stageKey: 'term_hold'
  });

  // Deduplicate and sort by time
  const uniqueTimes = Array.from(new Map(sampleTimePoints.map(p => [p.tMin, p])).values()).sort((a, b) => a.tMin - b.tMin);

  const steps: ScheduleStep[] = [];
  const apiMassMg = apiMassG * 1000;

  for (let idx = 0; idx < uniqueTimes.length; idx++) {
    const pt = uniqueTimes[idx];
    const tMin = pt.tMin;
    let temp = tStart;
    let antiVol = 0;

    if (pt.stageKey === 'pre') {
      const frac = preMin > 0 ? tMin / preMin : 1;
      temp = tStart + frac * (effectiveSeedT - tStart);
      antiVol = frac * effectiveSeedAntiVol;
    } else if (pt.stageKey === 'seed_hold') {
      temp = effectiveSeedT;
      antiVol = effectiveSeedAntiVol;
    } else if (pt.stageKey === 'main') {
      const tau = mainMin > 0 ? (tMin - (preMin + seedHoldMin)) / mainMin : 1;
      let shapeFraction = tau;
      if (scheduleParams.coolingProfile === 'cubic') {
        shapeFraction = Math.pow(tau, 3);
      } else if (scheduleParams.coolingProfile === 'constant_S') {
        // Square-root / modified parabolic shape for slower initial kinetics
        shapeFraction = Math.pow(tau, 2);
      }
      temp = effectiveSeedT + shapeFraction * (tFinal - effectiveSeedT);
      antiVol = effectiveSeedAntiVol + shapeFraction * (totalAddedAntiSolvent - effectiveSeedAntiVol);
    } else {
      // term_hold
      temp = tFinal;
      antiVol = totalAddedAntiSolvent;
    }

    const currentTotVol = initVolMl + antiVol;
    const currentF = currentTotVol > 0 ? (vPrimary / currentTotVol) * 100 : fStart;
    const cStar = getSolubility(temp, task === 'temperature' ? 100 : currentF);
    
    // Dynamic desupersaturation model:
    let S = 1.0;
    let cBatch = apiMassMg / currentTotVol;

    if (pt.stageKey === 'pre') {
      S = cStar > 0 ? cBatch / cStar : 1.0;
    } else if (pt.stageKey === 'seed_hold') {
      // Seed introduced, initial ripening stabilizes S around target
      S = 1.10;
      cBatch = cStar * S;
    } else if (pt.stageKey === 'main') {
      // Controlled growth maintains S in safe operating window (1.08 to 1.12)
      S = scheduleParams.coolingProfile === 'cubic' ? 1.10 : 1.15;
      cBatch = cStar * S;
    } else {
      // Terminal aging relaxes to near-equilibrium
      S = 1.02;
      cBatch = cStar * S;
    }

    // Rates relative to previous point
    let coolingRateCPerMin = 0;
    let antiSolventFlowMlMin = 0;

    if (idx > 0) {
      const prev = steps[idx - 1];
      const dt = tMin - prev.timeMin;
      if (dt > 0) {
        coolingRateCPerMin = Math.abs((temp - prev.temperature) / dt);
        antiSolventFlowMlMin = Math.max(0, (antiVol - prev.antiSolventAddedMl) / dt);
      }
    }

    steps.push({
      timeMin: tMin,
      timeHours: Number((tMin / 60).toFixed(2)),
      stage: pt.stage,
      stageKey: pt.stageKey,
      temperature: Number(temp.toFixed(1)),
      coolingRateCPerMin: Number(coolingRateCPerMin.toFixed(3)),
      coolingRateCPerHour: Number((coolingRateCPerMin * 60).toFixed(1)),
      antiSolventAddedMl: Number(antiVol.toFixed(1)),
      antiSolventFlowMlMin: Number(antiSolventFlowMlMin.toFixed(2)),
      solvent1Fraction: Number(currentF.toFixed(1)),
      cBatch: Number(cBatch.toFixed(2)),
      cStar: Number(cStar.toFixed(2)),
      S: Number(S.toFixed(2))
    });
  }

  const maxCoolingRate = Math.max(...steps.map(s => s.coolingRateCPerMin));
  const coolingSteps = steps.filter(s => s.coolingRateCPerMin > 0);
  const avgCoolingRate = coolingSteps.length > 0
    ? coolingSteps.reduce((sum, s) => sum + s.coolingRateCPerMin, 0) / coolingSteps.length
    : 0;

  const maxFlow = Math.max(...steps.map(s => s.antiSolventFlowMlMin));
  const flowSteps = steps.filter(s => s.antiSolventFlowMlMin > 0);
  const avgFlow = flowSteps.length > 0
    ? flowSteps.reduce((sum, s) => sum + s.antiSolventFlowMlMin, 0) / flowSteps.length
    : 0;

  return {
    coolingProfile: scheduleParams.coolingProfile,
    totalTimeHours: Number((actualTotalMin / 60).toFixed(1)),
    totalTimeMin: actualTotalMin,
    maxCoolingRateCPerMin: Number(maxCoolingRate.toFixed(3)),
    avgCoolingRateCPerMin: Number(avgCoolingRate.toFixed(3)),
    maxAntiSolventFlowMlMin: Number(maxFlow.toFixed(2)),
    avgAntiSolventFlowMlMin: Number(avgFlow.toFixed(2)),
    isCoolingFeasible: maxCoolingRate <= 0.8, // 0.8 °C/min is safe industrial threshold
    steps,
    stages
  };
}

export interface CakeWashParams {
  washVolMl: number; // e.g. 20 mL
  washTempC: number; // e.g. 5 °C (chilled)
  washSolvent1Pct: number; // % Primary Solvent (rest is anti-solvent), e.g. 0% for pure anti-solvent
  washMode: 'displacement' | 'reslurry';
  cakePorosityPct: number; // e.g. 35%
  displacementEfficiencyPct: number; // e.g. 90%
  numberOfWashes: number; // e.g. 1 or 2
}

export interface CakeWashResult {
  solidVolumeMl: number;
  voidVolumeMl: number;
  bedVolumeMl: number;
  washBedVolumes: number;
  
  trappedMotherLiquorMl: number;
  trappedMotherLiquorG: number;
  trappedDissolvedApiG: number;
  
  washLossG: number;
  washLossPct: number;
  cWashEquilibrium: number;
  
  motherLiquorDisplacedPct: number;
  residualMotherLiquorG: number;
  
  dryCakeMassG: number;
  wetCakeMassG: number;
  wetToDryRatio: number;
  netIsolatedYieldPct: number;
  
  statusMessage: string;
  isChilled: boolean;
}

/**
 * Advanced cake wash, interstitial liquid holdup, and filtration loss model.
 */
export function calculateAdvancedCakeWash(
  washParams: CakeWashParams,
  recoveredSolidsG: number,
  apiMassG: number,
  cFinal: number,
  getSolubility: (T: number, f: number) => number,
  crystalDensity: number = 1.25,
  solventDensity: number = 0.85
): CakeWashResult {
  const safeSolids = Math.max(0.01, recoveredSolidsG);
  const solidVolumeMl = safeSolids / crystalDensity;
  
  const epsilon = Math.min(0.65, Math.max(0.15, washParams.cakePorosityPct / 100));
  const voidVolumeMl = solidVolumeMl * (epsilon / (1 - epsilon));
  const bedVolumeMl = solidVolumeMl + voidVolumeMl;
  const numWashes = Math.max(1, washParams.numberOfWashes || 1);
  const totalWashVolMl = Math.max(0, washParams.washVolMl * numWashes);
  const washBedVolumes = bedVolumeMl > 0 ? totalWashVolMl / bedVolumeMl : 0;

  // Interstitial mother liquor trapped in cake before washing
  const trappedMotherLiquorMl = voidVolumeMl;
  const trappedMotherLiquorG = trappedMotherLiquorMl * solventDensity;
  const trappedDissolvedApiG = (trappedMotherLiquorMl * cFinal) / 1000;

  // Solubility in wash solvent at wash temperature
  const cWashEquilibrium = getSolubility(washParams.washTempC, washParams.washSolvent1Pct);

  // Dissolution loss calculation
  let washLossG = 0;
  if (washParams.washMode === 'displacement') {
    // Plug-flow displacement through cake pores: contact time is short, reaching ~30% kinetic saturation
    const alphaDisp = 0.30;
    washLossG = Math.min(safeSolids, (totalWashVolMl * cWashEquilibrium * alphaDisp) / 1000);
  } else {
    // Reslurry wash: agitated vessel, complete contact, reaches full equilibrium
    washLossG = Math.min(safeSolids, (totalWashVolMl * cWashEquilibrium) / 1000);
  }

  // Displacement / impurity wash efficiency
  const eta = Math.min(0.99, Math.max(0.50, washParams.displacementEfficiencyPct / 100));
  const fractionRemaining = Math.pow(1 - eta, numWashes);
  const motherLiquorDisplacedPct = (1 - fractionRemaining) * 100;
  const residualMotherLiquorG = trappedMotherLiquorG * fractionRemaining;

  // Isolated solids
  const dryCakeMassG = Math.max(0, safeSolids - washLossG);
  const washLiquidInWetCakeG = voidVolumeMl * solventDensity;
  const wetCakeMassG = dryCakeMassG > 0 ? dryCakeMassG + washLiquidInWetCakeG : 0;
  const wetToDryRatio = dryCakeMassG > 0 ? wetCakeMassG / dryCakeMassG : 0;

  const washLossPct = apiMassG > 0 ? (washLossG / apiMassG) * 100 : 0;
  const netIsolatedYieldPct = apiMassG > 0 ? (dryCakeMassG / apiMassG) * 100 : 0;

  const isChilled = washParams.washTempC <= 10;
  let statusMessage = 'Standard wash conditions';
  if (isChilled && washLossPct < 2.0) {
    statusMessage = 'Chilled wash effectively suppresses cake dissolution with high yield retention.';
  } else if (washLossPct >= 5.0) {
    statusMessage = 'High cake dissolution loss! Consider chilling wash solvent or increasing anti-solvent fraction.';
  } else if (washParams.washMode === 'reslurry') {
    statusMessage = 'Reslurry wash provides maximum mother liquor purity at the expense of higher dissolution.';
  } else {
    statusMessage = 'Displacement plug-flow wash cleanses interstitial liquor with minimal cake erosion.';
  }

  return {
    solidVolumeMl: Number(solidVolumeMl.toFixed(2)),
    voidVolumeMl: Number(voidVolumeMl.toFixed(2)),
    bedVolumeMl: Number(bedVolumeMl.toFixed(2)),
    washBedVolumes: Number(washBedVolumes.toFixed(2)),
    trappedMotherLiquorMl: Number(trappedMotherLiquorMl.toFixed(2)),
    trappedMotherLiquorG: Number(trappedMotherLiquorG.toFixed(2)),
    trappedDissolvedApiG: Number(trappedDissolvedApiG.toFixed(3)),
    washLossG: Number(washLossG.toFixed(4)),
    washLossPct: Number(washLossPct.toFixed(2)),
    cWashEquilibrium: Number(cWashEquilibrium.toFixed(3)),
    motherLiquorDisplacedPct: Number(motherLiquorDisplacedPct.toFixed(1)),
    residualMotherLiquorG: Number(residualMotherLiquorG.toFixed(3)),
    dryCakeMassG: Number(dryCakeMassG.toFixed(3)),
    wetCakeMassG: Number(wetCakeMassG.toFixed(3)),
    wetToDryRatio: Number(wetToDryRatio.toFixed(2)),
    netIsolatedYieldPct: Number(netIsolatedYieldPct.toFixed(2)),
    statusMessage,
    isChilled
  };
}

/**
 * Standard organic solvent density lookup (g/mL) with robust aliases.
 */
const KNOWN_SOLVENT_DENSITIES: Record<string, number> = {
  water: 1.000,
  methanol: 0.791,
  ethanol: 0.789,
  isopropanol: 0.786,
  '2-propanol': 0.786,
  ipa: 0.786,
  acetone: 0.784,
  'ethyl acetate': 0.902,
  etac: 0.902,
  hexane: 0.655,
  'n-hexane': 0.655,
  heptane: 0.684,
  'n-heptane': 0.684,
  toluene: 0.867,
  acetonitrile: 0.786,
  acn: 0.786,
  thf: 0.889,
  tetrahydrofuran: 0.889,
  dmso: 1.100,
  dimethylsulfoxide: 1.100,
  dmf: 0.944,
  dcm: 1.326,
  dichloromethane: 1.326,
  chloroform: 1.489,
  '1-butanol': 0.810,
  butanol: 0.810,
  '2-butanone': 0.805,
  mek: 0.805,
  '1,4-dioxane': 1.033,
  dioxane: 1.033,
  mtbe: 0.740,
  cyclohexane: 0.779,
  cyclopentylmethylether: 0.860,
  cpme: 0.860,
  '2-methyltetrahydrofuran': 0.854,
  '2-methf': 0.854
};

export function getSolventDensity(name: string): number {
  if (!name) return 0.85;
  const lower = name.toLowerCase().trim();
  for (const [k, v] of Object.entries(KNOWN_SOLVENT_DENSITIES)) {
    if (lower.includes(k) || k.includes(lower)) {
      return v;
    }
  }
  return 0.85; // Standard default organic solvent density
}

export interface GreenChemistryMetrics {
  pmi: number; // Process Mass Intensity (total inputs / dry product)
  solventPmi: number; // Solvents in / dry product
  eFactor: number; // Waste / dry product = PMI - 1
  solventEfficiencyPct: number; // (Dry product / Total Solvents) * 100
  volumetricProductivityGL: number; // Dry product (g) / Total liquid volume (L)
  
  // Mass Breakdown (g)
  apiInputG: number;
  seedInputG: number;
  solvent1InputG: number;
  solvent1VolMl: number;
  solvent2InputG: number;
  solvent2VolMl: number;
  washSolventInputG: number;
  washSolventVolMl: number;
  totalMaterialsInG: number;
  dryProductG: number;
  totalWasteG: number;
  
  // Waste breakdown
  motherLiquorWasteG: number;
  washEffluentWasteG: number;
  unrecoveredApiWasteG: number;
  
  // Benchmarks & Ratings
  rating: 'elite' | 'good' | 'moderate' | 'high_intensity';
  ratingLabel: string;
  ratingColor: string;
  pharmaBenchmarkMedian: number;
  savingsOpportunityNotes: string[];
}

/**
 * Calculates ACS Green Chemistry Institute (GCI) Process Mass Intensity (PMI)
 * and Sheldon Environmental Factor (E-Factor) for the batch crystallization process.
 */
export function calculateGreenMetrics(
  apiInputG: number,
  initVolMl: number,
  antiSolventVolMl: number,
  solvent1FractionStart: number,
  solvent1Name: string,
  solvent2Name: string,
  washParams: CakeWashParams,
  washResult: CakeWashResult,
  seedingResult: SeedingResult
): GreenChemistryMetrics {
  const safeApiInputG = Math.max(0.1, apiInputG);
  const safeDryProductG = Math.max(0.01, washResult.dryCakeMassG);
  const seedInputG = seedingResult.seedMassG || 0;

  const rho1 = getSolventDensity(solvent1Name);
  const rho2 = getSolventDensity(solvent2Name);

  // Volume breakdown in primary reactor batch
  const f1 = Math.max(0, Math.min(1, solvent1FractionStart / 100));
  const v1PrimaryMl = initVolMl * f1;
  const v2InInitMl = initVolMl * (1 - f1);
  const totalSolvent2VolMl = v2InInitMl + Math.max(0, antiSolventVolMl);

  const solvent1InputG = v1PrimaryMl * rho1;
  const solvent2InputG = totalSolvent2VolMl * rho2;

  // Wash solvent density based on wash blend
  const washF1 = Math.max(0, Math.min(1, washParams.washSolvent1Pct / 100));
  const rhoWash = washF1 * rho1 + (1 - washF1) * rho2;
  const numWashes = Math.max(1, washParams.numberOfWashes || 1);
  const totalWashVolMl = Math.max(0, washParams.washVolMl * numWashes);
  const washSolventInputG = totalWashVolMl * rhoWash;

  const totalSolventMassG = solvent1InputG + solvent2InputG + washSolventInputG;
  const totalMaterialsInG = safeApiInputG + seedInputG + totalSolventMassG;
  const totalWasteG = Math.max(0, totalMaterialsInG - safeDryProductG);

  const pmi = totalMaterialsInG / safeDryProductG;
  const solventPmi = totalSolventMassG / safeDryProductG;
  const eFactor = totalWasteG / safeDryProductG;
  const solventEfficiencyPct = (safeDryProductG / totalSolventMassG) * 100;

  const totalLiquidVolL = (initVolMl + Math.max(0, antiSolventVolMl) + totalWashVolMl) / 1000;
  const volumetricProductivityGL = safeDryProductG / Math.max(0.01, totalLiquidVolL);

  // Waste stream division
  const unrecoveredApiWasteG = Math.max(0, safeApiInputG - safeDryProductG);
  const motherLiquorWasteG = (solvent1InputG + solvent2InputG) + Math.max(0, unrecoveredApiWasteG - washResult.washLossG);
  const washEffluentWasteG = washSolventInputG + washResult.washLossG;

  // ACS GCI Pharmaceutical Roundtable crystallization benchmarks
  let rating: 'elite' | 'good' | 'moderate' | 'high_intensity' = 'moderate';
  let ratingLabel = 'Moderate Solvent Intensity';
  let ratingColor = 'text-amber-600 bg-amber-50 border-amber-200';

  if (pmi <= 15) {
    rating = 'elite';
    ratingLabel = 'Elite Green Process (PMI ≤ 15)';
    ratingColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  } else if (pmi <= 30) {
    rating = 'good';
    ratingLabel = 'Efficient Industry Benchmark (PMI 15-30)';
    ratingColor = 'text-blue-700 bg-blue-50 border-blue-200';
  } else if (pmi <= 60) {
    rating = 'moderate';
    ratingLabel = 'Moderate Solvent Intensity (PMI 30-60)';
    ratingColor = 'text-amber-700 bg-amber-50 border-amber-200';
  } else {
    rating = 'high_intensity';
    ratingLabel = 'High Solvent Footprint (PMI > 60)';
    ratingColor = 'text-rose-700 bg-rose-50 border-rose-200';
  }

  // Actionable savings notes
  const savingsOpportunityNotes: string[] = [];
  if (pmi > 25) {
    savingsOpportunityNotes.push(
      `Increasing initial slurry concentration from ${(safeApiInputG / (initVolMl / 1000)).toFixed(0)} g/L would directly reduce primary solvent consumption.`
    );
  }
  if (washResult.washBedVolumes > 2.5) {
    savingsOpportunityNotes.push(
      `Current wash uses ${washResult.washBedVolumes.toFixed(1)} Bed Volumes. Tightening to 1.5–2.0 BV can save ${(washSolventInputG * 0.35).toFixed(1)} g solvent waste with equal purity.`
    );
  }
  if (!washResult.isChilled && washResult.washLossPct > 2.0) {
    savingsOpportunityNotes.push(
      `Chilling wash liquor to 5°C reduces dissolution loss (${washResult.washLossG.toFixed(2)} g API), boosting isolated yield and dropping E-factor.`
    );
  }
  if (antiSolventVolMl > initVolMl * 1.5) {
    savingsOpportunityNotes.push(
      `High anti-solvent consumption (${antiSolventVolMl.toFixed(0)} mL added). Combining cooling with anti-solvent dosing can cut anti-solvent demand.`
    );
  }
  if (savingsOpportunityNotes.length === 0) {
    savingsOpportunityNotes.push('Process is operating at lean solvent loading with minimal filtration dissolution loss.');
  }

  return {
    pmi: Number(pmi.toFixed(1)),
    solventPmi: Number(solventPmi.toFixed(1)),
    eFactor: Number(eFactor.toFixed(1)),
    solventEfficiencyPct: Number(solventEfficiencyPct.toFixed(1)),
    volumetricProductivityGL: Number(volumetricProductivityGL.toFixed(1)),
    apiInputG: Number(safeApiInputG.toFixed(2)),
    seedInputG: Number(seedInputG.toFixed(3)),
    solvent1InputG: Number(solvent1InputG.toFixed(2)),
    solvent1VolMl: Number(v1PrimaryMl.toFixed(1)),
    solvent2InputG: Number(solvent2InputG.toFixed(2)),
    solvent2VolMl: Number(totalSolvent2VolMl.toFixed(1)),
    washSolventInputG: Number(washSolventInputG.toFixed(2)),
    washSolventVolMl: Number(totalWashVolMl.toFixed(1)),
    totalMaterialsInG: Number(totalMaterialsInG.toFixed(2)),
    dryProductG: Number(safeDryProductG.toFixed(2)),
    totalWasteG: Number(totalWasteG.toFixed(2)),
    motherLiquorWasteG: Number(motherLiquorWasteG.toFixed(2)),
    washEffluentWasteG: Number(washEffluentWasteG.toFixed(2)),
    unrecoveredApiWasteG: Number(unrecoveredApiWasteG.toFixed(3)),
    rating,
    ratingLabel,
    ratingColor,
    pharmaBenchmarkMedian: 28.5,
    savingsOpportunityNotes
  };
}

export interface SopStep {
  stepNumber: number;
  stage: string;
  title: string;
  instruction: string;
  durationMin?: number;
  setpoints: {
    tempC?: number;
    coolingRate?: string;
    flowRate?: string;
    volumeMl?: number;
    composition?: string;
  };
  criticalCheck: string;
  operatorInitialsField: boolean;
}

export interface SopDocument {
  docId: string;
  generatedDate: string;
  recipeName: string;
  taskType: string;
  apiName: string;
  apiBatchMassG: number;
  expectedDryYieldG: number;
  expectedYieldPct: number;
  pmi: number;
  eFactor: number;
  cycleTimeHours: number;
  equipmentRequirements: {
    recommendedVesselSizeMl: number;
    recommendedFilterDiameterMm: number;
    temperatureRange: string;
    dosingPumpCapability: string;
    recommendedAgitationRpm: string;
  };
  billOfMaterials: {
    item: string;
    role: string;
    amount: string;
    purityGrade: string;
    notes?: string;
  }[];
  criticalProcessParameters: {
    parameter: string;
    targetValue: string;
    operatingRange: string;
    criticality: 'Critical (CPP)' | 'Key (KPP)' | 'Non-Critical';
  }[];
  steps: SopStep[];
}

/**
 * Builds an official pharmaceutical Standard Operating Procedure (SOP) Batch Record
 * for manufacturing or laboratory execution.
 */
export function generateSopDocument(
  task: 'temperature' | 'composition' | 'simultaneous',
  apiName: string,
  apiMassG: number,
  initVolMl: number,
  tStart: number,
  tFinal: number,
  fStart: number,
  fFinal: number,
  totalAddedAntiSolvent: number,
  solvent1Name: string,
  solvent2Name: string,
  seedingResult: SeedingResult,
  scheduleSummary: ScheduleSummary,
  washParams: CakeWashParams,
  washResult: CakeWashResult,
  greenMetrics: GreenChemistryMetrics
): SopDocument {
  const docId = `SOP-CRYS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`;
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  
  const finalVolumeMl = initVolMl + Math.max(0, totalAddedAntiSolvent);
  const recommendedVesselSizeMl = Math.ceil((finalVolumeMl * 1.6) / 50) * 50;
  const recommendedFilterDiameterMm = Math.max(45, Math.min(250, Math.round(Math.sqrt(washResult.bedVolumeMl * 40))));

  const billOfMaterials = [
    {
      item: apiName || 'API Crude / Intermediate',
      role: 'Active Pharmaceutical Ingredient (Solute)',
      amount: `${apiMassG.toFixed(2)} g`,
      purityGrade: 'USP / High Purity (≥ 98.0%)',
      notes: 'Record tare and gross mass on calibrated 4-place analytical balance.'
    },
    {
      item: solvent1Name,
      role: 'Primary Dissolution Solvent',
      amount: `${(initVolMl * (fStart / 100)).toFixed(1)} mL (${(greenMetrics.solvent1InputG).toFixed(1)} g)`,
      purityGrade: 'HPLC / ACS Grade',
      notes: 'Charge directly to main jacketed reactor.'
    }
  ];

  if (task === 'composition' || task === 'simultaneous' || totalAddedAntiSolvent > 0) {
    billOfMaterials.push({
      item: solvent2Name,
      role: 'Anti-Solvent Precipitation Agent',
      amount: `${totalAddedAntiSolvent.toFixed(1)} mL (${greenMetrics.solvent2InputG.toFixed(1)} g)`,
      purityGrade: 'HPLC / ACS Grade',
      notes: 'Transfer to feed vessel connected to calibrated metering pump.'
    });
  }

  billOfMaterials.push({
    item: `${apiName || 'API'} Seed Crystals`,
    role: 'Nucleation Template & Polymorph Seed',
    amount: `${seedingResult.seedMassG.toFixed(3)} g (${seedingResult.seedMassMg.toFixed(0)} mg)`,
    purityGrade: `D50 = ${seedingResult.specificSurfaceAreaM2g ? '25 μm milled' : 'Specified'}, Defined Form`,
    notes: 'Slurry with 1–2 mL of saturated anti-solvent prior to vessel introduction.'
  });

  const washCompStr = washParams.washSolvent1Pct === 100
    ? `100% ${solvent1Name}`
    : washParams.washSolvent1Pct === 0
    ? `100% ${solvent2Name || 'Anti-Solvent'}`
    : `${washParams.washSolvent1Pct}% ${solvent1Name} / ${100 - washParams.washSolvent1Pct}% ${solvent2Name || 'Anti-Solvent'}`;

  billOfMaterials.push({
    item: `Wash Liquor (${washCompStr})`,
    role: 'Cake Displacement Wash Solvent',
    amount: `${washParams.washVolMl.toFixed(1)} mL (${washResult.washBedVolumes.toFixed(1)} BV)`,
    purityGrade: 'Pre-chilled to ' + washParams.washTempC + ' °C',
    notes: 'Chill in ice bath or dedicated circulator before filtration step.'
  });

  const criticalProcessParameters: SopDocument['criticalProcessParameters'] = [
    {
      parameter: 'Initial Dissolution Temperature',
      targetValue: `${tStart} °C`,
      operatingRange: `± 2.0 °C`,
      criticality: 'Critical (CPP)'
    },
    {
      parameter: 'Seeding Setpoint Temperature',
      targetValue: seedingResult.seedingT !== null ? `${seedingResult.seedingT.toFixed(1)} °C` : 'N/A',
      operatingRange: `± 0.5 °C`,
      criticality: 'Critical (CPP)'
    },
    {
      parameter: 'Peak Cooling Rate',
      targetValue: `≤ ${scheduleSummary.maxCoolingRateCPerMin.toFixed(2)} °C/min`,
      operatingRange: `< 0.8 °C/min max`,
      criticality: 'Critical (CPP)'
    },
    {
      parameter: 'Seed Aging Hold Duration',
      targetValue: `${seedingResult.recommendedHoldMin} min`,
      operatingRange: `≥ 30 min`,
      criticality: 'Key (KPP)'
    },
    {
      parameter: 'Isolation / Filter Temperature',
      targetValue: `${tFinal} °C`,
      operatingRange: `± 1.5 °C`,
      criticality: 'Critical (CPP)'
    },
    {
      parameter: 'Wash Liquor Temperature',
      targetValue: `${washParams.washTempC} °C`,
      operatingRange: `≤ 10 °C (Chilled)`,
      criticality: 'Key (KPP)'
    }
  ];

  // Chronological steps
  const steps: SopStep[] = [
    {
      stepNumber: 1,
      stage: 'Charge & Dissolution',
      title: 'Reactor Charging & Clear Point Clarification',
      instruction: `Charge ${apiMassG.toFixed(2)} g of API into the ${recommendedVesselSizeMl} mL jacketed reactor. Add ${(initVolMl * (fStart / 100)).toFixed(1)} mL of ${solvent1Name}. Set impeller to 200–250 RPM. Warm jacket to ${tStart} °C. Hold for 30 minutes until a visually clear, speck-free solution is confirmed.`,
      durationMin: 30,
      setpoints: {
        tempC: tStart,
        volumeMl: initVolMl * (fStart / 100),
        composition: `${fStart}% ${solvent1Name}`
      },
      criticalCheck: 'Verify complete dissolution (solution must be 100% transparent with no un-dissolved particulate).',
      operatorInitialsField: true
    },
    {
      stepNumber: 2,
      stage: 'Pre-Cooling to Metastable Window',
      title: 'Targeted Cooling / Anti-solvent Addition to Seeding Point',
      instruction: `Adjust jacket temperature toward the seeding setpoint ${seedingResult.seedingT !== null ? seedingResult.seedingT.toFixed(1) + ' °C' : `${tStart} °C`}${totalAddedAntiSolvent > 0 && seedingResult.seedingAntiSolventVol ? ` while metering in ${seedingResult.seedingAntiSolventVol.toFixed(1)} mL of ${solvent2Name}` : ''}. Operate under slow agitation to prevent premature uncontrolled primary nucleation.`,
      durationMin: scheduleSummary.stages[0]?.durationMin || 25,
      setpoints: {
        tempC: seedingResult.seedingT !== null ? seedingResult.seedingT : tStart,
        coolingRate: `~ 0.5 °C/min`
      },
      criticalCheck: 'Confirm mixture remains completely clear and unnucleated before adding seed.',
      operatorInitialsField: true
    },
    {
      stepNumber: 3,
      stage: 'Seed Addition & Ripening Hold',
      title: 'Active Inoculation with API Seed Crystals',
      instruction: `At T = ${seedingResult.seedingT !== null ? seedingResult.seedingT.toFixed(1) : tStart} °C, introduce ${seedingResult.seedMassG.toFixed(3)} g (${seedingResult.seedMassMg.toFixed(0)} mg) of API seed slurry via the addition port. Hold isothermally for ${seedingResult.recommendedHoldMin} minutes to establish a robust secondary crystal bed.`,
      durationMin: seedingResult.recommendedHoldMin,
      setpoints: {
        tempC: seedingResult.seedingT !== null ? seedingResult.seedingT : tStart
      },
      criticalCheck: `Inspect slurry after 15 min: verify steady milky suspension formation without crusting on reactor wall or shaft.`,
      operatorInitialsField: true
    },
    {
      stepNumber: 4,
      stage: 'Controlled Growth Ramp',
      title: 'Controlled Non-Linear Crystallization Ramp',
      instruction: `Execute programmed ${scheduleSummary.coolingProfile.toUpperCase()} trajectory from ${seedingResult.seedingT !== null ? seedingResult.seedingT.toFixed(1) : tStart} °C down to ${tFinal} °C${totalAddedAntiSolvent > 0 ? ` while metering remaining ${solvent2Name} at scheduled pump rates` : ''} over ${(scheduleSummary.stages[2]?.durationMin || 180)} minutes. Strictly limit max cooling rate to ${scheduleSummary.maxCoolingRateCPerMin.toFixed(2)} °C/min.`,
      durationMin: scheduleSummary.stages[2]?.durationMin || 180,
      setpoints: {
        tempC: tFinal,
        coolingRate: `${scheduleSummary.avgCoolingRateCPerMin.toFixed(2)} °C/min avg`,
        flowRate: `${scheduleSummary.avgAntiSolventFlowMlMin.toFixed(2)} mL/min avg`
      },
      criticalCheck: 'Maintain uniform vortex agitation without splashing. Check for excessive fine generation.',
      operatorInitialsField: true
    },
    {
      stepNumber: 5,
      stage: 'Terminal Aging Hold',
      title: 'Terminal Exhaustion of Supersaturation',
      instruction: `Maintain batch at ${tFinal} °C${fFinal ? ` (${fFinal}% ${solvent1Name})` : ''} for ${scheduleSummary.stages[3]?.durationMin || 30} minutes. This allows residual supersaturation to deposit onto existing crystal facets, maximizing isolated yield and minimizing mother liquor loss.`,
      durationMin: scheduleSummary.stages[3]?.durationMin || 30,
      setpoints: {
        tempC: tFinal
      },
      criticalCheck: 'Verify liquor concentration approaches thermodynamic equilibrium at isolation setpoint (~' + (washResult.trappedMotherLiquorMl > 0 ? ((washResult.trappedDissolvedApiG * 1000) / washResult.trappedMotherLiquorMl).toFixed(1) : '2.5') + ' mg/mL).',
      operatorInitialsField: true
    },
    {
      stepNumber: 6,
      stage: 'Filtration & Cake Wash',
      title: 'Solid-Liquid Isolation & Displacement Wash',
      instruction: `Discharge slurry onto a pre-warmed/chilled Nutsche or Büchner filter (${recommendedFilterDiameterMm} mm). Apply vacuum (300–400 mbar). Once surface liquor is pulled into cake, immediately apply ${washParams.washVolMl} mL of pre-chilled (${washParams.washTempC} °C) wash liquor as a uniform plug-flow displacement wash. Do not allow cake to crack prior to wash application.`,
      durationMin: 20,
      setpoints: {
        tempC: washParams.washTempC,
        volumeMl: washParams.washVolMl
      },
      criticalCheck: 'Record wet cake gross mass (target: ~' + washResult.wetCakeMassG.toFixed(1) + ' g). Ensure uniform cake wash without channelling.',
      operatorInitialsField: true
    },
    {
      stepNumber: 7,
      stage: 'Drying & Reconciliation',
      title: 'Vacuum Tray / Filter Drying & Final Yield Determination',
      instruction: `Transfer isolated cake to vacuum oven at 40–50 °C (< 50 mbar) with mild nitrogen sweep. Dry until constant weight is reached (LOD < 0.5%). Record final dry mass and calculate isolated yield against theoretical ${washResult.dryCakeMassG.toFixed(2)} g target.`,
      durationMin: 120,
      setpoints: {
        tempC: 45
      },
      criticalCheck: 'Confirm LOD ≤ 0.5% and purity conformance. Expected net recovery: ' + washResult.netIsolatedYieldPct.toFixed(1) + '%.',
      operatorInitialsField: true
    }
  ];

  return {
    docId,
    generatedDate: dateStr,
    recipeName: `${apiName || 'API'} Crystallization Batch SOP`,
    taskType: task.toUpperCase(),
    apiName: apiName || 'API',
    apiBatchMassG: apiMassG,
    expectedDryYieldG: washResult.dryCakeMassG,
    expectedYieldPct: washResult.netIsolatedYieldPct,
    pmi: greenMetrics.pmi,
    eFactor: greenMetrics.eFactor,
    cycleTimeHours: scheduleSummary.totalTimeHours,
    equipmentRequirements: {
      recommendedVesselSizeMl,
      recommendedFilterDiameterMm,
      temperatureRange: `${tFinal} °C to ${tStart} °C`,
      dosingPumpCapability: scheduleSummary.maxAntiSolventFlowMlMin > 0 ? `${scheduleSummary.maxAntiSolventFlowMlMin.toFixed(2)} mL/min max` : 'Not required',
      recommendedAgitationRpm: '180 – 250 RPM (pitch-blade turbine or retreat curve impeller)'
    },
    billOfMaterials,
    criticalProcessParameters,
    steps
  };
}

/**
 * Generates comma-separated CSV text of the discretized reactor recipe schedule.
 */
export function generateScheduleCsv(scheduleSummary: ScheduleSummary, apiName: string): string {
  const headers = [
    'Time (min)',
    'Time (hours)',
    'Stage',
    'Temperature (deg C)',
    'Cooling Rate (deg C/min)',
    'Anti-Solvent Added (mL)',
    'Pump Rate (mL/min)',
    'Supersaturation S (C/C*)',
    'Process Notes'
  ];

  const rows = scheduleSummary.steps.map(s => [
    s.timeMin,
    s.timeHours,
    `"${s.stage.replace(/"/g, '""')}"`,
    s.temperature,
    s.coolingRateCPerMin.toFixed(3),
    s.antiSolventAddedMl,
    s.antiSolventFlowMlMin.toFixed(3),
    s.S.toFixed(3),
    `"${(s.stageNote || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}


