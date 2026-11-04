import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Upload, FileSpreadsheet, ChevronUp, ChevronDown, Settings, Save, RotateCcw, Edit2, X, Info, Sliders, GripVertical } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import XLSX from 'xlsx-js-style';
const { read, utils, writeFile } = XLSX;
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';
import { SampleData, CalibrationResult } from '../types';
import { generateId, roundTo, getExportFileName } from '../utils';
import { getSolventNames } from '../data/solvents';
import { sanitizeSamples } from '../utils/importHelper';
import { enrichSamplesWithConcentration } from '../utils/calculations';


interface SamplesTabProps {
  samples: SampleData[];
  setSamples: React.Dispatch<React.SetStateAction<SampleData[]>>;
  calibrationResult: CalibrationResult;
  setCalibrationPoints?: React.Dispatch<React.SetStateAction<import('../types').CalibrationPoint[]>>;
  experimentName?: string;
}

interface Preset {
  id: string;
  name: string;
  solvents: string[];
}

const DEFAULT_PRESETS: Preset[] = [
  {
    id: 'polar-aprotic',
    name: 'Polar Aprotic solvents (16 Solvents)',
    solvents: [
      'Acetonitrile',
      'Dichloromethane',
      'Ethyl acetate',
      'Acetone',
      'Tetrahydrofuran',
      'Dimethyl Sulfoxide',
      'Dimethylformamide',
      'Methyl ethyl ketone',
      '2-Methyl tetrahydrofuran',
      'Cyclohexanone',
      'Dimethyl carbonate',
      'Diethyl carbonate',
      'N-Butyl acetate',
      'Propylene carbonate'
    ]
  }
];
interface SortableRowProps {
  id: string;
  className?: string;
  children: React.ReactNode;
}

