import React, { useState } from 'react';
import { Beaker, Sliders, ChevronUp, ChevronDown, Sparkles, Thermometer, Droplets, Info } from 'lucide-react';
import { RegressionResult } from '../../utils/models';

interface ProcessParametersBarProps {
  task: 'temperature' | 'composition' | 'simultaneous';
  apiMassG: string;
  setApiMassG: (val: string) => void;
  initVolMl: string;
  setInitVolMl: (val: string) => void;
  tStart: string;
  setTStart: (val: string) => void;
  tFinal: string;
  setTFinal: (val: string) => void;
  fStart: string;
  setFStart: (val: string) => void;
  fFinal: string;
  setFFinal: (val: string) => void;
  handleNumericInput: (val: string, setter: (v: string) => void) => void;
  solvent1Name: string;
  solvent2Name: string;
  model: RegressionResult | any | null;
  totalAddedAntiSolvent: number;
}

export const ProcessParametersBar: React.FC<ProcessParametersBarProps> = ({
  task,
  apiMassG,
  setApiMassG,
  initVolMl,
  setInitVolMl,
  tStart,
  setTStart,
  tFinal,
  setTFinal,
  fStart,
  setFStart,
  fFinal,
  setFFinal,
  handleNumericInput,
  solvent1Name,
  solvent2Name,
  model,
  totalAddedAntiSolvent
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const numApiMass = parseFloat(apiMassG) || 10;
  const numInitVol = parseFloat(initVolMl) || 100;
  const initialConcentration = numInitVol > 0 ? (numApiMass * 1000) / numInitVol : 0;

  const numTStart = parseFloat(tStart) || 60;
  const numTFinal = parseFloat(tFinal) || 20;
  const deltaT = numTStart - numTFinal;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs transition-all">
      {/* Header Bar */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/40 rounded-t-xl">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-100">
            <Sliders size={15} className="text-blue-600" />
            <span>Process Parameters & Operating Conditions</span>
          </div>

          <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          {/* System Model Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 border border-blue-200/70 dark:border-blue-800/70 text-blue-700 dark:text-blue-300 text-[11px]">
            <Beaker size={13} className="text-blue-500 shrink-0" />
            <span className="font-medium truncate max-w-[220px]" title={`${solvent1Name}${solvent2Name ? ` + ${solvent2Name}` : ''}`}>
              {solvent1Name} {task !== 'temperature' && solvent2Name ? `+ ${solvent2Name}` : ''}
            </span>
            <span className="text-blue-400">&bull;</span>
            <span className="font-mono text-[10px]">{model?.modelName || 'Best Fit Model'}</span>
          </div>
        </div>

        {/* Quick Summary / Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-500">
            <span>C₀: <strong className="text-slate-700 dark:text-slate-200">{initialConcentration.toFixed(1)} mg/mL</strong></span>
            {(task === 'temperature' || task === 'simultaneous') && (
              <span>&Delta;T: <strong className="text-slate-700 dark:text-slate-200">{deltaT.toFixed(0)} °C</strong></span>
            )}
            {(task === 'composition' || task === 'simultaneous') && totalAddedAntiSolvent > 0 && (
              <span>Anti-Solvent: <strong className="text-slate-700 dark:text-slate-200">{totalAddedAntiSolvent.toFixed(0)} mL</strong></span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={isExpanded ? 'Collapse parameters bar' : 'Expand parameters bar'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expandable Parameter Form */}
      {isExpanded && (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs animate-in fade-in duration-150">
          {/* 1. API Mass */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
              API Mass (g)
            </label>
            <input
              type="text"
              value={apiMassG}
              onChange={e => handleNumericInput(e.target.value, setApiMassG)}
              placeholder="10"
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 font-mono focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">Solute target</span>
          </div>

          {/* 2. Initial Volume */}
          <div>
            <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
              Initial Vol (mL)
            </label>
            <input
              type="text"
              value={initVolMl}
              onChange={e => handleNumericInput(e.target.value, setInitVolMl)}
              placeholder="100"
              className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 font-mono focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">C₀ = {initialConcentration.toFixed(1)} mg/mL</span>
          </div>

          {/* 3 & 4. Temperature Profile */}
          {(task === 'temperature' || task === 'simultaneous') && (
            <>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Start Temp (°C)
                </label>
                <input
                  type="text"
                  value={tStart}
                  onChange={e => handleNumericInput(e.target.value, setTStart)}
                  placeholder="60"
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 font-mono focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Dissolution T</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Final Temp (°C)
                </label>
                <input
                  type="text"
                  value={tFinal}
                  onChange={e => handleNumericInput(e.target.value, setTFinal)}
                  placeholder="20"
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 font-mono focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Isolation T (&Delta;T: {deltaT}°C)</span>
              </div>
            </>
          )}

          {/* 5 & 6. Anti-Solvent Composition Profile */}
          {(task === 'composition' || task === 'simultaneous') && (
            <>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 truncate" title={solvent1Name}>
                  Start {solvent1Name} (%)
                </label>
                <input
                  type="text"
                  value={fStart}
                  onChange={e => handleNumericInput(e.target.value, setFStart)}
                  placeholder="100"
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 font-mono focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">Primary solvent %</span>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1 truncate" title={solvent1Name}>
                  Final {solvent1Name} (%)
                </label>
                <input
                  type="text"
                  value={fFinal}
                  onChange={e => handleNumericInput(e.target.value, setFFinal)}
                  placeholder="50"
                  className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 font-mono focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">+{totalAddedAntiSolvent.toFixed(0)} mL anti-solvent</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
