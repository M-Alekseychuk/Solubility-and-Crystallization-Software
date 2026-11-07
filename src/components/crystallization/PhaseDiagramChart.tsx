import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ReferenceDot
} from 'recharts';
import { Layers, Activity, TrendingUp, Compass, Target, Info, Sparkles } from 'lucide-react';
import { PhaseDiagramPoint, BatchTrajectoryPoint, MilestoneMarker } from '../../utils/crystallization';

interface PhaseDiagramChartProps {
  phaseData: {
    phaseCurve: PhaseDiagramPoint[];
    trajectory: BatchTrajectoryPoint[];
    markers: MilestoneMarker[];
    xLabel: string;
    xUnit: string;
  };
  supersaturationData: any[];
  seedingTargetS: number;
  mszwScrit: number;
  task: 'temperature' | 'composition' | 'simultaneous';
  totalCycleHours?: number;
}

export const PhaseDiagramChart: React.FC<PhaseDiagramChartProps> = ({
  phaseData,
  supersaturationData,
  seedingTargetS,
  mszwScrit,
  task,
  totalCycleHours = 6.0
}) => {
  const [activeView, setActiveView] = useState<'phase' | 'supersaturation' | 'concentration'>('phase');
  const [showLinearTrajectory, setShowLinearTrajectory] = useState<boolean>(true);
  const [selectedMarker, setSelectedMarker] = useState<number | null>(null);

  const [isDark, setIsDark] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  });

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Calculate focused domain for Supersaturation Y-axis (e.g. 0.8 to ~1.5)
  const maxS = useMemo(() => {
    let max = mszwScrit;
    supersaturationData.forEach(d => {
      if (typeof d.S_lin === 'number' && d.S_lin > max) max = d.S_lin;
      if (typeof d.S_cub === 'number' && d.S_cub > max) max = d.S_cub;
    });
    return Math.min(2.0, Math.max(1.5, Math.ceil(max * 1.15 * 10) / 10));
  }, [supersaturationData, mszwScrit]);

  // Calculate focused domain for Driving Force Y-axis
  const maxDeltaC = useMemo(() => {
    let max = 2.0;
    supersaturationData.forEach(d => {
      if (typeof d.deltaC_lin === 'number' && d.deltaC_lin > max) max = d.deltaC_lin;
      if (typeof d.deltaC_cub === 'number' && d.deltaC_cub > max) max = d.deltaC_cub;
    });
    return Math.max(3.0, Math.ceil(max * 1.2));
  }, [supersaturationData]);

  // Use unified phaseCurve from phaseData which already contains continuous aligned points
  const mergedPhaseChartData = useMemo(() => {
    return phaseData.phaseCurve;
  }, [phaseData.phaseCurve]);

  // Find max concentration for Y-axis domain
  const maxY = useMemo(() => {
    let max = 10;
    mergedPhaseChartData.forEach(d => {
      if (d.cCrit && d.cCrit > max) max = d.cCrit;
      if (d.cBatch && d.cBatch > max) max = d.cBatch;
      if (d.cBatchLinear && d.cBatchLinear > max) max = d.cBatchLinear;
    });
    return Math.ceil(max * 1.15);
  }, [mergedPhaseChartData]);

  // Clean, round numeric X-axis domain and ticks for Phase Diagram
  const { xDomain, xTicks } = useMemo(() => {
    const validPoints = mergedPhaseChartData.filter(d => typeof d.x === 'number' && !isNaN(d.x));
    if (!validPoints.length) return { xDomain: [0, 80], xTicks: [0, 20, 40, 60, 80] };
    const minVal = Math.min(...validPoints.map(d => d.x));
    const maxVal = Math.max(...validPoints.map(d => d.x));
    if (!isFinite(minVal) || !isFinite(maxVal) || minVal >= maxVal) {
      return { xDomain: [0, 80], xTicks: [0, 20, 40, 60, 80] };
    }
    
    // Determine clean step size (e.g., 10°C, 20%, etc.)
    const range = maxVal - minVal;
    let step = 10;
    if (range > 60) step = 10;
    else if (range > 30) step = 5;
    else step = 2;

    const start = Math.floor(minVal / step) * step;
    const end = Math.ceil(maxVal / step) * step;
    const ticks: number[] = [];
    for (let t = start; t <= end + 0.001; t += step) {
      ticks.push(Math.round(t * 10) / 10);
    }
    return { xDomain: [start, end], xTicks: ticks };
  }, [mergedPhaseChartData]);

  const CustomPhaseTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    const cStar = data.cStar;
    const cCrit = data.cCrit;
    const cBatch = data.cBatch;
    const cBatchLinear = data.cBatchLinear;
    const sVal = data.S !== undefined ? data.S : (cBatch && cStar ? cBatch / cStar : null);
    const sLinVal = data.SLinear !== undefined ? data.SLinear : (cBatchLinear && cStar ? cBatchLinear / cStar : null);

    let zone = 'Single-Phase Undersaturated Solution';
    let zoneColor = 'text-sky-600 dark:text-sky-400';
    let zoneBg = 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800';

    if (sVal !== null) {
      if (sVal > mszwScrit) {
        zone = 'Labile Zone (Spontaneous Primary Nucleation Risk)';
        zoneColor = 'text-rose-600 dark:text-rose-400';
        zoneBg = 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
      } else if (sVal > 1.0) {
        zone = 'Metastable Zone (Controlled Seed Growth Corridor)';
        zoneColor = 'text-emerald-600 dark:text-emerald-400';
        zoneBg = 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
      } else {
        zone = 'Undersaturated Zone (Thermodynamically Stable Liquid)';
        zoneColor = 'text-sky-600 dark:text-sky-400';
        zoneBg = 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800';
      }
    }

    return (
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs space-y-2 min-w-[240px]">
        <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-1 flex justify-between items-center">
          <span>{phaseData.xLabel}: {label} {phaseData.xUnit}</span>
          {sVal !== null && <span className="text-slate-500 font-medium">S = {sVal.toFixed(2)}</span>}
        </div>

        <div className={`p-1.5 rounded-md border text-[11px] font-medium ${zoneBg} ${zoneColor}`}>
          {zone}
        </div>

        <div className="space-y-1 text-slate-600 dark:text-slate-300">
          {cBatch !== undefined && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Controlled Batch C:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{cBatch.toFixed(2)} mg/mL</span>
            </div>
          )}
          {showLinearTrajectory && cBatchLinear !== undefined && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                Linear Batch C:
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {cBatchLinear.toFixed(2)} mg/mL {sLinVal && sLinVal > mszwScrit ? '⚠️' : ''}
              </span>
            </div>
          )}
          {cStar !== undefined && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                Solubility C* (Eq):
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{cStar.toFixed(2)} mg/mL</span>
            </div>
          )}
          {cCrit !== undefined && (
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                MSZW Limit (C_crit):
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{cCrit.toFixed(2)} mg/mL</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const CustomTrajectoryTooltip = ({ active, payload, label, mode }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;

    const isLinearLabile = typeof data.S_lin === 'number' && data.S_lin > mszwScrit;
    const isCubicSafe = typeof data.S_cub === 'number' && data.S_cub <= mszwScrit;

    return (
      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 text-xs space-y-2.5 min-w-[250px]">
        <div className="font-bold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-1.5 flex justify-between items-center">
          <span>{data.displayTime || data.timePercent || label}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
            {data.stage || 'Batch Operating Progress'}
          </span>
        </div>

        <div className="space-y-1.5">
          {/* Cubic controlled profile */}
          <div className="p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Cubic Controlled Cooling:
              </span>
              <span>S = {data.S_cub?.toFixed(2)}</span>
            </div>
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1 flex justify-between">
              <span>ΔC = {data.deltaC_cub?.toFixed(2)} mg/mL</span>
              <span>T = {data.T_cub?.toFixed(1)} °C</span>
            </div>
          </div>

          {/* Linear cooling profile */}
          <div className={`p-2 rounded-lg border ${
            isLinearLabile
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'
              : 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-200/80 dark:border-blue-800/40 text-blue-800 dark:text-blue-300'
          }`}>
            <div className="flex items-center justify-between font-semibold text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isLinearLabile ? 'bg-rose-500' : 'bg-blue-500'}`} />
                Linear Cooling:
              </span>
              <span>S = {data.S_lin?.toFixed(2)}</span>
            </div>
            <div className="text-[10px] mt-1 flex justify-between opacity-90">
              <span>ΔC = {data.deltaC_lin?.toFixed(2)} mg/mL</span>
              <span>T = {data.T_lin?.toFixed(1)} °C</span>
            </div>
          </div>
        </div>

        {/* Operating status callout */}
        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700 text-[10px] flex items-center justify-between">
          <span className="text-slate-400">Operating Corridor:</span>
          {isLinearLabile ? (
            <span className="text-rose-600 dark:text-rose-400 font-semibold">Linear in Labile Zone (Fines Risk)</span>
          ) : (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Safe Metastable Zone (S &lt; S_crit)</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
      {/* Chart View Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-blue-600" />
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              Phase Diagram & Process Trajectory
            </h3>
          </div>

          {/* Operating Direction Badge */}
          {phaseData.markers.length >= 2 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-700/60 px-2.5 py-1 rounded-md border border-slate-200/70 dark:border-slate-600/60">
              <Compass size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Direction: <strong className="text-slate-800 dark:text-slate-100">{phaseData.markers[0]?.x} {phaseData.xUnit} → {phaseData.markers[phaseData.markers.length - 1]?.x} {phaseData.xUnit}</strong></span>
            </div>
          )}
        </div>

        {/* View Switcher Buttons & Options */}
        <div className="flex flex-wrap items-center gap-2">
          {activeView === 'phase' && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mr-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showLinearTrajectory}
                onChange={(e) => setShowLinearTrajectory(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
              />
              <span>Compare Linear</span>
            </label>
          )}

          <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setActiveView('phase')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeView === 'phase'
                  ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Phase Diagram (C vs {phaseData.xUnit === '°C' ? 'T' : 'Composition'})
            </button>
            <button
              type="button"
              onClick={() => setActiveView('supersaturation')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeView === 'supersaturation'
                  ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Supersaturation (S vs %)
            </button>
            <button
              type="button"
              onClick={() => setActiveView('concentration')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeView === 'concentration'
                  ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              Driving Force (ΔC vs %)
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {activeView === 'phase' ? (
            <ComposedChart data={mergedPhaseChartData} margin={{ top: 12, right: 25, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis
                dataKey="x"
                type="number"
                domain={xDomain}
                ticks={xTicks}
                stroke={isDark ? '#94a3b8' : '#64748b'}
                fontSize={11}
                tick={{ fill: isDark ? '#ffffff' : '#64748b' }}
                tickLine={false}
                label={{ value: `${phaseData.xLabel} (${phaseData.xUnit})`, position: 'bottom', offset: 8, fontSize: 11, fill: isDark ? '#ffffff' : '#64748b' }}
              />
              <YAxis
                stroke={isDark ? '#94a3b8' : '#64748b'}
                fontSize={11}
                tick={{ fill: isDark ? '#ffffff' : '#64748b' }}
                tickLine={false}
                domain={[0, maxY]}
                label={{ value: 'Concentration (mg/mL)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: isDark ? '#ffffff' : '#64748b' }}
              />
              <RechartsTooltip content={<CustomPhaseTooltip />} />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="plainline"
                formatter={(value: string) => <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{value}</span>}
              />

              {/* Equilibrium Solubility Curve C* */}
              <Line
                type="monotone"
                dataKey="cStar"
                name="Solubility C* (Equilibrium)"
                stroke="#2563eb"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />

              {/* Metastable Limit Curve C_crit */}
              <Line
                type="monotone"
                dataKey="cCrit"
                name={`MSZW Limit C_crit (S=${mszwScrit.toFixed(2)})`}
                stroke="#9333ea"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />

              {/* Uncontrolled Linear Trajectory (Optional comparison) */}
              {showLinearTrajectory && (
                <Line
                  type="monotone"
                  dataKey="cBatchLinear"
                  name="Uncontrolled Linear Trajectory"
                  stroke="#d97706"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              )}

              {/* Controlled Cubic Batch Operating Trajectory */}
              <Line
                type="monotone"
                dataKey="cBatch"
                name="Controlled Batch Trajectory"
                stroke="#10b981"
                strokeWidth={3}
                dot={(props: any) => {
                  if (props.payload && props.payload.isTrajectoryNode && props.index % 6 === 0) {
                    return (
                      <circle
                        key={`traj-dot-${props.cx}-${props.cy}`}
                        cx={props.cx}
                        cy={props.cy}
                        r={2.5}
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth={1}
                      />
                    );
                  }
                  return <React.Fragment key={`empty-${props.index}`} />;
                }}
                connectNulls
                isAnimationActive={false}
              />

              {/* Milestone Markers plotted directly on the trajectory */}
              {phaseData.markers.map((m, idx) => {
                // If initial state and saturation are very close (< 1.2°C), render concentric dots
                const isNearStart = idx === 1 && Math.abs(m.x - phaseData.markers[0]?.x) < 1.2;
                const isSelected = selectedMarker === idx;

                return (
                  <React.Fragment key={`milestone-group-${idx}`}>
                    {/* Active selection halo */}
                    {isSelected && (
                      <ReferenceDot
                        x={m.x}
                        y={m.y}
                        r={10}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        strokeDasharray="2 2"
                      />
                    )}
                    <ReferenceDot
                      x={m.x}
                      y={m.y}
                      r={isNearStart ? 4.5 : (idx === 0 && Math.abs(m.x - phaseData.markers[1]?.x) < 1.2 ? 7 : 5.5)}
                      fill={idx === 0 && Math.abs(m.x - phaseData.markers[1]?.x) < 1.2 ? 'none' : m.color}
                      stroke={idx === 0 && Math.abs(m.x - phaseData.markers[1]?.x) < 1.2 ? m.color : '#ffffff'}
                      strokeWidth={idx === 0 && Math.abs(m.x - phaseData.markers[1]?.x) < 1.2 ? 2.5 : 2}
                    />
                  </React.Fragment>
                );
              })}
            </ComposedChart>
          ) : activeView === 'supersaturation' ? (
            <LineChart data={supersaturationData} margin={{ top: 12, right: 25, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis
                dataKey="timePercent"
                stroke={isDark ? '#94a3b8' : '#64748b'}
                fontSize={11}
                tick={{ fill: isDark ? '#ffffff' : '#64748b' }}
                tickLine={false}
                label={{
                  value: `Process Progress (%) • Recipe Cycle: 0 to ${totalCycleHours} h`,
                  position: 'bottom',
                  offset: 8,
                  fontSize: 11,
                  fill: isDark ? '#ffffff' : '#64748b'
                }}
              />
              <YAxis
                stroke={isDark ? '#94a3b8' : '#64748b'}
                fontSize={11}
                tick={{ fill: isDark ? '#ffffff' : '#64748b' }}
                tickLine={false}
                domain={[0.8, maxS]}
                label={{ value: 'Supersaturation Ratio (S = C/C*)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: isDark ? '#ffffff' : '#64748b' }}
              />
              <RechartsTooltip content={<CustomTrajectoryTooltip mode="supersaturation" />} />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="plainline"
                formatter={(value: string) => <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{value}</span>}
              />

              {/* Safe Metastable Operating Corridor Shading */}
              <ReferenceArea
                y1={1.0}
                y2={mszwScrit}
                fill="#10b981"
                fillOpacity={0.06}
              />

              {/* Reference boundary lines with non-colliding labels */}
              <ReferenceLine
                y={1.0}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                label={{
                  value: 'Saturation (S = 1.00)',
                  position: 'insideTopLeft',
                  fontSize: 10,
                  fill: '#64748b',
                  offset: 8
                }}
              />
              <ReferenceLine
                y={seedingTargetS}
                stroke="#10b981"
                strokeDasharray="3 3"
                label={{
                  value: `Seed Target (S = ${seedingTargetS.toFixed(2)})`,
                  position: 'insideBottomRight',
                  fontSize: 10,
                  fill: '#059669',
                  offset: 8
                }}
              />
              <ReferenceLine
                y={mszwScrit}
                stroke="#ef4444"
                strokeDasharray="3 3"
                label={{
                  value: `MSZW Limit (S_crit = ${mszwScrit.toFixed(2)})`,
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: '#dc2626',
                  offset: 8
                }}
              />

              <Line
                type="monotone"
                dataKey="S_lin"
                name="Linear Cooling (S)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="S_cub"
                name="Cubic Controlled Cooling (S)"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <LineChart data={supersaturationData} margin={{ top: 12, right: 25, left: 24, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
              <XAxis
                dataKey="timePercent"
                stroke={isDark ? '#94a3b8' : '#64748b'}
                fontSize={11}
                tick={{ fill: isDark ? '#ffffff' : '#64748b' }}
                tickLine={false}
                label={{
                  value: `Process Progress (%) • Recipe Cycle: 0 to ${totalCycleHours} h`,
                  position: 'bottom',
                  offset: 8,
                  fontSize: 11,
                  fill: isDark ? '#ffffff' : '#64748b'
                }}
              />
              <YAxis
                stroke={isDark ? '#94a3b8' : '#64748b'}
                fontSize={11}
                tick={{ fill: isDark ? '#ffffff' : '#64748b' }}
                tickLine={false}
                domain={[0, maxDeltaC]}
                label={{ value: 'Driving Force ΔC (mg/mL)', angle: -90, position: 'insideLeft', offset: 14, fontSize: 11, fill: isDark ? '#ffffff' : '#64748b' }}
              />
              <RechartsTooltip content={<CustomTrajectoryTooltip mode="driving_force" />} />
              <Legend
                verticalAlign="top"
                height={32}
                iconType="plainline"
                formatter={(value: string) => <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{value}</span>}
              />

              <ReferenceLine
                y={0}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                label={{
                  value: 'Equilibrium (ΔC = 0)',
                  position: 'insideTopRight',
                  fontSize: 10,
                  fill: '#64748b',
                  offset: 8
                }}
              />
              <Line
                type="monotone"
                dataKey="deltaC_lin"
                name="Linear Driving Force (ΔC)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="deltaC_cub"
                name="Cubic Driving Force (ΔC)"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Process Milestones on Phase Diagram */}
      {activeView === 'phase' && phaseData.markers.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 dark:border-slate-700">
          {phaseData.markers.map((m, idx) => {
            const isSelected = selectedMarker === idx;
            return (
              <div
                key={idx}
                onClick={() => setSelectedMarker(isSelected ? null : idx)}
                className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-blue-50/90 dark:bg-blue-950/40 border-blue-400 dark:border-blue-600 ring-2 ring-blue-400/30'
                    : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: m.color }} />
                    <span>{m.name}</span>
                  </div>
                  {isSelected && <span className="text-[10px] text-blue-600 font-medium">Selected</span>}
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-1">
                  {m.x} {phaseData.xUnit} • {m.y.toFixed(1)} mg/mL (S={m.s.toFixed(2)})
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 leading-tight">
                  {m.description}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Legend & Interpretation Guide */}
      <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center justify-between gap-3 border border-slate-200 dark:border-slate-700">
        {activeView === 'phase' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-blue-600" />
              <strong className="text-slate-700 dark:text-slate-200">Equilibrium C*:</strong>
              <span className="text-[11px] text-slate-500">Thermodynamic solubility limit (S = 1.0).</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 border-b-2 border-dashed border-purple-600" />
              <strong className="text-slate-700 dark:text-slate-200">MSZW Boundary C_crit:</strong>
              <span className="text-[11px] text-slate-500">Critical boundary before primary spontaneous nucleation.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-1 bg-emerald-500 rounded-full" />
              <strong className="text-slate-700 dark:text-slate-200">Controlled Trajectory:</strong>
              <span className="text-[11px] text-slate-500">Stays inside safe corridor without fines.</span>
            </div>
            {showLinearTrajectory && (
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-0.5 border-b-2 border-dashed border-amber-500" />
                <strong className="text-slate-700 dark:text-slate-200">Linear Trajectory:</strong>
                <span className="text-[11px] text-slate-500">Breaches C_crit into Labile Zone (fines risk).</span>
              </div>
            )}
          </>
        ) : activeView === 'supersaturation' ? (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-emerald-500" />
              <strong className="text-slate-700 dark:text-slate-200">Cubic Controlled Cooling:</strong>
              <span className="text-[11px] text-slate-500">Matches cooling to crystal surface growth, keeping S steady within safe corridor (S = 1.08–1.12).</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-blue-500" />
              <strong className="text-slate-700 dark:text-slate-200">Linear Cooling:</strong>
              <span className="text-[11px] text-slate-500">Excessive early cooling generates S surge past MSZW limit (S &gt; 1.30), risking fines.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-1 bg-emerald-500/20 border border-emerald-500/50 rounded" />
              <strong className="text-slate-700 dark:text-slate-200">Metastable Window:</strong>
              <span className="text-[11px] text-slate-500">Between S = 1.00 and S_crit = {mszwScrit.toFixed(2)}. Desupersaturation relaxes to S ≈ 1.01 at batch completion.</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-emerald-500" />
              <strong className="text-slate-700 dark:text-slate-200">Cubic Driving Force (ΔC):</strong>
              <span className="text-[11px] text-slate-500">Maintains controlled driving force (1–2 mg/mL) aligned with growing crystal surface area.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 bg-blue-500" />
              <strong className="text-slate-700 dark:text-slate-200">Linear Driving Force (ΔC):</strong>
              <span className="text-[11px] text-slate-500">Large early driving force spike causes high supersaturation and nucleation risk before crystal bed catches up.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-3 h-0.5 border-b-2 border-dashed border-slate-400" />
              <strong className="text-slate-700 dark:text-slate-200">Equilibrium (ΔC = 0):</strong>
              <span className="text-[11px] text-slate-500">Achieved at the terminal hold as residual solute depletes onto existing crystal faces.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
