import React, { useState } from 'react';
import {
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sliders,
  Table,
  LineChart as ChartIcon,
  Flame,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceArea
} from 'recharts';
import { ReactorScheduleParams, ScheduleSummary } from '../../utils/crystallization';

interface ReactorScheduleCardProps {
  scheduleParams: ReactorScheduleParams;
  setScheduleParams: React.Dispatch<React.SetStateAction<ReactorScheduleParams>>;
  scheduleSummary: ScheduleSummary;
  task: 'temperature' | 'composition' | 'simultaneous';
  solvent1Name: string;
  solvent2Name: string;
}

export const ReactorScheduleCard: React.FC<ReactorScheduleCardProps> = ({
  scheduleParams,
  setScheduleParams,
  scheduleSummary,
  task,
  solvent1Name,
  solvent2Name
}) => {
  const [showTable, setShowTable] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'chart'>('timeline');

  const updateParam = <K extends keyof ReactorScheduleParams>(key: K, val: ReactorScheduleParams[K]) => {
    setScheduleParams(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 rounded-lg">
            <Clock size={18} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
              Reactor Dosing & Cooling Schedules
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                Time-Resolved Batch Recipe
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Discretized cooling ramp and anti-solvent pumping rates configured for laboratory or plant jacket heat transfer.
            </p>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-700 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'timeline'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            Stages & Rates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chart')}
            className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
              activeTab === 'chart'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            Time Profile Chart
          </button>
        </div>
      </div>

      {/* Inputs Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/40 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
        {/* Total Cycle Duration */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-medium">
            <span>Total Cycle Time</span>
            <div className="flex gap-1">
              {[4, 6, 8, 12].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => updateParam('totalCycleHours', h)}
                  className={`px-1.5 py-0.2 text-[10px] rounded ${
                    Math.abs(scheduleParams.totalCycleHours - h) < 0.1
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min="1"
              max="48"
              step="0.5"
              value={scheduleParams.totalCycleHours}
              onChange={e => updateParam('totalCycleHours', Math.max(1, parseFloat(e.target.value) || 6))}
              className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
            />
            <span className="text-xs text-slate-500 font-medium">hours</span>
          </div>
          <span className="text-[10px] text-slate-400">({scheduleSummary.totalTimeMin} min total run)</span>
        </div>

        {/* Trajectory Profile */}
        <div className="space-y-1.5">
          <label className="block text-xs text-slate-600 dark:text-slate-300 font-medium">
            Controlled Ramp Shape
          </label>
          <select
            value={scheduleParams.coolingProfile}
            onChange={e => updateParam('coolingProfile', e.target.value as any)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 font-medium"
          >
            <option value="cubic">Cubic (t³) — Standard Controlled</option>
            <option value="linear">Linear (t) — Constant Rate</option>
            <option value="constant_S">Parabolic (t²) — Moderate Curvature</option>
          </select>
          <span className="text-[10px] text-slate-400">
            {scheduleParams.coolingProfile === 'cubic'
              ? 'Slow initial rate prevents secondary fines'
              : scheduleParams.coolingProfile === 'linear'
              ? 'Constant chiller & pump setpoint'
              : 'Maintains steady driving force'}
          </span>
        </div>

        {/* Seed Aging Hold Duration */}
        <div className="space-y-1.5">
          <label className="block text-xs text-slate-600 dark:text-slate-300 font-medium">
            Seed Ripening Hold (min)
          </label>
          <input
            type="number"
            min="10"
            max="240"
            step="5"
            value={scheduleParams.seedHoldMinutes}
            onChange={e => updateParam('seedHoldMinutes', Math.max(10, parseFloat(e.target.value) || 45))}
            className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
          />
          <span className="text-[10px] text-slate-400">Isothermal aging at seed window</span>
        </div>

        {/* Terminal Hold Duration */}
        <div className="space-y-1.5">
          <label className="block text-xs text-slate-600 dark:text-slate-300 font-medium">
            Terminal Aging Hold (min)
          </label>
          <input
            type="number"
            min="10"
            max="240"
            step="5"
            value={scheduleParams.terminalHoldMinutes}
            onChange={e => updateParam('terminalHoldMinutes', Math.max(10, parseFloat(e.target.value) || 30))}
            className="w-full border rounded-lg px-2.5 py-1 text-xs bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600"
          />
          <span className="text-[10px] text-slate-400">Exhaust supersaturation before filtration</span>
        </div>
      </div>

      {/* Industrial Feasibility & Rate Gauges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Max Cooling Rate */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Peak Cooling Rate</span>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-lg font-bold ${scheduleSummary.isCoolingFeasible ? 'text-slate-800 dark:text-slate-100' : 'text-amber-600'}`}>
              {scheduleSummary.maxCoolingRateCPerMin.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">°C/min</span>
            <span className="text-[11px] text-slate-400">({(scheduleSummary.maxCoolingRateCPerMin * 60).toFixed(1)} °C/h)</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px]">
            {scheduleSummary.isCoolingFeasible ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <CheckCircle2 size={12} /> Plant feasible (&le; 0.8 °C/min)
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-medium">
                <AlertTriangle size={12} /> High rate (&gt; 0.8 °C/min)
              </span>
            )}
          </div>
        </div>

        {/* Avg Cooling Rate */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Average Cooling Rate</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {scheduleSummary.avgCoolingRateCPerMin.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">°C/min</span>
            <span className="text-[11px] text-slate-400">({(scheduleSummary.avgCoolingRateCPerMin * 60).toFixed(1)} °C/h)</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Main crystallization phase</div>
        </div>

        {/* Max Anti-Solvent Flow Rate */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Max Dosing Flow Rate</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
              {scheduleSummary.maxAntiSolventFlowMlMin.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500">mL/min</span>
            <span className="text-[11px] text-slate-400">({(scheduleSummary.maxAntiSolventFlowMlMin * 0.06).toFixed(2)} L/h)</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            Avg: {scheduleSummary.avgAntiSolventFlowMlMin.toFixed(2)} mL/min
          </div>
        </div>

        {/* Batch Crystallization Window */}
        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mb-0.5">Main Growth Window</span>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {scheduleSummary.stages[2]?.durationMin || 0} <span className="text-xs font-normal text-slate-500">min</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">
            {((scheduleSummary.stages[2]?.durationMin || 0) / 60).toFixed(1)} hours active ramp
          </div>
        </div>
      </div>

      {/* Tab 1: 4-Stage Process Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {scheduleSummary.stages.map((st, i) => (
              <div
                key={i}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/60 space-y-1.5 shadow-2xs"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{st.name.split('.')[1] || st.name}</span>
                  <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold rounded text-[10px]">
                    {st.durationMin} min
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span>t = {st.startMin} min</span>
                  <ArrowRight size={10} />
                  <span>t = {st.endMin} min</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug pt-1">
                  {st.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Interactive Time Series Chart */}
      {activeTab === 'chart' && (
        <div className="h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={scheduleSummary.steps} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="timeMin"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                label={{ value: 'Process Time (minutes)', position: 'bottom', offset: 5, fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft', offset: 15, fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#6366f1"
                fontSize={11}
                tickLine={false}
                label={{ value: 'Anti-Solvent Added (mL)', angle: 90, position: 'insideRight', offset: 15, fontSize: 11, fill: '#6366f1' }}
              />
              <RechartsTooltip
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(val: any, name: string) => [val, name]}
                labelFormatter={(label: any) => `Time: ${label} min (${(label / 60).toFixed(2)} h)`}
              />
              <Legend verticalAlign="top" height={32} />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="temperature"
                name="Reactor Temp (°C)"
                stroke="#ef4444"
                strokeWidth={2.5}
                dot={{ r: 2 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="antiSolventAddedMl"
                name="Anti-Solvent Volume (mL)"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
              />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="S"
                name="Supersaturation (S)"
                stroke="#10b981"
                strokeWidth={1.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Expandable Step-by-Step Recipe Table */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTable(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-900/70 hover:bg-slate-100 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Table size={15} className="text-indigo-600" />
            <span>View Discretized Step Recipe Table ({scheduleSummary.steps.length} setpoints)</span>
          </div>
          {showTable ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showTable && (
          <div className="overflow-x-auto max-h-72 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                <tr>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Stage</th>
                  <th className="py-2 px-3">Temp (°C)</th>
                  <th className="py-2 px-3">Cooling Rate</th>
                  <th className="py-2 px-3">Anti-Solvent Added</th>
                  <th className="py-2 px-3">Pump Rate</th>
                  <th className="py-2 px-3">S (C/C*)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-normal">
                {scheduleSummary.steps.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                    <td className="py-1.5 px-3 font-medium">
                      {s.timeMin} min <span className="text-[10px] text-slate-400">({s.timeHours}h)</span>
                    </td>
                    <td className="py-1.5 px-3 text-[11px]">{s.stage}</td>
                    <td className="py-1.5 px-3 font-semibold">{s.temperature} °C</td>
                    <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">
                      {s.coolingRateCPerMin > 0 ? `${s.coolingRateCPerMin.toFixed(2)} °C/min` : '—'}
                    </td>
                    <td className="py-1.5 px-3">{s.antiSolventAddedMl} mL</td>
                    <td className="py-1.5 px-3 text-indigo-600 dark:text-indigo-400 font-medium">
                      {s.antiSolventFlowMlMin > 0 ? `${s.antiSolventFlowMlMin.toFixed(2)} mL/min` : '—'}
                    </td>
                    <td className="py-1.5 px-3 font-medium">
                      <span className={s.S > 1.25 ? 'text-amber-600' : 'text-emerald-600'}>
                        {s.S.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
