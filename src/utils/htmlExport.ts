import { CalibrationPoint, SampleData, CalibrationResult } from '../types';
import { getExportFileName } from '../utils';
import { enrichSamplesWithConcentration } from './calculations';
import { fitTemperatureModels, DataPoint } from './models';
import logoImg from '../assets/Logo.png';

interface ExportHTMLParams {
  experimentName: string;
  calibrationData: CalibrationPoint[];
  calibrationResult: CalibrationResult;
  samples: SampleData[];
  wavelength?: string;
  hplcUsed?: string;
  activePredictionModel?: any;
  forceZero?: boolean;
}

export const exportToInteractiveHTML = async ({
  experimentName,
  calibrationData,
  calibrationResult,
  samples,
  wavelength,
  hplcUsed,
  activePredictionModel,
  forceZero
}: ExportHTMLParams) => {
    const parseNum = (val: any) => {
        if (val === null || val === undefined || val === '') return NaN;
        if (typeof val === 'number') return val;
        const str = String(val).replace(',', '.');
        return parseFloat(str);
    };
    
    // Convert logo to base64
    let logoBase64 = '';
    try {
        const img = new Image();
        img.src = logoImg;
        await new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; 
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            logoBase64 = canvas.toDataURL('image/png');
        }
    } catch (err) {
        console.error('Failed to load logo for HTML export', err);
    }

    // Calculate concentration correctly
    const validCalPoints = calibrationData
      .map(p => {
          const mass = Number(String(p.massMg).replace(',', '.'));
          const vol = Number(String(p.volMl).replace(',', '.'));
          return {
              concentration: mass && vol ? mass / vol : NaN,
              area: p.area
          };
      })
      .filter(p => !isNaN(p.concentration));

    const validSamples = samples.filter(s => !s.excluded);

    const d = new Date();
    const formattedDate = `${d.getDate()}. ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;

    // Batch process prediction models for all solvents in dataset
    const allSolventsData: Record<string, any> = {};

    if (calibrationResult && calibrationResult.valid && samples && samples.length > 0) {
        const processedSamples = enrichSamplesWithConcentration(samples, calibrationResult, 4).map(s => ({
            ...s,
            calculatedReactionConc: s.rawReactionConc
        }));

        // Collect all unique solvent names
        const solventNamesSet = new Set<string>();
        samples.forEach(s => {
            if (s.solvent1 && s.solvent1.trim() !== '') solventNamesSet.add(s.solvent1.trim());
            if (s.solvent2 && s.solvent2.trim() !== '') solventNamesSet.add(s.solvent2.trim());
        });
        const solventNames = Array.from(solventNamesSet).sort((a, b) => a.localeCompare(b));

        // Generate predictions for each individual solvent
        for (const solvName of solventNames) {
            const sNameLower = solvName.trim().toLowerCase();
            const matchingSamples = processedSamples.filter(s => {
                if (s.excluded) return false;
                if (s.calculatedReactionConc === null || isNaN(s.calculatedReactionConc)) return false;
                const s1 = (s.solvent1 || '').trim().toLowerCase();
                const s2 = (s.solvent2 || '').trim().toLowerCase();
                const rawFrac = parseNum(s.solvent1Fraction);

                // Pure solvent conditions
                if (s1 === sNameLower && (s2 === '' || s2 === sNameLower || rawFrac === 100)) return true;
                if (s2 === sNameLower && (s1 === '' || rawFrac === 0)) return true;
                return false;
            });

            const dataPoints: DataPoint[] = matchingSamples.map(s => ({
                T: parseNum(s.temperature),
                f: 1,
                S: Math.max(0, Number(s.calculatedReactionConc))
            })).filter(d => !isNaN(d.T) && !isNaN(d.S));

            const uniqueT = Array.from(new Set(dataPoints.map(d => d.T))).sort((a, b) => a - b);
            
            // Require at least 2 distinct temperatures to fit temperature curves
            if (uniqueT.length >= 2) {
                const models = fitTemperatureModels(dataPoints);
                if (models && models.length > 0) {
                    let selectedModel = models[0];
                    if (
                        activePredictionModel &&
                        activePredictionModel.selectedSolvent1 &&
                        activePredictionModel.selectedSolvent1.trim().toLowerCase() === sNameLower &&
                        (!activePredictionModel.selectedSolvent2 || activePredictionModel.selectedSolvent2.trim().toLowerCase() === sNameLower) &&
                        activePredictionModel.model
                    ) {
                        const match = models.find(m => m.modelName === activePredictionModel.model.modelName);
                        if (match) selectedModel = match;
                    }

                    const minT = Math.min(...uniqueT);
                    const maxT = Math.max(...uniqueT);
                    const startT = Math.max(-20, Math.floor(minT - 5));
                    
                    // Extend prediction range by default 30 °C beyond the last experimental datapoint
                    let upperT = maxT + 30;
                    if (activePredictionModel && activePredictionModel.targetT) {
                        const targetTNum = parseNum(activePredictionModel.targetT);
                        if (!isNaN(targetTNum) && targetTNum > upperT) {
                            upperT = targetTNum + 5;
                        }
                    }
                    const endT = Math.ceil(upperT);

                    const candidateModels = models.map(m => {
                        const cData: Array<{ x: number; pred: number }> = [];
                        const step = Math.max(0.5, (endT - startT) / 70);
                        for (let t = startT; t <= endT + 0.001; t += step) {
                            const pred = m.predict({ T: t });
                            cData.push({
                                x: Math.round(t * 10) / 10,
                                pred: Math.max(0, pred.pred)
                            });
                        }
                        return {
                            modelName: m.modelName,
                            category: m.category || 'mathematical',
                            stats: {
                                r2: m.stats?.r2 || 0,
                                adj_r2: m.stats?.adj_r2 || 0,
                                rmse: m.stats?.rmse || 0,
                                mape: m.stats?.mape || 0,
                                aic: m.stats?.aic || 0
                            },
                            chartData: cData
                        };
                    });

                    const activeCandidate = candidateModels.find(m => m.modelName === selectedModel.modelName) || candidateModels[0];
                    const scatterData = dataPoints.map(d => ({ x: d.T, y: d.S }));

                    const traces = [
                        {
                            x: scatterData.map(d => d.x),
                            y: scatterData.map(d => d.y),
                            mode: 'markers',
                            type: 'scatter',
                            name: 'Experimental Data',
                            marker: { size: 10, color: '#0f172a' },
                            hovertemplate: 'Temp: %{x} °C<br>Solubility: %{y:.2f} mg/mL<extra></extra>'
                        },
                        {
                            x: (activeCandidate.chartData || []).map(d => d.x),
                            y: (activeCandidate.chartData || []).map(d => d.pred),
                            mode: 'lines',
                            type: 'scatter',
                            name: `Predicted (${selectedModel.modelName})`,
                            line: { color: '#3b82f6', width: 3 },
                            hovertemplate: 'Temp: %{x} °C<br>Pred Solubility: %{y:.2f} mg/mL<extra></extra>'
                        }
                    ];

                    const layout = {
                        margin: { t: 30, b: 60, l: 80, r: 30 },
                        xaxis: { 
                            title: { text: 'Temperature (°C)', font: { size: 16 } },
                            tickfont: { size: 13 },
                            gridcolor: '#f1f5f9'
                        },
                        yaxis: { 
                            title: { text: 'Solubility (mg/mL)', font: { size: 16 } },
                            tickfont: { size: 13 },
                            gridcolor: '#f1f5f9'
                        },
                        showlegend: true,
                        legend: { orientation: 'h', y: 1.1, x: 0 },
                        paper_bgcolor: 'transparent',
                        plot_bgcolor: 'transparent'
                    };

                    allSolventsData[solvName] = {
                        key: solvName,
                        displayName: solvName,
                        is3D: false,
                        selectedModel: {
                            modelName: selectedModel.modelName,
                            category: selectedModel.category || 'mathematical',
                            stats: {
                                r2: selectedModel.stats?.r2 || 0,
                                adj_r2: selectedModel.stats?.adj_r2 || 0,
                                rmse: selectedModel.stats?.rmse || 0,
                                mape: selectedModel.stats?.mape || 0,
                                aic: selectedModel.stats?.aic || 0
                            }
                        },
                        candidateModels,
                        traces,
                        layout
                    };
                }
            }
        }

        // Include 3D Simultaneous model if active in software
        if (activePredictionModel && activePredictionModel.predictionTask === 'simultaneous' && activePredictionModel.surfaceData && activePredictionModel.scatter3DData) {
            const s1 = activePredictionModel.selectedSolvent1 || 'Solvent 1';
            const s2 = activePredictionModel.selectedSolvent2 || 'Solvent 2';
            const simKey = `${s1} + ${s2} (3D Surface)`;

            const simTraces = [
                {
                    type: 'surface',
                    z: activePredictionModel.surfaceData.zData,
                    x: activePredictionModel.surfaceData.fValues,
                    y: activePredictionModel.surfaceData.tValues,
                    colorscale: 'Viridis',
                    opacity: 0.8,
                    name: 'Predicted Model',
                    showscale: false
                },
                {
                    type: 'scatter3d',
                    mode: 'markers',
                    x: activePredictionModel.scatter3DData.map((d: any) => d.f),
                    y: activePredictionModel.scatter3DData.map((d: any) => d.t),
                    z: activePredictionModel.scatter3DData.map((d: any) => d.s),
                    marker: { size: 5, color: '#0f172a', symbol: 'circle' },
                    name: 'Experimental Data'
                }
            ]; // Target prediction red diamond hidden as requested by user

            const simLayout = {
                autosize: true,
                showlegend: false,
                margin: { l: 0, r: 0, b: 0, t: 0 },
                scene: { 
                    xaxis: { title: { text: `${s1} (%)`, font: { size: 16 } }, tickfont: { size: 13 } }, 
                    yaxis: { title: { text: 'Temp (°C)', font: { size: 16 } }, tickfont: { size: 13 } }, 
                    zaxis: { title: { text: 'Solubility (mg/mL)', font: { size: 16 } }, tickfont: { size: 13 } } 
                },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent'
            };

            allSolventsData[simKey] = {
                key: simKey,
                displayName: `${s1} + ${s2} (3D Surface)`,
                is3D: true,
                selectedModel: {
                    modelName: activePredictionModel.model?.modelName || 'Simultaneous Model',
                    stats: activePredictionModel.model?.stats || { r2: 0, adj_r2: 0, rmse: 0, mape: 0, aic: 0 }
                },
                candidateModels: (activePredictionModel.models || []).map((m: any) => {
                    let chartData = null;
                    if (typeof m.predict === 'function') {
                        const tVals = activePredictionModel.surfaceData?.tValues;
                        const fVals = activePredictionModel.surfaceData?.fValues;
                        if (tVals && fVals) {
                            const zData = tVals.map((t: number) => 
                                fVals.map((f: number) => {
                                    const pred = m.predict({ T: t, f: f / 100 });
                                    return Math.max(0, pred.pred);
                                })
                            );
                            chartData = { zData };
                        }
                    }
                    return {
                        modelName: m.modelName,
                        category: m.category || 'mathematical',
                        stats: m.stats || { r2: 0, adj_r2: 0, rmse: 0, mape: 0, aic: 0 },
                        chartData
                    };
                }),
                traces: simTraces,
                layout: simLayout
            };
        }
    }

    // Determine default solvent
    const solventKeys = Object.keys(allSolventsData);
    let defaultSolventKey = '';
    if (activePredictionModel) {
        if (activePredictionModel.predictionTask === 'simultaneous') {
            const s1 = activePredictionModel.selectedSolvent1 || 'Solvent 1';
            const s2 = activePredictionModel.selectedSolvent2 || 'Solvent 2';
            const simKey = `${s1} + ${s2} (3D Surface)`;
            if (allSolventsData[simKey]) defaultSolventKey = simKey;
        } else if (activePredictionModel.selectedSolvent1 && allSolventsData[activePredictionModel.selectedSolvent1]) {
            defaultSolventKey = activePredictionModel.selectedSolvent1;
        }
    }
    if (!defaultSolventKey && solventKeys.length > 0) {
        defaultSolventKey = solventKeys[0];
    }

    const hasPredictions = solventKeys.length > 0;
    const initialSolvent = hasPredictions ? allSolventsData[defaultSolventKey] : null;

    const htmlString = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${experimentName || 'Untitled'} - Solubility Report</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
</head>
<body class="bg-slate-50 text-slate-800 p-4 md:p-8 min-h-screen font-sans">
    <div class="max-w-6xl mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-100 to-green-100 text-slate-800 p-4 md:p-6 flex justify-between items-start border-b border-slate-200">
            <div>
                <h1 class="text-3xl font-bold mb-2">${experimentName || 'Untitled'}</h1>
                <div class="flex flex-col gap-1 text-sm text-slate-600">
                    <div class="flex flex-wrap gap-x-8 gap-y-2">
                        ${wavelength ? `<div><span class="font-bold text-slate-700">Wavelength:</span> ${wavelength} nm</div>` : ''}
                        <div><span class="font-bold text-slate-700">Date:</span> ${formattedDate}</div>
                    </div>
                    <div><span class="font-bold text-slate-700">HPLC used:</span> ${hplcUsed || 'Not specified'}</div>
                </div>
            </div>
            ${logoBase64 ? `<div class="h-20 w-40 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center p-2 overflow-hidden"><img src="${logoBase64}" alt="Logo" class="max-h-full max-w-full object-contain scale-[1.3]"></div>` : ''}
        </div>

        <div class="p-6 md:p-8 space-y-12">
            <!-- Calibration Section -->
            <section>
                <div class="flex flex-wrap justify-between items-end mb-6 border-b border-slate-200 pb-3 gap-4">
                    <h2 class="text-2xl font-bold text-slate-800">Calibration Curve</h2>
                </div>
                
                <div class="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-6 flex flex-col md:flex-row items-center justify-center gap-6 shadow-inner" id="equationDisplay">
                    <!-- Equation inserted by JS -->
                </div>

                <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                    <div id="calibrationPlot" class="w-full h-[450px]"></div>
                </div>
            </section>

            <!-- Samples Section -->
            <section>
                <div class="mb-6 border-b border-slate-200 pb-3">
                    <h2 class="text-2xl font-bold text-slate-800">Sample Results <span class="text-sm font-normal text-slate-500 ml-2">(Auto-calculates based on curve)</span></h2>
                </div>
                
                <div class="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                    <table class="w-full text-sm text-left">
                        <thead class="text-xs text-slate-700 bg-slate-100 border-b border-slate-200">
                            <tr>
                                <th class="px-3 py-3 font-semibold cursor-pointer hover:text-blue-600 select-none" onclick="sortTable('name')">Sample Name <span id="nameSort" class="text-slate-400">↕</span></th>
                                <th class="px-3 py-3 font-semibold cursor-pointer hover:text-blue-600 select-none" onclick="sortTable('solvent')">Solvent <span id="solventSort" class="text-slate-400">↕</span></th>
                                <th class="px-3 py-3 font-semibold text-right cursor-pointer hover:text-blue-600 select-none" onclick="sortTable('temperature')">Temp (°C) <span id="tempSort" class="text-slate-400">↕</span></th>
                                <th class="px-3 py-3 font-semibold text-right">Area</th>
                                <th class="px-3 py-3 font-semibold text-right">Sampling Vol. (µL)</th>
                                <th class="px-3 py-3 font-semibold text-right">Added Solv. (mL)</th>
                                <th class="px-3 py-3 font-semibold text-right border-l border-slate-200 cursor-pointer hover:text-blue-600 select-none" onclick="sortTable('solubility')">Solubility (mg/mL) <span id="solSort" class="text-slate-400">↕</span></th>
                            </tr>
                        </thead>
                        <tbody id="samplesTableBody" class="divide-y divide-slate-100">
                            <!-- Populated by JS -->
                        </tbody>
                    </table>
                </div>
            </section>
            
            ${hasPredictions && initialSolvent ? `
            <section class="mb-4">
                <div class="flex flex-wrap justify-between items-center mb-4 border-b border-slate-200 pb-3 gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-800">Solubility Prediction Model</h2>
                        <p class="text-sm text-slate-500 mt-0.5">Select a solvent to view its experimental data, fitted model curve, and statistics</p>
                    </div>
                    <div class="flex items-center gap-2.5 bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <label for="solventSelect" class="text-sm font-semibold text-slate-700 whitespace-nowrap">Solvent:</label>
                        <select id="solventSelect" onchange="renderSolvent(this.value)" class="bg-white border border-slate-300 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer min-w-[200px]">
                            ${solventKeys.map(k => `
                                <option value="${k}" ${k === defaultSolventKey ? 'selected' : ''}>${allSolventsData[k].displayName}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                    <div class="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-slate-200 p-4 flex flex-wrap justify-between items-center gap-4">
                        <div>
                            <div id="currentModelName" class="font-semibold text-slate-800 text-lg">
                                ${initialSolvent.selectedModel.modelName}
                            </div>
                            <div class="text-sm text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                                <span>R² = <span id="currentR2" class="font-mono font-medium text-slate-800">${(initialSolvent.selectedModel.stats?.r2 || 0).toFixed(4)}</span></span>
                                <span>Adj R² = <span id="currentAdjR2" class="font-mono font-medium text-slate-800">${(initialSolvent.selectedModel.stats?.adj_r2 || 0).toFixed(4)}</span></span>
                                <span>RMSE = <span id="currentRmse" class="font-mono font-medium text-slate-800">${(initialSolvent.selectedModel.stats?.rmse || 0).toFixed(4)}</span></span>
                                <span>MAPE = <span id="currentMape" class="font-mono font-medium text-slate-800">${(initialSolvent.selectedModel.stats?.mape || 0).toFixed(2)}%</span></span>
                                <span>AIC = <span id="currentAic" class="font-mono font-medium text-slate-800">${(initialSolvent.selectedModel.stats?.aic || 0).toFixed(1)}</span></span>
                            </div>
                        </div>
                        <div id="viewBadge" class="text-xs font-semibold px-2.5 py-1 rounded-full ${initialSolvent.is3D ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">
                            ${initialSolvent.is3D ? '3D Surface' : '2D Temperature Curve'}
                        </div>
                    </div>
                    <div class="p-6 md:p-8">
                        <div id="predictionPlot" class="w-full h-[600px]"></div>
                    </div>
                </div>

                <div id="candidateModelsContainer" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div class="border-b border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                        <div>
                            <h2 class="text-md font-semibold text-slate-800">Candidate Models Comparison</h2>
                            <p class="text-xs text-slate-500 mt-0.5">Models grounded in physical/thermodynamic reality are prioritized when statistical fit is comparable.</p>
                        </div>
                        <span class="text-xs text-slate-500">Click any row to view that model's curve</span>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse whitespace-nowrap">
                            <thead>
                                <tr class="border-b border-slate-200 text-xs text-slate-600 bg-slate-50">
                                    <th class="py-3 px-4 font-medium">Model</th>
                                    <th class="py-3 px-3 font-medium">Type</th>
                                    <th class="py-3 px-4 font-medium text-right">R²</th>
                                    <th class="py-3 px-4 font-medium text-right">Adj R²</th>
                                    <th class="py-3 px-4 font-medium text-right">RMSE</th>
                                    <th class="py-3 px-4 font-medium text-right">AIC</th>
                                </tr>
                            </thead>
                            <tbody id="candidateModelsBody" class="divide-y divide-slate-100 text-sm">
                                <!-- Populated dynamically by JS -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
            ` : ''}

        </div>
    </div>

    <!-- Application Logic Embedded -->
    <script>
        window.onerror = function(msg, url, lineNo, columnNo, error) {
            document.body.innerHTML += '<div style="color:red; font-weight:bold; padding:20px;">ERROR: ' + msg + '<br>Line: ' + lineNo + '</div>';
            return false;
        };
        let processedSamples = [];
        // Raw Data Injection
        const rawCalibrationData = ${JSON.stringify(validCalPoints)};
        const rawSamples = ${JSON.stringify(validSamples)};

        // Multi-Solvent Prediction Data
        const allSolventsData = ${JSON.stringify(allSolventsData)};
        let currentSolventKey = ${JSON.stringify(defaultSolventKey)};
        let currentModelName = (allSolventsData && allSolventsData[currentSolventKey]) ? allSolventsData[currentSolventKey].selectedModel.modelName : '';

        function renderSolvent(solventKey, modelNameOverride) {
            if (!allSolventsData || !allSolventsData[solventKey]) return;
            const solv = allSolventsData[solventKey];
            currentSolventKey = solventKey;

            // Sync dropdown selection if needed
            const selectEl = document.getElementById('solventSelect');
            if (selectEl && selectEl.value !== solventKey) {
                selectEl.value = solventKey;
            }

            // Determine active model
            let activeModel = solv.selectedModel;
            let activeChartData = null;
            if (modelNameOverride && solv.candidateModels) {
                const found = solv.candidateModels.find(m => m.modelName === modelNameOverride);
                if (found) {
                    activeModel = found;
                    activeChartData = found.chartData;
                }
            } else if (solv.candidateModels) {
                const found = solv.candidateModels.find(m => m.modelName === activeModel.modelName);
                if (found) {
                    activeChartData = found.chartData;
                }
            }
            currentModelName = activeModel.modelName;

            // Update Header Information
            const modelNameEl = document.getElementById('currentModelName');
            if (modelNameEl) modelNameEl.textContent = activeModel.modelName;

            const r2El = document.getElementById('currentR2');
            if (r2El) r2El.textContent = (activeModel.stats && !isNaN(activeModel.stats.r2)) ? activeModel.stats.r2.toFixed(4) : '-';

            const adjR2El = document.getElementById('currentAdjR2');
            if (adjR2El) adjR2El.textContent = (activeModel.stats && !isNaN(activeModel.stats.adj_r2)) ? activeModel.stats.adj_r2.toFixed(4) : '-';

            const rmseEl = document.getElementById('currentRmse');
            if (rmseEl) rmseEl.textContent = (activeModel.stats && !isNaN(activeModel.stats.rmse)) ? activeModel.stats.rmse.toFixed(4) : '-';

            const mapeEl = document.getElementById('currentMape');
            if (mapeEl) mapeEl.textContent = (activeModel.stats && !isNaN(activeModel.stats.mape)) ? activeModel.stats.mape.toFixed(2) + '%' : '-';

            const aicEl = document.getElementById('currentAic');
            if (aicEl) aicEl.textContent = (activeModel.stats && !isNaN(activeModel.stats.aic)) ? activeModel.stats.aic.toFixed(1) : '-';

            const badgeEl = document.getElementById('viewBadge');
            if (badgeEl) {
                badgeEl.textContent = solv.is3D ? '3D Surface' : '2D Temperature Curve';
                badgeEl.className = 'text-xs font-semibold px-2.5 py-1 rounded-full ' + (solv.is3D ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700');
            }

            // Update Plot
            let traces = solv.traces;
            if (!solv.is3D && activeChartData && solv.traces && solv.traces.length >= 2) {
                traces = [
                    solv.traces[0], // Experimental scatter markers
                    {
                        ...solv.traces[1],
                        x: activeChartData.map(d => d.x),
                        y: activeChartData.map(d => d.pred),
                        name: 'Predicted (' + activeModel.modelName + ')'
                    }
                ];
            } else if (solv.is3D && activeChartData && activeChartData.zData && solv.traces && solv.traces.length >= 2) {
                traces = [
                    {
                        ...solv.traces[0],
                        z: activeChartData.zData,
                        name: 'Predicted (' + activeModel.modelName + ')'
                    },
                    solv.traces[1] // Experimental scatter markers
                ];
            }
            Plotly.react('predictionPlot', traces, solv.layout, { responsive: true, displayModeBar: false });

            // Update Candidate Models Table
            const tbody = document.getElementById('candidateModelsBody');
            if (tbody && solv.candidateModels && solv.candidateModels.length > 0) {
                let rowsHtml = '';
                for (let i = 0; i < solv.candidateModels.length; i++) {
                    const m = solv.candidateModels[i];
                    const isSelected = (m.modelName === currentModelName);
                    const isBest = (i === 0);
                    const rowClass = isSelected ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50 cursor-pointer';
                    let indicator = '';
                    if (isBest) {
                        indicator = '<span class="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Best fit"></span>';
                    } else if (isSelected) {
                        indicator = '<span class="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Selected"></span>';
                    } else {
                        indicator = '<span class="w-2 h-2 rounded-full bg-transparent shrink-0"></span>';
                    }
                    const r2Str = (m.stats && !isNaN(m.stats.r2)) ? m.stats.r2.toFixed(4) : '-';
                    const adjR2Str = (m.stats && !isNaN(m.stats.adj_r2)) ? m.stats.adj_r2.toFixed(4) : '-';
                    const rmseStr = (m.stats && !isNaN(m.stats.rmse)) ? m.stats.rmse.toFixed(4) : '-';
                    const aicStr = (m.stats && !isNaN(m.stats.aic)) ? m.stats.aic.toFixed(1) : '-';

                    const isPhysical = (m.category === 'physical');
                    const typeBadge = isPhysical 
                        ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Physical</span>'
                        : '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">Mathematical</span>';

                    const recBadge = isBest 
                        ? '<span class="text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 ml-1">Recommended</span>' 
                        : '';

                    rowsHtml += '<tr class="' + rowClass + ' transition-colors" onclick="renderSolvent(\\'' + solventKey.replace(/'/g, "\\\\'") + '\\', \\'' + m.modelName.replace(/'/g, "\\\\'") + '\\')" title="Click to view curve">' +
                        '<td class="py-3 px-4 text-slate-800 flex items-center gap-2">' +
                        indicator +
                        '<span class="font-medium">' + m.modelName + '</span>' +
                        recBadge +
                        '</td>' +
                        '<td class="py-3 px-3">' + typeBadge + '</td>' +
                        '<td class="py-3 px-4 text-slate-600 text-right font-mono">' + r2Str + '</td>' +
                        '<td class="py-3 px-4 text-slate-600 text-right font-mono">' + adjR2Str + '</td>' +
                        '<td class="py-3 px-4 text-slate-600 text-right font-mono">' + rmseStr + '</td>' +
                        '<td class="py-3 px-4 text-slate-600 text-right font-mono">' + aicStr + '</td>' +
                        '</tr>';
                }
                tbody.innerHTML = rowsHtml;
            }
        }

        // Initialize prediction section on page load
        if (currentSolventKey && allSolventsData[currentSolventKey]) {
            renderSolvent(currentSolventKey);
        }

        const equationDisplay = document.getElementById('equationDisplay');
        const samplesTableBody = document.getElementById('samplesTableBody');

        // Sorting state
        let currentSort = null;
        let sortAsc = true;
        
        function sortTable(key) {
            if (currentSort === key) {
                sortAsc = !sortAsc;
            } else {
                currentSort = key;
                sortAsc = true;
            }
            
            // Reset icons
            const headers = { 'name': 'nameSort', 'solvent': 'solventSort', 'temperature': 'tempSort', 'solubility': 'solSort' };
            for (const h in headers) {
                const el = document.getElementById(headers[h]);
                if (el) el.textContent = '↕';
            }
            // Set active icon
            if (headers[key]) {
                const activeEl = document.getElementById(headers[key]);
                if (activeEl) activeEl.textContent = sortAsc ? '↑' : '↓';
            }
            
            updateUI();
        }

        // Helper for numbers with commas or weird formats
        function parseNum(val) {
            if (val === null || val === undefined || val === '') return NaN;
            if (typeof val === 'number') return val;
            return Number(String(val).replace(/,/g, '.'));
        }

        // Math Logic
        function calculateRegression(forceZero) {
            let n = 0;
            let sumX = 0;
            let sumY = 0;
            let sumXY = 0;
            let sumX2 = 0;

            for (const pt of rawCalibrationData) {
                const x = parseNum(pt.concentration);
                const y = parseNum(pt.area);
                if (!isNaN(x) && !isNaN(y)) {
                    n++;
                    sumX += x;
                    sumY += y;
                    sumXY += x * y;
                    sumX2 += x * x;
                }
            }

            let m = 0;
            let c = 0;
            let r2 = 0;

            if (n === 0) return { m: 0, c: 0, r2: 0 };

            if (forceZero) {
                m = sumXY / sumX2;
                c = 0;
                
                // R2 calc
                let meanY = sumY / n;
                let ssTot = 0;
                let ssRes = 0;
                for (const pt of rawCalibrationData) {
                    const x = parseNum(pt.concentration);
                    const y = parseNum(pt.area);
                    if (!isNaN(x) && !isNaN(y)) {
                        ssTot += Math.pow(y - meanY, 2);
                        ssRes += Math.pow(y - (m * x), 2);
                    }
                }
                r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
            } else {
                const denominator = (n * sumX2 - sumX * sumX);
                m = (n * sumXY - sumX * sumY) / denominator;
                c = (sumY - m * sumX) / n;

                let meanY = sumY / n;
                let ssTot = 0;
                let ssRes = 0;
                for (const pt of rawCalibrationData) {
                    const x = parseNum(pt.concentration);
                    const y = parseNum(pt.area);
                    if (!isNaN(x) && !isNaN(y)) {
                        ssTot += Math.pow(y - meanY, 2);
                        ssRes += Math.pow(y - (m * x + c), 2);
                    }
                }
                r2 = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);
            }

            return { m, c, r2 };
        }

        function updateUI() {
            const forceZero = ${forceZero ? 'true' : 'false'};
            const reg = calculateRegression(forceZero);

            // Update Equation
            const sign = reg.c >= 0 ? '+' : '-';
            const cText = forceZero ? ' <span class="text-slate-400 mx-2">+</span> <span class="text-slate-800">0</span>' : ' <span class="text-slate-400 mx-2">' + sign + '</span> <span class="text-slate-800">' + Math.abs(reg.c).toFixed(4) + '</span>';
            
            equationDisplay.innerHTML = \`
                <div class="text-2xl font-mono flex items-center">
                    <span class="text-slate-500 mr-4">y =</span> 
                    <span class="text-blue-600 font-bold">\${reg.m.toFixed(4)}</span> 
                    <span class="text-slate-500 ml-2">x</span> 
                    \${cText}
                </div>
                <div class="hidden md:block w-px h-10 bg-slate-200 mx-4"></div>
                <div class="text-xl font-mono text-slate-600">
                    R² = <span class="\${reg.r2 >= 0.99 ? 'text-green-600 font-bold' : 'text-slate-800'}">\${reg.r2.toFixed(4)}</span>
                </div>
            \`;

            // Update Graph
            const xVals = rawCalibrationData.map(p => parseNum(p.concentration)).filter(n => !isNaN(n));
            const yVals = rawCalibrationData.map(p => parseNum(p.area)).filter(n => !isNaN(n));
            
            const minX = Math.min(...xVals, 0);
            const maxX = Math.max(...xVals) * 1.05;
            const minY = Math.min(...yVals, 0);
            const maxY = Math.max(...yVals) * 1.05;
            
            const lineX = [minX, maxX];
            const lineY = lineX.map(x => reg.m * x + reg.c);

            const trace1 = {
                x: xVals,
                y: yVals,
                mode: 'markers',
                type: 'scatter',
                name: 'Data Points',
                marker: { size: 10, color: '#0f172a', line: { color: 'white', width: 2 } },
                hovertemplate: 'Concentration: %{x}<br>Area: %{y}<extra></extra>'
            };

            const trace2 = {
                x: lineX,
                y: lineY,
                mode: 'lines',
                type: 'scatter',
                name: 'Fit',
                line: { color: '#3b82f6', width: 3 },
                hoverinfo: 'none'
            };

            const layout = {
                margin: { t: 20, b: 50, l: 70, r: 20 },
                xaxis: { 
                    title: { text: 'Concentration (mg/mL)', font: { size: 16, color: '#64748b' } },
                    range: [minX, maxX],
                    gridcolor: '#f1f5f9',
                    zerolinecolor: '#cbd5e1',
                    tickfont: { size: 14 }
                },
                yaxis: { 
                    title: { text: 'Absorbtion (mAU)', font: { size: 16, color: '#64748b' } },
                    range: [minY, maxY],
                    gridcolor: '#f1f5f9',
                    zerolinecolor: '#cbd5e1',
                    tickfont: { size: 14 }
                },
                showlegend: false,
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                hovermode: 'closest'
            };

            Plotly.newPlot('calibrationPlot', [trace1, trace2], layout, {responsive: true, displayModeBar: false});

            // Update Samples Table
            samplesTableBody.innerHTML = '';
            
            // First pass: Calculate and enrich samples
            processedSamples = rawSamples.map(s => {
                const area = parseNum(s.area);
                const added = parseNum(s.addedSolventMl);
                const taken = parseNum(s.volumeTakenUl);
                let vialConc = 0;
                let reactionConc = 0;
                let isCalculable = false;

                if (!isNaN(area) && !isNaN(added) && !isNaN(taken) && taken > 0) {
                    isCalculable = true;
                    vialConc = (area - reg.c) / reg.m;
                    vialConc = Math.max(0, vialConc); 
                    
                    const volTakenMl = taken / 1000;
                    const dilutionFactor = (added + volTakenMl) / volTakenMl;
                    reactionConc = vialConc * dilutionFactor;
                }

                const solventStr = s.solvent2 && Number(s.solvent1Fraction) < 100 
                  ? \`\${s.solvent1} (\${s.solvent1Fraction}%) / \${s.solvent2}\`
                  : (s.solvent1 || '-');
                  
                const tempVal = (s.temperature !== '' && s.temperature !== null && s.temperature !== undefined) ? parseNum(s.temperature) : NaN;
                
                return {
                    ...s,
                    area, added, taken, vialConc, reactionConc, isCalculable, solventStr, tempVal
                };
            });

            // Sorting logic
            if (currentSort) {
                processedSamples.sort((a, b) => {
                    let valA, valB;
                    if (currentSort === 'name') {
                        valA = (a.name || '').toLowerCase();
                        valB = (b.name || '').toLowerCase();
                    } else if (currentSort === 'solvent') {
                        valA = a.solventStr.toLowerCase();
                        valB = b.solventStr.toLowerCase();
                    } else if (currentSort === 'temperature') {
                        valA = isNaN(a.tempVal) ? -Infinity : a.tempVal;
                        valB = isNaN(b.tempVal) ? -Infinity : b.tempVal;
                    } else if (currentSort === 'solubility') {
                        valA = a.isCalculable ? a.reactionConc : -Infinity;
                        valB = b.isCalculable ? b.reactionConc : -Infinity;
                    }
                    
                    if (valA < valB) return sortAsc ? -1 : 1;
                    if (valA > valB) return sortAsc ? 1 : -1;
                    return 0;
                });
            }

            // Min and Max for coloring
            const validConcs = processedSamples.filter(s => s.isCalculable).map(s => s.reactionConc);
            const minConc = validConcs.length > 0 ? Math.min(...validConcs) : 0;
            const maxConc = validConcs.length > 0 ? Math.max(...validConcs) : 1;
            
            const fmt = (n) => isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 4 });
            const fmtSol = (n) => isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { useGrouping: false, minimumFractionDigits: 1, maximumFractionDigits: 1 });

            for (const s of processedSamples) {
                const tr = document.createElement('tr');
                tr.className = 'hover:bg-slate-50 transition-colors';
                
                const tempDisp = !isNaN(s.tempVal) ? s.tempVal : '-';
                const areaDisp = !isNaN(s.area) ? fmt(s.area) : '-';
                const addedDisp = !isNaN(s.added) ? fmt(s.added) : '-';
                const takenDisp = !isNaN(s.taken) ? fmt(s.taken) : '-';
                const reactionDisp = s.isCalculable ? fmtSol(s.reactionConc) : '-';
                
                let cellStyle = '';
                let cellClass = 'text-slate-500 bg-slate-50/30';
                
                if (s.isCalculable) {
                    let ratio = 0.5;
                    if (maxConc > minConc) {
                        ratio = (s.reactionConc - minConc) / (maxConc - minConc);
                    } else if (validConcs.length === 1) {
                        ratio = 1;
                    }
                    const hue = ratio * 120; // 0 = red, 120 = green
                    cellStyle = \`background-color: hsl(\${hue}, 80%, 90%);\`;
                    cellClass = 'text-slate-900';
                }

                tr.innerHTML = \`
                    <td class="px-3 py-2 font-medium text-slate-800">\${s.name || '-'}</td>
                    <td class="px-3 py-2 text-slate-600">\${s.solventStr}</td>
                    <td class="px-3 py-2 text-right text-slate-600">\${tempDisp}</td>
                    <td class="px-3 py-2 text-right font-mono text-slate-700">\${areaDisp}</td>
                    <td class="px-3 py-2 text-right font-mono text-slate-500">\${takenDisp}</td>
                    <td class="px-3 py-2 text-right font-mono text-slate-500">\${addedDisp}</td>
                    <td class="px-3 py-2 text-right font-mono font-bold border-l border-slate-200 \${cellClass}" style="\${cellStyle}">\${reactionDisp}</td>
                \`;
                samplesTableBody.appendChild(tr);
            }
        }

        // Initial render
        updateUI();

    </script>
</body>
</html>`;

    const blob = new Blob([htmlString], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName(experimentName, 'html');
    a.click();
    URL.revokeObjectURL(url);
};
