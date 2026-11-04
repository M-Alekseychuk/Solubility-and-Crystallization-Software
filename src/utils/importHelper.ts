import XLSX from 'xlsx-js-style';
import { Experiment, CalibrationPoint, SampleData } from '../types';
import { generateId, calculateLinearRegression } from '../utils';

const defaultCalibrationPoints: CalibrationPoint[] = [
  { id: generateId(), massMg: 1.0, volMl: 1.0, area: '' },
  { id: generateId(), massMg: 0.1, volMl: 1.0, area: '' },
  { id: generateId(), massMg: 0.02, volMl: 1.0, area: '' },
];

function getFuzzy(obj: any, keys: string[]): any {
  const objKeys = Object.keys(obj);
  for (const k of objKeys) {
    const cleanK = k.toLowerCase().replace(/[^a-z0-9%]/g, '');
    for (const target of keys) {
      const cleanTarget = target.toLowerCase().replace(/[^a-z0-9%]/g, '');
      if (cleanK === cleanTarget) {
        return obj[k];
      }
    }
  }
  return undefined;
}

function normalizeNumber(val: any): any {
  if (typeof val === 'string') {
    return val.replace(/,/g, '.');
  }
  return val;
}

function sanitizeCalibrationData(rawPoints: any[]): CalibrationPoint[] {
  if (!Array.isArray(rawPoints) || rawPoints.length === 0) {
    return defaultCalibrationPoints.map(p => ({ ...p, id: generateId() }));
  }
  return rawPoints.map(p => ({
    id: generateId(),
    massMg: normalizeNumber(p.massMg !== undefined ? p.massMg : (getFuzzy(p, ['Mass (mg)', 'Mass']) ?? '')),
    volMl: normalizeNumber(p.volMl !== undefined ? p.volMl : (getFuzzy(p, ['Solvent Vol (mL)', 'Solvent Vol']) ?? '')),
    area: normalizeNumber(p.area !== undefined ? p.area : (getFuzzy(p, ['UV Area', 'Area']) ?? ''))
  }));
}

export function sanitizeSamples(rawSamples: any[]): SampleData[] {
  if (!Array.isArray(rawSamples)) return [];
  return rawSamples.map(s => ({
    id: generateId(),
    name: s.name !== undefined ? s.name : (getFuzzy(s, ['Sample Name', 'Name', 'Sample Na']) || 'Sample'),
    area: normalizeNumber(s.area !== undefined ? s.area : (getFuzzy(s, ['UV Area', 'Area']) ?? '')),
    volumeTakenUl: normalizeNumber(s.volumeTakenUl !== undefined ? s.volumeTakenUl : (getFuzzy(s, ['Sampling Vol. (µL)', 'Sampling Vol. (uL)', 'Sampling Vol (uL)', 'Reaction Vol Taken (uL)', 'Rxn Vol (µL)', 'Rxn Vol (uL)']) ?? '')),
    addedSolventMl: normalizeNumber(s.addedSolventMl !== undefined ? s.addedSolventMl : (getFuzzy(s, ['Added Solvent (mL)', 'Added Solv (mL)', 'diluted with (mL)']) ?? '')),
    solvent1: s.solvent1 !== undefined ? s.solvent1 : (getFuzzy(s, ['Solvent 1', 'Solv 1']) || ''),
    solvent2: s.solvent2 !== undefined ? s.solvent2 : (getFuzzy(s, ['Solvent 2', 'Solv 2']) || ''),
    solvent1Fraction: normalizeNumber(s.solvent1Fraction !== undefined ? s.solvent1Fraction : (getFuzzy(s, ['Solv 1 (%)', 'Solvent 1 (%)', 'S1 (%)']) ?? '')),
    temperature: normalizeNumber(s.temperature !== undefined ? s.temperature : (getFuzzy(s, ['Temp (°C)', 'Temp', 'Temperature']) ?? ''))
  }));
}

function computeResult(calPoints: CalibrationPoint[]) {
  const validPoints = calPoints
    .filter(p => {
      const vol = Number(String(p.volMl).replace(',', '.'));
      return p.massMg !== '' && p.volMl !== '' && p.area !== '' && !isNaN(vol) && vol > 0;
    })
    .map(p => ({
      x: Number(String(p.massMg).replace(',', '.')) / Number(String(p.volMl).replace(',', '.')),
      y: Number(String(p.area).replace(',', '.'))
    }));

  return calculateLinearRegression(validPoints);
}

export async function parseExperimentFiles(files: FileList | File[]): Promise<Experiment[]> {
  const importedExperiments: Experiment[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = file.name;
    const ext = fileName.slice(((fileName.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();

    try {
      if (ext === 'json') {
        const text = await file.text();
        const json = JSON.parse(text);

        const expList = Array.isArray(json) ? json : [json];

        for (const item of expList) {
          // Check if item is valid experiment JSON structure or exported project
          const rawCal = item.calibrationData || item.calibrationPoints || [];
          const rawSamples = item.samples || [];
          const calPoints = sanitizeCalibrationData(rawCal);
          const samples = sanitizeSamples(rawSamples);
          const calResult = computeResult(calPoints);

          const baseName = item.name || fileName.replace(/\.json$/i, '');

          importedExperiments.push({
            id: generateId(),
            name: baseName,
            createdAt: item.createdAt && typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
            updatedAt: Date.now(),
            wavelength: item.wavelength || '210',
            calibrationData: calPoints,
            samples: samples,
            calibrationResult: calResult
          });
        }
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });

        let calPoints: CalibrationPoint[] = [];
        let samples: SampleData[] = [];

        // Check for Calibration sheet
        const calSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('calibration')) || wb.SheetNames[0];
        if (calSheetName && wb.Sheets[calSheetName]) {
          const calData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[calSheetName]);
          if (calData.length > 0) {
            calPoints = sanitizeCalibrationData(calData);
          }
        }

        // Check for Samples sheet
        const sampleSheetName = wb.SheetNames.find(s => s.toLowerCase().includes('sample'));
        if (sampleSheetName && wb.Sheets[sampleSheetName]) {
          const sampleData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sampleSheetName]);
          if (sampleData.length > 0) {
            samples = sanitizeSamples(sampleData);
          }
        } else if (wb.SheetNames.length > 1 && wb.SheetNames[1] !== calSheetName) {
          // Fallback to second sheet if available
          const sampleData: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[1]]);
          if (sampleData.length > 0) {
            samples = sanitizeSamples(sampleData);
          }
        }

        if (calPoints.length === 0) {
          calPoints = defaultCalibrationPoints.map(p => ({ ...p, id: generateId() }));
        }

        const calResult = computeResult(calPoints);
        const baseName = fileName.replace(/\.(xlsx|xls|csv)$/i, '');

        importedExperiments.push({
          id: generateId(),
          name: baseName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          wavelength: '210',
          calibrationData: calPoints,
          samples: samples,
          calibrationResult: calResult
        });
      }
    } catch (err) {
      console.error(`Failed to parse file ${fileName}:`, err);
    }
  }

  return importedExperiments;
}
