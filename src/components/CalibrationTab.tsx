import React, { useRef } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { Plus, Trash2, Download, Upload } from 'lucide-react';
import { CalibrationPoint, CalibrationResult } from '../types';
import { generateId, roundTo, getExportFileName } from '../utils';

interface CalibrationTabProps {
  points: CalibrationPoint[];
  setPoints: React.Dispatch<React.SetStateAction<CalibrationPoint[]>>;
  result: CalibrationResult;
  wavelength?: string;
  setWavelength?: (w: string) => void;
  hplcUsed?: string;
  setHplcUsed?: (h: string) => void;
  forceZero?: boolean;
  setForceZero?: (v: boolean) => void;
  experimentName?: string;
}

export function CalibrationTab({ points, setPoints, result, wavelength = '210', setWavelength, hplcUsed = '', setHplcUsed, forceZero = false, setForceZero, experimentName }: CalibrationTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDark, setIsDark] = React.useState(() => {
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

  const addPoint = () => {
    setPoints([...points, { id: generateId(), massMg: '', volMl: '', area: '' }]);
  };

  const removePoint = (id: string) => {
    if (points.length <= 2) {
      alert("At least 2 points are needed for a calibration curve.");
      return;
    }
    setPoints(points.filter(p => p.id !== id));
  };

  const updatePoint = (id: string, field: keyof CalibrationPoint, value: string | number) => {
    let normalizedValue = value;
    if (typeof value === 'string') {
      normalizedValue = value.replace(/,/g, '.');
    }
    setPoints(points.map(p => p.id === id ? { ...p, [field]: normalizedValue } : p));
  };

  const downloadCalibration = () => {
    const data = {
      points,
      wavelength,
      hplcUsed,
      forceZero
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName(experimentName, 'json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const uploadCalibration = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.points && Array.isArray(data.points)) {
          setPoints(data.points);
          if (data.wavelength !== undefined && setWavelength) setWavelength(data.wavelength);
          if (data.hplcUsed !== undefined && setHplcUsed) setHplcUsed(data.hplcUsed);
          if (data.forceZero !== undefined && setForceZero) setForceZero(data.forceZero);
        } else {
          alert('Invalid calibration file format.');
        }
      } catch (err) {
        console.error('Error parsing calibration file:', err);
        alert('Failed to load calibration file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validDataPoints = points
    .filter(p => {
      const vol = Number(String(p.volMl).replace(",", "."));
      const mass = Number(String(p.massMg).replace(",", "."));
      const area = Number(String(p.area).replace(",", "."));
      return p.massMg !== '' && p.volMl !== '' && p.area !== '' && !isNaN(vol) && vol > 0 && !isNaN(mass) && !isNaN(area);
    })
    .map(p => ({
      x: Number(String(p.massMg).replace(",", ".")) / Number(String(p.volMl).replace(",", ".")),
      y: Number(String(p.area).replace(",", "."))
    }))
    .sort((a, b) => a.x - b.x);

  // Generate trendline points
  let trendlineData: any[] = [];
  if (result.valid && validDataPoints.length > 0) {
    const minX = 0; // Plot from 0
    const maxX = Math.max(...validDataPoints.map(d => d.x)) * 1.1; // Extend slightly past max
    trendlineData = [
      { x: minX, y: result.slope * minX + result.intercept },
      { x: maxX, y: result.slope * maxX + result.intercept }
    ];
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-slate-800">Calibration Curve Data</h2>
            <div className="flex items-center gap-2">
              <label htmlFor="wavelength" className="text-sm font-medium text-slate-600">Wavelength (nm):</label>
              <input
                id="wavelength"
                type="text"
                value={wavelength}
                onChange={(e) => setWavelength?.(e.target.value)}
                className="w-24 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700 bg-white"
                placeholder="e.g. 210"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="hplcUsed" className="text-sm font-medium text-slate-600">HPLC used:</label>
              <input
                id="hplcUsed"
                type="text"
                value={hplcUsed}
                onChange={(e) => setHplcUsed?.(e.target.value)}
                className="w-40 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-700 bg-white"
                placeholder="e.g. HPLC 1"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={downloadCalibration}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors"
              title="Download Calibration Curve"
            >
              <Download size={16} />
              Save
            </button>
            <div className="relative flex items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={uploadCalibration}
                accept=".json"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Upload existing Calibration Curve"
              />
              <button 
                className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md transition-colors pointer-events-none"
              >
                <Upload size={16} />
                Load
              </button>
            </div>
            <button 
              onClick={addPoint}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <Plus size={16} />
              Add calibration point
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-sm text-slate-600">
                <th className="py-3 px-4 font-medium">Mass (mg)</th>
                <th className="py-3 px-4 font-medium">Solvent Vol (mL)</th>
                <th className="py-3 px-4 font-medium">Conc. (mg/mL)</th>
                <th className="py-3 px-4 font-medium">UV Area</th>
                <th className="py-3 px-4 font-medium w-16 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {points.map((point) => {
                const volNum = Number(String(point.volMl).replace(",", "."));
                const conc = (point.massMg !== '' && point.volMl !== '' && !isNaN(volNum) && volNum > 0) 
                  ? roundTo(Number(String(point.massMg).replace(",", ".")) / volNum) 
                  : '-';
                
                return (
                  <tr key={point.id} className="text-sm">
                    <td className="py-2 px-4">
                      <input 
                        type="text" 
                        min="0"
                        step="any"
                        value={point.massMg}
                        onChange={(e) => updatePoint(point.id, 'massMg', e.target.value)}
                        className="w-full border border-slate-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="e.g. 1"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input 
                        type="text" 
                        min="0"
                        step="any"
                        value={point.volMl}
                        onChange={(e) => updatePoint(point.id, 'volMl', e.target.value)}
                        className="w-full border border-slate-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="e.g. 1"
                      />
                    </td>
                    <td className="py-2 px-4 font-medium text-slate-700 bg-slate-50/50 dark:bg-slate-900 dark:text-slate-100">
                      {conc}
                    </td>
                    <td className="py-2 px-4">
                      <input 
                        type="text" 
                        min="0"
                        step="any"
                        value={point.area}
                        onChange={(e) => updatePoint(point.id, 'area', e.target.value)}
                        className="w-full border border-slate-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="e.g. 1500"
                      />
                    </td>
                    <td className="py-2 px-4 text-center">
                      <button 
                        onClick={() => removePoint(point.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                        title="Remove point"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Regression Results</h3>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600">
              <input 
                type="checkbox" 
                checked={forceZero} 
                onChange={(e) => setForceZero?.(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Force zero
            </label>
          </div>
          {result.valid ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Equation</p>
                <p className="text-xl font-mono text-slate-900 mt-1">
                  y = {roundTo(result.slope)}x {result.intercept >= 0 ? '+' : '-'} {Math.abs(roundTo(result.intercept))}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                  <p className="text-xs text-slate-500 uppercase mb-1">R² Score</p>
                  <p className="text-lg font-medium text-blue-600">{roundTo(result.rSquared, 5)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded border border-slate-100">
                  <p className="text-xs text-slate-500 uppercase mb-1">Slope (m)</p>
                  <p className="text-lg font-medium text-slate-800">{roundTo(result.slope)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 p-4 rounded-md text-sm">
              Enter at least 2 valid data points with area and concentration &gt; 0 to generate a curve.
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm h-[380px]">
          {result.valid ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 20, right: 30, bottom: 35, left: 35 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} />
                <XAxis 
                  dataKey="x" 
                  type="number" 
                  name="Concentration" 
                  stroke={isDark ? '#64748b' : '#cbd5e1'}
                  tick={{ fill: isDark ? '#ffffff' : '#64748b', fontSize: 14 }}
                  tickFormatter={(val: number) => {
                    if (typeof val !== 'number' || isNaN(val)) return '';
                    return `${Number(val.toFixed(3))}`;
                  }}
                  domain={[0, 'dataMax + 0.1']}
                  label={{ 
                    value: 'Concentration in mg/mL', 
                    position: 'insideBottom', 
                    offset: -10, 
                    fill: isDark ? '#ffffff' : '#475569', 
                    fontSize: 16,
                    fontWeight: 600
                  }}
                />
                <YAxis 
                  dataKey="y" 
                  name="Absorbtion" 
                  stroke={isDark ? '#64748b' : '#cbd5e1'}
                  tick={{ fill: isDark ? '#ffffff' : '#64748b', fontSize: 14 }}
                  label={{ 
                    value: 'Absorbtion in mAU', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fill: isDark ? '#ffffff' : '#475569', 
                    fontSize: 16,
                    fontWeight: 600,
                    style: { textAnchor: 'middle' },
                    offset: -5
                  }}
                />
                <Tooltip 
                  cursor={{ strokeDasharray: '3 3', stroke: isDark ? '#475569' : '#cbd5e1' }}
                  contentStyle={{ 
                    borderRadius: '6px', 
                    backgroundColor: isDark ? '#0f172a' : '#ffffff',
                    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: isDark ? '#f8fafc' : '#0f172a'
                  }}
                  formatter={(value: any, name: string) => [`${roundTo(Number(value))} mAU`, name === 'Standards' ? 'Absorbtion' : name]}
                  labelFormatter={(label) => `Concentration: ${Number(Number(label).toFixed(3))} mg/mL`}
                />
                <Scatter name="Standards" data={validDataPoints} fill="#3b82f6" />
                <Scatter 
                  name="Trendline" 
                  data={trendlineData} 
                  line={{ stroke: '#10b981', strokeWidth: 2 }} 
                  shape={() => null} 
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400">
              Chart will appear here once data is entered
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
