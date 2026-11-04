import React from 'react';
import {
  Filter,
  Droplets,
  Snowflake,
  ShieldCheck,
  AlertTriangle,
  Layers,
  ArrowRight,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-react';
import { CakeWashParams, CakeWashResult } from '../../utils/crystallization';

interface CakeWashFiltrationCardProps {
  washParams: CakeWashParams;
  setWashParams: React.Dispatch<React.SetStateAction<CakeWashParams>>;
  washResult: CakeWashResult;
  solvent1Name: string;
  solvent2Name: string;
  apiMassG: number;
  task?: 'temperature' | 'composition' | 'simultaneous';
}

export const CakeWashFiltrationCard: React.FC<CakeWashFiltrationCardProps> = ({
  washParams,
  setWashParams,
  washResult,
  solvent1Name,
  solvent2Name,
  apiMassG,
  task
}) => {
  const updateParam = <K extends keyof CakeWashParams>(key: K, val: CakeWashParams[K]) => {
    setWashParams(prev => ({ ...prev, [key]: val }));
  };

  const antiSolventLabel = solvent2Name
    ? `${solvent2Name} (Anti-Solvent)`
    : 'Anti-Solvent (e.g. Water / Heptane)';

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-lg">
            <Filter size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              Advanced Cake Wash & Filtration Holdup
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300">
                Solid-Liquid Isolation
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Model interstitial mother liquor displacement, cake porosity, and temperature/solvent-dependent dissolution loss.
            </p>
          </div>
        </div>

        {/* Quick Chilled Toggle */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium mr-1 whitespace-nowrap">Chiller:</span>
          <button
            type="button"
            onClick={() => updateParam('washTempC', 5)}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 whitespace-nowrap ${
              washParams.washTempC <= 5
                ? 'bg-sky-600 text-white font-medium shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Snowflake size={12} /> Chilled (5°C)
          </button>
          <button
            type="button"
            onClick={() => updateParam('washTempC', 20)}
            className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
              washParams.washTempC === 20
                ? 'bg-slate-700 text-white font-medium shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Ambient (20°C)
          </button>
        </div>
      </div>

      {/* Control Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* 1. Wash Solvent Composition */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>Wash Composition</span>
            <span className="text-[11px] font-bold text-amber-600">
              {washParams.washSolvent1Pct}% {solvent1Name}
            </span>
          </div>
          <div className="flex gap-1 mb-1">
            {[0, 20, 50, 100].map(pct => (
              <button
                key={pct}
                type="button"
                onClick={() => updateParam('washSolvent1Pct', pct)}
                className={`flex-1 py-0.5 text-[10px] rounded whitespace-nowrap transition-colors ${
                  Math.abs(washParams.washSolvent1Pct - pct) < 1
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {pct === 0 ? '100% Anti' : pct === 100 ? `100% S1` : `${pct}% S1`}
              </button>
            ))}
          </div>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={washParams.washSolvent1Pct}
            onChange={e => updateParam('washSolvent1Pct', parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
          />
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span className="truncate max-w-[170px]" title={`${100 - washParams.washSolvent1Pct}% ${antiSolventLabel}`}>
              {100 - washParams.washSolvent1Pct}% {antiSolventLabel}
            </span>
            <span className="font-mono text-amber-700 dark:text-amber-400 font-medium shrink-0">
              C*<sub>wash</sub>: {washResult.cWashEquilibrium.toFixed(2)} mg/mL
            </span>
          </div>
        </div>

        {/* 2. Wash Mode */}
        <div className="space-y-1.5">
          <label className="block text-xs text-slate-600 dark:text-slate-300 font-medium">
            Wash Mode
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => updateParam('washMode', 'displacement')}
              className={`p-1.5 text-xs rounded-lg border text-center transition-colors whitespace-nowrap ${
                washParams.washMode === 'displacement'
                  ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>Displacement</span>
              <span className="block text-[9px] font-normal text-slate-400">Plug Flow</span>
            </button>
            <button
              type="button"
              onClick={() => updateParam('washMode', 'reslurry')}
              className={`p-1.5 text-xs rounded-lg border text-center transition-colors whitespace-nowrap ${
                washParams.washMode === 'reslurry'
                  ? 'border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-semibold'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400'
              }`}
            >
              <span>Reslurry</span>
              <span className="block text-[9px] font-normal text-slate-400">Re-suspension</span>
            </button>
          </div>
          <span className="text-[10px] text-slate-400">
            {washParams.washMode === 'displacement' ? 'Low contact time, minimal erosion' : 'Complete contact, maximum purity'}
          </span>
        </div>

        {/* 3. Wash Volume & Repetitions */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>Wash Volume & Steps</span>
            <div className="flex gap-1">
              {[1, 2].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateParam('numberOfWashes', n)}
                  className={`px-1.5 py-0.2 text-[10px] rounded whitespace-nowrap ${
                    washParams.numberOfWashes === n
                      ? 'bg-amber-600 text-white font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {n}x
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="0"
              step="5"
              value={washParams.washVolMl}
              onChange={e => {
                const val = parseFloat(e.target.value);
                updateParam('washVolMl', isNaN(val) ? 0 : val);
              }}
              className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
            />
            <span className="text-xs text-slate-500 font-medium">mL</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {washResult.washBedVolumes.toFixed(1)} Bed Volumes (BV)
          </span>
        </div>

        {/* 4. Cake Porosity */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>Cake Porosity (ε)</span>
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              {washParams.cakePorosityPct}% void
            </span>
          </div>
          <input
            type="range"
            min="20"
            max="60"
            step="5"
            value={washParams.cakePorosityPct}
            onChange={e => updateParam('cakePorosityPct', parseInt(e.target.value))}
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-600"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>20% (Dense)</span>
            <span>35% (Typical)</span>
            <span>60% (Flocculated)</span>
          </div>
        </div>
      </div>

      {/* Diagnostic Message */}
      <div
        className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
          washResult.washLossPct < 2.0
            ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : washResult.washLossPct < 5.0
            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}
      >
        {washResult.washLossPct < 2.0 ? (
          <ShieldCheck size={17} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle size={17} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-semibold">{washResult.statusMessage}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/70 dark:bg-black/20 border border-current font-bold shrink-0">
              {washResult.washLossG > 0
                ? `-${washResult.washLossG < 0.001 ? '<0.001' : washResult.washLossG.toFixed(3)} g (${washResult.washLossPct < 0.01 ? '<0.01' : washResult.washLossPct}%)`
                : '0 g loss'}
            </span>
          </div>
          <div className="text-[11px] opacity-90 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>Solubility in wash liquor ({washParams.washTempC}°C): <strong>{washResult.cWashEquilibrium.toFixed(2)} mg/mL</strong></span>
            <span>Applied wash: <strong>{washResult.washBedVolumes} Bed Volumes (BV)</strong></span>
            {task === 'temperature' && !solvent2Name && (
              <span className="text-slate-500 dark:text-slate-400 italic">
                (Single-solvent: blend anti-solvent rinse to suppress dissolution)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 4-Column Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Trapped Mother Liquor */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Trapped Mother Liquor</span>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {washResult.trappedMotherLiquorMl.toFixed(1)} <span className="text-xs font-normal text-slate-500">mL</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Contains {washResult.trappedDissolvedApiG.toFixed(3)} g dissolved API
          </div>
        </div>

        {/* Impurity / Mother Liquor Displaced */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Mother Liquor Displaced</span>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {washResult.motherLiquorDisplacedPct}%
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Residual: {washResult.residualMotherLiquorG.toFixed(2)} g holdup
          </div>
        </div>

        {/* Wash Dissolution Loss */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Wash Dissolution Loss</span>
          <div className={`text-lg font-bold ${washResult.washLossPct > 4 ? 'text-rose-600' : 'text-amber-600'}`}>
            {washResult.washLossG > 0 && washResult.washLossG < 0.001 ? (
              <>
                <span title={`${washResult.washLossG.toFixed(4)} g`}>&lt;0.001</span>{' '}
                <span className="text-xs font-normal text-slate-500">g API</span>{' '}
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  ({(washResult.washLossG * 1000).toFixed(1)} mg)
                </span>
              </>
            ) : (
              <>
                {washResult.washLossG.toFixed(3)} <span className="text-xs font-normal text-slate-500">g API</span>
              </>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {washResult.washLossG > 0 && washResult.washLossPct < 0.01
              ? `<0.01% of initial ${apiMassG} g batch`
              : `${washResult.washLossPct}% of initial ${apiMassG} g batch`}
          </div>
        </div>

        {/* Wet to Dry Cake Ratio */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Wet Cake vs. Dry Cake</span>
          <div className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
            {washResult.dryCakeMassG.toFixed(2)} <span className="text-xs font-normal text-slate-500">g dry</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Wet: {washResult.wetCakeMassG.toFixed(2)} g ({washResult.wetToDryRatio}x ratio)
          </div>
        </div>
      </div>
    </div>
  );
};
