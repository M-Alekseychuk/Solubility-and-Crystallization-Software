import React, { useState, useMemo } from 'react';
import { X, RotateCcw, Eye, Compass, Layers, Sparkles, Filter, Info, ShieldCheck, CheckCircle2 } from 'lucide-react';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { Solvent } from '../types';
import { BinaryMixtureCandidate } from '../utils/greenChemistry';

const Plot = createPlotlyComponent(Plotly);

interface HansenSpaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  referenceSolvent: Solvent | null;
  solvents: Solvent[];
  topCandidates: Array<{ solvent: Solvent; similarity: number; distance: number }>;
  binaryMixtures?: BinaryMixtureCandidate[];
  onSelectReferenceSolvent?: (solvent: Solvent) => void;
}

export function HansenSpaceModal({
  isOpen,
  onClose,
  referenceSolvent,
  solvents,
  topCandidates,
  binaryMixtures = [],
  onSelectReferenceSolvent
}: HansenSpaceModalProps) {
  const [showAllSolvents, setShowAllSolvents] = useState(true);
  const [showBinaryMixtures, setShowBinaryMixtures] = useState(true);
  const [cameraView, setCameraView] = useState<'default' | 'top' | 'front' | 'side'>('default');
  const [searchSolventId, setSearchSolventId] = useState<string>('');

  // Filter solvents that have valid Hansen parameters
  const validSolvents = useMemo(() => {
    return solvents.filter(
      s => s.hansenD !== undefined && s.hansenP !== undefined && s.hansenH !== undefined
    );
  }, [solvents]);

  const highlightedSolvent = useMemo(() => {
    if (!searchSolventId) return null;
    return validSolvents.find(s => s.id === searchSolventId || s.name.toLowerCase() === searchSolventId.toLowerCase()) || null;
  }, [searchSolventId, validSolvents]);

  const topCandidateIds = useMemo(() => {
    return new Set(topCandidates.map(c => c.solvent.id));
  }, [topCandidates]);

  // Build Plotly Traces
  const plotData = useMemo(() => {
    if (!isOpen) return [];

    const traces: any[] = [];

    const refHD = referenceSolvent?.hansenD;
    const refHP = referenceSolvent?.hansenP;
    const refHH = referenceSolvent?.hansenH;
    const hasRef = refHD !== undefined && refHP !== undefined && refHH !== undefined;

    // 1. Background / Database Solvents
    const backgroundSolvents = validSolvents.filter(
      s => s.id !== referenceSolvent?.id && (showAllSolvents || topCandidateIds.has(s.id))
    );

    if (backgroundSolvents.length > 0) {
      const x = backgroundSolvents.map(s => s.hansenD!);
      const y = backgroundSolvents.map(s => s.hansenP!);
      const z = backgroundSolvents.map(s => s.hansenH!);
      const colors = backgroundSolvents.map(s => Number(s.ehsScore) || 5);
      const texts = backgroundSolvents.map(s => {
        let text = `<b>${s.name}</b><br>` +
          `EHS Score: <b>${s.ehsScore || '-'}/10</b> | ICH: ${s.ichClass ? `Class ${s.ichClass}` : 'Unknown'}<br>` +
          `δD: <b>${s.hansenD?.toFixed(1)}</b> | δP: <b>${s.hansenP?.toFixed(1)}</b> | δH: <b>${s.hansenH?.toFixed(1)}</b>`;

        if (s.boilingPoint !== '' && s.boilingPoint !== undefined) {
          text += `<br>BP: ${s.boilingPoint}°C` + (s.meltingPoint !== '' && s.meltingPoint !== undefined ? ` | MP: ${s.meltingPoint}°C` : '');
        }
        if (s.viscosity !== '' && s.viscosity !== undefined) {
          text += `<br>Viscosity: ${s.viscosity} mPa·s`;
        }
        if (s.casNumber) {
          text += `<br>CAS: ${s.casNumber}`;
        }

        if (hasRef) {
          const Ra = Math.sqrt(
            4 * Math.pow(s.hansenD! - refHD!, 2) +
            Math.pow(s.hansenP! - refHP!, 2) +
            Math.pow(s.hansenH! - refHH!, 2)
          );
          const sim = Math.max(0, 100 - (Ra / 15) * 100);
          text += `<br>Distance (Ra): <b>${Ra.toFixed(2)}</b> (Similarity: <b>${sim.toFixed(1)}%</b>)`;
        }
        return text;
      });

      // Red to Green colorscale for EHS scores
      const ehsColorscale: any = [
        [0.0, '#ef4444'],   // 3 (hazardous) - Red
        [0.3, '#f97316'],   // 5 (moderate) - Orange
        [0.55, '#eab308'],  // 6.5 (fair) - Yellow
        [0.75, '#84cc16'],  // 8 (good / class 3) - Light Green
        [1.0, '#22c55e'],   // 10 (green / water) - Green
      ];

      traces.push({
        type: 'scatter3d',
        mode: 'markers',
        name: 'Database Solvents',
        x,
        y,
        z,
        text: texts,
        hoverinfo: 'text',
        marker: {
          size: 7,
          color: colors,
          colorscale: ehsColorscale,
          cmin: 2,
          cmax: 10,
          colorbar: {
            title: { text: 'G (EHS)', font: { size: 13, family: 'sans-serif' } },
            tickvals: [3, 4, 5, 6, 7, 8, 9, 10],
            len: 0.75,
            thickness: 16,
            outlinewidth: 0,
            x: 1.02,
          },
          line: {
            color: '#333333',
            width: 0.8
          },
          opacity: 0.85
        }
      });
    }

    // 2. Top Drop-in Replacements (highlighted with distinct glowing golden ring)
    const topSolvents = topCandidates.map(c => c.solvent).filter(
      s => s.id !== referenceSolvent?.id && s.hansenD !== undefined
    );

    if (topSolvents.length > 0) {
      traces.push({
        type: 'scatter3d',
        mode: 'markers+text',
        name: 'Top Candidates',
        x: topSolvents.map(s => s.hansenD!),
        y: topSolvents.map(s => s.hansenP!),
        z: topSolvents.map(s => s.hansenH!),
        text: topSolvents.map(s => s.name),
        textposition: 'top center',
        textfont: { size: 10, color: '#1e293b' },
        hoverinfo: 'text',
        hovertext: topSolvents.map(s => {
          const match = topCandidates.find(c => c.solvent.id === s.id);
          return `<b>⭐ Top Match: ${s.name}</b><br>` +
            `Similarity: <b>${match ? match.similarity.toFixed(1) : ''}%</b><br>` +
            `ICH: Class ${s.ichClass || '?'}<br>` +
            `dD: ${s.hansenD?.toFixed(1)} | dP: ${s.hansenP?.toFixed(1)} | dH: ${s.hansenH?.toFixed(1)}`;
        }),
        marker: {
          size: 9,
          color: '#2563eb',
          symbol: 'circle',
          line: {
            color: '#ffffff',
            width: 2
          }
        }
      });
    }

    // 3. Binary Mixture Suggestions (if enabled)
    if (showBinaryMixtures && binaryMixtures.length > 0) {
      const topBinaries = binaryMixtures.slice(0, 4);
      traces.push({
        type: 'scatter3d',
        mode: 'markers+text',
        name: 'Binary Mixtures',
        x: topBinaries.map(b => b.hansenD),
        y: topBinaries.map(b => b.hansenP),
        z: topBinaries.map(b => b.hansenH),
        text: topBinaries.map(b => `${Math.round(b.fraction1 * 100)}:${Math.round(b.fraction2 * 100)} Blend`),
        textposition: 'bottom center',
        textfont: { size: 9, color: '#7c3aed' },
        hoverinfo: 'text',
        hovertext: topBinaries.map(b => 
          `<b>🧪 Binary Mixture: ${b.name}</b><br>` +
          `Similarity: <b>${b.similarity.toFixed(1)}%</b><br>` +
          `Blended EHS: ${b.ehsScore}/10<br>` +
          `dD: ${b.hansenD} | dP: ${b.hansenP} | dH: ${b.hansenH}`
        ),
        marker: {
          size: 10,
          color: '#9333ea',
          symbol: 'diamond',
          line: {
            color: '#ffffff',
            width: 1.5
          }
        }
      });
    }

    // 4. Reference Problem Solvent (Focal point: black core, red glowing border)
    if (hasRef) {
      traces.push({
        type: 'scatter3d',
        mode: 'markers+text',
        name: `Reference (${referenceSolvent!.name})`,
        x: [refHD!],
        y: [refHP!],
        z: [refHH!],
        text: [`📍 ${referenceSolvent!.name}`],
        textposition: 'top center',
        textfont: { size: 12, color: '#dc2626', family: 'sans-serif' },
        hoverinfo: 'text',
        hovertext: [
          `<b>🎯 Reference Problem Solvent: ${referenceSolvent!.name}</b><br>` +
          `ICH: Class ${referenceSolvent!.ichClass || '?'}<br>` +
          `EHS Score: ${referenceSolvent!.ehsScore || '-'}/10<br>` +
          `dD: ${refHD!.toFixed(1)} | dP: ${refHP!.toFixed(1)} | dH: ${refHH!.toFixed(1)}`
        ],
        marker: {
          size: 13,
          color: '#dc2626',
          symbol: 'circle',
          line: {
            color: '#000000',
            width: 2.5
          }
        }
      });
    }

    // 5. Highlighted / Inspected Solvent (from search)
    if (highlightedSolvent && highlightedSolvent.hansenD !== undefined && highlightedSolvent.id !== referenceSolvent?.id) {
      traces.push({
        type: 'scatter3d',
        mode: 'markers+text',
        name: `Inspected: ${highlightedSolvent.name}`,
        x: [highlightedSolvent.hansenD],
        y: [highlightedSolvent.hansenP],
        z: [highlightedSolvent.hansenH],
        text: [`🔍 ${highlightedSolvent.name}`],
        textposition: 'top center',
        textfont: { size: 12, color: '#b45309', family: 'sans-serif' },
        hoverinfo: 'text',
        hovertext: [
          `<b>🔍 Inspected Solvent: ${highlightedSolvent.name}</b><br>` +
          `δD: <b>${highlightedSolvent.hansenD}</b> | δP: <b>${highlightedSolvent.hansenP}</b> | δH: <b>${highlightedSolvent.hansenH}</b><br>` +
          `EHS Green Score: <b>${highlightedSolvent.ehsScore ?? '-'}/10</b> | ICH: ${highlightedSolvent.ichClass ? `Class ${highlightedSolvent.ichClass}` : 'Unknown'}` +
          (highlightedSolvent.casNumber ? `<br>CAS: ${highlightedSolvent.casNumber}` : '') +
          (highlightedSolvent.boilingPoint !== '' ? `<br>BP: ${highlightedSolvent.boilingPoint}°C` : '') +
          (highlightedSolvent.viscosity !== '' && highlightedSolvent.viscosity !== undefined ? `<br>Viscosity: ${highlightedSolvent.viscosity} mPa·s` : '')
        ],
        marker: {
          size: 15,
          color: '#f59e0b',
          symbol: 'diamond',
          line: {
            color: '#78350f',
            width: 2.5
          }
        }
      });
    }

    return traces;
  }, [isOpen, validSolvents, referenceSolvent, showAllSolvents, showBinaryMixtures, topCandidates, topCandidateIds, binaryMixtures, highlightedSolvent]);

  // Plotly 3D Layout
  const plotLayout = useMemo(() => {
    // Camera angles
    let eye = { x: 1.6, y: -1.7, z: 1.2 };
    if (cameraView === 'top') {
      eye = { x: 0.0, y: 0.0, z: 2.5 };
    } else if (cameraView === 'front') {
      eye = { x: 0.0, y: -2.5, z: 0.0 };
    } else if (cameraView === 'side') {
      eye = { x: 2.5, y: 0.0, z: 0.0 };
    }

    const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    return {
      autosize: true,
      margin: { l: 10, r: 10, b: 10, t: 10 },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      showlegend: true,
      legend: {
        x: 0.02,
        y: 0.98,
        bgcolor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255,255,255,0.85)',
        bordercolor: isDark ? '#334155' : '#e2e8f0',
        borderwidth: 1,
        font: { size: 11, color: isDark ? '#e2e8f0' : '#334155' }
      },
      scene: {
        aspectmode: 'cube',
        camera: { eye },
        xaxis: {
          title: { text: 'Dispersion dD (MPa)¹/²', font: { size: 12, color: isDark ? '#ffffff' : '#334155' } },
          tickfont: { size: 10, color: isDark ? '#ffffff' : '#334155' },
          color: isDark ? '#ffffff' : '#334155',
          backgroundcolor: isDark ? '#1e293b' : '#f8fafc',
          gridcolor: isDark ? '#334155' : '#e2e8f0',
          showbackground: true,
          zerolinecolor: isDark ? '#475569' : '#cbd5e1',
          range: [12, 22]
        },
        yaxis: {
          title: { text: 'Polarity dP (MPa)¹/²', font: { size: 12, color: isDark ? '#ffffff' : '#334155' } },
          tickfont: { size: 10, color: isDark ? '#ffffff' : '#334155' },
          color: isDark ? '#ffffff' : '#334155',
          backgroundcolor: isDark ? '#1e293b' : '#f8fafc',
          gridcolor: isDark ? '#334155' : '#e2e8f0',
          showbackground: true,
          zerolinecolor: isDark ? '#475569' : '#cbd5e1',
          range: [0, 26]
        },
        zaxis: {
          title: { text: 'Hydrogen bonding dH (MPa)¹/²', font: { size: 12, color: isDark ? '#ffffff' : '#334155' } },
          tickfont: { size: 10, color: isDark ? '#ffffff' : '#334155' },
          color: isDark ? '#ffffff' : '#334155',
          backgroundcolor: isDark ? '#1e293b' : '#f8fafc',
          gridcolor: isDark ? '#334155' : '#e2e8f0',
          showbackground: true,
          zerolinecolor: isDark ? '#475569' : '#cbd5e1',
          range: [0, 44]
        }
      }
    };
  }, [cameraView]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/90">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-emerald-950/60 text-green-700 dark:text-emerald-300 rounded-xl">
              <Compass size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Hansen Space 3D</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium">
                  {validSolvents.length} Solvents with HSP
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                {referenceSolvent ? (
                  <span>
                    Reference HSP: <strong className="text-red-600 dark:text-rose-400">{referenceSolvent.name}</strong> (dD = {referenceSolvent.hansenD ?? 'N/A'}, dP = {referenceSolvent.hansenP ?? 'N/A'}, dH = {referenceSolvent.hansenH ?? 'N/A'})
                  </span>
                ) : (
                  'Select a reference solvent on the main tab to highlight its target coordinates'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Action / View Controls Bar */}
        <div className="px-6 py-2.5 bg-slate-100/70 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Eye size={14} /> Camera View:
            </span>
            <div className="inline-flex bg-white dark:bg-slate-900 rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 shadow-sm">
              <button
                onClick={() => setCameraView('default')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  cameraView === 'default' ? 'bg-green-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Default 3D
              </button>
              <button
                onClick={() => setCameraView('top')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  cameraView === 'top' ? 'bg-green-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Top (dD vs dP)
              </button>
              <button
                onClick={() => setCameraView('front')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  cameraView === 'front' ? 'bg-green-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Front (dP vs dH)
              </button>
              <button
                onClick={() => setCameraView('side')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  cameraView === 'side' ? 'bg-green-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                Side (dD vs dH)
              </button>
            </div>
          </div>

          {/* Quick Solvent Search & Locate */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1">
              <Compass size={13} className="text-amber-600 dark:text-amber-400" /> Inspect Solvent:
            </span>
            <select
              value={searchSolventId}
              onChange={e => setSearchSolventId(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:outline-none max-w-[230px]"
            >
              <option value="">-- Find Solvent in 3D Space --</option>
              {validSolvents
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (δD {s.hansenD}, δP {s.hansenP}, δH {s.hansenH})
                  </option>
                ))}
            </select>
            {searchSolventId && (
              <button
                onClick={() => setSearchSolventId('')}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1 py-0.5 text-xs cursor-pointer"
                title="Clear selection"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showAllSolvents}
                onChange={e => setShowAllSolvents(e.target.checked)}
                className="rounded border-slate-300 text-green-600 focus:ring-green-500"
              />
              <span>Show All Database Solvents</span>
            </label>

            {binaryMixtures.length > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-purple-700 dark:text-purple-300 font-medium">
                <input
                  type="checkbox"
                  checked={showBinaryMixtures}
                  onChange={e => setShowBinaryMixtures(e.target.checked)}
                  className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                />
                <span>Show Binary Mixtures</span>
              </label>
            )}
          </div>
        </div>

        {/* Highlighted Solvent Inspector Banner */}
        {highlightedSolvent && (
          <div className="px-6 py-2.5 bg-amber-50/95 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-900/60 flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold text-amber-950 dark:text-amber-200 flex items-center gap-1.5 text-sm">
                <span className="w-2.5 h-2.5 rotate-45 bg-amber-500 inline-block"></span>
                {highlightedSolvent.name}
              </span>
              {highlightedSolvent.casNumber && (
                <span className="text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded font-mono text-[11px]">
                  CAS: {highlightedSolvent.casNumber}
                </span>
              )}
              <span className="text-amber-900 dark:text-amber-200 font-mono">
                δD: <strong>{highlightedSolvent.hansenD}</strong> | δP: <strong>{highlightedSolvent.hansenP}</strong> | δH: <strong>{highlightedSolvent.hansenH}</strong>
              </span>
              <span className="text-amber-800 dark:text-amber-300">
                EHS Green Score: <strong>{highlightedSolvent.ehsScore ?? '-'}/10</strong>
              </span>
              {highlightedSolvent.boilingPoint !== '' && (
                <span className="text-amber-800 dark:text-amber-300">
                  BP: <strong>{highlightedSolvent.boilingPoint}°C</strong>
                </span>
              )}
              {highlightedSolvent.meltingPoint !== '' && (
                <span className="text-amber-800 dark:text-amber-300">
                  MP: <strong>{highlightedSolvent.meltingPoint}°C</strong>
                </span>
              )}
              {highlightedSolvent.viscosity !== undefined && (
                <span className="text-amber-800 dark:text-amber-300">
                  Viscosity: <strong>{highlightedSolvent.viscosity} mPa·s</strong>
                </span>
              )}
            </div>
            {onSelectReferenceSolvent && referenceSolvent?.id !== highlightedSolvent.id && (
              <button
                onClick={() => {
                  onSelectReferenceSolvent(highlightedSolvent);
                }}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer text-xs"
              >
                Set as Target Reference
              </button>
            )}
          </div>
        )}

        {/* 3D Canvas Area */}
        <div className="relative flex-1 min-h-[500px] h-[60vh] bg-slate-50/50 dark:bg-slate-900">
          <Plot
            data={plotData}
            layout={plotLayout}
            config={{
              responsive: true,
              displayModeBar: true,
              modeBarButtonsToRemove: ['lasso2d', 'select2d'],
              displaylogo: false
            }}
            style={{ width: '100%', height: '100%' }}
          />

          {/* Quick Helper Floating Pill */}
          <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-600 dark:text-slate-300 shadow-sm pointer-events-none max-w-sm">
            <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1">
              <Info size={13} className="text-blue-500 dark:text-blue-400" /> Interaction Tip:
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Click & drag to rotate in 3D. Scroll to zoom in/out. Right-click and drag to pan across axes.
            </div>
          </div>
        </div>

        {/* Footer Summary / Quick stats */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 inline-block"></span>
              <strong className="text-slate-700 dark:text-slate-200">Target Reference</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span>
              <strong className="text-slate-700 dark:text-slate-200">Top Drop-in Matches</strong>
            </span>
            {binaryMixtures.length > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rotate-45 bg-purple-600 inline-block"></span>
                <strong className="text-slate-700 dark:text-slate-200">Optimized Binary Mixtures</strong>
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span>
              <span>Color Gradient = EHS Green Score (3-10)</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
