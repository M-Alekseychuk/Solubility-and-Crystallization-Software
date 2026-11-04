import React from 'react';
import { CheckCircle2, AlertTriangle, Droplets, Filter, Layers, Scale, Sparkles } from 'lucide-react';
import { CakeWashResult } from '../../utils/crystallization';

interface BatchSummaryCardProps {
  isUndersaturated: boolean;
  cBatchStart: number;
  cStart: number;
  pApiMassG: number;
  finalRecoveredG: number;
  finalYieldPct: number;
  theoreticalYieldPct: number;
  preWashSolidsG: number;
  mlLossG: number;
  mlLossPct: number;
  washResult: CakeWashResult;
  totalLossG: number;
  totalLossPct: number;
}

export const BatchSummaryCard: React.FC<BatchSummaryCardProps> = ({
  isUndersaturated,
  cBatchStart,
  cStart,
  pApiMassG,
  finalRecoveredG,
  finalYieldPct,
  theoreticalYieldPct,
  preWashSolidsG,
  mlLossG,
  mlLossPct,
  washResult,
  totalLossG,
  totalLossPct
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-4">
      {/* Header & Main KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-lg">
            <Layers size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              Batch Yield & Mass Balance Hub
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                isUndersaturated 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}>
                {isUndersaturated ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {isUndersaturated ? 'Undersaturated (Clear Solution)' : 'Supersaturated (Particulate Risk)'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Input: <strong>{pApiMassG.toFixed(2)} g</strong> API &bull; Initial C₀: <strong>{cBatchStart.toFixed(1)} mg/mL</strong> (C*: {cStart.toFixed(1)} mg/mL)
            </p>
          </div>
        </div>

        {/* Primary Isolated Recovery Callout */}
        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/60 px-4 py-2 rounded-xl border border-slate-100 dark:border-slate-800 self-start md:self-auto">
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Isolated Yield</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-tight">
              {finalYieldPct.toFixed(1)}%
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Dry Solids</span>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {finalRecoveredG.toFixed(2)} <span className="text-xs font-normal text-slate-500">g</span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Segmented Mass Balance Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300">
          <span>Mass Disposition Breakdown</span>
          <span className="text-[11px] text-slate-500">Total Accounted: 100% ({pApiMassG.toFixed(2)} g)</span>
        </div>

        <div className="h-3 w-full bg-slate-100 dark:bg-slate-700/60 rounded-full overflow-hidden flex shadow-inner">
          <div 
            className="bg-emerald-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, finalYieldPct))}%` }}
            title={`Isolated Dry Cake: ${finalRecoveredG.toFixed(2)} g (${finalYieldPct.toFixed(1)}%)`}
          />
          <div 
            className="bg-sky-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, mlLossPct))}%` }}
            title={`Mother Liquor Loss: ${mlLossG.toFixed(3)} g (${mlLossPct.toFixed(1)}%)`}
          />
          <div 
            className="bg-amber-500 transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, washResult.washLossPct))}%` }}
            title={`Cake Wash Loss: ${washResult.washLossG.toFixed(3)} g (${washResult.washLossPct.toFixed(1)}%)`}
          />
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-between gap-y-1.5 text-xs pt-1 text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
            <span>Isolated Cake: <strong className="text-emerald-700 dark:text-emerald-300">{finalRecoveredG.toFixed(2)} g</strong> ({finalYieldPct.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block shrink-0" />
            <span>Mother Liquor: <strong className="text-sky-700 dark:text-sky-300">{mlLossG.toFixed(3)} g</strong> ({mlLossPct.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shrink-0" />
            <span>Cake Wash: <strong className="text-amber-700 dark:text-amber-300">{washResult.washLossG.toFixed(3)} g</strong> ({washResult.washLossPct.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-medium">
            <span>Total Loss: <strong>{totalLossG.toFixed(3)} g</strong> ({totalLossPct.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Streamlined 4-Box Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-xs">
        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <div className="text-[11px] text-slate-500 mb-0.5">Pre-Wash Solids</div>
          <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{theoreticalYieldPct.toFixed(1)}%</div>
          <div className="text-[10px] text-slate-400">{preWashSolidsG.toFixed(2)} g in reactor</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <div className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1">
            <Droplets size={12} className="text-sky-500" />
            <span>Liquor Solubility Loss</span>
          </div>
          <div className="font-bold text-sky-700 dark:text-sky-400 text-sm">{mlLossG.toFixed(2)} g</div>
          <div className="text-[10px] text-sky-600/80 dark:text-sky-400/80">{mlLossPct.toFixed(1)}% at harvest T</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <div className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1">
            <Filter size={12} className="text-amber-500" />
            <span>Wash Dissolution Loss</span>
          </div>
          <div className="font-bold text-amber-700 dark:text-amber-400 text-sm">{washResult.washLossG.toFixed(2)} g</div>
          <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80">{washResult.washLossPct.toFixed(1)}% ({washResult.isChilled ? 'Chilled' : 'Ambient'})</div>
        </div>

        <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <div className="text-[11px] text-slate-500 mb-0.5 flex items-center gap-1">
            <Scale size={12} className="text-emerald-500" />
            <span>Final Isolated Mass</span>
          </div>
          <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">{finalRecoveredG.toFixed(2)} g</div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">{finalYieldPct.toFixed(1)}% net recovered</div>
        </div>
      </div>
    </div>
  );
};
