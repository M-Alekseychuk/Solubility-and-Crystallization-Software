import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BookOpen, Moon, Sun, ArrowLeft, ArrowUpDown, Target, Activity, Calculator, Plus, Trash2, Droplet, Upload, Archive, RotateCcw, FolderArchive, Check, X, FileSpreadsheet, Beaker, Leaf, Hexagon, HelpCircle, Layers } from 'lucide-react';
import { CalibrationTab } from './components/CalibrationTab';
import { SamplesTab } from './components/SamplesTab';
import { GuideTab } from './components/GuideTab';
import { PredictionTab } from './components/PredictionTab';
import { SolventsTab } from './components/SolventsTab';
import { GreenReplacementTab } from './components/GreenReplacementTab';
import { CrystallizationTab } from './components/CrystallizationTab';
import { DataActions } from './components/DataActions';
import { CalibrationPoint, SampleData, Experiment, TabState } from './types';
import { calculateLinearRegression, generateId } from './utils';
import { parseExperimentFiles } from './utils/importHelper';
import logoImg from './assets/Logo.png';

const formatCustomDate = (ts: number) => {
  const d = new Date(ts);
  return `${d.getDate()}. ${d.toLocaleString('en-US', { month: 'long' })} ${d.getFullYear()}`;
};

const defaultCalibrationPoints: CalibrationPoint[] = [
  { id: generateId(), massMg: 1.0, volMl: 1.0, area: '' },
  { id: generateId(), massMg: 0.1, volMl: 1.0, area: '' },
  { id: generateId(), massMg: 0.02, volMl: 1.0, area: '' },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('hplc-dark-mode');
    return saved === 'true';
  });

  const [experiments, setExperiments] = useState<Experiment[]>(() => {
    const saved = localStorage.getItem('hplc-experiments');
    if (saved) return JSON.parse(saved);
    // Migration from old version if any
    const oldCalib = localStorage.getItem('hplc-calibration');
    const oldSamples = localStorage.getItem('hplc-samples');
    if (oldCalib || oldSamples) {
      return [{
        id: generateId(),
        name: 'Default Experiment',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        calibrationData: oldCalib ? JSON.parse(oldCalib) : defaultCalibrationPoints,
        samples: oldSamples ? JSON.parse(oldSamples) : [],
        calibrationResult: { slope: 0, intercept: 0, rSquared: 0, valid: false }
      }];
    }
    return [];
  });

  const [archivedExperiments, setArchivedExperiments] = useState<Experiment[]>(() => {
    const saved = localStorage.getItem('hplc-archived-experiments');
    return saved ? JSON.parse(saved) : [];
  });

  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(() => {
    const saved = localStorage.getItem('hplc-active-experiment');
    return saved ? saved : null;
  });
  
  const [activeTab, setActiveTab] = useState<TabState>(() => {
    const saved = localStorage.getItem('hplc-active-tab');
    return (saved as TabState) || 'calibration';
  });
  
  const [activePredictionModel, setActivePredictionModel] = useState<any>(null);

  const [overviewTab, setOverviewTab] = useState<'active' | 'archive'>('active');

  const [sortField, setSortField] = useState<'name' | 'updatedAt'>('updatedAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [archiveConfirmId, setArchiveConfirmId] = useState<string | null>(null);
  const [permanentDeleteConfirmId, setPermanentDeleteConfirmId] = useState<string | null>(null);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const overviewFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeExperimentId) {
      localStorage.setItem('hplc-active-experiment', activeExperimentId);
    } else {
      localStorage.removeItem('hplc-active-experiment');
    }
    setActivePredictionModel(null);
  }, [activeExperimentId]);

  useEffect(() => {
    localStorage.setItem('hplc-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('hplc-dark-mode', darkMode.toString());
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('hplc-experiments', JSON.stringify(experiments));
  }, [experiments]);

  useEffect(() => {
    localStorage.setItem('hplc-archived-experiments', JSON.stringify(archivedExperiments));
  }, [archivedExperiments]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const activeExperiment = useMemo(() => {
    return experiments.find(e => e.id === activeExperimentId) || null;
  }, [experiments, activeExperimentId]);

  const updateActiveExperiment = (updates: Partial<Experiment>) => {
    if (!activeExperimentId) return;
    setExperiments(prev => prev.map(exp => {
      if (exp.id === activeExperimentId) {
        return { ...exp, ...updates, updatedAt: Date.now() };
      }
      return exp;
    }));
  };

  const createExperiment = () => {
    const newExp: Experiment = {
      id: generateId(),
      name: 'New Experiment',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      calibrationData: defaultCalibrationPoints.map(p => ({ ...p, id: generateId() })),
      samples: [],
      calibrationResult: { slope: 0, intercept: 0, rSquared: 0, valid: false }
    };
    setExperiments(prev => [newExp, ...prev]);
    setActiveExperimentId(newExp.id);
    setActiveTab('calibration');
  };

  const loadDemoExperiment = () => {
    const demoCalData = [
      { id: generateId(), massMg: 1, volMl: 10, area: 100 },
      { id: generateId(), massMg: 2, volMl: 10, area: 200 },
      { id: generateId(), massMg: 3, volMl: 10, area: 300 },
      { id: generateId(), massMg: 4, volMl: 10, area: 400 },
      { id: generateId(), massMg: 5, volMl: 10, area: 500 }
    ];

    const demoSamples = [
      // Water 100%
      { id: generateId(), name: 'W-20', solvent1: 'Water', solvent2: '', solvent1Fraction: 100, temperature: 20, volumeTakenUl: 1000, addedSolventMl: 10, area: 100 },
      { id: generateId(), name: 'W-25', solvent1: 'Water', solvent2: '', solvent1Fraction: 100, temperature: 25, volumeTakenUl: 1000, addedSolventMl: 10, area: 120 },
      { id: generateId(), name: 'W-30', solvent1: 'Water', solvent2: '', solvent1Fraction: 100, temperature: 30, volumeTakenUl: 1000, addedSolventMl: 10, area: 150 },
      { id: generateId(), name: 'W-35', solvent1: 'Water', solvent2: '', solvent1Fraction: 100, temperature: 35, volumeTakenUl: 1000, addedSolventMl: 10, area: 190 },
      // Ethanol 100%
      { id: generateId(), name: 'E-20', solvent1: 'Ethanol', solvent2: '', solvent1Fraction: 100, temperature: 20, volumeTakenUl: 1000, addedSolventMl: 10, area: 400 },
      { id: generateId(), name: 'E-25', solvent1: 'Ethanol', solvent2: '', solvent1Fraction: 100, temperature: 25, volumeTakenUl: 1000, addedSolventMl: 10, area: 480 },
      { id: generateId(), name: 'E-30', solvent1: 'Ethanol', solvent2: '', solvent1Fraction: 100, temperature: 30, volumeTakenUl: 1000, addedSolventMl: 10, area: 580 },
      { id: generateId(), name: 'E-35', solvent1: 'Ethanol', solvent2: '', solvent1Fraction: 100, temperature: 35, volumeTakenUl: 1000, addedSolventMl: 10, area: 700 },
      // Methanol 100%
      { id: generateId(), name: 'M-20', solvent1: 'Methanol', solvent2: '', solvent1Fraction: 100, temperature: 20, volumeTakenUl: 1000, addedSolventMl: 10, area: 600 },
      { id: generateId(), name: 'M-25', solvent1: 'Methanol', solvent2: '', solvent1Fraction: 100, temperature: 25, volumeTakenUl: 1000, addedSolventMl: 10, area: 720 },
      { id: generateId(), name: 'M-30', solvent1: 'Methanol', solvent2: '', solvent1Fraction: 100, temperature: 30, volumeTakenUl: 1000, addedSolventMl: 10, area: 850 },
      { id: generateId(), name: 'M-35', solvent1: 'Methanol', solvent2: '', solvent1Fraction: 100, temperature: 35, volumeTakenUl: 1000, addedSolventMl: 10, area: 1000 },
      // Water/Ethanol 50:50
      { id: generateId(), name: 'WE-20', solvent1: 'Water', solvent2: 'Ethanol', solvent1Fraction: 50, temperature: 20, volumeTakenUl: 1000, addedSolventMl: 10, area: 300 },
      { id: generateId(), name: 'WE-25', solvent1: 'Water', solvent2: 'Ethanol', solvent1Fraction: 50, temperature: 25, volumeTakenUl: 1000, addedSolventMl: 10, area: 360 },
      { id: generateId(), name: 'WE-30', solvent1: 'Water', solvent2: 'Ethanol', solvent1Fraction: 50, temperature: 30, volumeTakenUl: 1000, addedSolventMl: 10, area: 450 },
      { id: generateId(), name: 'WE-35', solvent1: 'Water', solvent2: 'Ethanol', solvent1Fraction: 50, temperature: 35, volumeTakenUl: 1000, addedSolventMl: 10, area: 550 },
    ];

    const newExp: Experiment = {
      id: generateId(),
      name: 'Demo: Solvents & Mixtures',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      calibrationData: demoCalData,
      samples: demoSamples,
      calibrationResult: { slope: 1000, intercept: 0, rSquared: 1, valid: true }
    };
    setExperiments(prev => [newExp, ...prev]);
    setActiveExperimentId(newExp.id);
    setActiveTab('prediction');
  };

  const confirmArchiveExperiment = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArchiveConfirmId(id);
  };

  const executeArchiveExperiment = (id: string) => {
    const target = experiments.find(e => e.id === id);
    if (!target) return;

    const archivedItem: Experiment = { ...target, archivedAt: Date.now() };
    setExperiments(prev => prev.filter(e => e.id !== id));
    setArchivedExperiments(prev => [archivedItem, ...prev]);

    if (activeExperimentId === id) {
      setActiveExperimentId(null);
    }

    setArchiveConfirmId(null);
    showToast(`Moved "${target.name}" to Archive folder.`);
  };

  const restoreExperiment = (id: string) => {
    const target = archivedExperiments.find(e => e.id === id);
    if (!target) return;

    const restoredItem: Experiment = { ...target, updatedAt: Date.now() };
    delete restoredItem.archivedAt;

    setArchivedExperiments(prev => prev.filter(e => e.id !== id));
    setExperiments(prev => [restoredItem, ...prev]);

    showToast(`Restored "${target.name}" from Archive.`);
  };

  const restoreAllArchived = () => {
    if (archivedExperiments.length === 0) return;
    const restored = archivedExperiments.map(item => {
      const copy = { ...item, updatedAt: Date.now() };
      delete copy.archivedAt;
      return copy;
    });
    setExperiments(prev => [...restored, ...prev]);
    setArchivedExperiments([]);
    showToast(`Restored ${archivedExperiments.length} experiment(s) from Archive.`);
  };

  const executePermanentDelete = (id: string) => {
    const target = archivedExperiments.find(e => e.id === id);
    setArchivedExperiments(prev => prev.filter(e => e.id !== id));
    setPermanentDeleteConfirmId(null);
    if (target) showToast(`Permanently deleted "${target.name}".`);
  };

  const updateExperimentName = (id: string, newName: string) => {
    setExperiments(prev => prev.map(exp => {
      if (exp.id === id) return { ...exp, name: newName, updatedAt: Date.now() };
      return exp;
    }));
  };

  const handleTriggerOverviewImport = () => {
    if (overviewFileInputRef.current) {
      overviewFileInputRef.current.value = '';
      overviewFileInputRef.current.click();
    }
  };

  const handleOverviewFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    try {
      const imported = await parseExperimentFiles(files);
      if (imported.length > 0) {
        setExperiments(prev => [...imported, ...prev]);
        showToast(`Successfully imported ${imported.length} experiment(s).`);
      } else {
        alert('No valid experiment data could be imported from the selected file(s).');
      }
    } catch (err) {
      console.error('Import error:', err);
      alert('An error occurred while importing files.');
    } finally {
      setIsImporting(false);
    }
  };

  const calibrationResult = useMemo(() => {
    if (!activeExperiment) return { slope: 0, intercept: 0, rSquared: 0, valid: false };
    const validPoints = activeExperiment.calibrationData
      .filter(p => {
        const vol = Number(String(p.volMl).replace(',', '.'));
        return p.massMg !== '' && p.volMl !== '' && p.area !== '' && vol > 0;
      })
      .map(p => ({
        x: Number(String(p.massMg).replace(',', '.')) / Number(String(p.volMl).replace(',', '.')),
        y: Number(String(p.area).replace(',', '.'))
      }));
    
    return calculateLinearRegression(validPoints, activeExperiment.forceZero);
  }, [activeExperiment?.calibrationData, activeExperiment?.forceZero]);

  useEffect(() => {
    if (activeExperiment && JSON.stringify(activeExperiment.calibrationResult) !== JSON.stringify(calibrationResult)) {
      updateActiveExperiment({ calibrationResult });
    }
  }, [calibrationResult, activeExperiment]);

  const sortedExperiments = useMemo(() => {
    return [...experiments].sort((a, b) => {
      if (sortField === 'name') {
        return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      } else {
        return sortAsc ? a.updatedAt - b.updatedAt : b.updatedAt - a.updatedAt;
      }
    });
  }, [experiments, sortField, sortAsc]);

  const sortedArchivedExperiments = useMemo(() => {
    return [...archivedExperiments].sort((a, b) => (b.archivedAt || b.updatedAt) - (a.archivedAt || a.updatedAt));
  }, [archivedExperiments]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-lg shadow-xl flex items-center gap-3 text-sm animate-fade-in border border-slate-700">
          <Check size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Hidden File Input for Overview Multi-Import */}
      <input 
        type="file" 
        ref={overviewFileInputRef} 
        onChange={handleOverviewFilesSelected} 
        multiple 
        accept=".json,.xlsx,.xls,.csv" 
        className="hidden" 
      />

      <header className="bg-gradient-to-r from-blue-100 to-green-100 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex py-3 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center bg-white rounded-xl shadow-sm h-16 w-32 overflow-hidden border border-slate-100 cursor-pointer" onClick={() => setActiveExperimentId(null)}>
                <img 
                  src={logoImg} 
                  alt="Mischa's Chemical Industries Logo" 
                  className="h-full w-full object-contain scale-[1.3]"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f1f5f9"/><text x="50" y="55" font-family="sans-serif" font-size="12" text-anchor="middle" fill="%2364748b">Upload</text><text x="50" y="70" font-family="sans-serif" font-size="12" text-anchor="middle" fill="%2364748b">Logo.png</text></svg>';
                  }}
                />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 cursor-pointer hover:text-blue-700 transition-colors" onClick={() => setActiveExperimentId(null)}>
                    HPLC Solubility Calculator
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-600/10 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 border border-blue-600/20 shadow-xs">
                    v.1.0.0
                  </span>
                </div>
                {activeExperiment ? (
                  <p className="text-sm text-blue-800 font-medium mt-1 flex items-center gap-2">
                    <button onClick={() => setActiveExperimentId(null)} className="hover:underline flex items-center gap-1">
                      <ArrowLeft size={14} /> Back to Experiments
                    </button>
                    <span className="text-slate-400">|</span>
                    {activeExperiment.name}
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 font-medium">UV Absorption vs Concentration</p>
                )}
              </div>
            </div>
            <div className="flex items-center">
              {activeExperiment && (
                <DataActions 
                  calibrationPoints={activeExperiment.calibrationData}
                  setCalibrationPoints={(pts) => {
                    const data = typeof pts === 'function' ? pts(activeExperiment.calibrationData) : pts;
                    updateActiveExperiment({ calibrationData: data });
                  }}
                  samples={activeExperiment.samples}
                  setSamples={(smps) => {
                    const data = typeof smps === 'function' ? smps(activeExperiment.samples) : smps;
                    updateActiveExperiment({ samples: data });
                  }}
                  calibrationResult={calibrationResult}
                  wavelength={activeExperiment.wavelength}
                  hplcUsed={activeExperiment.hplcUsed}
                  experimentName={activeExperiment.name}
                  activePredictionModel={activePredictionModel}
                  forceZero={activeExperiment.forceZero}
                />
              )}
              <button
                onClick={() => setActiveTab('guide')}
                className={`ml-4 flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'guide'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700'
                }`}
                title="Step-by-Step Guide"
              >
                <HelpCircle size={18} />
                <span className="hidden sm:inline">Step-by-Step Guide</span>
              </button>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="ml-4 p-2 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!activeExperimentId ? (
          <div className="space-y-6">
            {/* Overview Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Experiments</h2>
                <p className="text-sm text-slate-500">Manage, import, or restore your solubility calculation projects</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={loadDemoExperiment}
                  className="flex items-center gap-2 px-3.5 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium text-sm rounded-lg transition-colors border border-purple-200 cursor-pointer"
                  title="Load a pre-configured demo experiment"
                >
                  <Beaker size={17} className="text-purple-600" />
                  Load Demo Data
                </button>
                <button
                  onClick={handleTriggerOverviewImport}
                  disabled={isImporting}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-lg transition-colors border border-slate-200 cursor-pointer disabled:opacity-50"
                  title="Import one or multiple experiments (.json, .xlsx, .csv)"
                >
                  <Upload size={17} className="text-blue-600" />
                  {isImporting ? 'Importing...' : 'Import Experiments'}
                </button>
                <button
                  onClick={createExperiment}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus size={18} />
                  New Experiment
                </button>
              </div>
            </div>

            {/* View Tabs: Active vs Archive */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 pt-3 bg-slate-50/50 dark:bg-slate-900/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOverviewTab('active')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                      overviewTab === 'active'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-300 bg-white dark:bg-slate-800 rounded-t-lg'
                        : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                    }`}
                  >
                    Active Experiments
                    <span className={`px-2 py-0.5 rounded-full text-xs ${overviewTab === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {experiments.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setOverviewTab('archive')}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                      overviewTab === 'archive'
                        ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-300 bg-white dark:bg-slate-800 rounded-t-lg'
                        : 'border-transparent text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100'
                    }`}
                  >
                    <FolderArchive size={16} />
                    Archive Folder
                    <span className={`px-2 py-0.5 rounded-full text-xs ${overviewTab === 'archive' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {archivedExperiments.length}
                    </span>
                  </button>
                </div>

                {overviewTab === 'archive' && archivedExperiments.length > 0 && (
                  <div className="flex items-center gap-2 pb-2">
                    <button
                      onClick={restoreAllArchived}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-md transition-colors"
                    >
                      <RotateCcw size={14} /> Restore All
                    </button>
                  </div>
                )}
              </div>

              {overviewTab === 'active' ? (
                /* ACTIVE EXPERIMENTS LIST */
                <div>
                  <div className="flex items-center justify-between px-6 py-3 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700">
                    <div 
                      className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 select-none"
                      onClick={() => {
                        if (sortField === 'name') setSortAsc(!sortAsc);
                        else { setSortField('name'); setSortAsc(true); }
                      }}
                    >
                      Experiment Name {sortField === 'name' && <ArrowUpDown size={14} />}
                    </div>
                    <div 
                      className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 w-48 justify-end mr-28 select-none"
                      onClick={() => {
                        if (sortField === 'updatedAt') setSortAsc(!sortAsc);
                        else { setSortField('updatedAt'); setSortAsc(false); }
                      }}
                    >
                      Last Edited {sortField === 'updatedAt' && <ArrowUpDown size={14} />}
                    </div>
                  </div>
                  
                  {experiments.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                        <Activity size={24} className="text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-700 mb-2">No active experiments</p>
                      <p className="text-sm mb-4">Create a new experiment or import existing project files.</p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={loadDemoExperiment}
                          className="px-4 py-2 text-sm font-medium bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg transition-colors border border-purple-200 flex items-center gap-2"
                        >
                          <Beaker size={16} /> Load Demo
                        </button>
                        <button
                          onClick={handleTriggerOverviewImport}
                          className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors border border-slate-200"
                        >
                          Import Experiments
                        </button>
                        <button
                          onClick={createExperiment}
                          className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          + New Experiment
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {sortedExperiments.map(exp => (
                        <div 
                          key={exp.id} 
                          className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="flex-1 mr-4">
                            <input
                              type="text"
                              value={exp.name}
                              onChange={(e) => updateExperimentName(exp.id, e.target.value)}
                              className="text-lg font-semibold text-slate-900 bg-transparent border-none focus:ring-0 p-0 hover:bg-slate-200/50 rounded px-2 -ml-2 w-full max-w-md transition-colors"
                            />
                            <p className="text-xs text-slate-500 mt-1">
                              Created: {formatCustomDate(exp.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-sm text-slate-500 w-48 text-right">
                              {formatCustomDate(exp.updatedAt)} {new Date(exp.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setActiveExperimentId(exp.id);
                                  setActiveTab('calibration');
                                }}
                                className="text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors whitespace-nowrap opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                              >
                                Go to Experiment
                              </button>
                              <button
                                onClick={(e) => confirmArchiveExperiment(exp.id, e)}
                                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                                title="Move to Archive"
                              >
                                <Archive size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* ARCHIVE FOLDER VIEW */
                <div>
                  <div className="flex items-center justify-between px-6 py-3 bg-amber-50/50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <div>Archived Experiment Name</div>
                    <div className="flex gap-16 mr-20">
                      <div>Created</div>
                      <div>Archived On</div>
                    </div>
                  </div>

                  {archivedExperiments.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
                        <FolderArchive size={24} className="text-slate-400" />
                      </div>
                      <p className="text-lg font-medium text-slate-700 mb-1">Archive folder is empty</p>
                      <p className="text-sm">When you delete an experiment, it is safely stored here for restoration.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {sortedArchivedExperiments.map(exp => (
                        <div 
                          key={exp.id} 
                          className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors group"
                        >
                          <div className="flex-1 mr-4">
                            <span className="text-base font-semibold text-slate-800">{exp.name}</span>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-xs text-slate-500">
                              {formatCustomDate(exp.createdAt)}
                            </div>
                            <div className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded font-medium">
                              {formatCustomDate(exp.archivedAt || exp.updatedAt)}
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => restoreExperiment(exp.id)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                                title="Restore to Active Experiments"
                              >
                                <RotateCcw size={14} /> Restore
                              </button>
                              <button
                                onClick={() => setPermanentDeleteConfirmId(exp.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Permanently"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 flex space-x-1 bg-slate-200/50 p-1 rounded-lg w-fit overflow-x-auto max-w-full custom-scrollbar">
              <button
                onClick={() => setActiveTab('calibration')}
                className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'calibration'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Activity size={18} />
                1. Calibration Curve
              </button>
              <button
                onClick={() => setActiveTab('samples')}
                className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'samples'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Calculator size={18} />
                2. Solubility Calculation
              </button>
              <button
                onClick={() => setActiveTab('prediction')}
                className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'prediction'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Target size={18} />
                3. Prediction Models
              </button>
              <button
                onClick={() => setActiveTab('solvents')}
                className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'solvents'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Droplet size={18} />
                4. Solvents
              </button>
              <button
                onClick={() => setActiveTab('green-replacement')}
                className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'green-replacement'
                    ? 'bg-white text-green-700 shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Leaf size={18} />
                5. Green Replacement
              </button>
              <button
                onClick={() => setActiveTab('crystallization')}
                className={`whitespace-nowrap flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'crystallization'
                    ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                <Layers size={18} />
                6. Crystallization Planner
              </button>
            </div>

            <div className="mt-6">
              {activeTab === 'calibration' ? (
                <CalibrationTab 
                  points={activeExperiment!.calibrationData} 
                  setPoints={(pts) => {
                    const data = typeof pts === 'function' ? pts(activeExperiment!.calibrationData) : pts;
                    updateActiveExperiment({ calibrationData: data });
                  }} 
                  result={calibrationResult} 
                  wavelength={activeExperiment!.wavelength}
                  setWavelength={(w) => updateActiveExperiment({ wavelength: w })}
                  hplcUsed={activeExperiment!.hplcUsed}
                  setHplcUsed={(h) => updateActiveExperiment({ hplcUsed: h })}
                  forceZero={activeExperiment!.forceZero}
                  setForceZero={(f) => updateActiveExperiment({ forceZero: f })}
                  experimentName={activeExperiment!.name}
                />
              ) : activeTab === 'samples' ? (
                <SamplesTab 
                  samples={activeExperiment!.samples} 
                  setSamples={(smps) => {
                    const data = typeof smps === 'function' ? smps(activeExperiment!.samples) : smps;
                    updateActiveExperiment({ samples: data });
                  }} 
                  calibrationResult={calibrationResult} 
                  setCalibrationPoints={(pts) => { updateActiveExperiment({ calibrationData: typeof pts === "function" ? pts(activeExperiment!.calibrationData) : pts }); }} 
                  experimentName={activeExperiment!.name}
                />
              ) : activeTab === 'solvents' ? (
                <SolventsTab />
              ) : activeTab === 'green-replacement' ? (
                <GreenReplacementTab activeExperiment={activeExperiment!} />
              ) : activeTab === 'prediction' ? (
                <PredictionTab key={activeExperiment!.id} experimentId={activeExperiment!.id} samples={activeExperiment!.samples} calibrationResult={calibrationResult} onActiveModelChange={setActivePredictionModel} />
              ) : activeTab === 'crystallization' ? (
                <CrystallizationTab activeExperiment={activeExperiment!} predictionContext={activePredictionModel} />
              ) : (
                <GuideTab />
              )}
            </div>
          </>
        )}
      </main>

      {/* Archive Confirmation Modal */}
      {archiveConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <Archive size={22} />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Move Experiment to Archive</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to archive this experiment? It will be moved to the <strong>Archive Folder</strong>, where you can view or restore it at any time.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setArchiveConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executeArchiveExperiment(archiveConfirmId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors shadow-sm cursor-pointer"
              >
                Move to Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Confirmation Modal */}
      {permanentDeleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <Trash2 size={22} />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Delete Permanently</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Are you sure you want to permanently delete this archived experiment? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                onClick={() => setPermanentDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => executePermanentDelete(permanentDeleteConfirmId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

