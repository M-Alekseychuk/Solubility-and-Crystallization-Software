import React from 'react';
import { Target, Sparkles, AlertTriangle, CheckCircle2, ShieldAlert, Clock, Info, ArrowDown, Activity, Layers, HelpCircle } from 'lucide-react';
import { SeedingParams, SeedingResult } from '../../utils/crystallization';

interface SeedingCardProps {
  seedingParams: SeedingParams;
  setSeedingParams: React.Dispatch<React.SetStateAction<SeedingParams>>;
  seedingResult: SeedingResult | null;
  task: 'temperature' | 'composition' | 'simultaneous';
  tStart: number;
  tFinal: number;
  fStart: number;
  fFinal: number;
  solvent1Name: string;
  solvent2Name: string;
  apiMassG: number;
  initVolMl: number;
}

export const SeedingCard: React.FC<SeedingCardProps> = ({
  seedingParams,
  setSeedingParams,
  seedingResult,
  task,
  tStart,
  tFinal,
  fStart,
  fFinal,
  solvent1Name,
  solvent2Name,
  apiMassG,
  initVolMl
}) => {
  const updateParam = <K extends keyof SeedingParams>(key: K, value: SeedingParams[K]) => {
    setSeedingParams(prev => ({ ...prev, [key]: value }));
  };

  const handleNumeric = (val: string, key: keyof SeedingParams, fallback: number) => {
    const clean = val.replace(/,/g, '.');
    if (/^[0-9]*\.?[0-9]*$/.test(clean)) {
      const num = parseFloat(clean);
      updateParam(key, isNaN(num) ? fallback : num);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
            <Target size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              Seeding Strategy & Metastable Window
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                Secondary Growth Control
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Establish crystal seeds within the metastable zone to eliminate spontaneous primary nucleation and ensure uniform CSD.
            </p>
          </div>
        </div>

        {/* Quick Seeding Presets */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => updateParam('targetS', 1.05)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              Math.abs(seedingParams.targetS - 1.05) < 0.001
                ? 'bg-emerald-600 text-white font-medium shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300'
            }`}
            title="Conservative seeding at low supersaturation (zero nucleation risk, gentle growth)"
          >
            Light (1.05)
          </button>
          <button
            type="button"
            onClick={() => updateParam('targetS', 1.10)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              Math.abs(seedingParams.targetS - 1.10) < 0.001
                ? 'bg-emerald-600 text-white font-medium shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300'
            }`}
            title="Standard industry recommended seeding window (optimal driving force & stability)"
          >
            Standard (1.10)
          </button>
          <button
            type="button"
            onClick={() => updateParam('targetS', 1.18)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              Math.abs(seedingParams.targetS - 1.18) < 0.001
                ? 'bg-emerald-600 text-white font-medium shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-600 dark:text-slate-300'
            }`}
            title="Aggressive driving force closer to MSZW boundary (faster initial kinetics)"
          >
            Fast (1.18)
          </button>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Target Supersaturation S */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>Target Seeding S (C/C*)</span>
            <span className="text-[11px] text-emerald-600 font-semibold">{seedingParams.targetS.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min="1.01"
            max="1.30"
            step="0.01"
            value={seedingParams.targetS}
            onChange={e => updateParam('targetS', parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>1.01 (Border)</span>
            <span>1.10 (Standard)</span>
            <span>1.30 (MSZW)</span>
          </div>
        </div>

        {/* 2. Seed Loading wt% */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>Seed Loading (wt%)</span>
            <div className="flex gap-1">
              {[1.0, 2.0, 3.0, 5.0].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => updateParam('seedLoadingPct', val)}
                  className={`px-1.5 py-0.2 text-[10px] rounded ${
                    Math.abs(seedingParams.seedLoadingPct - val) < 0.01
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                  }`}
                >
                  {val}%
                </button>
              ))}
            </div>
          </div>
          <input
            type="number"
            min="0.1"
            max="15"
            step="0.1"
            value={seedingParams.seedLoadingPct}
            onChange={e => updateParam('seedLoadingPct', Math.max(0.1, parseFloat(e.target.value) || 2.0))}
            className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
          />
          <span className="text-[10px] text-slate-400">Typical: 1.0 – 3.0 wt% of batch API</span>
        </div>

        {/* 3. Particle Size D50 */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>Seed Size D₅₀ (μm)</span>
            <span className="text-[11px] text-slate-500">{seedingParams.seedD50Um} μm</span>
          </label>
          <input
            type="number"
            min="5"
            max="200"
            step="5"
            value={seedingParams.seedD50Um}
            onChange={e => updateParam('seedD50Um', Math.max(5, parseFloat(e.target.value) || 25))}
            className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
          />
          <span className="text-[10px] text-slate-400">Milled seed slurry: 15–30 μm</span>
        </div>

        {/* 4. MSZW Limit Scrit */}
        <div className="space-y-1.5">
          <label className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>MSZW Limit (S_crit)</span>
            <span className="text-[11px] text-purple-600 font-semibold">{seedingParams.mszwScrit.toFixed(2)}</span>
          </label>
          <input
            type="number"
            min="1.10"
            max="1.80"
            step="0.05"
            value={seedingParams.mszwScrit}
            onChange={e => updateParam('mszwScrit', Math.max(1.1, parseFloat(e.target.value) || 1.30))}
            className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
          />
          <span className="text-[10px] text-slate-400">Metastable boundary (avg 1.25–1.40)</span>
        </div>
      </div>

      {/* Calculated Seeding Protocol Results */}
      {seedingResult && (
        <div className="space-y-3 pt-2">
          {/* Status Diagnostic Alert */}
          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              seedingResult.status === 'optimal'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : seedingResult.status === 'undersaturated_risk'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            {seedingResult.status === 'optimal' ? (
              <CheckCircle2 size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : seedingResult.status === 'undersaturated_risk' ? (
              <ShieldAlert size={17} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={17} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <span className="font-semibold">{seedingResult.statusMessage}</span>
              <div className="text-[11px] opacity-90 mt-0.5">
                Seed aging period: Hold isothermally for{' '}
                <strong>{seedingParams.agingTimeMin} minutes</strong> to establish seed bed equilibrium before initiating cooling/dosing.
              </div>
            </div>
          </div>

          {/* Key Output Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Seeding Temperature or Anti-Solvent Volume */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">
                {task === 'temperature' ? 'Seeding Temp (T_seed)' : 'Anti-Solvent at Seeding'}
              </span>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {task === 'temperature' ? (
                  seedingResult.seedingT !== null ? `${seedingResult.seedingT} °C` : 'N/A'
                ) : (
                  seedingResult.seedingAntiSolventVol !== null ? `${seedingResult.seedingAntiSolventVol} mL` : 'N/A'
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {task === 'temperature' ? (
                  `ΔT Subcooling: ${seedingResult.seedingSubcoolingT !== null ? `${seedingResult.seedingSubcoolingT}°C` : '—'}`
                ) : (
                  `${solvent1Name} %: ${seedingResult.seedingSolvent1Fraction !== null ? `${seedingResult.seedingSolvent1Fraction}%` : '—'}`
                )}
              </div>
            </div>

            {/* Seed Mass Required */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Seed Mass Charge</span>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {seedingResult.seedMassG >= 1
                  ? `${seedingResult.seedMassG.toFixed(3)} g`
                  : `${seedingResult.seedMassMg.toFixed(1)} mg`}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {seedingParams.seedLoadingPct.toFixed(1)}% of {apiMassG} g batch
              </div>
            </div>

            {/* Specific Surface Area */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Specific Surface Area</span>
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {seedingResult.specificSurfaceAreaM2g.toFixed(3)} <span className="text-xs font-normal text-slate-500">m²/g</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Total: {seedingResult.totalSurfaceAreaM2.toFixed(4)} m² ({Math.round(seedingResult.totalSurfaceAreaM2 * 10000)} cm²)
              </div>
            </div>

            {/* Bed Density & Trajectory Position */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Process Trajectory Point</span>
              <div className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                {seedingResult.seedingProgressPct}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Hold duration: {seedingParams.agingTimeMin} min
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
