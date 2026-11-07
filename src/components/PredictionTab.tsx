import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, Scatter, ResponsiveContainer, ComposedChart } from 'recharts';
import Plotly from 'plotly.js-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';
import { AlertCircle, Target, TrendingUp, HelpCircle, ChevronDown, ChevronUp, RefreshCw, Cpu, MonitorPlay } from 'lucide-react';

const Plot = createPlotlyComponent(Plotly);

// Helper to safely check if WebGL is currently supported and available without leaking contexts
const checkWebGLAvailability = (): { available: boolean; reason?: string } => {
  if (typeof window === 'undefined') return { available: true };
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      return { 
        available: false, 
        reason: 'The browser could not allocate a WebGL context (maximum GPU context limit reached or hardware acceleration disabled).' 
      };
    }
    const ext = (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
    if (ext) {
      ext.loseContext(); // Immediately release test context
    }
    return { available: true };
  } catch (e: any) {
    return { 
      available: false, 
      reason: e?.message || 'WebGL context initialization threw an error.' 
    };
  }
};
import { SampleData, CalibrationResult } from '../types';
import { fitTemperatureModels, fitCompositionModels, fitSimultaneousModels, DataPoint, RegressionResult } from '../utils/models';
import { enrichSamplesWithConcentration } from '../utils/calculations';

interface PredictionTabProps {
  experimentId: string;
  samples: SampleData[];
  calibrationResult: CalibrationResult;
  onActiveModelChange?: (model: any) => void;
}

const parseNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return NaN;
  const str = String(val).replace(',', '.').trim();
  const n = Number(str);
  return isNaN(n) ? NaN : n;
};

// Custom shape component for the Target Prediction point
const TargetPredictionShape = (props: any) => {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined || isNaN(cx) || isNaN(cy)) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={3} fill="#ffffff" />
      <line x1={cx - 14} y1={cy} x2={cx + 14} y2={cy} stroke="#ef4444" strokeWidth={2} />
      <line x1={cx} y1={cy - 14} x2={cx} y2={cy + 14} stroke="#ef4444" strokeWidth={2} />
    </g>
  );
};

