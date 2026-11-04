import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, Droplet, Edit2, Check, Download, ArrowUpDown, Upload, FileJson, FileSpreadsheet, CheckCircle2, AlertCircle, Wand2, BookmarkCheck, RotateCcw } from 'lucide-react';
import { Solvent } from '../types';
import { generateId } from '../utils';
import XLSX from 'xlsx-js-style';
const { utils, writeFile } = XLSX;
import { defaultSolvents, masterSolventDatabase, enrichSolventWithReference, enrichSolventsList, findSolventInDatabase } from '../data/solvents';

export function SolventsTab() {
  const [solvents, setSolvents] = useState<Solvent[]>(() => {
    const saved = localStorage.getItem('hplc-solvents');
    const standard = localStorage.getItem('hplc-solvents-standard');
    const target = saved || standard;
    if (target) {
      try {
        let parsed = JSON.parse(target);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Enrich user lab solvents with reference database
          const { enriched } = enrichSolventsList(parsed);
          localStorage.setItem('hplc-solvents', JSON.stringify(enriched));
          return enriched;
        }
      } catch (e) {
        console.error("Failed to parse saved solvents", e);
      }
    }
    const { enriched } = enrichSolventsList(defaultSolvents);
    return enriched;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [filterIchClass, setFilterIchClass] = useState<number | null>(null);
  const [minEhsScore, setMinEhsScore] = useState<number | null>(null);
  const [sortField, setSortField] = useState<'name' | 'dielectricConstant' | 'polarityProfile' | 'waterMiscibility' | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('hplc-solvents', JSON.stringify(solvents));
  }, [solvents]);

  // On mount check: silently synchronize any missing parameters with reference database without banner
  useEffect(() => {
    const { enriched, totalFieldsUpdated } = enrichSolventsList(solvents);
    if (totalFieldsUpdated > 0) {
      setSolvents(enriched);
      localStorage.setItem('hplc-solvents', JSON.stringify(enriched));
    }
  }, []);

  const handleSaveAsStandard = () => {
    localStorage.setItem('hplc-solvents-standard', JSON.stringify(solvents));
    localStorage.setItem('hplc-solvents', JSON.stringify(solvents));
    setFeedbackMessage('Current solvent list saved as software standard');
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const handleResetToStandard = () => {
    if (window.confirm('Reset lab solvents inventory to the software standard? Any unsaved changes will be replaced.')) {
      const standard = localStorage.getItem('hplc-solvents-standard');
      let targetSolvents = defaultSolvents;
      if (standard) {
        try {
          const parsed = JSON.parse(standard);
          if (Array.isArray(parsed) && parsed.length > 0) {
            targetSolvents = parsed;
          }
        } catch (e) {
          console.error("Failed to parse standard solvents", e);
        }
      }
      const { enriched } = enrichSolventsList(targetSolvents);
      setSolvents(enriched);
      localStorage.setItem('hplc-solvents', JSON.stringify(enriched));
      setFeedbackMessage('Solvent inventory reset to software standard');
      setTimeout(() => setFeedbackMessage(null), 3500);
    }
  };

  const sortedSolvents = useMemo(() => {
    let filtered = solvents;
    if (filterIchClass !== null) {
      filtered = filtered.filter(s => s.ichClass === filterIchClass);
    }
    if (minEhsScore !== null) {
      filtered = filtered.filter(s => Number(s.ehsScore) >= minEhsScore);
    }
    
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      if (sortField === 'name') {
        const res = a.name.localeCompare(b.name);
        return sortAsc ? res : -res;
      } else if (sortField === 'dielectricConstant') {
        const valA = Number(a.dielectricConstant) || -Infinity;
        const valB = Number(b.dielectricConstant) || -Infinity;
        return sortAsc ? valA - valB : valB - valA;
      } else if (sortField === 'polarityProfile') {
        const valA = a.polarityProfile || '';
        const valB = b.polarityProfile || '';
        const res = valA.localeCompare(valB);
        return sortAsc ? res : -res;
      } else if (sortField === 'waterMiscibility') {
        const valA = a.waterMiscibility || '';
        const valB = b.waterMiscibility || '';
        const res = valA.localeCompare(valB);
        return sortAsc ? res : -res;
      }
      return 0;
    });
  }, [solvents, sortField, sortAsc, filterIchClass, minEhsScore]);

  const handleSort = (field: 'name' | 'dielectricConstant' | 'polarityProfile' | 'waterMiscibility') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const addSolvent = () => {
    const newSolv: Solvent = {
      id: generateId(),
      name: 'New Solvent',
      boilingPoint: '',
      meltingPoint: '',
      flashPoint: '',
      ichClass: '',
      ehsScore: '',
      dielectricConstant: '',
      polarityIndex: '',
      polarityProfile: 'Nonpolar',
      waterMiscibility: 'Immiscible'
    };
    setSolvents([...solvents, newSolv]);
    setIsEditing(true);
  };

  const removeSolvent = (id: string) => {
    setSolvents(solvents.filter(s => s.id !== id));
  };

  const updateSolvent = (id: string, field: keyof Solvent, value: any) => {
    setSolvents(solvents.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      // If the user changed the name, check if we can auto-fill blanks from database
      if (field === 'name' && typeof value === 'string' && value.trim().length >= 3) {
        const ref = findSolventInDatabase(value);
        if (ref) {
          const res = enrichSolventWithReference(updated);
          return res.solvent;
        }
      }
      return updated;
    }));
  };

  const handleAutoFillSingleRow = (id: string) => {
    const target = solvents.find(s => s.id === id);
    if (!target) return;
    const res = enrichSolventWithReference(target);
    setSolvents(solvents.map(s => s.id === id ? res.solvent : s));
    setFeedbackMessage(`Updated ${target.name} parameters`);
    setTimeout(() => setFeedbackMessage(null), 3000);
  };

  const handleExport = () => {
    const wb = utils.book_new();
    const wsData = sortedSolvents.map(s => ({
      'Solvent Name': s.name,
      'Cost ($/kg)': s.costPerKg !== '' && s.costPerKg !== undefined ? Number(s.costPerKg) : '',
      'Boiling Point (°C)': s.boilingPoint !== '' ? Number(s.boilingPoint) : s.boilingPoint,
      'Melting Point (°C)': s.meltingPoint !== '' ? Number(s.meltingPoint) : s.meltingPoint,
      'Flash Point (°C)': s.flashPoint !== '' && s.flashPoint !== undefined ? Number(s.flashPoint) : (s.name === 'Water' || s.name === 'Dichloromethane' || s.name === 'Chloroform' || s.name === 'Carbon tetrachloride' ? 'None' : ''),
      'ICH Class': s.ichClass || '',
      'EHS Score': s.ehsScore || '',
      'Dielectric Constant': s.dielectricConstant !== '' ? Number(s.dielectricConstant) : s.dielectricConstant,
      'Polarity Index': s.polarityIndex || '',
      'Polarity': s.polarityProfile || 'Unknown',
      'Water Miscibility': s.waterMiscibility === 'Partially' ? `Partially (${s.miscibilityPercentage || '?'}%)` : s.waterMiscibility || 'Unknown',
    }));

    const ws = utils.json_to_sheet(wsData);

    const range = utils.decode_range(ws['!ref'] || 'A1:K1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell_address = { c: C, r: R };
        const cell_ref = utils.encode_cell(cell_address);
        if (!ws[cell_ref]) continue;

        const cell = ws[cell_ref];
        cell.s = {
          font: { name: 'Calibri', sz: 11 },
          alignment: { vertical: 'center', horizontal: 'left' },
          border: {
            top: { style: 'thin', color: { rgb: "E2E8F0" } },
            bottom: { style: 'thin', color: { rgb: "E2E8F0" } },
            left: { style: 'thin', color: { rgb: "E2E8F0" } },
            right: { style: 'thin', color: { rgb: "E2E8F0" } }
          }
        };

        if (R === 0) {
          cell.s.font = { bold: true, color: { rgb: "FFFFFF" } };
          cell.s.fill = { fgColor: { rgb: "2563EB" } };
          cell.s.alignment = { vertical: 'center', horizontal: 'center' };
        } else {
          if (R % 2 === 0) {
            cell.s.fill = { fgColor: { rgb: "F8FAFC" } };
          }
        }
      }
    }

    const colWidths = [
      { wch: 22 }, // Solvent Name
      { wch: 14 }, // Cost ($/kg)
      { wch: 18 }, // Boiling Point
      { wch: 18 }, // Melting Point
      { wch: 16 }, // Flash Point
      { wch: 12 }, // ICH Class
      { wch: 12 }, // EHS Score
      { wch: 20 }, // Dielectric Constant
      { wch: 15 }, // Polarity Index
      { wch: 16 }, // Polarity
      { wch: 22 }, // Water Miscibility
    ];
    ws['!cols'] = colWidths;
    ws['!rows'] = [{ hpt: 26 }];

    utils.book_append_sheet(wb, ws, 'Solvents');
    writeFile(wb, 'Common_Solvents.xlsx');
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(solvents, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "solvents_inventory.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const valid = imported.every(s => s && typeof s.name === 'string');
          if (valid) {
            // Enrich with missing parameters automatically on import
            const { enriched } = enrichSolventsList(imported);
            setSolvents(enriched);
            localStorage.setItem('hplc-solvents', JSON.stringify(enriched));
            setFeedbackMessage(`Loaded ${enriched.length} lab solvents successfully`);
            setTimeout(() => setFeedbackMessage(null), 3500);
          } else {
            alert("The uploaded file does not contain a valid solvents list.");
          }
        } else {
          alert("The uploaded JSON must be an array of solvents.");
        }
      } catch (err) {
        alert("Invalid JSON file");
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:justify-between lg:items-start">
          <div className="flex flex-col">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Droplet size={20} className="text-blue-500" />
              Lab Solvents Inventory
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Active laboratory solvents inventory. All physical parameters, safety profiles, dielectric constants, and miscibility data are maintained here.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {feedbackMessage && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg animate-fade-in shadow-xs">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
              <button
                onClick={handleSaveAsStandard}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-blue-700 hover:bg-white px-2.5 py-1 rounded transition-colors"
                title="Save the current solvent list as the software standard"
              >
                <BookmarkCheck size={14} className="text-blue-600" />
                <span>Save as Standard</span>
              </button>
              <div className="w-px h-4 bg-slate-300"></div>
              <button
                onClick={handleResetToStandard}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-white px-2 py-1 rounded transition-colors"
                title="Reset lab solvents inventory to the software standard"
              >
                <RotateCcw size={13} />
                <span>Reset to Standard</span>
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1 rounded-lg">
              <label 
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded transition-colors cursor-pointer"
                title="Import Solvents from JSON"
              >
                <Upload size={14} />
                Import
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={handleImportJSON} 
                  ref={fileInputRef}
                  className="hidden" 
                />
              </label>
              <div className="w-px h-4 bg-slate-300"></div>
              
              <div className="flex items-center gap-1.5 px-2">
                <span className="text-xs text-slate-500 font-medium">ICH:</span>
                <select
                  value={filterIchClass || ''}
                  onChange={(e) => setFilterIchClass(e.target.value ? Number(e.target.value) : null)}
                  className="text-xs border border-slate-300 rounded px-1 py-1 text-slate-700 bg-white"
                >
                  <option value="">All</option>
                  <option value="1">Class 1</option>
                  <option value="2">Class 2</option>
                  <option value="3">Class 3</option>
                </select>
              </div>
              <div className="flex items-center gap-1.5 px-2">
                <span className="text-xs text-slate-500 font-medium">EHS &gt;=:</span>
                <select
                  value={minEhsScore || ''}
                  onChange={(e) => setMinEhsScore(e.target.value ? Number(e.target.value) : null)}
                  className="text-xs border border-slate-300 rounded px-1 py-1 text-slate-700 bg-white"
                >
                  <option value="">Any</option>
                  <option value="5">5</option>
                  <option value="8">8 (Green)</option>
                </select>
              </div>

              <div className="w-px h-4 bg-slate-300"></div>
              <button 
                onClick={handleExportJSON}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded transition-colors"
                title="Export Solvents to JSON"
              >
                <FileJson size={14} />
                JSON
              </button>
              <div className="w-px h-4 bg-slate-300"></div>
              <button 
                onClick={handleExport}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 px-2 py-1 rounded transition-colors"
                title="Export Solvents to Excel"
              >
                <FileSpreadsheet size={14} />
                Excel
              </button>
            </div>
            
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                isEditing 
                  ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100' 
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
              }`}
            >
              {isEditing ? (
                <>
                  <Check size={14} />
                  Done
                </>
              ) : (
                <>
                  <Edit2 size={14} />
                  Edit
                </>
              )}
            </button>
            <button 
              onClick={addSolvent}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md transition-colors"
            >
              <Plus size={14} />
              Add Solvent
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-600 uppercase tracking-wider">
                <th 
                  className="py-2.5 px-3 font-medium cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Solvent Name
                    <ArrowUpDown size={14} className={`text-slate-400 group-hover:text-slate-600 ${sortField === 'name' ? 'text-blue-500' : ''}`} />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-medium normal-case tracking-normal">Cost ($/kg)</th>
                <th className="py-2.5 px-3 font-medium">Boiling Point (°C)</th>
                <th className="py-2.5 px-3 font-medium">Melting Point (°C)</th>
                <th className="py-2.5 px-3 font-medium">Flash Point (°C)</th>
                <th className="py-2.5 px-3 font-medium">ICH Class</th>
                <th className="py-2.5 px-3 font-medium">EHS Score</th>
                <th 
                  className="py-2.5 px-3 font-medium cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSort('dielectricConstant')}
                >
                  <div className="flex items-center gap-1">
                    Dielectric Constant
                    <ArrowUpDown size={14} className={`text-slate-400 group-hover:text-slate-600 ${sortField === 'dielectricConstant' ? 'text-blue-500' : ''}`} />
                  </div>
                </th>
                <th className="py-2.5 px-3 font-medium">Polarity Index</th>
                <th 
                  className="py-2.5 px-3 font-medium cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSort('polarityProfile')}
                >
                  <div className="flex items-center gap-1">
                    Polarity
                    <ArrowUpDown size={14} className={`text-slate-400 group-hover:text-slate-600 ${sortField === 'polarityProfile' ? 'text-blue-500' : ''}`} />
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 font-medium cursor-pointer hover:bg-slate-50 transition-colors group"
                  onClick={() => handleSort('waterMiscibility')}
                >
                  <div className="flex items-center gap-1">
                    Water Miscibility
                    <ArrowUpDown size={14} className={`text-slate-400 group-hover:text-slate-600 ${sortField === 'waterMiscibility' ? 'text-blue-500' : ''}`} />
                  </div>
                </th>
                {isEditing && <th className="py-2.5 px-3 font-medium w-24 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSolvents.map((solvent) => {
                const isNonFlammable = solvent.name === 'Water' || solvent.name === 'Dichloromethane' || solvent.name === 'Chloroform' || solvent.name === 'Carbon tetrachloride';
                
                return (
                  <tr key={solvent.id} className="text-sm hover:bg-slate-50/50">
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input 
                            type="text" 
                            value={solvent.name}
                            onChange={(e) => updateSolvent(solvent.id, 'name', e.target.value)}
                            className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="e.g. Methanol"
                          />
                        </div>
                      ) : (
                        <span className="font-medium text-slate-800">{solvent.name}</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="relative flex items-center">
                          <span className="absolute left-2 text-xs text-slate-400">$</span>
                          <input 
                            type="number" 
                            step="any"
                            min="0"
                            value={solvent.costPerKg ?? ''}
                            onChange={(e) => updateSolvent(solvent.id, 'costPerKg', e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-24 pl-5 border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="0.00"
                          />
                        </div>
                      ) : (
                        <span className={solvent.costPerKg !== '' && solvent.costPerKg !== undefined ? "font-medium text-slate-700" : "text-slate-300 italic"}>
                          {solvent.costPerKg !== '' && solvent.costPerKg !== undefined ? `$${Number(solvent.costPerKg).toFixed(2)}` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input 
                          type="number" 
                          step="any"
                          value={solvent.boilingPoint}
                          onChange={(e) => updateSolvent(solvent.id, 'boilingPoint', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="e.g. 64.7"
                        />
                      ) : (
                        <span className={solvent.boilingPoint !== '' && solvent.boilingPoint !== undefined ? "text-slate-700" : "text-slate-300 italic"}>
                          {solvent.boilingPoint !== '' && solvent.boilingPoint !== undefined ? solvent.boilingPoint : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input 
                          type="number" 
                          step="any"
                          value={solvent.meltingPoint}
                          onChange={(e) => updateSolvent(solvent.id, 'meltingPoint', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="e.g. -97.6"
                        />
                      ) : (
                        <span className={solvent.meltingPoint !== '' && solvent.meltingPoint !== undefined ? "text-slate-700" : "text-slate-300 italic"}>
                          {solvent.meltingPoint !== '' && solvent.meltingPoint !== undefined ? solvent.meltingPoint : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input 
                          type="number" 
                          step="any"
                          value={solvent.flashPoint || ''}
                          onChange={(e) => updateSolvent(solvent.id, 'flashPoint', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder={isNonFlammable ? "None" : "e.g. 11"}
                        />
                      ) : (
                        <span className="text-slate-700">
                          {solvent.flashPoint !== '' && solvent.flashPoint !== undefined 
                            ? solvent.flashPoint 
                            : isNonFlammable ? <span className="text-slate-400 text-xs italic">None</span> : <span className="text-slate-300 italic">-</span>
                          }
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <select
                          value={solvent.ichClass || ''}
                          onChange={(e) => updateSolvent(solvent.id, 'ichClass', e.target.value ? Number(e.target.value) : '')}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          <option value="">-</option>
                          <option value="1">1 (Avoid)</option>
                          <option value="2">2 (Limit)</option>
                          <option value="3">3 (Low toxic)</option>
                        </select>
                      ) : (
                        <span className="text-slate-700 font-medium">
                          {solvent.ichClass ? `Class ${solvent.ichClass}` : <span className="text-slate-300 italic font-normal">-</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input 
                          type="number" 
                          min="1" max="10"
                          value={solvent.ehsScore || ''}
                          onChange={(e) => updateSolvent(solvent.id, 'ehsScore', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="1-10"
                        />
                      ) : (
                        <span className={`font-medium ${(Number(solvent.ehsScore)||0) >= 8 ? 'text-emerald-600' : (Number(solvent.ehsScore)||0) >= 5 ? 'text-amber-600' : Number(solvent.ehsScore) > 0 ? 'text-rose-600' : 'text-slate-300 italic font-normal'}`}>
                          {solvent.ehsScore || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input 
                          type="number" 
                          min="0"
                          step="any"
                          value={solvent.dielectricConstant}
                          onChange={(e) => updateSolvent(solvent.id, 'dielectricConstant', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="e.g. 33.0"
                        />
                      ) : (
                        <span className={solvent.dielectricConstant !== '' && solvent.dielectricConstant !== undefined ? "text-slate-800 font-medium" : "text-slate-300 italic font-normal"}>
                          {solvent.dielectricConstant !== '' && solvent.dielectricConstant !== undefined ? solvent.dielectricConstant : '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <input 
                          type="number" 
                          step="0.1"
                          value={solvent.polarityIndex || ''}
                          onChange={(e) => updateSolvent(solvent.id, 'polarityIndex', e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          placeholder="e.g. 5.1"
                        />
                      ) : (
                        <span className={solvent.polarityIndex !== '' && solvent.polarityIndex !== undefined ? "text-slate-700" : "text-slate-300 italic font-normal"}>
                          {solvent.polarityIndex || '-'}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <select
                          value={solvent.polarityProfile || ''}
                          onChange={(e) => updateSolvent(solvent.id, 'polarityProfile', e.target.value as any)}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                          <option value="">Unknown</option>
                          <option value="Polar Aprotic">Polar Aprotic</option>
                          <option value="Polar Protic">Polar Protic</option>
                          <option value="Nonpolar">Nonpolar</option>
                        </select>
                      ) : (
                        <span className="text-slate-700 whitespace-nowrap">
                          {solvent.polarityProfile || <span className="text-slate-300 italic">-</span>}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={solvent.waterMiscibility || ''}
                            onChange={(e) => updateSolvent(solvent.id, 'waterMiscibility', e.target.value as any)}
                            className="border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none flex-1"
                          >
                            <option value="">Unknown</option>
                            <option value="Fully">Fully</option>
                            <option value="Partially">Partially</option>
                            <option value="Immiscible">Immiscible</option>
                          </select>
                          {solvent.waterMiscibility === 'Partially' && (
                            <div className="flex items-center gap-1 w-24">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={solvent.miscibilityPercentage === undefined ? '' : solvent.miscibilityPercentage}
                                onChange={(e) => updateSolvent(solvent.id, 'miscibilityPercentage', e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full border border-slate-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="%"
                              />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {solvent.waterMiscibility === 'Fully' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                              Fully
                            </span>
                          )}
                          {solvent.waterMiscibility === 'Partially' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                              Partially {solvent.miscibilityPercentage ? `(~${solvent.miscibilityPercentage}%)` : ''}
                            </span>
                          )}
                          {solvent.waterMiscibility === 'Immiscible' && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
                              Immiscible
                            </span>
                          )}
                          {!solvent.waterMiscibility && (
                            <span className="text-slate-300 text-xs italic">-</span>
                          )}
                        </div>
                      )}
                    </td>
                    {isEditing && (
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleAutoFillSingleRow(solvent.id)}
                            className="text-slate-400 hover:text-blue-600 p-1 transition-colors"
                            title="Auto-fill missing parameters for this solvent from reference database"
                          >
                            <Wand2 size={15} />
                          </button>
                          <button 
                            onClick={() => removeSolvent(solvent.id)}
                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                            title="Remove solvent"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {solvents.length === 0 && (
            <div className="text-center py-6 text-slate-500 text-sm">
              No solvents added yet. Click "Add Solvent" or "Import" to load your lab inventory.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
