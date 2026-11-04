import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Beaker, Layers, FileText, Leaf } from 'lucide-react';
import { Experiment } from '../types';
import {
  SeedingParams,
  ReactorScheduleParams,
  CakeWashParams,
  autoFitModelFromExperiment,
  calculateSeedingStrategy,
  calculateProcessTrajectories,
  generatePhaseDiagram,
  generateReactorSchedule,
  calculateAdvancedCakeWash,
  getSolventDensity,
  calculateGreenMetrics,
  generateSopDocument
} from '../utils/crystallization';
import { ProcessParametersBar } from './crystallization/ProcessParametersBar';
import { BatchSummaryCard } from './crystallization/BatchSummaryCard';
import { SeedingCard } from './crystallization/SeedingCard';
import { PhaseDiagramChart } from './crystallization/PhaseDiagramChart';
import { ReactorScheduleCard } from './crystallization/ReactorScheduleCard';
import { CakeWashFiltrationCard } from './crystallization/CakeWashFiltrationCard';
import { GreenMetricsCard } from './crystallization/GreenMetricsCard';
import { BatchSopModal } from './crystallization/BatchSopModal';

export interface CrystallizationPlannerData {
  apiMassG: string;
  initVolMl: string;
  tStart: string;
  tFinal: string;
  fStart: string;
  fFinal: string;
  seedingParams: SeedingParams;
  scheduleParams: ReactorScheduleParams;
  washParams: CakeWashParams;
}

const defaultSeedingParams: SeedingParams = {
  targetS: 1.10,
  seedLoadingPct: 2.0,
  seedD50Um: 25,
  mszwScrit: 1.30,
  agingTimeMin: 45,
  crystalDensity: 1.25
};

const defaultScheduleParams: ReactorScheduleParams = {
  totalCycleHours: 6.0,
  coolingProfile: 'cubic',
  seedHoldMinutes: 45,
  terminalHoldMinutes: 30
};

const defaultWashParams: CakeWashParams = {
  washVolMl: 20,
  washTempC: 5, // Default to chilled wash
  washSolvent1Pct: 100, // Default to chilled primary solvent (standard crystallization isolation practice)
  washMode: 'displacement',
  cakePorosityPct: 35,
  displacementEfficiencyPct: 90,
  numberOfWashes: 1
};

const defaultPlannerData: CrystallizationPlannerData = {
  apiMassG: '',
  initVolMl: '',
  tStart: '',
  tFinal: '',
  fStart: '',
  fFinal: '',
  seedingParams: defaultSeedingParams,
  scheduleParams: defaultScheduleParams,
  washParams: defaultWashParams
};