function SortableRow({ id, className = '', children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  return (
    <tr ref={setNodeRef} style={style} className={`text-sm ${isDragging ? 'bg-blue-50/50' : ''} ${className}`}>
      <td className="py-2 px-2 text-center text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600" {...attributes} {...listeners}>
        <GripVertical size={16} className="mx-auto" />
      </td>
      {children}
    </tr>
  );
}
export function SamplesTab({ samples, setSamples, calibrationResult, setCalibrationPoints, experimentName }: SamplesTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      setSamples((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  const [solventOptions, setSolventOptions] = useState<string[]>(() => getSolventNames());

  useEffect(() => {
    setSolventOptions(getSolventNames());
  }, []);

  const [presets, setPresets] = useState<Preset[]>(() => {
    const saved = localStorage.getItem('hplc-sample-presets');
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
  });

  useEffect(() => {
    localStorage.setItem('hplc-sample-presets', JSON.stringify(presets));
  }, [presets]);

  const [selectedPresetId, setSelectedPresetId] = useState<string>(presets[0]?.id || '');
  const [showEditPresets, setShowEditPresets] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string>('');
  const [editingName, setEditingName] = useState('');
  const [editingSolventsText, setEditingSolventsText] = useState('');

  const [tempCount, setTempCount] = useState<number>(3);
  const [tempValues, setTempValues] = useState<string[]>(['25', '50', '80']);

  const [quickSolv1, setQuickSolv1] = useState('');
  const [quickSolv2, setQuickSolv2] = useState('');
  const [quickSolv1Frac, setQuickSolv1Frac] = useState('100');

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
    isAlert?: boolean;
  }>({ isOpen: false, title: '', message: '' });

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      onConfirm,
      isAlert: false
    });
  };

  const showAlert = (title: string, message: string) => {
    setModalConfig({
      isOpen: true,
      title,
      message,
      isAlert: true
    });
  };

  const loadPreset = (presetId: string, append: boolean) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;

    const parsedTemps = tempValues.map(val => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 25 : parsed;
    });

    const newRows: SampleData[] = [];
    preset.solvents.forEach(solvent => {
      parsedTemps.forEach(temp => {
        newRows.push({
          id: generateId(),
          name: '',
          solvent1: solvent,
          solvent2: '',
          solvent1Fraction: 100,
          temperature: temp,
          area: '',
          volumeTakenUl: '',
          addedSolventMl: '1,0'
        });
      });
    });

    if (append) {
      setSamples([...samples, ...newRows]);
    } else {
      if (samples.length === 0) {
        setSamples(newRows);
      } else {
        showConfirm(
          "Replace Samples",
          "Are you sure you want to replace all current samples with this preset?",
          () => setSamples(newRows)
        );
      }
    }
  };

  const handleQuickAddMixture = () => {
    if (!quickSolv1.trim()) {
      showAlert('Error', 'Please specify at least Solvent 1.');
      return;
    }
    const parsedTemps = tempValues.map(val => {
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 25 : parsed;
    });

    let fraction = Number(String(quickSolv1Frac).replace(',', '.'));
    if (isNaN(fraction)) fraction = 100;

    const newRows: SampleData[] = parsedTemps.map(temp => ({
      id: generateId(),
      name: '',
      solvent1: quickSolv1,
      solvent2: quickSolv2,
      solvent1Fraction: fraction,
      temperature: temp,
      area: '',
      volumeTakenUl: '',
      addedSolventMl: '1,0'
    }));
    setSamples([...samples, ...newRows]);
  };

  const handleStartEditPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    setEditingPresetId(preset.id);
    setEditingName(preset.name);
    setEditingSolventsText(preset.solvents.join('\n'));
    setShowEditPresets(true);
  };

  const handleSavePreset = () => {
    if (!editingName.trim()) {
      showAlert('Error', 'Preset name cannot be empty');
      return;
    }
    const solvents = editingSolventsText
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const updatedPresets = presets.map(p => {
      if (p.id === editingPresetId) {
        return { ...p, name: editingName.trim(), solvents };
      }
      return p;
    });

    setPresets(updatedPresets);
    setShowEditPresets(false);
  };

  const handleCreatePreset = () => {
    const newPreset: Preset = {
      id: generateId(),
      name: 'New Custom Preset',
      solvents: ['Methanol', 'Ethanol']
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    setEditingPresetId(newPreset.id);
    setEditingName(newPreset.name);
    setEditingSolventsText(newPreset.solvents.join('\n'));
    setShowEditPresets(true);
  };

  const handleDeletePreset = (id: string) => {
    showConfirm(
      'Delete Preset',
      'Are you sure you want to delete this preset?',
      () => {
        const updated = presets.filter(p => p.id !== id);
        setPresets(updated);
        if (selectedPresetId === id) {
          setSelectedPresetId(updated[0]?.id || '');
        }
        setShowEditPresets(false);
      }
    );
  };

  const handleResetPresets = () => {
    showConfirm(
      'Reset Presets',
      'Are you sure you want to reset all presets to default? This will overwrite your custom presets.',
      () => {
        setPresets(DEFAULT_PRESETS);
        setSelectedPresetId(DEFAULT_PRESETS[0].id);
        setShowEditPresets(false);
      }
    );
  };

  const addSample = () => {
    setSamples([...samples, { 
      id: generateId(), 
      name: `Sample ${samples.length + 1}`, 
      area: '', 
      volumeTakenUl: '', 
      addedSolventMl: '1,0',
      solvent1: '',
      solvent2: '',
      solvent1Fraction: 100,
      temperature: ''
    }]);
  };

  const [importType, setImportType] = useState<'excel' | 'pdf'>('excel');

  const triggerImport = (type: 'excel' | 'pdf') => {
    setImportType(type);
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === 'excel' ? '.xlsx,.xls' : '.pdf';
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (importType === 'excel') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = utils.sheet_to_json<any>(ws);

          if (data && data.length > 0) {
            const newSamples = sanitizeSamples(data);
            setSamples((prev) => [...prev, ...newSamples]);
          }
        } catch (err) {
          console.error(err);
          showAlert('Import Error', 'Failed to parse Excel file. Please ensure it has the correct columns.');
        }
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsBinaryString(file);
    } else if (importType === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const pdfjsLib = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.mjs');
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs';
        // @ts-ignore
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageTexts: string[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const items = content.items as any[];
          
          const pageLinesMap = new Map<number, { x: number; str: string }[]>();
          
          items.forEach(item => {
            if (!item.str) return;
            const y = Math.round((item.transform ? item.transform[5] : 0) / 3) * 3;
            if (!pageLinesMap.has(y)) {
              pageLinesMap.set(y, []);
            }
            pageLinesMap.get(y)!.push({ x: item.transform ? item.transform[4] : 0, str: item.str });
          });

          const sortedYs = Array.from(pageLinesMap.keys()).sort((a, b) => b - a);
          const pageLines: string[] = [];
          for (const y of sortedYs) {
            const lineItems = pageLinesMap.get(y)!;
            lineItems.sort((a, b) => a.x - b.x);
            const lineStr = lineItems.map(it => it.str).join(' ').trim();
            if (lineStr) {
              pageLines.push(lineStr);
            }
          }
          pageTexts.push(pageLines.join('\n'));
        }

        const fullText = pageTexts.join('\n');
        
        const calHeaderMatch = fullText.match(/Calibration\s+standard\s+statistics:?/i);
        const sampleHeaderMatch = fullText.match(/Sample\s+statistics:?/i);
        const seqHeaderMatch = fullText.match(/Sequence\s+Table:?/i);

        const calHeaderIdx = calHeaderMatch ? fullText.indexOf(calHeaderMatch[0]) : -1;
        const sampleHeaderIdx = sampleHeaderMatch ? fullText.indexOf(sampleHeaderMatch[0]) : -1;
        const seqHeaderIdx = seqHeaderMatch ? fullText.indexOf(seqHeaderMatch[0]) : -1;

        let seqSectionText = '';
        if (seqHeaderIdx !== -1) {
          const endIdx = calHeaderIdx !== -1 ? calHeaderIdx : (sampleHeaderIdx !== -1 ? sampleHeaderIdx : fullText.length);
          seqSectionText = fullText.substring(seqHeaderIdx, endIdx);
        } else {
          seqSectionText = fullText;
        }

        let calSectionText = '';
        if (calHeaderIdx !== -1) {
          const endIdx = sampleHeaderIdx !== -1 ? sampleHeaderIdx : fullText.length;
          calSectionText = fullText.substring(calHeaderIdx, endIdx);
        }

        let sampleSectionText = '';
        if (sampleHeaderIdx !== -1) {
          sampleSectionText = fullText.substring(sampleHeaderIdx);
        } else if (calHeaderIdx === -1 && seqHeaderIdx === -1) {
          sampleSectionText = fullText;
        }

        const seqDilutionMap = new Map<string, string>();
        const seqDilutionList: string[] = [];
        
        if (seqSectionText) {
          const seqLines = seqSectionText.split('\n');
          for (const line of seqLines) {
            if (/Sample\s*Name|Injection\s*Date|Bracketing\s*Mode|Sequence\s*Table/i.test(line)) continue;
            
            const dilutionMatch = line.match(/(\d+);(?:\d+;)*\d+/);
            if (dilutionMatch) {
              const dFactor = parseInt(dilutionMatch[1], 10);
              
              let sampleNamePart = line.split(/\s+[A-Z]\d+-[A-Z0-9]+|\s+\d{4}-\d{2}-\d{2}|\s+\d+;/)[0].trim();
              if (/^\d+\s+/.test(sampleNamePart)) {
                sampleNamePart = sampleNamePart.replace(/^\d+\s+/, '');
              }
              
              if (/^Cal\d*$/i.test(sampleNamePart) || /^Cal\b/i.test(sampleNamePart) || sampleNamePart.startsWith('Cal')) {
                continue;
              }

              if (!isNaN(dFactor) && dFactor > 0) {
                const calcVol = 1000 / dFactor;
                const volStr = Number.isInteger(calcVol) ? String(calcVol) : calcVol.toFixed(1).replace('.', ',');
                
                if (sampleNamePart) {
                  const normKey = sampleNamePart.toLowerCase().replace(/\s+/g, '');
                  seqDilutionMap.set(normKey, volStr);
                }
                seqDilutionList.push(volStr);
              }
            }
          }
        }

        const newCalPoints: import('../types').CalibrationPoint[] = [];
        if (calSectionText) {
          const calRegex = /(\d+)\s+([A-Za-z0-9_]+)\s+(\d+)\s+([A-Z0-9\-]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([-.\d]+)\s+([\d.]+)/g;
          let match;
          while ((match = calRegex.exec(calSectionText)) !== null) {
            const calibAmount = match[7];
            const area = match[9];
            if (calibAmount && area) {
              newCalPoints.push({
                id: Math.random().toString(36).substring(2, 9),
                massMg: calibAmount.replace('.', ','),
                volMl: '1,0',
                area: area.replace('.', ',')
              });
            }
          }
        }

        if (newCalPoints.length > 0 && setCalibrationPoints) {
          setCalibrationPoints(newCalPoints);
        }

        const solventList = [
          'Acetonitrile', 'ACN', 'Methanol', 'MeOH', 'Water', 'H2O', 'Ethanol', 'EtOH',
          'Isopropanol', 'iPrOH', 'IPA', 'Ethyl acetate', 'EtOAc', 'Acetone',
          'Tetrahydrofuran', 'THF', 'DMSO', 'DMF', 'Dichloromethane', 'DCM',
          'Toluene', 'Heptane', 'NMP', 'MEK', 'MTBE', 'CPME', 'Cyclohexane',
          'Chloroform', 'Anisole', '1-Butanol', '2-Butanol', '1-Propanol'
        ];

        const extractSampleMeta = (rawName: string) => {
          const name = rawName.replace(/\s+/g, ' ').trim();
          let temperature: string | number = '';
          let solvent1 = '';
          let solvent2 = '';
          let solvent1Fraction: string | number = '';

          const tempMatch = name.match(/(\d{1,3})\s*(?:°C|°|deg\s*C|\bC\b)/i);
          if (tempMatch) {
            temperature = parseInt(tempMatch[1], 10);
          }

          const matchedSolvents: string[] = [];
          for (const solv of solventList) {
            const regex = new RegExp(`\\b${solv}\\b`, 'i');
            if (regex.test(name)) {
              let norm = solv;
              if (/^ACN$/i.test(solv)) norm = 'Acetonitrile';
              else if (/^MeOH$/i.test(solv)) norm = 'Methanol';
              else if (/^EtOH$/i.test(solv)) norm = 'Ethanol';
              else if (/^(?:iPrOH|IPA)$/i.test(solv)) norm = 'Isopropanol';
              else if (/^EtOAc$/i.test(solv)) norm = 'Ethyl acetate';
              else if (/^THF$/i.test(solv)) norm = 'Tetrahydrofuran';
              else if (/^DCM$/i.test(solv)) norm = 'Dichloromethane';
              else if (/^H2O$/i.test(solv)) norm = 'Water';
              
              if (!matchedSolvents.includes(norm)) {
                matchedSolvents.push(norm);
              }
            }
          }

          if (matchedSolvents.length > 0) solvent1 = matchedSolvents[0];
          if (matchedSolvents.length > 1) solvent2 = matchedSolvents[1];
          
          const fracMatch = name.match(/(\d{1,3})\s*%/);
          if (fracMatch) {
            solvent1Fraction = parseInt(fracMatch[1], 10);
          } else if (matchedSolvents.length === 1) {
            solvent1Fraction = 100;
          }
          
          return { name, solvent1, solvent2, solvent1Fraction, temperature };
        };

        const newSamples: SampleData[] = [];
        
        if (sampleSectionText) {
          const sampleRegex = /(\d+)\s+(.+?)\s+([A-Z]\d+-[A-Z0-9]+|[A-Z]\d+|-)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([-.\d]+)\s+([-.\d]+)/g;
          let match;
          let sampleIdx = 0;
          while ((match = sampleRegex.exec(sampleSectionText)) !== null) {
            const rawSampleName = match[2].trim();
            const area = match[6];
            
            if (/^Cal\d*$/i.test(rawSampleName) || /^Cal\b/i.test(rawSampleName)) {
              continue;
            }

            const normKey = rawSampleName.toLowerCase().replace(/\s+/g, '');
            let volumeTakenUl = seqDilutionMap.get(normKey);
            if (!volumeTakenUl) {
              for (const [k, v] of seqDilutionMap.entries()) {
                if (normKey.includes(k) || k.includes(normKey)) {
                  volumeTakenUl = v;
                  break;
                }
              }
            }
            if (!volumeTakenUl && sampleIdx < seqDilutionList.length) {
              volumeTakenUl = seqDilutionList[sampleIdx];
            }
            if (!volumeTakenUl) {
              volumeTakenUl = '';
            }

            const meta = extractSampleMeta(rawSampleName);

            newSamples.push({
              id: Math.random().toString(36).substring(2, 9),
              name: rawSampleName,
              solvent1: meta.solvent1,
              solvent2: meta.solvent2,
              solvent1Fraction: meta.solvent1Fraction,
              temperature: meta.temperature,
              area: area.replace('.', ','),
              volumeTakenUl: volumeTakenUl,
              addedSolventMl: '1,0',
            });
            sampleIdx++;
          }
        }

        if (newSamples.length > 0) {
          let updatedCount = 0;
          let addedCount = 0;
          
          setSamples(prev => {
            const updatedList = [...prev];
            const brandNewSamples: SampleData[] = [];
            
            for (const ns of newSamples) {
              const normNsName = ns.name.trim().replace(/\s+/g, ' ').toLowerCase();
              if (!normNsName) continue;
              
              const existingIdx = updatedList.findIndex(s => 
                s.name && s.name.trim().replace(/\s+/g, ' ').toLowerCase() === normNsName
              );
              
              if (existingIdx !== -1) {
                updatedList[existingIdx] = {
                  ...updatedList[existingIdx],
                  area: ns.area,
                  volumeTakenUl: ns.volumeTakenUl !== '' ? ns.volumeTakenUl : updatedList[existingIdx].volumeTakenUl
                };
                updatedCount++;
              } else {
                brandNewSamples.push(ns);
                addedCount++;
              }
            }
            
            const nonBlank = updatedList.filter(s => 
              (s.name && s.name.trim() !== '') || 
              (s.area && String(s.area).trim() !== '') || 
              (s.solvent1 && s.solvent1.trim() !== '')
            );
            return [...nonBlank, ...brandNewSamples];
          });
          
          alert(`PDF imported successfully! Processed ${newSamples.length} sample measurement line(s).`);
        } else {
          alert("PDF processed. Calibration curve updated, but no sample measurement lines were detected.");
        }
      } catch (err) {
        console.error(err);
        showAlert('Import Error', 'Failed to parse PDF file.');
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  const removeSample = (id: string) => {
    setSamples(samples.filter(s => s.id !== id));
  };

  const updateSample = (id: string, field: keyof SampleData, value: string | number) => {
    let normalizedValue = value;
    if (typeof value === 'string') {
      normalizedValue = value.replace(/,/g, '.');
    }
    setSamples(samples.map(s => s.id === id ? { ...s, [field]: normalizedValue } : s));
  };

  const clearAll = () => {
    showConfirm(
      "Clear All Samples",
      "Are you sure you want to clear all samples?",
      () => setSamples([])
    );
  };

  const [sortField, setSortField] = useState<'name' | 'reactionConc' | 'solvent1' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const processedSamples = useMemo(() => {
    return enrichSamplesWithConcentration(samples, calibrationResult, 1);
  }, [samples, calibrationResult]);

  const sortedSamples = useMemo(() => {
    if (!sortField) return processedSamples;
    return [...processedSamples].sort((a, b) => {
      if (sortField === 'name') {
        const res = a.name.localeCompare(b.name);
        return sortAsc ? res : -res;
      } else if (sortField === 'solvent1') {
        const valA = a.solvent1 || '';
        const valB = b.solvent1 || '';
        const res = valA.localeCompare(valB);
        return sortAsc ? res : -res;
      } else if (sortField === 'reactionConc') {
        const valA = a.rawReactionConc === null ? -Infinity : a.rawReactionConc;
        const valB = b.rawReactionConc === null ? -Infinity : b.rawReactionConc;
        return sortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });
  }, [processedSamples, sortField, sortAsc]);

  const validConcs = processedSamples
    .map(s => s.rawReactionConc)
    .filter(c => c !== null) as number[];

  const minConc = validConcs.length > 0 ? Math.min(...validConcs) : 0;
  const maxConc = validConcs.length > 0 ? Math.max(...validConcs) : 1;

  const handleSort = (field: 'name' | 'reactionConc' | 'solvent1') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const moveSample = (index: number, direction: 'up' | 'down') => {
    const currentList = [...sortedSamples];
    if (index < 0 || index >= currentList.length) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentList.length) return;

    const temp = currentList[index];
    currentList[index] = currentList[targetIndex];
    currentList[targetIndex] = temp;

    if (sortField !== null) {
      setSortField(null);
    }

    const updatedSamples = currentList.map(s => ({
      id: s.id,
      name: s.name,
      area: s.area,
      volumeTakenUl: s.volumeTakenUl,
      addedSolventMl: s.addedSolventMl,
      solvent1: s.solvent1,
      solvent2: s.solvent2,
      solvent1Fraction: s.solvent1Fraction,
      temperature: s.temperature,
    }));

    setSamples(updatedSamples);
  };

const handleExportExcel = () => {
    const wb = utils.book_new();
    const sampleData = sortedSamples.map(s => {
      return {
        'Sample Name': s.name,
        'Solvent 1': s.solvent1 || '',
        'Solvent 2': s.solvent2 || '',
        'Solv 1 (%)': s.solvent1Fraction !== '' ? Number(s.solvent1Fraction) : s.solvent1Fraction,
        'Temp (°C)': s.temperature !== '' ? Number(s.temperature) : s.temperature,
        'UV Area': s.area !== '' ? Number(s.area) : s.area,
        'Sampling Vol. (µL)': s.volumeTakenUl !== '' ? Number(s.volumeTakenUl) : s.volumeTakenUl,
        'Added Solvent (mL)': s.addedSolventMl !== '' ? Number(s.addedSolventMl) : s.addedSolventMl,
        'Reaction Conc. (mg/mL)': s.reactionConc
      };
    });
    
    const wsSamples = utils.json_to_sheet(sampleData);

    const sampleKeys = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
    const sampleCols = sampleKeys.map(key => ({ wch: key.length + 5 }));
    sampleData.forEach(row => {
      sampleKeys.forEach((key, colIdx) => {
        const val = row[key as keyof typeof row];
        if (val !== undefined && val !== null) {
          const valLen = String(val).length;
          if (valLen + 2 > sampleCols[colIdx].wch) {
            sampleCols[colIdx].wch = valLen + 2;
          }
        }
      });
    });
    wsSamples['!cols'] = sampleCols;

    const rangeSamples = utils.decode_range(wsSamples['!ref'] || 'A1:A1');
    for (let R = rangeSamples.s.r; R <= rangeSamples.e.r; ++R) {
      for (let C = rangeSamples.s.c; C <= rangeSamples.e.c; ++C) {
        const cellAddress = { c: C, r: R };
        const cellRef = utils.encode_cell(cellAddress);
        const cell = wsSamples[cellRef];
        if (!cell) continue;

        cell.s = {
          alignment: { horizontal: 'center', vertical: 'center' }
        };

        if (R === 0) {
          cell.s.font = { bold: true };
        }
      }
    }

    utils.book_append_sheet(wb, wsSamples, 'Samples');
    writeFile(wb, getExportFileName(experimentName, 'xlsx'));
  };

  return (
    <div className="space-y-6">
      {!calibrationResult.valid && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="shrink-0 mt-0.5 text-amber-600" size={18} />
          <p className="text-sm">
            <strong>No valid calibration curve.</strong> Please set up your calibration standards in the Calibration tab first. 
            Concentrations cannot be calculated without a valid curve.
          </p>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        {/* Preset / Screening Loader */}
        <div className="mb-6 p-4 rounded-xl border border-blue-100 bg-blue-50/20 dark:border-slate-700 dark:bg-slate-800/40">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sliders className="text-blue-600 dark:text-blue-400" size={20} />
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Screening & Solvent Presets</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Quickly pre-populate your screening matrix with custom temperature points per solvent.</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                className="text-xs border border-slate-300 rounded-md px-2.5 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 max-w-xs outline-none"
              >
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <button
                onClick={() => loadPreset(selectedPresetId, false)}
                disabled={!selectedPresetId}
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                Load (Replace)
              </button>
              
              <button
                onClick={() => loadPreset(selectedPresetId, true)}
                disabled={!selectedPresetId}
                className="text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                Load (Append)
              </button>

              <button
                onClick={() => handleStartEditPreset(selectedPresetId)}
                disabled={!selectedPresetId}
                className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                title="Manage and Edit Presets"
              >
                <Settings size={14} />
                Manage Presets
              </button>
            </div>
          </div>

          {/* Custom Temperature Configuration Block */}
          <div className="mt-4 pt-4 border-t border-blue-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center gap-4 justify-between bg-white/40 dark:bg-slate-900/40 p-3 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Temperature Points per Solvent:
                </label>
                <input
                  type="text"
                  min="1"
                  max="10"
                  value={tempCount}
                  onChange={(e) => {
                    const val = Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                    setTempCount(val);
                    setTempValues(prev => {
                      const next = [...prev];
                      if (next.length < val) {
                        const defaults = [25, 50, 80, 100, 120, 150];
                        for (let i = next.length; i < val; i++) {
                          next.push(defaults[i] !== undefined ? String(defaults[i]) : String(25 + i * 15));
                        }
                      } else if (next.length > val) {
                        next.splice(val);
                      }
                      return next;
                    });
                  }}
                  className="w-16 text-xs border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-center focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Set Temperatures (°C):
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {tempValues.map((val, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md pl-2 pr-1 py-1">
                      <span className="text-[10px] text-slate-400 font-medium font-mono">T{idx + 1}:</span>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const next = [...tempValues];
                          next[idx] = e.target.value;
                          setTempValues(next);
                        }}
                        className="w-12 text-xs text-center focus:outline-none bg-transparent text-slate-800 dark:text-slate-200 animate-fade-in"
                        placeholder="Temp"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              Generates {tempCount} rows per solvent.
            </p>
          </div>

          {/* Quick Add Mixture Block */}
          <div className="mt-4 pt-4 border-t border-blue-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Quick Add:</span>
              <input
                type="text"
                value={quickSolv1}
                onChange={(e) => setQuickSolv1(e.target.value)}
                onFocus={() => setSolventOptions(getSolventNames())}
                list="solvents-autofill-list"
                className="w-28 text-xs border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                placeholder="Solvent 1"
              />
              <input
                type="text"
                value={quickSolv2}
                onChange={(e) => setQuickSolv2(e.target.value)}
                onFocus={() => setSolventOptions(getSolventNames())}
                list="solvents-autofill-list"
                className="w-28 text-xs border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none"
                placeholder="Solvent 2 (opt)"
              />
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={quickSolv1Frac}
                  onChange={(e) => setQuickSolv1Frac(e.target.value)}
                  className="w-16 text-xs border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 outline-none text-center"
                  placeholder="100"
                />
                <span className="text-[10px] text-slate-500 font-medium">% Solv 1</span>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={handleQuickAddMixture}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <Plus size={14} /> Add with Temperatures
              </button>
              <button 
                onClick={addSample}
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <Plus size={14} /> Add Sample
              </button>
            </div>
          </div>

          {/* Edit Preset Slide-down Panel */}
          {showEditPresets && (
            <div className="mt-4 p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Edit2 size={14} /> Edit Preset: {presets.find(p => p.id === editingPresetId)?.name || 'Custom'}
                </h4>
                <button 
                  onClick={() => setShowEditPresets(false)}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Preset Name</label>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="e.g., Custom Screening List"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={handleSavePreset}
                      className="flex items-center gap-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md transition-colors shadow-sm cursor-pointer"
                    >
                      <Save size={14} /> Save Preset
                    </button>
                    <button
                      onClick={handleCreatePreset}
                      className="flex items-center gap-1 text-xs font-semibold bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Plus size={14} /> Create New
                    </button>
                    <button
                      onClick={() => handleDeletePreset(editingPresetId)}
                      className="flex items-center gap-1 text-xs font-semibold bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 px-3 py-1.5 rounded-md transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={handleResetPresets}
                      className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      <RotateCcw size={12} /> Reset all to factory defaults
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Solvent List (one solvent per line)
                  </label>
                  <textarea
                    value={editingSolventsText}
                    onChange={(e) => setEditingSolventsText(e.target.value)}
                    rows={6}
                    className="w-full border border-slate-300 dark:border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                    placeholder="Methanol&#10;Ethanol&#10;Water"
                  />
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Info size={10} /> {tempCount} rows will be automatically generated for each solvent entered above (at {tempValues.filter(Boolean).join(', ')}°C).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-slate-800">Sample Measurements</h2>
            <p className="text-sm text-slate-500">Calculate total compound amount per mL of original reaction solution.</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={clearAll}
              disabled={samples.length === 0}
              className="text-sm font-medium text-slate-600 hover:text-red-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              Clear All
            </button>
            <button 
              onClick={handleExportExcel}
              disabled={samples.length === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 bg-white border border-slate-200 px-4 py-1.5 rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              <FileSpreadsheet size={16} />
              Export Excel
            </button>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
            />
            <button 
              onClick={() => triggerImport('excel')}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 bg-white border border-slate-200 px-4 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <FileSpreadsheet size={16} />
              Import Excel
            </button>
            <button 
              onClick={() => triggerImport('pdf')}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 bg-white border border-slate-200 px-4 py-1.5 rounded-md transition-colors shadow-sm"
            >
              <Upload size={16} />
              Import PDF
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-600">
                <th className="py-2 px-2 font-medium w-8 text-center"></th>
                <th className="py-2 px-2 font-medium w-8 text-center" title="Exclude sample from predictions">
                  <span className="sr-only">Exclude</span>
                  <div className="w-3 h-3 rounded border border-slate-400 mx-auto" />
                </th>
                <th 
                  className="py-2 px-2 font-medium min-w-[170px] cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  Sample Name {sortField === 'name' && (sortAsc ? '↑' : '↓')}
                </th>
                <th 
                  className="py-2 px-2 font-medium min-w-[130px] cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => handleSort('solvent1')}
                >
                  Solvent 1 {sortField === 'solvent1' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="py-2 px-2 font-medium min-w-[125px]">Solvent 2</th>
                <th className="py-2 px-2 font-medium min-w-[70px]">Solvent 1 (%)</th>
                <th className="py-2 px-2 font-medium min-w-[65px]">Temp (°C)</th>
                <th className="py-2 px-2 font-medium min-w-[80px]">UV Area</th>
                <th className="py-2 px-2 font-medium min-w-[80px]">Sampling Vol. (µL)</th>
                <th className="py-2 px-2 font-medium min-w-[80px]">Added Solvent (mL)</th>
                <th 
                  className="py-2 px-2 font-medium min-w-[80px] bg-green-50/50 cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={() => handleSort('reactionConc')}
                >
                  Concentration (mg/mL) {sortField === 'reactionConc' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="py-2 px-2 font-medium w-20 text-center">Actions</th>
              </tr>
            </thead>
            <SortableContext items={sortedSamples.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <tbody className="divide-y divide-slate-100">
              {sortedSamples.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 text-sm italic">
                    No samples added yet. Click "Add Sample" to begin.
                  </td>
                </tr>
              ) : sortedSamples.map((sample, index) => {
                const { rawReactionConc, reactionConc } = sample;

                let cellStyle: React.CSSProperties = {};
                if (rawReactionConc !== null) {
                  let ratio = 0.5;
                  if (maxConc > minConc) {
                    ratio = (rawReactionConc - minConc) / (maxConc - minConc);
                  } else if (validConcs.length === 1) {
                    ratio = 1; // if there's only one sample, make it green
                  }
                  // red = 0, green = 120
                  const hue = Math.round(ratio * 120);
                  cellStyle = { backgroundColor: `hsl(${hue}, 85%, 85%)`, color: '#0f172a' };
                }

                return (
                  <SortableRow key={sample.id} id={sample.id} className={`text-sm hover:bg-slate-50/30 transition-colors ${sample.excluded ? 'opacity-50 grayscale' : ''}`}>
                    <td className="py-1 px-2 text-center">
                      <input 
                        type="checkbox"
                        checked={!!sample.excluded}
                        onChange={(e) => updateSample(sample.id, 'excluded', e.target.checked as any)}
                        className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        title="Exclude from predictions"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={sample.name}
                        onChange={(e) => updateSample(sample.id, 'name', e.target.value)}
                        className="w-full min-w-[150px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="Sample Name"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={sample.solvent1 || ''}
                        onChange={(e) => updateSample(sample.id, 'solvent1', e.target.value)}
                        onFocus={() => setSolventOptions(getSolventNames())}
                        list="solvents-autofill-list"
                        className="w-full min-w-[110px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="Solv 1"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        value={sample.solvent2 || ''}
                        onChange={(e) => updateSample(sample.id, 'solvent2', e.target.value)}
                        onFocus={() => setSolventOptions(getSolventNames())}
                        list="solvents-autofill-list"
                        className="w-full min-w-[105px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="Solv 2"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        min="0"
                        step="any"
                        value={sample.solvent1Fraction}
                        onChange={(e) => updateSample(sample.id, 'solvent1Fraction', e.target.value)}
                        className="w-full min-w-[50px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="100"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        step="any"
                        value={sample.temperature}
                        onChange={(e) => updateSample(sample.id, 'temperature', e.target.value)}
                        className="w-full min-w-[50px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="25"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        min="0"
                        step="any"
                        value={sample.area}
                        onChange={(e) => updateSample(sample.id, 'area', e.target.value)}
                        className="w-full min-w-[65px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="Area"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        min="0"
                        step="any"
                        value={sample.volumeTakenUl}
                        onChange={(e) => updateSample(sample.id, 'volumeTakenUl', e.target.value)}
                        className="w-full min-w-[50px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="10"
                      />
                    </td>
                    <td className="py-1 px-2">
                      <input 
                        type="text" 
                        min="0"
                        step="any"
                        value={sample.addedSolventMl}
                        onChange={(e) => updateSample(sample.id, 'addedSolventMl', e.target.value)}
                        className="w-full min-w-[50px] border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-xs"
                        placeholder="1"
                      />
                    </td>
                    <td 
                      className={`py-1 px-2 font-mono font-bold text-xs transition-colors ${rawReactionConc !== null ? 'text-slate-900' : 'text-slate-500 bg-slate-50/30'}`}
                      style={cellStyle}
                    >
                      {reactionConc}
                    </td>
                    <td className="py-1 px-2">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => moveSample(index, 'up')}
                          disabled={index === 0}
                          className="text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition-colors p-1"
                          title="Move up"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button 
                          onClick={() => moveSample(index, 'down')}
                          disabled={index === sortedSamples.length - 1}
                          className="text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400 cursor-pointer disabled:cursor-not-allowed transition-colors p-1"
                          title="Move down"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button 
                          onClick={() => removeSample(sample.id)}
                          className="text-slate-400 hover:text-red-600 cursor-pointer transition-colors p-1"
                          title="Remove sample"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </SortableRow>
                );
              })}
            </tbody>
            </SortableContext>
          </table>
          </DndContext>
        </div>
      </div>

      {/* Calculation Formulas */}
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm mt-6">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Calculation Formulas</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-slate-700 dark:text-slate-300">
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <p className="text-sm font-medium mb-2 w-full text-left text-slate-500 uppercase tracking-wider">1. Vial Concentration</p>
            <BlockMath math="C_{vial} = \frac{\text{UV Area} - \text{Intercept}}{\text{Slope}}" />
          </div>
          <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <p className="text-sm font-medium mb-2 w-full text-left text-slate-500 uppercase tracking-wider">2. Reaction Concentration</p>
            <BlockMath math="C_{reaction} = C_{vial} \times \frac{V_{taken} + V_{added}}{V_{taken}}" />
          </div>
        </div>
      </div>

      {modalConfig.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full mx-4 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">{modalConfig.title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{modalConfig.message}</p>
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              {!modalConfig.isAlert ? (
                <>
                  <button
                    onClick={() => setModalConfig({ isOpen: false, title: '', message: '' })}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      modalConfig.onConfirm?.();
                      setModalConfig({ isOpen: false, title: '', message: '' });
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm cursor-pointer"
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setModalConfig({ isOpen: false, title: '', message: '' })}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-sm cursor-pointer"
                >
                  OK
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <datalist id="solvents-autofill-list">
        {solventOptions.map((name, idx) => (
          <option key={`${name}-${idx}`} value={name} />
        ))}
      </datalist>
    </div>
  );
}
