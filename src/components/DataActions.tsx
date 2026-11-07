import React, { useRef, useState, useMemo } from 'react';
import { Download, Upload, FileJson, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { CalibrationPoint, SampleData, CalibrationResult } from '../types';
import { roundTo, getExportFileName } from '../utils';
import { exportProjectToExcel } from '../utils/excelExport';
import { exportToInteractiveHTML } from '../utils/htmlExport';
import { FileCode } from 'lucide-react';

interface DataActionsProps {
  calibrationPoints: CalibrationPoint[];
  setCalibrationPoints: React.Dispatch<React.SetStateAction<CalibrationPoint[]>>;
  samples: SampleData[];
  setSamples: React.Dispatch<React.SetStateAction<SampleData[]>>;
  calibrationResult: CalibrationResult;
  wavelength?: string;
  hplcUsed?: string;
  experimentName?: string;
  activePredictionModel?: any;
  forceZero?: boolean;
}

export function DataActions({ calibrationPoints, setCalibrationPoints, samples, setSamples, calibrationResult, wavelength, hplcUsed, experimentName, activePredictionModel, forceZero }: DataActionsProps) {
  const [exportOpen, setExportOpen] = useState(false);

  const handleExportProject = () => {
    const data = {
      calibrationPoints,
      samples,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFileName(experimentName, 'json');
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const handleExportExcel = async () => {
    try {
      await exportProjectToExcel(calibrationPoints, samples, calibrationResult, wavelength, hplcUsed, experimentName);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
    } finally {
      setExportOpen(false);
    }
  };

  const handleExportHTMLAction = async () => {
    try {
      await exportToInteractiveHTML({
        experimentName: experimentName || 'Untitled',
        calibrationData: calibrationPoints,
        calibrationResult,
        samples,
        wavelength: wavelength || '',
        hplcUsed: hplcUsed || '',
        activePredictionModel,
        forceZero
      });
    } catch (err) {
      console.error('Error exporting HTML:', err);
    } finally {
      setExportOpen(false);
    }
  };


  return (
    <div className="flex gap-2 relative">
      <div className="relative">
        <button 
          onClick={() => { setExportOpen(!exportOpen); }}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-slate-800 px-3 py-1.5 rounded-md transition-colors text-sm font-medium backdrop-blur-sm"
        >
          <Download size={16} />
          Export
          <ChevronDown size={14} />
        </button>

        {exportOpen && (
          <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 shadow-lg rounded-md py-1 z-20">
            <button onClick={handleExportHTMLAction} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
              <FileCode size={16} className="text-purple-500" /> Interactive HTML (.html)
            </button>
            <button onClick={handleExportProject} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
              <FileJson size={16} className="text-blue-500" /> Project File (.json)
            </button>
            <button onClick={handleExportExcel} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 text-left">
              <FileSpreadsheet size={16} className="text-green-600" /> Excel (.xlsx)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