const loadPlannerData = (systemKey: string): CrystallizationPlannerData => {
  try {
    const raw = localStorage.getItem(`hplc-cryst-plan-${systemKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        apiMassG: typeof parsed.apiMassG === 'string' ? parsed.apiMassG : '',
        initVolMl: typeof parsed.initVolMl === 'string' ? parsed.initVolMl : '',
        tStart: typeof parsed.tStart === 'string' ? parsed.tStart : '',
        tFinal: typeof parsed.tFinal === 'string' ? parsed.tFinal : '',
        fStart: typeof parsed.fStart === 'string' ? parsed.fStart : '',
        fFinal: typeof parsed.fFinal === 'string' ? parsed.fFinal : '',
        seedingParams: { ...defaultSeedingParams, ...(parsed.seedingParams || {}) },
        scheduleParams: { ...defaultScheduleParams, ...(parsed.scheduleParams || {}) },
        washParams: { ...defaultWashParams, ...(parsed.washParams || {}) }
      };
    }
  } catch (e) {
    console.error('Error loading crystallization planner data', e);
  }
  return defaultPlannerData;
};

const savePlannerData = (systemKey: string, data: CrystallizationPlannerData) => {
  try {
    localStorage.setItem(`hplc-cryst-plan-${systemKey}`, JSON.stringify(data));
  } catch (e) {
    console.error('Error saving crystallization planner data', e);
  }
};

interface CrystallizationTabProps {
  activeExperiment: Experiment | null;
  predictionContext: any;
}

export const CrystallizationTab: React.FC<CrystallizationTabProps> = ({ activeExperiment, predictionContext }) => {
  const [isSopOpen, setIsSopOpen] = useState<boolean>(false);

  const experimentId = activeExperiment?.id || 'default';
  const savedSolv1 = activeExperiment ? localStorage.getItem(`hplc-pred-solv1-${activeExperiment.id}`) || undefined : undefined;
  const savedSolv2 = activeExperiment ? localStorage.getItem(`hplc-pred-solv2-${activeExperiment.id}`) || undefined : undefined;

  // Automatically derive model if PredictionTab hasn't been visited yet
  const autoFitted = useMemo(() => {
    if (predictionContext?.model && predictionContext?.predictionTask) {
      return null;
    }
    if (!activeExperiment?.samples || activeExperiment.samples.length === 0) {
      return null;
    }
    const calRes = activeExperiment.calibrationResult || { slope: 0, intercept: 0, rSquared: 0, valid: false };
    return autoFitModelFromExperiment(activeExperiment.samples, calRes, savedSolv1, savedSolv2);
  }, [predictionContext, activeExperiment, savedSolv1, savedSolv2]);

  const model = predictionContext?.model || autoFitted?.model || null;
  const task = predictionContext?.predictionTask || autoFitted?.predictionTask || null;

  const isModelAvailable = !!model && !!task;

  const solvent1Name = predictionContext?.selectedSolvent1 || autoFitted?.selectedSolvent1 || savedSolv1 || 'Solvent 1';
  const solvent2Name = predictionContext?.selectedSolvent2 !== undefined
    ? predictionContext.selectedSolvent2
    : (autoFitted?.selectedSolvent2 !== undefined ? autoFitted.selectedSolvent2 : (savedSolv2 || ''));

  // Unique system key combining experiment ID and active solvent/mixture
  const currentSystemKey = useMemo(() => {
    const s1 = (solvent1Name || 'solv1').trim().toLowerCase();
    const s2 = (task !== 'temperature' ? (solvent2Name || '') : '').trim().toLowerCase();
    return `${experimentId}__${s1}__${s2}`;
  }, [experimentId, solvent1Name, solvent2Name, task]);

  // Dictionary of plans keyed by systemKey so state updates are instant and persisted
  const [plansBySystem, setPlansBySystem] = useState<Record<string, CrystallizationPlannerData>>(() => {
    const s1 = (solvent1Name || 'solv1').trim().toLowerCase();
    const s2 = (task !== 'temperature' ? (solvent2Name || '') : '').trim().toLowerCase();
    const initKey = `${experimentId}__${s1}__${s2}`;
    return {
      [initKey]: loadPlannerData(initKey)
    };
  });

  // Ensure current system data is loaded when switching to a different solvent system
  useEffect(() => {
    setPlansBySystem(prev => {
      if (prev[currentSystemKey]) return prev;
      return {
        ...prev,
        [currentSystemKey]: loadPlannerData(currentSystemKey)
      };
    });
  }, [currentSystemKey]);

  const currentPlan = useMemo(() => {
    return plansBySystem[currentSystemKey] || loadPlannerData(currentSystemKey);
  }, [plansBySystem, currentSystemKey]);

  const updateCurrentPlan = useCallback((updater: (prev: CrystallizationPlannerData) => CrystallizationPlannerData) => {
    setPlansBySystem(prev => {
      const existing = prev[currentSystemKey] || loadPlannerData(currentSystemKey);
      const updated = updater(existing);
      savePlannerData(currentSystemKey, updated);
      return { ...prev, [currentSystemKey]: updated };
    });
  }, [currentSystemKey]);

  const apiMassG = currentPlan.apiMassG;
  const setApiMassG = useCallback((val: string) => {
    updateCurrentPlan(prev => ({ ...prev, apiMassG: val }));
  }, [updateCurrentPlan]);

  const initVolMl = currentPlan.initVolMl;
  const setInitVolMl = useCallback((val: string) => {
    updateCurrentPlan(prev => ({ ...prev, initVolMl: val }));
  }, [updateCurrentPlan]);

  const tStart = currentPlan.tStart;
  const setTStart = useCallback((val: string) => {
    updateCurrentPlan(prev => ({ ...prev, tStart: val }));
  }, [updateCurrentPlan]);

  const tFinal = currentPlan.tFinal;
  const setTFinal = useCallback((val: string) => {
    updateCurrentPlan(prev => ({ ...prev, tFinal: val }));
  }, [updateCurrentPlan]);

  const fStart = currentPlan.fStart;
  const setFStart = useCallback((val: string) => {
    updateCurrentPlan(prev => ({ ...prev, fStart: val }));
  }, [updateCurrentPlan]);

  const fFinal = currentPlan.fFinal;
  const setFFinal = useCallback((val: string) => {
    updateCurrentPlan(prev => ({ ...prev, fFinal: val }));
  }, [updateCurrentPlan]);

  const seedingParams = currentPlan.seedingParams;
  const setSeedingParams = useCallback((action: React.SetStateAction<SeedingParams>) => {
    updateCurrentPlan(prev => ({
      ...prev,
      seedingParams: typeof action === 'function' ? action(prev.seedingParams) : action
    }));
  }, [updateCurrentPlan]);

  const scheduleParams = currentPlan.scheduleParams;
  const setScheduleParams = useCallback((action: React.SetStateAction<ReactorScheduleParams>) => {
    updateCurrentPlan(prev => ({
      ...prev,
      scheduleParams: typeof action === 'function' ? action(prev.scheduleParams) : action
    }));
  }, [updateCurrentPlan]);

  const washParams = currentPlan.washParams;
  const setWashParams = useCallback((action: React.SetStateAction<CakeWashParams>) => {
    updateCurrentPlan(prev => ({
      ...prev,
      washParams: typeof action === 'function' ? action(prev.washParams) : action
    }));
  }, [updateCurrentPlan]);

  const handleNumericInput = (val: string, setter: (val: string) => void) => {
    const clean = val.replace(/,/g, '.');
    if (/^[0-9]*\.?[0-9]*$/.test(clean) || (clean === '-' || /^-?[0-9]*\.?[0-9]*$/.test(clean))) {
      setter(clean);
    }
  };

  const getSolubility = (T: number, f?: number) => {
    if (!model) return 0;
    try {
      if (task === 'temperature') {
        const basePred = Math.max(0, model.predict({ T }).pred);
        // Inside crystallizer vessel (f is undefined or >= 100): exact saturation solubility in pure solvent
        if (f === undefined || f >= 100) return basePred;

        // For cake wash liquor or anti-solvent blends:
        // Even pure anti-solvents (water, heptane) have a realistic small finite residual solubility (~2% of base solubility or min 0.05 mg/mL)
        const cAnti = Math.max(0.05, basePred * 0.02);
        const frac = Math.max(0, Math.min(1, f / 100));
        return cAnti + (basePred - cAnti) * frac;
      }
      if (task === 'composition') {
        const pred = Math.max(0, model.predict({ f: (f !== undefined ? f : 100) / 100 }).pred);
        return Math.max(0.05, pred);
      }
      if (task === 'simultaneous') {
        const pred = Math.max(0, model.predict({ T, f: (f !== undefined ? f : 100) / 100 }).pred);
        return Math.max(0.05, pred);
      }
    } catch (e) {
      return 0;
    }
    return 0;
  };

  const calcResults = useMemo(() => {
    if (!isModelAvailable) return null;

    const parseNum = (val: string, fallback: number) => {
      if (val === '') return fallback;
      const n = parseFloat(val);
      return isNaN(n) ? fallback : n;
    };

    const pApiMassG = parseNum(apiMassG, 10);
    const pInitVolMl = parseNum(initVolMl, 100);
    const pTStart = parseNum(tStart, 60);
    const pTFinal = parseNum(tFinal, 20);
    const pFStart = parseNum(fStart, 100);
    const pFFinal = parseNum(fFinal, 50);

    if (pApiMassG <= 0 || pInitVolMl <= 0) return null;

    const cStart = getSolubility(pTStart, pFStart);
    const cFinal = getSolubility(pTFinal, pFFinal);

    const apiMassMg = pApiMassG * 1000;
    const cBatchStart = apiMassMg / pInitVolMl;
    
    // Anti-solvent math
    const vPrimary = pInitVolMl * (pFStart / 100);
    const finalVolMl = task === 'temperature' ? pInitVolMl : (pFFinal > 0 ? vPrimary / (pFFinal / 100) : pInitVolMl);
    const totalAddedAntiSolvent = finalVolMl - pInitVolMl;

    const isUndersaturated = cBatchStart < cStart;
    const dissolvedMgStart = Math.min(apiMassMg, cStart * pInitVolMl);
    
    // Mother liquor loss (solution loss)
    const mlLossG = (finalVolMl * cFinal) / 1000;
    const mlLossPct = pApiMassG > 0 ? (mlLossG / pApiMassG) * 100 : 0;
    const preWashSolidsG = Math.max(0, pApiMassG - mlLossG);
    const theoreticalYieldPct = Math.max(0, 100 * preWashSolidsG / pApiMassG);

    // Advanced Cake Wash & Holdup Modeling (Item 4)
    const primarySolventDensity = getSolventDensity(solvent1Name);
    const washResult = calculateAdvancedCakeWash(
      washParams,
      preWashSolidsG,
      pApiMassG,
      cFinal,
      getSolubility,
      seedingParams.crystalDensity,
      primarySolventDensity
    );

    const totalLossG = mlLossG + washResult.washLossG;
    const totalLossPct = mlLossPct + washResult.washLossPct;
    const finalRecoveredG = washResult.dryCakeMassG;
    const finalYieldPct = washResult.netIsolatedYieldPct;

    // Seeding calculations
    const seedingResult = calculateSeedingStrategy(
      getSolubility,
      task as 'temperature' | 'composition' | 'simultaneous',
      pApiMassG,
      pInitVolMl,
      pTStart,
      pTFinal,
      pFStart,
      pFFinal,
      totalAddedAntiSolvent,
      vPrimary,
      seedingParams
    );

    // Trajectories (Linear vs Cubic with dynamic desupersaturation model)
    const trajectoryData = calculateProcessTrajectories(
      task as 'temperature' | 'composition' | 'simultaneous',
      pApiMassG,
      pInitVolMl,
      pTStart,
      pTFinal,
      pFStart,
      pFFinal,
      totalAddedAntiSolvent,
      vPrimary,
      seedingResult,
      seedingParams,
      scheduleParams,
      getSolubility
    );

    // Phase diagram & trajectory overlay
    const phaseData = generatePhaseDiagram(
      getSolubility,
      task as 'temperature' | 'composition' | 'simultaneous',
      pTStart,
      pTFinal,
      pFStart,
      pFFinal,
      seedingParams.mszwScrit,
      cBatchStart,
      seedingResult.seedingT,
      seedingResult.seedingAntiSolventVol,
      seedingResult.saturationT,
      cFinal
    );

    // Time-Resolved Reactor Schedule (Item 3)
    const scheduleSummary = generateReactorSchedule(
      task as 'temperature' | 'composition' | 'simultaneous',
      scheduleParams,
      pTStart,
      pTFinal,
      pFStart,
      pFFinal,
      pInitVolMl,
      totalAddedAntiSolvent,
      vPrimary,
      seedingResult.seedingT,
      seedingResult.seedingAntiSolventVol,
      pApiMassG,
      getSolubility
    );

    // Green Chemistry Metrics (Item 5)
    const greenMetrics = calculateGreenMetrics(
      pApiMassG,
      pInitVolMl,
      totalAddedAntiSolvent,
      pFStart,
      solvent1Name,
      solvent2Name,
      washParams,
      washResult,
      seedingResult
    );

    // One-Click SOP Batch Record Document (Item 6)
    const sopDocument = generateSopDocument(
      task as 'temperature' | 'composition' | 'simultaneous',
      activeExperiment?.name || 'API Candidate',
      pApiMassG,
      pInitVolMl,
      pTStart,
      pTFinal,
      pFStart,
      pFFinal,
      totalAddedAntiSolvent,
      solvent1Name,
      solvent2Name,
      seedingResult,
      scheduleSummary,
      washParams,
      washResult,
      greenMetrics
    );

    return {
      cStart, cFinal,
      cBatchStart, isUndersaturated, dissolvedMgStart,
      mlLossG, totalLossG,
      mlLossPct, totalLossPct,
      theoreticalYieldPct, finalYieldPct,
      preWashSolidsG, finalRecoveredG,
      finalVolMl,
      totalAddedAntiSolvent,
      trajectoryData,
      seedingResult,
      phaseData,
      scheduleSummary,
      washResult,
      greenMetrics,
      sopDocument,
      pApiMassG,
      pInitVolMl,
      pTStart,
      pTFinal,
      pFStart,
      pFFinal
    };
  }, [isModelAvailable, tStart, tFinal, fStart, fFinal, apiMassG, initVolMl, task, model, seedingParams, scheduleParams, washParams, activeExperiment, solvent1Name, solvent2Name]);

  if (!isModelAvailable) {
    return (
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
        <Beaker size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
        <h3 className="text-lg font-medium text-slate-800 dark:text-slate-100 mb-2">No Solubility Model Available</h3>
        <p className="max-w-md mx-auto text-sm">
          Please provide calibrated samples in the <strong>Samples</strong> tab or fit a model in the <strong>Prediction</strong> tab to activate crystallization & seeding calculations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Layers className="text-blue-600" />
            Crystallization & Yield Planner
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Integrated QbD suite for seeding kinetics, reactor schedules, cake washing, green PMI metrics, and batch SOPs.
          </p>
        </div>

        {calcResults && (
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${calcResults.greenMetrics.ratingColor}`}>
              <Leaf size={14} />
              <span>PMI: <strong>{calcResults.greenMetrics.pmi}</strong></span>
            </div>

            <button
              type="button"
              onClick={() => setIsSopOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
              title="Generate batch crystallization standard operating procedure"
            >
              <FileText size={15} />
              <span>Export Recipe SOP</span>
            </button>
          </div>
        )}
      </div>

      {calcResults && (
        <div className="space-y-6">
          {/* 1. Executive Batch Yield & Mass Balance Hub (Top Overview) */}
          <BatchSummaryCard
            isUndersaturated={calcResults.isUndersaturated}
            cBatchStart={calcResults.cBatchStart}
            cStart={calcResults.cStart}
            pApiMassG={calcResults.pApiMassG}
            finalRecoveredG={calcResults.finalRecoveredG}
            finalYieldPct={calcResults.finalYieldPct}
            theoreticalYieldPct={calcResults.theoreticalYieldPct}
            preWashSolidsG={calcResults.preWashSolidsG}
            mlLossG={calcResults.mlLossG}
            mlLossPct={calcResults.mlLossPct}
            washResult={calcResults.washResult}
            totalLossG={calcResults.totalLossG}
            totalLossPct={calcResults.totalLossPct}
          />

          {/* 2. Process Parameters & Operating Conditions */}
          <ProcessParametersBar
            task={task as 'temperature' | 'composition' | 'simultaneous'}
            apiMassG={apiMassG}
            setApiMassG={setApiMassG}
            initVolMl={initVolMl}
            setInitVolMl={setInitVolMl}
            tStart={tStart}
            setTStart={setTStart}
            tFinal={tFinal}
            setTFinal={setTFinal}
            fStart={fStart}
            setFStart={setFStart}
            fFinal={fFinal}
            setFFinal={setFFinal}
            handleNumericInput={handleNumericInput}
            solvent1Name={solvent1Name}
            solvent2Name={solvent2Name}
            model={model}
            totalAddedAntiSolvent={calcResults.totalAddedAntiSolvent}
          />

          {/* 3. Phase Diagram Overlay & Operating Trajectory */}
          <PhaseDiagramChart
            phaseData={calcResults.phaseData}
            supersaturationData={calcResults.trajectoryData}
            seedingTargetS={seedingParams.targetS}
            mszwScrit={seedingParams.mszwScrit}
            task={task as 'temperature' | 'composition' | 'simultaneous'}
            totalCycleHours={scheduleParams.totalCycleHours}
          />

          {/* 4. Seeding Strategy & Metastable Window Calculator */}
          <SeedingCard
            seedingParams={seedingParams}
            setSeedingParams={setSeedingParams}
            seedingResult={calcResults.seedingResult}
            task={task as 'temperature' | 'composition' | 'simultaneous'}
            tStart={calcResults.pTStart}
            tFinal={calcResults.pTFinal}
            fStart={calcResults.pFStart}
            fFinal={calcResults.pFFinal}
            solvent1Name={solvent1Name}
            solvent2Name={solvent2Name}
            apiMassG={calcResults.pApiMassG}
            initVolMl={calcResults.pInitVolMl}
          />

          {/* 5. Reactor Dosing & Controlled Cooling Schedules */}
          <ReactorScheduleCard
            scheduleParams={scheduleParams}
            setScheduleParams={setScheduleParams}
            scheduleSummary={calcResults.scheduleSummary}
            task={task as 'temperature' | 'composition' | 'simultaneous'}
            solvent1Name={solvent1Name}
            solvent2Name={solvent2Name}
          />

          {/* 6. Advanced Cake Wash & Filtration Holdup Modeling */}
          <CakeWashFiltrationCard
            washParams={washParams}
            setWashParams={setWashParams}
            washResult={calcResults.washResult}
            solvent1Name={solvent1Name}
            solvent2Name={solvent2Name}
            apiMassG={calcResults.pApiMassG}
            task={task as 'temperature' | 'composition' | 'simultaneous'}
          />

          {/* 7. Process Mass Intensity (PMI) & Green Chemistry Metrics */}
          <GreenMetricsCard
            metrics={calcResults.greenMetrics}
            solvent1Name={solvent1Name}
            solvent2Name={solvent2Name}
            apiMassG={calcResults.pApiMassG}
          />
        </div>
      )}

      {/* Feature 6: One-Click SOP Batch Crystallization Record Modal */}
      {calcResults && (
        <BatchSopModal
          isOpen={isSopOpen}
          onClose={() => setIsSopOpen(false)}
          sop={calcResults.sopDocument}
          scheduleSummary={calcResults.scheduleSummary}
        />
      )}
    </div>
  );
};
