import React from 'react';
import {
  Leaf,
  Scale,
  Sparkles,
  TrendingDown,
  Droplets,
  AlertCircle,
  HelpCircle,
  BarChart2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { GreenChemistryMetrics } from '../../utils/crystallization';

interface GreenMetricsCardProps {
  metrics: GreenChemistryMetrics;
  solvent1Name: string;
  solvent2Name: string;
  apiMassG: number;
}

export const GreenMetricsCard: React.FC<GreenMetricsCardProps> = ({
  metrics,
  solvent1Name,
  solvent2Name,
  apiMassG
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg">
            <Leaf size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              Process Mass Intensity (PMI) & Green Chemistry
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${metrics.ratingColor}`}>
                {metrics.ratingLabel}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ACS Green Chemistry Institute (GCI) metrics: mass efficiency, Sheldon E-Factor, and solvent waste intensity.
            </p>
          </div>
        </div>

        {/* Global Score Pill */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] text-slate-400 font-medium">Crystallization PMI</div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100">
              {metrics.pmi} <span className="text-xs font-normal text-slate-500">kg in / kg API</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4-KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* PMI */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
            <span>Process Mass Intensity</span>
            <Scale size={13} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{metrics.pmi}</span>
            <span className="text-xs text-slate-500">g in / g prod</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Solvent PMI: <strong className="text-slate-600 dark:text-slate-300">{metrics.solventPmi}</strong>
          </div>
        </div>

        {/* Sheldon E-Factor */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
            <span>Sheldon E-Factor</span>
            <TrendingDown size={13} className="text-blue-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{metrics.eFactor}</span>
            <span className="text-xs text-slate-500">g waste / g prod</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Total waste: {metrics.totalWasteG} g
          </div>
        </div>

        {/* Volumetric Productivity */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
            <span>Batch Productivity</span>
            <Droplets size={13} className="text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{metrics.volumetricProductivityGL}</span>
            <span className="text-xs text-slate-500">g / L</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Liquid efficiency: {metrics.solventEfficiencyPct}%
          </div>
        </div>

        {/* Product Recovery Ratio */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-0.5">
            <span>Isolated Product</span>
            <CheckCircle2 size={13} className="text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{metrics.dryProductG}</span>
            <span className="text-xs text-slate-500">g</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Of {metrics.totalMaterialsInG} g total inputs
          </div>
        </div>
      </div>

      {/* Industry Benchmark Slider */}
      <div className="p-3.5 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <BarChart2 size={14} className="text-emerald-600" />
            ACS GCI Pharmaceutical Roundtable Benchmark Comparison
          </span>
          <span className="text-[11px] text-slate-500">
            Industry Median: <strong>~{metrics.pharmaBenchmarkMedian}</strong> | Current: <strong className="text-emerald-600">{metrics.pmi}</strong>
          </span>
        </div>

        {/* Visual benchmark track */}
        <div className="relative pt-4 pb-2">
          {/* Track Bar */}
          <div className="h-3 w-full rounded-full bg-linear-to-r from-emerald-500 via-yellow-400 to-rose-500 overflow-hidden relative opacity-85" />

          {/* Industry Median Marker */}
          <div
            className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${Math.min(95, Math.max(5, (metrics.pharmaBenchmarkMedian / 80) * 100))}%` }}
          >
            <span className="text-[9px] font-bold text-slate-500 bg-white dark:bg-slate-800 px-1 py-0.2 rounded border border-slate-200 dark:border-slate-700 shadow-2xs">
              Median (28.5)
            </span>
            <div className="w-0.5 h-3 bg-slate-600 mt-0.5" />
          </div>

          {/* Current Batch Marker */}
          <div
            className="absolute top-0 transform -translate-x-1/2 flex flex-col items-center z-10"
            style={{ left: `${Math.min(95, Math.max(5, (metrics.pmi / 80) * 100))}%` }}
          >
            <span className="text-[10px] font-extrabold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-1.5 py-0.5 rounded shadow-sm">
              ★ {metrics.pmi}
            </span>
            <div className="w-1 h-3 bg-slate-900 dark:bg-white mt-0.5" />
          </div>
        </div>

        <div className="flex justify-between text-[10px] text-slate-400 pt-1">
          <span>&le; 15 (Elite / Green)</span>
          <span>15 – 30 (Optimized Pharma)</span>
          <span>30 – 60 (Standard Clinical)</span>
          <span>&gt; 60 (Solvent Intensive)</span>
        </div>
      </div>

      {/* Materials & Waste Breakdown Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inputs Breakdown */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
          <div className="bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-200 flex justify-between items-center">
            <span>Material Charges (Total In: {metrics.totalMaterialsInG} g)</span>
            <span className="text-[10px] text-slate-500 font-normal">Mass (g) / Vol (mL)</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 p-1">
            <div className="flex items-center justify-between p-2">
              <span className="text-slate-600 dark:text-slate-300 font-medium">API Solute (Solids)</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {metrics.apiInputG} g <span className="text-slate-400 text-[10px]">({((metrics.apiInputG / metrics.totalMaterialsInG) * 100).toFixed(1)}%)</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2">
              <span className="text-slate-600 dark:text-slate-300">Seed Crystal Bed</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {metrics.seedInputG} g <span className="text-slate-400 text-[10px]">({(metrics.seedInputG * 1000).toFixed(0)} mg)</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2">
              <span className="text-slate-600 dark:text-slate-300">Primary Solvent ({solvent1Name})</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {metrics.solvent1InputG} g <span className="text-slate-400 text-[10px]">({metrics.solvent1VolMl} mL)</span>
              </span>
            </div>
            {metrics.solvent2VolMl > 0 && (
              <div className="flex items-center justify-between p-2">
                <span className="text-slate-600 dark:text-slate-300">Anti-Solvent ({solvent2Name})</span>
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {metrics.solvent2InputG} g <span className="text-slate-400 text-[10px]">({metrics.solvent2VolMl} mL)</span>
                </span>
              </div>
            )}
            <div className="flex items-center justify-between p-2">
              <span className="text-slate-600 dark:text-slate-300">Cake Wash Liquor</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {metrics.washSolventInputG} g <span className="text-slate-400 text-[10px]">({metrics.washSolventVolMl} mL)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Effluent / Waste Stream Breakdown */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden text-xs">
          <div className="bg-slate-100 dark:bg-slate-800/80 px-3.5 py-2 font-semibold text-slate-700 dark:text-slate-200 flex justify-between items-center">
            <span>Outputs & Waste Streams (Total: {metrics.totalMaterialsInG} g)</span>
            <span className="text-[10px] text-slate-500 font-normal">Disposition</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 p-1">
            <div className="flex items-center justify-between p-2 bg-emerald-50/50 dark:bg-emerald-950/20">
              <span className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 size={13} /> Isolated Dry Product
              </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                {metrics.dryProductG} g <span className="text-[10px] font-normal">({((metrics.dryProductG / metrics.totalMaterialsInG) * 100).toFixed(1)}%)</span>
              </span>
            </div>
            <div className="flex items-center justify-between p-2">
              <span className="text-slate-600 dark:text-slate-300">Mother Liquor Filtrate (Waste)</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {metrics.motherLiquorWasteG} g
              </span>
            </div>
            <div className="flex items-center justify-between p-2">
              <span className="text-slate-600 dark:text-slate-300">Cake Wash Effluent (Waste)</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {metrics.washEffluentWasteG} g
              </span>
            </div>
            <div className="flex items-center justify-between p-2">
              <span className="text-slate-600 dark:text-slate-300">Unrecovered API in Solution</span>
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                {metrics.unrecoveredApiWasteG} g
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/40">
              <span className="text-slate-500 font-medium">Total Process Waste</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {metrics.totalWasteG} g (E = {metrics.eFactor})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actionable Green Optimization Advice */}
      <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
          <Sparkles size={14} className="text-emerald-600 shrink-0" />
          <span>Green Chemistry Process Optimization Insights</span>
        </div>
        <ul className="space-y-1 text-xs text-emerald-800 dark:text-emerald-300 pl-4 list-disc">
          {metrics.savingsOpportunityNotes.map((note, idx) => (
            <li key={idx} className="leading-snug">{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
