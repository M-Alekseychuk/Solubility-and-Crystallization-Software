import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Leaf, Search, ArrowRight, Activity, Filter, Download, Droplet, Compass, ShieldCheck, Sparkles, Layers, DollarSign, ExternalLink, Beaker, ChevronDown } from 'lucide-react';
import { Solvent, Experiment, SampleData } from '../types';
import { getSolventNames, defaultSolvents, extendedSolvents } from '../data/solvents';
import * as XLSX from 'xlsx-js-style';
import { HansenSpaceModal } from './HansenSpaceModal';
import { EhsRadarModal } from './EhsRadarModal';
import { calculateBinaryMixtures, BinaryMixtureCandidate, getEhsBreakdown } from '../utils/greenChemistry';

interface GreenReplacementTabProps {
  activeExperiment: Experiment | null;
}

export function GreenReplacementTab({ activeExperiment }: GreenReplacementTabProps) {
  const solvents = extendedSolvents;

  const [referenceSolventName, setReferenceSolventName] = useState<string>(() => {
    return localStorage.getItem('hplc-green-reference-solvent') || '';
  });

  useEffect(() => {
    localStorage.setItem('hplc-green-reference-solvent', referenceSolventName);
  }, [referenceSolventName]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [minBp, setMinBp] = useState<number | ''>('');
  const [minSolubility, setMinSolubility] = useState<number | ''>('');
  const [acceptableIchClasses, setAcceptableIchClasses] = useState<number[]>([2, 3]);
  const [allowBinaryMixtures, setAllowBinaryMixtures] = useState<boolean>(true);

  // Modals state
  const [showHansenModal, setShowHansenModal] = useState<boolean>(false);
  const [showEhsModal, setShowEhsModal] = useState<boolean>(false);
  const [selectedEhsCandidate, setSelectedEhsCandidate] = useState<{ solvent: Solvent; similarity: number } | null>(null);
  const [selectedEhsBinary, setSelectedEhsBinary] = useState<BinaryMixtureCandidate | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleIchClass = (ichClass: number) => {
    setAcceptableIchClasses(prev => 
      prev.includes(ichClass) ? prev.filter(c => c !== ichClass) : [...prev, ichClass]
    );
  };

  const getExperimentalSolubility = (solventName: string) => {
    if (!activeExperiment || !activeExperiment.calibrationResult.valid) return null;
    const samples = activeExperiment.samples.filter(s => s.solvent1 === solventName && !s.solvent2 && !s.excluded);
    if (samples.length === 0) return null;
    
    // Average area
    const avgArea = samples.reduce((sum, s) => sum + Number(s.area), 0) / samples.length;
    // Calc conc: x = (y - b) / m
    const concMgMl = (avgArea - activeExperiment.calibrationResult.intercept) / activeExperiment.calibrationResult.slope;
    return Math.max(0, concMgMl);
  };

  const referenceSolvent = useMemo(() => {
    return solvents.find(s => s.name === referenceSolventName) || null;
  }, [solvents, referenceSolventName]);

  const scoredCandidates = useMemo(() => {
    if (!referenceSolvent) return [];

    const refDc = Number(referenceSolvent.dielectricConstant) || 0;
    const refPi = Number(referenceSolvent.polarityIndex) || 0;
    const refBp = Number(referenceSolvent.boilingPoint) || 0;

    const refHD = referenceSolvent.hansenD;
    const refHP = referenceSolvent.hansenP;
    const refHH = referenceSolvent.hansenH;
    const hasRefHansen = refHD !== undefined && refHP !== undefined && refHH !== undefined;

    const maxDc = 100;
    const maxPi = 10;
    const maxBp = 300;

    let candidates = solvents.filter(s => s.id !== referenceSolvent.id);

    // Filter missing Hansen parameters if reference has them
    if (hasRefHansen) {
      candidates = candidates.filter(s => s.hansenD !== undefined && s.hansenP !== undefined && s.hansenH !== undefined);
    }

    // Apply filters
    if (minBp !== '') {
      candidates = candidates.filter(s => Number(s.boilingPoint) >= minBp);
    }
    candidates = candidates.filter(s => {
      const ich = s.ichClass as number;
      if (!ich) return true; // Keep unknown
      return acceptableIchClasses.includes(ich);
    });

    return candidates.map(s => {
      let similarity = 0;
      let distance = 0;
      let usedHansen = false;

      const sHD = s.hansenD;
      const sHP = s.hansenP;
      const sHH = s.hansenH;
      const hasHansen = sHD !== undefined && sHP !== undefined && sHH !== undefined;

      if (hasRefHansen && hasHansen) {
        // Use Hansen distance (Ra)
        // Ra^2 = 4(dD1 - dD2)^2 + (dP1 - dP2)^2 + (dH1 - dH2)^2
        const Ra = Math.sqrt(
          4 * Math.pow(sHD! - refHD!, 2) + 
          Math.pow(sHP! - refHP!, 2) + 
          Math.pow(sHH! - refHH!, 2)
        );
        distance = Ra;
        // Normalize Ra to 0-100%. Usually Ra > 20 is completely dissimilar. 
        // We map Ra 0 -> 100%, Ra 15 -> 0%
        similarity = Math.max(0, 100 - (Ra / 15) * 100);
        usedHansen = true;
      } else {
        // Fallback to legacy distance
        const dc = Number(s.dielectricConstant) || 0;
        const pi = Number(s.polarityIndex) || 0;
        const bp = Number(s.boilingPoint) || 0;

        const deltaDc = (dc - refDc) / maxDc;
        const deltaPi = (pi - refPi) / maxPi;
        const deltaBp = (bp - refBp) / maxBp;

        distance = Math.sqrt(
          (0.4 * deltaDc * deltaDc) +
          (0.5 * deltaPi * deltaPi) +
          (0.1 * deltaBp * deltaBp)
        );
        similarity = Math.max(0, 100 - (distance * 100));
      }

      const expSol = getExperimentalSolubility(s.name);

      return {
        solvent: s,
        similarity,
        distance,
        usedHansen,
        expSolubility: expSol
      };
    }).sort((a, b) => b.similarity - a.similarity);

  }, [solvents, referenceSolvent, minBp, acceptableIchClasses, activeExperiment]);

  const filteredCandidates = useMemo(() => {
    let list = scoredCandidates;
    if (minSolubility !== '') {
      list = list.filter(c => c.expSolubility === null || c.expSolubility >= minSolubility);
    }
    return list;
  }, [scoredCandidates, minSolubility]);

  const dropInReplacements = filteredCandidates.slice(0, 9);
  const greenTier = filteredCandidates.filter(
    c => c.solvent.ichClass === 3 && c.similarity > 70 && !dropInReplacements.find(dr => dr.solvent.id === c.solvent.id)
  );

  // Binary mixture recommendations
  const binaryMixtures = useMemo(() => {
    if (!referenceSolvent || !allowBinaryMixtures) return [];

    // Evaluate green candidates (Class 3 or acceptable ICH classes)
    const eligibleSolvents = solvents.filter(s => {
      const ich = Number(s.ichClass);
      return acceptableIchClasses.includes(ich || 3);
    });

    return calculateBinaryMixtures(referenceSolvent, eligibleSolvents, 9);
  }, [referenceSolvent, solvents, acceptableIchClasses, allowBinaryMixtures]);

  const getIchBadge = (ichClass?: number | '') => {
    switch(ichClass) {
      case 1: return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-800">Class 1</span>;
      case 2: return <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800">Class 2</span>;
      case 3: return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-800">Class 3</span>;
      default: return <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600">Unknown</span>;
    }
  };

  const getEhsColor = (score?: number | '') => {
    const num = Number(score);
    if (!num) return 'bg-slate-200';
    if (num >= 8) return 'bg-green-500';
    if (num >= 5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const handleExport = () => {
    const expName = activeExperiment ? activeExperiment.name.replace(/[^a-z0-9]/gi, '_') : 'Experiment';
    
    // Excel Export
    const wb = XLSX.utils.book_new();

    // Sheet 1: Pure Replacements
    const wsData = filteredCandidates.map(c => ({
      'Candidate': c.solvent.name,
      'Similarity (%)': Number(c.similarity.toFixed(1)),
      'ICH Class': c.solvent.ichClass || 'Unknown',
      'EHS Score': c.solvent.ehsScore || 'Unknown',
      'Cost ($/kg)': c.solvent.costPerKg !== '' && c.solvent.costPerKg !== undefined ? Number(c.solvent.costPerKg) : '',
      'Boiling Point (°C)': c.solvent.boilingPoint,
      'Polarity Index': c.solvent.polarityIndex,
      'Dielectric Constant': c.solvent.dielectricConstant,
      'Measured Sol. (mg/mL)': c.expSolubility !== null ? Number(c.expSolubility.toFixed(2)) : 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Pure Replacements');

    // Sheet 2: Binary Mixtures (if generated)
    if (binaryMixtures.length > 0) {
      const binWsData = binaryMixtures.map(b => ({
        'Binary Blend': b.name,
        'Solvent A': b.solvent1.name,
        'Solvent B': b.solvent2.name,
        'Ratio (% Vol)': `${Math.round(b.fraction1 * 100)} / ${Math.round(b.fraction2 * 100)}`,
        'Similarity (%)': Number(b.similarity.toFixed(1)),
        'Blended EHS': b.ehsScore,
        'Blended Cost ($/kg)': b.costPerKg !== undefined ? b.costPerKg : 'N/A',
        'Blended BP (°C)': b.boilingPoint,
        'Blended Polarity': b.polarityIndex,
        'Hansen dD': b.hansenD,
        'Hansen dP': b.hansenP,
        'Hansen dH': b.hansenH,
      }));
      const binWs = XLSX.utils.json_to_sheet(binWsData);
      XLSX.utils.book_append_sheet(wb, binWs, 'Binary Mixtures');
    }

    XLSX.writeFile(wb, `${expName}_Green_Replacements.xlsx`);
  };

  const handleOpenEhsForCandidate = (cand: typeof filteredCandidates[0]) => {
    setSelectedEhsCandidate(cand);
    setSelectedEhsBinary(null);
    setShowEhsModal(true);
  };

  const handleOpenEhsForBinary = (bin: BinaryMixtureCandidate) => {
    setSelectedEhsBinary(bin);
    setSelectedEhsCandidate(null);
    setShowEhsModal(true);
  };

  const CandidateCard = ({ data, isDropIn }: { data: typeof filteredCandidates[0], isDropIn: boolean }) => (
    <div className={`p-4 rounded-xl border ${isDropIn ? 'bg-blue-50/30 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} shadow-xs flex flex-col justify-between relative`}>
      <div>
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {data.solvent.name}
            {getIchBadge(data.solvent.ichClass)}
          </h4>
          <div className="text-right">
            <div className="text-xl font-bold text-slate-700 dark:text-slate-100">{data.similarity.toFixed(1)}%</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Similarity</div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs mt-3">
          <div>
            <span className="text-slate-500 dark:text-slate-400">EHS Score:</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${getEhsColor(data.solvent.ehsScore)}`}
                  style={{ width: `${(Number(data.solvent.ehsScore) || 0) * 10}%` }}
                ></div>
              </div>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{data.solvent.ehsScore || '-'}</span>
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Bulk Cost:</span>
            <div className="font-medium text-slate-700 dark:text-slate-200 mt-1">
              {data.solvent.costPerKg !== '' && data.solvent.costPerKg !== undefined
                ? `$${Number(data.solvent.costPerKg).toFixed(2)} / kg`
                : <span className="text-slate-400 dark:text-slate-500 italic">Not set</span>}
            </div>
          </div>

          <div>
            <span className="text-slate-500 dark:text-slate-400">Boiling Pt:</span>
            <div className="font-medium text-slate-700 dark:text-slate-200">{data.solvent.boilingPoint}°C</div>
          </div>
          <div>
            <span className="text-slate-500 dark:text-slate-400">Polarity Index:</span>
            <div className="font-medium text-slate-700 dark:text-slate-200">{data.solvent.polarityIndex}</div>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500 dark:text-slate-400">Measured Sol:</span>
            <div className={`font-medium ${data.expSolubility !== null ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
              {data.expSolubility !== null ? `${data.expSolubility.toFixed(2)} mg/mL` : 'No data in active experiment'}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
        <button
          onClick={() => handleOpenEhsForCandidate(data)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-2.5 py-1 rounded-md transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
          title="Compare detailed Health, Safety & Environment profile against reference"
        >
          <ShieldCheck size={14} />
          Compare EHS
        </button>

        {data.usedHansen && (
          <span className="text-[10px] text-slate-400 font-mono" title="Matched using 3D Hansen Solubility Parameters">
            HSP matched
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Search & Filter Bar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Leaf size={20} className="text-green-600" />
                Green Chemistry Replacement Engine
              </h2>
            </div>
            <p className="text-sm text-slate-500 mb-6">
              Find safer, regulatory-compliant replacements for toxic or problematic solvents based on 3D Hansen solubility parameters, physical properties, and ICH safety classifications.
            </p>

            <div className="space-y-4">
              <div ref={dropdownRef} className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Reference Problem Solvent (To Replace)
                </label>
                <div 
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white cursor-pointer flex items-center justify-between"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  <span className={referenceSolventName ? "text-slate-800" : "text-slate-500"}>
                    {referenceSolventName || '-- Select a solvent to replace --'}
                  </span>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 flex flex-col">
                    <div className="p-2 border-b border-slate-100 bg-white sticky top-0 rounded-t-lg">
                      <div className="relative">
                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search solvent..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded text-sm outline-none focus:border-green-500"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {solvents
                        .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(s => (
                        <div
                          key={s.id}
                          className="px-3 py-2 text-sm hover:bg-slate-50 cursor-pointer text-slate-700"
                          onClick={() => {
                            setReferenceSolventName(s.name);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          {s.name} {s.ichClass ? <span className="text-slate-400 text-xs">(Class {s.ichClass})</span> : ''} {s.ehsScore ? <span className="text-slate-400 text-xs">[EHS {s.ehsScore}]</span> : ''}
                        </div>
                      ))}
                      {solvents.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <div className="px-3 py-4 text-sm text-center text-slate-500">
                          No solvents found matching "{searchQuery}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Min. Boiling Point (°C)
                  </label>
                  <input
                    type="number"
                    value={minBp}
                    onChange={(e) => setMinBp(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    placeholder="e.g. 50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Min. Measured Solubility (mg/mL)
                  </label>
                  <input
                    type="number"
                    value={minSolubility}
                    onChange={(e) => setMinSolubility(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    placeholder="Require measured sol."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-2">
                  Acceptable Candidate ICH Q3C Classes
                </label>
                <div className="flex gap-4">
                  {[1, 2, 3].map(c => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={acceptableIchClasses.includes(c)}
                        onChange={() => toggleIchClass(c)}
                        className="rounded border-slate-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-slate-700">Class {c}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Binary Mixture Toggle Checkbox */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowBinaryMixtures}
                    onChange={(e) => setAllowBinaryMixtures(e.target.checked)}
                    className="rounded border-purple-300 dark:border-purple-700 text-purple-600 focus:ring-purple-500 h-4 w-4"
                  />
                  <span className="text-sm font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <Beaker size={16} className="text-purple-600 dark:text-purple-400" />
                    Allow binary solvent mixture recommendations
                  </span>
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 ml-6 mt-0.5">
                  Calculates synergistic blends of two green solvents to closely match the reference solvent's Hansen solubility sphere.
                </p>
              </div>
            </div>
          </div>
          
          {referenceSolvent && (
            <div className="w-full lg:w-80 bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-700 pb-2.5">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Target Reference Profile</h3>
                  {getIchBadge(referenceSolvent.ichClass)}
                </div>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Name:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{referenceSolvent.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">EHS Score:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100">{referenceSolvent.ehsScore || '-'}/10</span>
                      <div className="w-12 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ${getEhsColor(referenceSolvent.ehsScore)}`}
                          style={{ width: `${(Number(referenceSolvent.ehsScore) || 0) * 10}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Boiling Point:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{referenceSolvent.boilingPoint}°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Polarity Index:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{referenceSolvent.polarityIndex}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Hansen HSP:</span>
                    <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {referenceSolvent.hansenD !== undefined 
                        ? `${referenceSolvent.hansenD} / ${referenceSolvent.hansenP} / ${referenceSolvent.hansenH}` 
                        : 'No HSP data'}
                    </span>
                  </div>
                  {referenceSolvent.costPerKg !== '' && referenceSolvent.costPerKg !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Cost:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">${Number(referenceSolvent.costPerKg).toFixed(2)}/kg</span>
                    </div>
                  )}
                  {getExperimentalSolubility(referenceSolvent.name) !== null && (
                    <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-slate-500 dark:text-slate-400">Your Sol:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{getExperimentalSolubility(referenceSolvent.name)?.toFixed(2)} mg/mL</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons for Tools */}
              <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                <button
                  onClick={() => setShowHansenModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Compass size={16} />
                  Open 3D Hansen Space Plot
                </button>
                <button
                  onClick={() => {
                    setSelectedEhsCandidate(dropInReplacements[0] || null);
                    setSelectedEhsBinary(null);
                    setShowEhsModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <ShieldCheck size={16} />
                  EHS Hazard Profile Comparison
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Results Section */}
      {referenceSolvent && (
        <div className="space-y-8">
          {/* Action Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Replacement Recommendations for {referenceSolvent.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ranked by Hansen parameter proximity, toxicological rating, and physical properties</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowHansenModal(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 px-3 py-1.5 rounded-lg transition-colors border border-purple-200 dark:border-purple-800 cursor-pointer"
                title="View interactive 3D Hansen Space visualization"
              >
                <Compass size={15} />
                3D Hansen Space
              </button>

              <button
                onClick={() => {
                  setSelectedEhsCandidate(dropInReplacements[0] || null);
                  setSelectedEhsBinary(null);
                  setShowEhsModal(true);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 px-3 py-1.5 rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                title="View EHS Radar comparison against reference solvent"
              >
                <ShieldCheck size={15} />
                EHS Hazard Chart
              </button>
            </div>
          </div>

          {/* Section 1: Top Drop-In Pure Replacements */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-3 flex items-center gap-2">
              <Activity size={16} className="text-blue-600 dark:text-blue-400" />
              Top Drop-in Pure Replacements
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dropInReplacements.map((c) => (
                <CandidateCard key={c.solvent.id} data={c} isDropIn={true} />
              ))}
              {dropInReplacements.length === 0 && (
                <div className="col-span-full text-center py-8 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 border-dashed">
                  No suitable pure solvent replacements found for the given criteria.
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Synergistic Binary Mixtures (When Enabled) */}
          {allowBinaryMixtures && binaryMixtures.length > 0 && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <Beaker size={16} className="text-purple-600 dark:text-purple-400" />
                  Synergistic Binary Solvent Mixtures (Green Blends)
                </h4>
                <span className="text-xs text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 px-2 py-0.5 rounded-full font-medium">
                  {binaryMixtures.length} Optimized Blends Found
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                By combining two green solvents, the resulting mixture achieves a closer Hansen solubility match than either individual component alone.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {binaryMixtures.map((b) => (
                  <div key={b.id} className="p-4 rounded-xl border bg-purple-50/20 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/60 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-purple-950 dark:text-purple-200 text-sm flex items-center gap-1.5">
                            {b.name}
                          </h4>
                          <div className="flex gap-1.5 mt-1">
                            {getIchBadge(b.solvent1.ichClass)}
                            <span className="text-xs text-slate-400">+</span>
                            {getIchBadge(b.solvent2.ichClass)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-purple-700 dark:text-purple-300">{b.similarity.toFixed(1)}%</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">HSP Similarity</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs mt-3">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Blended EHS:</span>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${getEhsColor(b.ehsScore)}`}
                                style={{ width: `${b.ehsScore * 10}%` }}
                              ></div>
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{b.ehsScore}</span>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Est. Bulk Cost:</span>
                          <div className="font-medium text-slate-700 dark:text-slate-200 mt-1">
                            {b.costPerKg !== undefined
                              ? `$${b.costPerKg.toFixed(2)} / kg`
                              : <span className="text-slate-400 italic">Partial data</span>}
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Blended BP:</span>
                          <div className="font-medium text-slate-700 dark:text-slate-200">~{b.boilingPoint}°C</div>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Blended Polarity:</span>
                          <div className="font-medium text-slate-700 dark:text-slate-200">{b.polarityIndex}</div>
                        </div>

                        <div className="col-span-2">
                          <span className="text-slate-500 dark:text-slate-400">HSP Vector (dD / dP / dH):</span>
                          <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                            {b.hansenD} / {b.hansenP} / {b.hansenH}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 mt-3 border-t border-purple-100 dark:border-purple-900/40 flex items-center justify-between">
                      <button
                        onClick={() => handleOpenEhsForBinary(b)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-200 hover:text-purple-800 dark:hover:text-purple-100 bg-purple-100/60 dark:bg-purple-900/40 hover:bg-purple-100 dark:hover:bg-purple-900/60 px-2.5 py-1 rounded-md transition-colors cursor-pointer border border-purple-300 dark:border-purple-700"
                        title="Compare blended Health, Safety & Environment profile against reference"
                      >
                        <ShieldCheck size={14} />
                        Compare EHS
                      </button>

                      <span className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">
                        Vol: {Math.round(b.fraction1 * 100)}% / {Math.round(b.fraction2 * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Other Class 3 Alternatives */}
          {greenTier.length > 0 && (
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-3 flex items-center gap-2">
                <Leaf size={16} />
                Other Class 3 Alternatives (High PDE / Inherently Greener)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-95">
                {greenTier.map((c) => (
                  <CandidateCard key={c.solvent.id} data={c} isDropIn={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3D Hansen Space Modal */}
      <HansenSpaceModal
        isOpen={showHansenModal}
        onClose={() => setShowHansenModal(false)}
        referenceSolvent={referenceSolvent}
        solvents={solvents}
        topCandidates={dropInReplacements}
        binaryMixtures={allowBinaryMixtures ? binaryMixtures : []}
        onSelectReferenceSolvent={(s) => setReferenceSolventName(s.name)}
      />

      {/* EHS Radar Modal */}
      <EhsRadarModal
        isOpen={showEhsModal}
        onClose={() => setShowEhsModal(false)}
        referenceSolvent={referenceSolvent}
        selectedCandidate={selectedEhsCandidate}
        selectedBinaryMixture={selectedEhsBinary}
        allCandidates={filteredCandidates}
        binaryMixtures={binaryMixtures}
        onSelectCandidate={(cand) => setSelectedEhsCandidate(cand)}
        onSelectBinary={(bin) => setSelectedEhsBinary(bin)}
      />
    </div>
  );
}