export const PredictionTab: React.FC<PredictionTabProps> = ({ experimentId, samples, calibrationResult, onActiveModelChange }) => {
  const [isModelsBoxOpen, setIsModelsBoxOpen] = useState(false);
  const [selectedSolvent1, setSelectedSolvent1] = useState<string>(() => localStorage.getItem(`hplc-pred-solv1-${experimentId}`) || '');
  const [selectedSolvent2, setSelectedSolvent2] = useState<string>(() => localStorage.getItem(`hplc-pred-solv2-${experimentId}`) || '');
  
  const [desiredTemp, setDesiredTemp] = useState<string>(() => localStorage.getItem(`hplc-pred-temp-${experimentId}`) || '');
  const [desiredRatio, setDesiredRatio] = useState<string>(() => localStorage.getItem(`hplc-pred-ratio-${experimentId}`) || '');

  const [isDark, setIsDark] = useState(() => {
    return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem(`hplc-pred-solv1-${experimentId}`, selectedSolvent1);
    localStorage.setItem(`hplc-pred-solv2-${experimentId}`, selectedSolvent2);
    localStorage.setItem(`hplc-pred-temp-${experimentId}`, desiredTemp);
    localStorage.setItem(`hplc-pred-ratio-${experimentId}`, desiredRatio);
  }, [experimentId, selectedSolvent1, selectedSolvent2, desiredTemp, desiredRatio]);

  // Extract unique solvents
  const availableSolvents = useMemo(() => {
    const s = new Set<string>();
    samples.forEach(samp => {
      if (samp.solvent1 && samp.solvent1.trim() !== '') s.add(samp.solvent1.trim());
      if (samp.solvent2 && samp.solvent2.trim() !== '') s.add(samp.solvent2.trim());
    });
    return Array.from(s).sort();
  }, [samples]);

  // Auto-select solvent 1 and solvent 2 if none are selected
  useEffect(() => {
    if (!selectedSolvent1 && availableSolvents.length > 0) {
      const mixtureSample = samples.find(s => s.solvent1 && s.solvent2 && s.solvent1.trim() !== s.solvent2.trim());
      if (mixtureSample) {
        setSelectedSolvent1(mixtureSample.solvent1.trim());
        if (!selectedSolvent2 && localStorage.getItem(`hplc-pred-solv2-${experimentId}`) === null) {
          setSelectedSolvent2(mixtureSample.solvent2.trim());
        }
      } else {
        setSelectedSolvent1(availableSolvents[0]);
      }
    }
  }, [availableSolvents, selectedSolvent1, selectedSolvent2, samples, experimentId]);

  // Filter valid data points
  const rawValidData: DataPoint[] = useMemo(() => {
    if (!selectedSolvent1 || !calibrationResult.valid) return [];
    
    const selS1 = selectedSolvent1.trim().toLowerCase();
    const selS2 = selectedSolvent2 ? selectedSolvent2.trim().toLowerCase() : '';

    // Process samples to get reaction concentrations
    const processedSamples = enrichSamplesWithConcentration(samples, calibrationResult, 4).map(s => ({
      ...s,
      calculatedReactionConc: s.rawReactionConc
    }));

    return processedSamples
      .filter(s => s.calculatedReactionConc !== null && !isNaN(s.calculatedReactionConc))
      .filter(s => !s.excluded)
      .filter(s => {
        const s1 = (s.solvent1 || '').trim().toLowerCase();
        const s2 = (s.solvent2 || '').trim().toLowerCase();
        const rawFrac = parseNum(s.solvent1Fraction);

        // Case 1: Only Solvent 1 is selected in UI
        if (!selS2) {
          if (s1 === selS1 && (s2 === '' || s2 === selS1 || rawFrac === 100)) return true;
          if (s2 === selS1 && (s1 === '' || rawFrac === 0)) return true;
          return false;
        }

        // Case 2: Both Solvent 1 and Solvent 2 selected in UI
        // Mixture of both
        if ((s1 === selS1 && s2 === selS2) || (s1 === selS2 && s2 === selS1)) return true;

        // Pure Solvent 1
        if (s1 === selS1 && (s2 === '' || rawFrac === 100)) return true;
        if (s2 === selS1 && (s1 === '' || rawFrac === 0)) return true;

        // Pure Solvent 2
        if (s1 === selS2 && (s2 === '' || rawFrac === 100)) return true;
        if (s2 === selS2 && (s1 === '' || rawFrac === 0)) return true;

        return false;
      })
      .map(s => {
        const s1 = (s.solvent1 || '').trim().toLowerCase();
        const s2 = (s.solvent2 || '').trim().toLowerCase();
        const rawFrac = parseNum(s.solvent1Fraction);

        let f = 1;
        if (!isNaN(rawFrac)) {
          if (s1 === selS1) {
            f = rawFrac / 100;
          } else if (s2 === selS1) {
            f = (100 - rawFrac) / 100;
          } else if (s1 === selS2) {
            f = (100 - rawFrac) / 100;
          } else {
            f = rawFrac / 100;
          }
        } else {
          if (s1 === selS1 && (s2 === '' || s2 === selS1)) f = 1;
          else if (s1 === selS2 && (s2 === '' || s2 === selS2)) f = 0;
          else if (s2 === selS1) f = 1;
          else if (s2 === selS2) f = 0;
        }

        const tempC = parseNum(s.temperature);
        
        return {
          T: tempC,
          f: Math.max(0, Math.min(1, f)),
          S: Math.max(0, Number(s.calculatedReactionConc))
        };
      })
      .filter(d => !isNaN(d.T) && !isNaN(d.f) && !isNaN(d.S));
  }, [samples, selectedSolvent1, selectedSolvent2, calibrationResult]);

  const [taskOverride, setTaskOverride] = useState<'auto' | 'temperature' | 'composition'>('auto');
  const [selectedModelName, setSelectedModelName] = useState<string>('');

  const rawUniqueT = useMemo(() => Array.from(new Set(rawValidData.map(d => d.T))).sort((a,b)=>a-b), [rawValidData]);
  const rawUniqueF = useMemo(() => Array.from(new Set(rawValidData.map(d => d.f))).sort((a,b)=>a-b), [rawValidData]);
  const canDoBoth = rawUniqueT.length > 1 && rawUniqueF.length > 1;

  const [filterTemp, setFilterTemp] = useState<number | null>(null);
  const [filterComp, setFilterComp] = useState<number | null>(null);

  useEffect(() => {
    if (rawUniqueT.length > 0 && (filterTemp === null || !rawUniqueT.includes(filterTemp))) {
      setFilterTemp(rawUniqueT[0]);
    }
    if (rawUniqueF.length > 0 && (filterComp === null || !rawUniqueF.includes(filterComp))) {
      setFilterComp(rawUniqueF[0]);
    }
  }, [rawUniqueT, rawUniqueF, filterTemp, filterComp]);

  const validData = useMemo(() => {
    if (!canDoBoth || taskOverride === 'auto') return rawValidData;
    if (taskOverride === 'temperature') {
      return rawValidData.filter(d => d.f === filterComp);
    }
    if (taskOverride === 'composition') {
      return rawValidData.filter(d => d.T === filterTemp);
    }
    return rawValidData;
  }, [rawValidData, canDoBoth, taskOverride, filterTemp, filterComp]);

  // Identify prediction task
  const predictionTask = useMemo(() => {
    if (validData.length === 0) return null;
    const uniqueT = new Set(validData.map(d => d.T)).size;
    const uniqueF = new Set(validData.map(d => d.f)).size;
    
    const canDoTemp = uniqueT > 1;
    const canDoComp = uniqueF > 1;
    
    if (canDoTemp && canDoComp) {
      if (taskOverride === 'temperature') return 'temperature';
      if (taskOverride === 'composition') return 'composition';
      return 'simultaneous';
    }
    
    if (canDoTemp) return 'temperature'; // Task 1
    if (canDoComp) return 'composition'; // Task 2
    return 'insufficient';
  }, [validData, taskOverride]);

  // Fit models
  const models = useMemo(() => {
    if (predictionTask === 'temperature') return fitTemperatureModels(validData);
    if (predictionTask === 'composition') return fitCompositionModels(validData);
    if (predictionTask === 'simultaneous') return fitSimultaneousModels(validData);
    return [];
  }, [predictionTask, validData]);

  useEffect(() => {
    if (models.length > 0) {
      if (!selectedModelName || !models.some(m => m.modelName === selectedModelName)) {
        setSelectedModelName(models[0].modelName);
      }
    } else {
      setSelectedModelName('');
    }
  }, [models, selectedModelName]);

  const bestModel = useMemo(() => {
    if (models.length === 0) return null;
    const selected = models.find(m => m.modelName === selectedModelName);
    return selected || models[0];
  }, [models, selectedModelName]);

  const isBestModel = models.length > 0 && bestModel?.modelName === models[0].modelName;

  const tVal = desiredTemp !== '' ? Number(desiredTemp) : null;
  const fVal = desiredRatio !== '' ? Number(desiredRatio) / 100 : null;

  // Auto-fill target inputs with average experimental values if empty
  useEffect(() => {
    if (validData.length > 0) {
      if (!desiredTemp) {
        const avgT = Math.round(validData.reduce((acc, d) => acc + d.T, 0) / validData.length);
        setDesiredTemp(String(avgT || 25));
      }
      if (!desiredRatio) {
        const avgF = Math.round((validData.reduce((acc, d) => acc + d.f, 0) / validData.length) * 100);
        setDesiredRatio(String(avgF || 100));
      }
    }
  }, [validData]);

  // Make prediction
  const predictionResult = useMemo(() => {
    if (!bestModel) return null;

    if (predictionTask === 'temperature' && tVal !== null && !isNaN(tVal)) {
      return bestModel.predict({ T: tVal });
    }
    if (predictionTask === 'composition' && fVal !== null && !isNaN(fVal)) {
      return bestModel.predict({ f: fVal });
    }
    if (predictionTask === 'simultaneous' && tVal !== null && fVal !== null && !isNaN(tVal) && !isNaN(fVal)) {
      return bestModel.predict({ T: tVal, f: fVal });
    }
    return null;
  }, [bestModel, desiredTemp, desiredRatio, predictionTask, tVal, fVal]);

  // Target scatter point for visual crosshair
  const targetScatterPoint = useMemo(() => {
    if (!predictionResult || isNaN(predictionResult.pred)) return null;
    if ((predictionTask === 'temperature' || predictionTask === 'simultaneous') && tVal !== null && !isNaN(tVal)) {
      return { x: tVal, y: Math.max(0, predictionResult.pred) };
    }
    if (predictionTask === 'composition' && fVal !== null && !isNaN(fVal)) {
      return { x: Math.round(fVal * 100), y: Math.max(0, predictionResult.pred) };
    }
    return null;
  }, [predictionResult, predictionTask, tVal, fVal]);

  // Domain check
  const domainCheck = useMemo(() => {
    if (!validData.length || !predictionResult) return null;
    const minT = Math.min(...validData.map(d => d.T));
    const maxT = Math.max(...validData.map(d => d.T));
    const minF = Math.min(...validData.map(d => d.f));
    const maxF = Math.max(...validData.map(d => d.f));
    
    let isExtrapolating = false;
    if (tVal !== null && (tVal < minT - 5 || tVal > maxT + 5)) isExtrapolating = true;
    if (fVal !== null && (fVal < minF - 0.05 || fVal > maxF + 0.05)) isExtrapolating = true;
    
    return isExtrapolating;
  }, [validData, predictionResult, tVal, fVal]);

  const chartData = useMemo(() => {
    if (!bestModel || validData.length === 0) return [];
    
    const data = [];
    if (predictionTask === 'temperature' || predictionTask === 'simultaneous') {
      let minT = Math.min(...validData.map(d => d.T));
      let maxT = Math.max(...validData.map(d => d.T));
      if (tVal !== null && !isNaN(tVal)) {
        minT = Math.min(minT, tVal);
        maxT = Math.max(maxT, tVal);
      }
      const startT = Math.max(-20, Math.floor(minT - 5));
      const endT = Math.ceil(maxT + 5);
      const fixedF = fVal !== null && !isNaN(fVal) ? fVal : 0.5;

      for (let t = startT; t <= endT; t += Math.max(0.5, (endT - startT) / 50)) {
        const pred = predictionTask === 'simultaneous' 
          ? bestModel.predict({ T: t, f: fixedF }) 
          : bestModel.predict({ T: t });
        data.push({
          x: Math.round(t * 10) / 10,
          pred: Math.max(0, pred.pred)
        });
      }
    } else if (predictionTask === 'composition') {
      for (let f = 0; f <= 1.001; f += 0.02) {
        const pred = bestModel.predict({ f });
        data.push({
          x: Math.round(f * 100),
          pred: Math.max(0, pred.pred)
        });
      }
    }
    return data;
  }, [bestModel, predictionTask, validData, fVal, tVal]);

  const scatterData = useMemo(() => {
    if (predictionTask === 'temperature' || predictionTask === 'simultaneous') {
      return validData.map(d => ({ x: d.T, y: d.S }));
    }
    if (predictionTask === 'composition') {
      return validData.map(d => ({ x: Math.round(d.f * 100), y: d.S }));
    }
    return [];
  }, [predictionTask, validData]);

  const maxYValue = useMemo(() => {
    let max = 0.1;
    if (scatterData.length > 0) {
      max = Math.max(max, ...scatterData.map(d => d.y));
    }
    if (chartData.length > 0) {
      max = Math.max(max, ...chartData.map(d => d.y));
    }
    if (predictionResult && !isNaN(predictionResult.pred)) {
      max = Math.max(max, predictionResult.pred);
    }
    return max * 1.5;
  }, [scatterData, chartData, predictionResult]);

  const [is3DView, setIs3DView] = useState(true);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [plotKey, setPlotKey] = useState<number>(0);
  const plotContainerRef = useRef<HTMLDivElement>(null);

  // Proactively check WebGL availability whenever entering 3D view or retrying
  useEffect(() => {
    if (is3DView && predictionTask === 'simultaneous') {
      const check = checkWebGLAvailability();
      if (!check.available) {
        setWebglError(check.reason || 'WebGL context unavailable.');
      } else {
        setWebglError(null);
      }
    }
  }, [is3DView, predictionTask, plotKey]);

  // Clean up Plotly WebGL context when leaving 3D view or unmounting
  useEffect(() => {
    return () => {
      if (plotContainerRef.current) {
        try {
          Plotly.purge(plotContainerRef.current);
        } catch (e) {
          // ignore
        }
      }
    };
  }, [is3DView]);

  const handleRetryWebGL = () => {
    if (plotContainerRef.current) {
      try {
        Plotly.purge(plotContainerRef.current);
      } catch (e) {
        // ignore
      }
    }
    setWebglError(null);
    setPlotKey(prev => prev + 1);
  };

  const surfaceData = useMemo(() => {
    if (!bestModel || predictionTask !== 'simultaneous') return null;
    
    let minT = Math.min(...rawValidData.map(d => d.T));
    let maxT = Math.max(...rawValidData.map(d => d.T));
    if (tVal !== null && !isNaN(tVal)) {
      minT = Math.min(minT, tVal);
      maxT = Math.max(maxT, tVal);
    }
    const startT = Math.max(-20, Math.floor(minT - 5));
    const endT = Math.ceil(maxT + 5);
    
    const tValues = [];
    for (let t = startT; t <= endT; t += Math.max(0.5, (endT - startT) / 20)) {
      tValues.push(t);
    }
    
    const fValues = [];
    for (let f = 0; f <= 1.001; f += 0.05) {
      fValues.push(f);
    }
    
    const zData = tValues.map(t => 
      fValues.map(f => Math.max(0, bestModel.predict({ T: t, f }).pred))
    );

    return {
      tValues,
      fValues: fValues.map(f => f * 100),
      zData
    };
  }, [bestModel, predictionTask, rawValidData, tVal]);

  const scatter3DData = useMemo(() => {
    if (predictionTask !== 'simultaneous') return null;
    return rawValidData.map(d => ({
      t: d.T,
      f: d.f * 100,
      s: d.S
    }));
  }, [predictionTask, rawValidData]);

  const targetScatter3DPoint = useMemo(() => {
    if (!predictionResult || isNaN(predictionResult.pred) || tVal === null || isNaN(tVal) || fVal === null || isNaN(fVal)) return null;
    return {
      t: tVal,
      f: fVal * 100,
      s: Math.max(0, predictionResult.pred)
    };
  }, [predictionResult, tVal, fVal]);

  const plot3DData = useMemo(() => {
    if (!surfaceData || !scatter3DData) return [];
    return [
      {
        type: 'surface' as const,
        z: surfaceData.zData,
        x: surfaceData.fValues,
        y: surfaceData.tValues,
        colorscale: 'Viridis',
        opacity: 0.8,
        name: 'Predicted Model',
        showscale: false
      },
      {
        type: 'scatter3d' as const,
        mode: 'markers' as const,
        x: scatter3DData.map(d => d.f),
        y: scatter3DData.map(d => d.t),
        z: scatter3DData.map(d => d.s),
        marker: {
          size: 5,
          color: '#0f172a',
          symbol: 'circle'
        },
        name: 'Experimental Data'
      },
      ...(targetScatter3DPoint ? [{
        type: 'scatter3d' as const,
        mode: 'markers' as const,
        x: [targetScatter3DPoint.f],
        y: [targetScatter3DPoint.t],
        z: [targetScatter3DPoint.s],
        marker: {
          size: 8,
          color: '#ef4444',
          symbol: 'diamond'
        },
        name: 'Target Prediction'
      }] : [])
    ];
  }, [surfaceData, scatter3DData, targetScatter3DPoint]);

  const plot3DLayout = useMemo(() => {
    const axisTextColor = isDark ? '#ffffff' : '#334155';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0';
    const zeroColor = isDark ? 'rgba(255, 255, 255, 0.4)' : '#cbd5e1';
    const bgColor = isDark ? '#1e293b' : '#f8fafc';

    return {
      autosize: true,
      showlegend: false,
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: { 
          title: { text: `${selectedSolvent1} (%)`, font: { size: 16, color: axisTextColor } },
          tickfont: { size: 13, color: axisTextColor },
          color: axisTextColor,
          gridcolor: gridColor,
          zerolinecolor: zeroColor,
          backgroundcolor: bgColor,
          showbackground: true
        },
        yaxis: { 
          title: { text: 'Temp (°C)', font: { size: 16, color: axisTextColor } },
          tickfont: { size: 13, color: axisTextColor },
          color: axisTextColor,
          gridcolor: gridColor,
          zerolinecolor: zeroColor,
          backgroundcolor: bgColor,
          showbackground: true
        },
        zaxis: { 
          title: { text: 'Solubility (mg/mL)', font: { size: 16, color: axisTextColor } },
          tickfont: { size: 13, color: axisTextColor },
          color: axisTextColor,
          gridcolor: gridColor,
          zerolinecolor: zeroColor,
          backgroundcolor: bgColor,
          showbackground: true
        },
        aspectmode: 'cube' as const
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent'
    };
  }, [selectedSolvent1, isDark]);

  const predictionContext = useMemo(() => {
    return {
      model: bestModel,
      models,
      predictionTask,
      surfaceData,
      scatter3DData,
      targetScatter3DPoint,
      chartData,
      scatterData,
      selectedSolvent1,
      selectedSolvent2,
      targetT: tVal
    };
  }, [bestModel, models, predictionTask, surfaceData, scatter3DData, targetScatter3DPoint, chartData, scatterData, selectedSolvent1, selectedSolvent2, tVal]);

  useEffect(() => {
    if (onActiveModelChange) {
      onActiveModelChange(predictionContext);
    }
  }, [predictionContext, onActiveModelChange]);

  return (
    <div className="space-y-8 animate-fade-in">
      
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Target className="text-blue-500" size={20} />
            Data Selection
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Select solvents to load experimental measurements and build the predictive model.
          </p>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Solvent 1 (Primary)
            </label>
            <select
              value={selectedSolvent1}
              onChange={(e) => setSelectedSolvent1(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select Solvent 1 --</option>
              {availableSolvents.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Solvent 2 (Optional)
            </label>
            <select
              value={selectedSolvent2}
              onChange={(e) => setSelectedSolvent2(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- None (Pure Solvent) --</option>
              {availableSolvents.filter(s => s !== selectedSolvent1).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        
        {!calibrationResult.valid ? (
          <div className="px-6 pb-6">
            <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  HPLC Calibration Curve Required
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  Please complete Tab 1 (Calibration) with valid standard measurements to calculate reaction concentrations.
                </p>
              </div>
            </div>
          </div>
        ) : validData.length === 0 ? (
          <div className="px-6 pb-6">
            <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  No Matching Sample Measurements Found
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  No valid sample data matched <strong>{selectedSolvent1 || 'selected solvent'}</strong>{selectedSolvent2 ? ` and ${selectedSolvent2}` : ''}. Please verify in Tab 2 that sample rows have matching Solvent names, non-zero UV Area, Sampling Vol (µL), Added Solvent (mL), and Temperature (°C).
                </p>
              </div>
            </div>
          </div>
        ) : predictionTask === 'insufficient' ? (
          <div className="px-6 pb-6">
            <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Found {validData.length} measurement(s), but additional data variation is needed
                </h4>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                  All matched samples have identical Temperature ({validData[0]?.T}°C) and Composition ({Math.round(validData[0]?.f * 100)}%). To fit a prediction model, please add sample rows in Tab 2 with at least two different temperatures (e.g. 25°C and 50°C) or two different solvent fractions (e.g. 50% and 100%).
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <div className="bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
              <TrendingUp className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" size={18} />
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  Found {validData.length} valid experimental measurement(s).
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">
                  {predictionTask === 'temperature' && "Data varies by temperature. Task: Temperature Interpolation (Van't Hoff / Polynomials)."}
                  {predictionTask === 'composition' && "Data varies by solvent composition. Task: Composition Interpolation (Log-Linear / Jouyban-Acree)."}
                  {predictionTask === 'simultaneous' && "Data varies by both temperature and composition. Task: Simultaneous 2D Prediction."}
                </p>
                {canDoBoth && (
                  <div className="mt-3 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-blue-800 dark:text-blue-300">Force specific task:</label>
                      <select
                        value={taskOverride}
                        onChange={(e) => setTaskOverride(e.target.value as any)}
                        className="text-xs border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-900 rounded px-2 py-1 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="auto">Auto (Simultaneous 2D)</option>
                        <option value="temperature">Task 1: Temperature</option>
                        <option value="composition">Task 2: Composition</option>
                      </select>
                    </div>
                    {taskOverride === 'temperature' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-blue-800 dark:text-blue-300">at Composition:</label>
                        <select
                          value={filterComp !== null ? filterComp : ''}
                          onChange={(e) => setFilterComp(Number(e.target.value))}
                          className="text-xs border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-900 rounded px-2 py-1 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {rawUniqueF.map(f => (
                            <option key={f} value={f}>{Math.round(f * 100)}% Solv 1</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {taskOverride === 'composition' && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-blue-800 dark:text-blue-300">at Temperature:</label>
                        <select
                          value={filterTemp !== null ? filterTemp : ''}
                          onChange={(e) => setFilterTemp(Number(e.target.value))}
                          className="text-xs border border-blue-200 dark:border-blue-700 bg-white dark:bg-slate-900 rounded px-2 py-1 text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {rawUniqueT.map(t => (
                            <option key={t} value={t}>{t}°C</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {bestModel && predictionTask !== 'insufficient' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {/* Prediction Input Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Make Prediction</h2>
              </div>
              <div className="p-4 space-y-4">
                {(predictionTask === 'temperature' || predictionTask === 'simultaneous') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Target Temperature (°C)
                    </label>
                    <input
                      type="number"
                      value={desiredTemp}
                      onChange={(e) => setDesiredTemp(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 25"
                    />
                  </div>
                )}
                
                {(predictionTask === 'composition' || predictionTask === 'simultaneous') && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Target {selectedSolvent1} Fraction (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={desiredRatio}
                      onChange={(e) => setDesiredRatio(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-md px-3 py-2 text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. 50"
                    />
                  </div>
                )}

                {domainCheck && (
                  <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-md p-3 flex items-start gap-2">
                    <AlertCircle className="text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" size={16} />
                    <p className="text-xs text-amber-900 dark:text-amber-200">
                      Prediction is outside validated experimental domain. Results may be unreliable.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Prediction Result Card */}
            {predictionResult && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Result</h2>
                </div>
                <div className="p-6 text-center">
                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">Predicted Solubility</div>
                  <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                    {Math.max(0, predictionResult.pred).toFixed(2)} <span className="text-lg font-normal text-slate-500 dark:text-slate-400">mg/mL</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-left border-t border-slate-100 dark:border-slate-700 pt-4">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">95% Confidence Interval</div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        [{Math.max(0, predictionResult.ci95[0]).toFixed(2)}, {Math.max(0, predictionResult.ci95[1]).toFixed(2)}]
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">95% Prediction Interval</div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        [{Math.max(0, predictionResult.pi95[0]).toFixed(2)}, {Math.max(0, predictionResult.pi95[1]).toFixed(2)}]
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Model Selection Card */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Selected Model</h2>
                  {isBestModel ? (
                    <span className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 text-xs px-2 py-0.5 rounded-full font-medium">Best Fit</span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 text-xs px-2 py-0.5 rounded-full font-medium">Custom Selection</span>
                  )}
                </div>
                {!isBestModel && (
                  <div className="flex items-start gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 mt-1">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>Currently not the best fitting model selected.</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="font-medium text-slate-800 dark:text-slate-200 mb-2">{bestModel.modelName}</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">R²</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{bestModel.stats.r2.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Adj R²</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{bestModel.stats.adj_r2.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">RMSE</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{bestModel.stats.rmse.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">MAPE</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{bestModel.stats.mape.toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">AIC</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">{bestModel.stats.aic.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-2 space-y-6">
             {/* Chart */}
             {bestModel && predictionTask && (
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                  <h3 className="text-md font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    {predictionTask === 'composition' ? 'Solubility vs Composition' : predictionTask === 'temperature' ? 'Solubility vs Temperature' : 'Simultaneous Solubility Model'}
                    {predictionTask === 'simultaneous' && (
                      <button 
                        onClick={() => setIs3DView(!is3DView)}
                        className={`text-xs px-2 py-1 rounded-md border ${is3DView ? 'bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/40 dark:border-blue-700 dark:text-blue-300' : 'bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300'} transition-colors ml-2`}
                      >
                        {is3DView ? '2D View' : '3D View'}
                      </button>
                    )}
                  </h3>
                  <div className="flex items-center gap-4 text-xs flex-wrap">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-slate-100 inline-block"></span>
                      Experimental Data
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="w-3 h-0.5 bg-blue-500 inline-block"></span>
                      Predicted Curve
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
                      Target Prediction
                    </div>
                    {is3DView && predictionTask === 'simultaneous' && (
                      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 border-l border-slate-300 dark:border-slate-700 pl-4 ml-2">
                        <span><strong className="font-medium text-slate-600 dark:text-slate-300">X:</strong> {selectedSolvent1} Fraction (%)</span>
                        <span><strong className="font-medium text-slate-600 dark:text-slate-300">Y:</strong> Temp (°C)</span>
                        <span><strong className="font-medium text-slate-600 dark:text-slate-300">Z:</strong> Solubility (mg/mL)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div ref={plotContainerRef} className="h-[350px] md:h-[450px] lg:h-[500px] w-full relative">
                  {is3DView && surfaceData && scatter3DData ? (
                    webglError ? (
                      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                        <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
                          <Cpu size={24} />
                        </div>
                        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
                          WebGL 3D Context Temporarily Unavailable
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mb-4 leading-relaxed">
                          Your browser temporarily cannot allocate a 3D WebGL context. This typically happens when the browser's active GPU context limit (8–16) is reached across tabs, or after a system sleep cycle.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
                          <button
                            onClick={() => setIs3DView(false)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm flex items-center gap-2"
                          >
                            <MonitorPlay size={15} />
                            Switch to 2D Slice View (Zero GPU)
                          </button>
                          <button
                            onClick={handleRetryWebGL}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 rounded-lg text-xs font-medium transition-colors flex items-center gap-2"
                          >
                            <RefreshCw size={15} />
                            Retry 3D WebGL
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 max-w-md text-left space-y-1">
                          <div className="font-semibold text-slate-700 dark:text-slate-300 mb-0.5">Quick Browser Fixes:</div>
                          <div>• <strong>Restart Browser GPU:</strong> Open a tab and navigate to <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400">chrome://restart</code>.</div>
                          <div>• <strong>Hardware Acceleration:</strong> Ensure <span className="font-medium">"Use graphics acceleration when available"</span> is ON in browser Settings.</div>
                          <div>• <strong>Context Limit:</strong> Close extra tabs that use 3D graphics or Maps to free WebGL contexts.</div>
                        </div>
                      </div>
                    ) : (
                      <Plot
                        key={plotKey}
                        data={plot3DData}
                        layout={plot3DLayout}
                        config={{ responsive: true, displayModeBar: false }}
                        style={{ width: '100%', height: '100%' }}
                        onError={(err) => {
                          console.warn('Plotly WebGL error caught:', err);
                          setWebglError('WebGL context creation failed or context was lost.');
                        }}
                      />
                    )
                  ) : (
                    <ResponsiveContainer>
                      <ComposedChart data={chartData} margin={{ top: 10, right: 20, bottom: 25, left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#cbd5e1'} opacity={isDark ? 0.6 : 0.3} />
                        <XAxis 
                          dataKey="x" 
                          type="number" 
                          domain={predictionTask === 'composition' ? [0, 100] : ['dataMin - 2', 'dataMax + 2']}
                          ticks={predictionTask === 'composition' ? [0, 20, 40, 60, 80, 100] : undefined}
                          name={predictionTask === 'composition' ? `${selectedSolvent1} (%)` : 'Temperature (°C)'}
                          stroke={isDark ? '#64748b' : '#cbd5e1'}
                          label={{ 
                            value: predictionTask === 'composition' ? `${selectedSolvent1} Fraction (%)` : 'Temperature (°C)', 
                            position: 'insideBottom', 
                            offset: -15,
                            style: { fill: isDark ? '#ffffff' : '#64748b', fontSize: 16, fontWeight: 500 }
                          }}
                          tick={{ fill: isDark ? '#ffffff' : '#64748b', fontSize: 14 }}
                        />
                        <YAxis 
                          name="Solubility (mg/mL)" 
                          domain={[0, maxYValue]}
                          allowDataOverflow={true}
                          stroke={isDark ? '#64748b' : '#cbd5e1'}
                          tickFormatter={(val) => Number(val.toFixed(2)).toString()}
                          label={{ 
                            value: 'Solubility (mg/mL)', 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { fill: isDark ? '#ffffff' : '#64748b', fontSize: 16, fontWeight: 500 } 
                          }}
                          tick={{ fill: isDark ? '#ffffff' : '#64748b', fontSize: 14 }}
                        />
                        <RechartsTooltip 
                          cursor={{ strokeDasharray: '3 3', stroke: isDark ? '#475569' : '#cbd5e1' }}
                          contentStyle={{ 
                            borderRadius: '8px', 
                            backgroundColor: isDark ? '#0f172a' : '#ffffff',
                            border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, 
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            color: isDark ? '#f8fafc' : '#0f172a'
                          }}
                          formatter={(value: any, name: string) => {
                            if (typeof value === 'number') {
                              return [`${value.toFixed(2)} mg/mL`, name];
                            }
                            return [value, name];
                          }}
                          labelFormatter={(label: any) => {
                            const unit = predictionTask === 'composition' ? '%' : '°C';
                            const labelName = predictionTask === 'composition' ? `${selectedSolvent1} Fraction` : 'Temperature';
                            return `${labelName}: ${label}${unit}`;
                          }}
                        />
                        
                        {/* Prediction Line */}
                        <Line 
                          data={chartData} 
                          type="monotone" 
                          dataKey="pred" 
                          stroke="#3b82f6" 
                          strokeWidth={2.5}
                          name="Predicted Model" 
                          dot={false} 
                          activeDot={{ r: 5 }}
                        />
                        
                        {/* Experimental Data Points */}
                        <Scatter 
                          data={scatterData} 
                          dataKey="y"
                          fill="#0f172a" 
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          name="Experimental Data" 
                        />
                        
                        {/* Target Prediction Point */}
                        {targetScatterPoint && (
                          <Scatter 
                            data={[targetScatterPoint]} 
                            dataKey="y"
                            name="Target Prediction" 
                            shape={<TargetPredictionShape />}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
             )}

             {/* Candidate Models Comparison */}
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-md font-semibold text-slate-800 dark:text-slate-100">Candidate Models Comparison</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Models grounded in physical/thermodynamic reality are prioritized when statistical fit is comparable.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Physical / Thermodynamic
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                      <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                      Mathematical / Empirical
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                        <th className="py-2.5 px-4 font-medium">Model</th>
                        <th className="py-2.5 px-3 font-medium">Type</th>
                        <th className="py-2.5 px-4 font-medium text-right">R²</th>
                        <th className="py-2.5 px-4 font-medium text-right">Adj R²</th>
                        <th className="py-2.5 px-4 font-medium text-right">RMSE</th>
                        <th className="py-2.5 px-4 font-medium text-right">AIC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                      {models.map((model, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => setSelectedModelName(model.modelName)}
                          className={`cursor-pointer transition-colors hover:bg-blue-50/50 dark:hover:bg-blue-900/20 ${
                            model.modelName === selectedModelName ? "bg-blue-50 dark:bg-blue-900/30" : ""
                          }`}
                        >
                          <td className="py-2.5 px-4 text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            {idx === 0 && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Recommended candidate model"></span>}
                            {model.modelName === selectedModelName && idx !== 0 && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Selected"></span>}
                            <span className="font-medium">{model.modelName}</span>
                            {idx === 0 && (
                              <span className="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 ml-1">
                                Recommended
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium ${
                                model.category === 'physical'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {model.category === 'physical' ? 'Physical' : 'Mathematical'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-right font-mono">{model.stats.r2.toFixed(4)}</td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-right font-mono">{model.stats.adj_r2.toFixed(4)}</td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-right font-mono">{model.stats.rmse.toFixed(4)}</td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-right font-mono">{model.stats.aic.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>
        </div>
      )}
      {/* Informational Models List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mt-8">
        <div 
          className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
          onClick={() => setIsModelsBoxOpen(!isModelsBoxOpen)}
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="text-slate-500 dark:text-slate-400" size={20} />
            <h2 className="text-md font-semibold text-slate-800 dark:text-slate-100">Evaluated Candidate Models</h2>
          </div>
          {isModelsBoxOpen ? (
            <ChevronUp className="text-slate-500 dark:text-slate-400" size={20} />
          ) : (
            <ChevronDown className="text-slate-500 dark:text-slate-400" size={20} />
          )}
        </div>
        
        {isModelsBoxOpen && (
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 duration-200">
            <div>
              <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3 text-sm">Task 1: Temperature Interpolation</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc pl-5">
                <li>Van't Hoff Relationship <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Modified Apelblat Equation <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Clarke-Glew Equation <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Linear Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Quadratic Polynomial <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Cubic Spline <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Natural Spline <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Monotonic Spline <span className="text-xs text-slate-500">(Mathematical)</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3 text-sm">Task 2: Composition Interpolation</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc pl-5">
                <li>Log-Linear Mixing (Yalkowsky) <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Jouyban-Acree Simplified <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Jouyban-Acree Full <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Redlich-Kister Expansion <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Linear Mixing <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Quadratic Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Polynomial Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Cubic Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Spline Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Weighted Nonlinear Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-slate-800 dark:text-slate-200 mb-3 text-sm">Task 3: Simultaneous Prediction</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400 list-disc pl-5">
                <li>Van't Hoff + Yalkowsky Combined <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Jouyban-Acree + Van't Hoff <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>Apelblat + Jouyban-Acree <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">(Physical)</span></li>
                <li>2D Linear Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>2D Quadratic Polynomial <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>2D Polynomial Regression <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Tensor Splines <span className="text-xs text-slate-500">(Mathematical)</span></li>
                <li>Locally Estimated Scatterplot Smoothing (LOESS) <span className="text-xs text-slate-500">(Mathematical)</span></li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
