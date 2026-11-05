import React, { useState } from 'react';
import { X, ShieldAlert, ShieldCheck, Leaf, Flame, HeartPulse, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Solvent, EhsBreakdown } from '../types';
import { BinaryMixtureCandidate, getEhsBreakdown } from '../utils/greenChemistry';

interface EhsRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceSolvent: Solvent | null;
  selectedCandidate: { solvent: Solvent; similarity: number } | null;
  selectedBinaryMixture?: BinaryMixtureCandidate | null;
  allCandidates: Array<{ solvent: Solvent; similarity: number }>;
  binaryMixtures?: BinaryMixtureCandidate[];
  onSelectCandidate?: (cand: { solvent: Solvent; similarity: number } | null) => void;
  onSelectBinary?: (bin: BinaryMixtureCandidate | null) => void;
}

export function EhsRadarModal({
  isOpen,
  onClose,
  referenceSolvent,
  selectedCandidate,
  selectedBinaryMixture,
  allCandidates,
  binaryMixtures = [],
  onSelectCandidate,
  onSelectBinary
}: EhsRadarModalProps) {
  if (!isOpen || !referenceSolvent) return null;

  const refBreakdown: EhsBreakdown = getEhsBreakdown(referenceSolvent);

  // Determine comparison target: binary mixture or pure candidate
  const isBinary = !!selectedBinaryMixture;
  const candidateName = isBinary
    ? selectedBinaryMixture!.name
    : (selectedCandidate?.solvent.name || 'Select Candidate');

  const candBreakdown: EhsBreakdown = isBinary
    ? selectedBinaryMixture!.ehsBreakdown
    : (selectedCandidate ? getEhsBreakdown(selectedCandidate.solvent) : {
        health: 5,
        safety: 5,
        environment: 5,
        overall: 5,
      });

  const candEhsScore = isBinary
    ? selectedBinaryMixture!.ehsScore
    : (Number(selectedCandidate?.solvent.ehsScore) || 5);

  const refEhsScore = Number(referenceSolvent.ehsScore) || 4;

  const radarData = [
    {
      metric: 'Health & Tox',
      reference: refBreakdown.health,
      candidate: candBreakdown.health,
      fullMark: 10,
    },
    {
      metric: 'Process Safety',
      reference: refBreakdown.safety,
      candidate: candBreakdown.safety,
      fullMark: 10,
    },
    {
      metric: 'Environmental Fate',
      reference: refBreakdown.environment,
      candidate: candBreakdown.environment,
      fullMark: 10,
    },
  ];

  const ehsDelta = candEhsScore - refEhsScore;
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">EHS Environmental, Health & Safety Comparison</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Multi-axis toxicological and safety assessment comparing problem solvent vs greener alternative
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Candidate Selector Switcher */}
        <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Comparing Against:</span>
            <select
              value={isBinary ? `bin_${selectedBinaryMixture!.id}` : (selectedCandidate ? `sol_${selectedCandidate.solvent.id}` : '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('bin_')) {
                  const binId = val.replace('bin_', '');
                  const match = binaryMixtures.find(b => b.id === binId);
                  if (match && onSelectBinary) {
                    onSelectBinary(match);
                    if (onSelectCandidate) onSelectCandidate(null);
                  }
                } else if (val.startsWith('sol_')) {
                  const solId = val.replace('sol_', '');
                  const match = allCandidates.find(c => c.solvent.id === solId);
                  if (match && onSelectCandidate) {
                    onSelectCandidate(match);
                    if (onSelectBinary) onSelectBinary(null);
                  }
                }
              }}
              className="border border-slate-300 dark:border-slate-700 rounded-md py-1 px-2.5 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <optgroup label="Pure Solvent Candidates">
                {allCandidates.map(c => (
                  <option key={c.solvent.id} value={`sol_${c.solvent.id}`}>
                    {c.solvent.name} (ICH Cl. {c.solvent.ichClass || '?'}, EHS {c.solvent.ehsScore || '-'}, {c.similarity.toFixed(0)}% sim)
                  </option>
                ))}
              </optgroup>
              {binaryMixtures.length > 0 && (
                <optgroup label="Optimized Binary Mixtures">
                  {binaryMixtures.map(b => (
                    <option key={b.id} value={`bin_${b.id}`}>
                      🧪 {b.name} (EHS {b.ehsScore}, {b.similarity.toFixed(0)}% sim)
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 dark:bg-rose-950/60 text-red-700 dark:text-rose-300 border border-transparent dark:border-rose-900/50">
              Reference: {referenceSolvent.name}
            </span>
            <ArrowRight size={14} className="text-slate-400" />
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-900/50">
              {candidateName}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Banner: Improvement Score */}
          <div className={`p-4 rounded-xl border flex items-center justify-between ${
            ehsDelta >= 0 
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70' 
              : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${ehsDelta >= 0 ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>
                {ehsDelta >= 0 ? <ShieldCheck size={24} /> : <ShieldAlert size={24} />}
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  {ehsDelta > 0
                    ? `Overall EHS Improvement: +${ehsDelta.toFixed(1)} Points`
                    : ehsDelta === 0
                    ? 'Equivalent Overall EHS Score'
                    : `Slight Trade-off: ${ehsDelta.toFixed(1)} Points`}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {ehsDelta > 0
                    ? `Replacing ${referenceSolvent.name} with ${candidateName} significantly reduces process toxicity and environmental burden.`
                    : `Review individual Health, Safety, and Environmental scores below to assess trade-offs.`}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-2xl font-black text-slate-800 dark:text-white">
                {refEhsScore} <span className="text-slate-400 font-normal">→</span> <span className="text-emerald-700 dark:text-emerald-400">{candEhsScore}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Overall EHS / 10</div>
            </div>
          </div>

          {/* Grid: Radar Chart + 3 Pillars Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Radar Chart (Col 5) */}
            <div className="lg:col-span-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center min-h-[300px]">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 text-center">
                EHS 3-Axis Hazard Radar
              </h5>
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke={isDark ? '#475569' : '#cbd5e1'} strokeDasharray="3 3" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: isDark ? '#cbd5e1' : '#334155', fontSize: 12, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 shadow-lg text-xs">
                              <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-1 mb-1">
                                {data.metric}
                              </div>
                              <div className="text-red-600 dark:text-rose-400 font-medium">
                                {referenceSolvent.name}: {data.reference}/10
                              </div>
                              <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                                {candidateName}: {data.candidate}/10
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Radar
                      name={referenceSolvent.name}
                      dataKey="reference"
                      stroke="#dc2626"
                      fill="#dc2626"
                      fillOpacity={0.25}
                    />
                    <Radar
                      name={candidateName}
                      dataKey="candidate"
                      stroke="#059669"
                      fill="#059669"
                      fillOpacity={0.35}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 text-center mt-1">
                Scale 1-10: 10 represents highest safety / least hazard.
              </p>
            </div>

            {/* 3 Pillars Details (Col 7) */}
            <div className="lg:col-span-7 space-y-3">
              {/* Pillar 1: Health */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <HeartPulse size={16} className="text-rose-500" />
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">1. Occupational Health & Toxicology</span>
                  </div>
                  <div className="text-xs font-semibold">
                    <span className="text-red-600 dark:text-rose-400">{refBreakdown.health}/10</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{candBreakdown.health}/10</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div>
                    <strong className="text-red-700 dark:text-rose-400">{referenceSolvent.name}:</strong> {refBreakdown.healthNotes}
                  </div>
                  <div>
                    <strong className="text-emerald-800 dark:text-emerald-300">{candidateName}:</strong> {candBreakdown.healthNotes}
                  </div>
                </div>
              </div>

              {/* Pillar 2: Safety & Flammability */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-amber-500" />
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">2. Process Safety & Flammability</span>
                  </div>
                  <div className="text-xs font-semibold">
                    <span className="text-red-600 dark:text-rose-400">{refBreakdown.safety}/10</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{candBreakdown.safety}/10</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div>
                    <strong className="text-red-700 dark:text-rose-400">{referenceSolvent.name}:</strong> {refBreakdown.safetyNotes}
                  </div>
                  <div>
                    <strong className="text-emerald-800 dark:text-emerald-300">{candidateName}:</strong> {candBreakdown.safetyNotes}
                  </div>
                </div>
              </div>

              {/* Pillar 3: Environmental Impact */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Leaf size={16} className="text-green-600" />
                    <span className="font-bold text-sm text-slate-800 dark:text-slate-100">3. Environmental Fate & VOC Emissions</span>
                  </div>
                  <div className="text-xs font-semibold">
                    <span className="text-red-600 dark:text-rose-400">{refBreakdown.environment}/10</span>
                    <span className="text-slate-400 mx-1">→</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{candBreakdown.environment}/10</span>
                  </div>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <div>
                    <strong className="text-red-700 dark:text-rose-400">{referenceSolvent.name}:</strong> {refBreakdown.envNotes}
                  </div>
                  <div>
                    <strong className="text-emerald-800 dark:text-emerald-300">{candidateName}:</strong> {candBreakdown.envNotes}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-medium text-xs rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
