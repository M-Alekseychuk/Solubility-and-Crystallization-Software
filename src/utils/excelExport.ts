import saveAs from 'file-saver';
import JSZip from 'jszip';
import { CalibrationPoint, SampleData, CalibrationResult } from '../types';
import { roundTo, getExportFileName } from '../utils';
import { calculateReactionConcentration, getValidCalibrationPoints } from './calculations';
import { CHART_TEMPLATE_BASE64 } from './chartTemplateBase64';

declare global {
  interface Window {
    XlsxPopulate: any;
  }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(base64, 'base64');
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getTemplateArrayBuffer(): Promise<ArrayBuffer> {
  // 1. Primary & rock-solid: Embedded Base64 template.
  // This is completely self-contained, 100% offline, and immune to Electron file:/// protocol restrictions.
  if (CHART_TEMPLATE_BASE64 && typeof CHART_TEMPLATE_BASE64 === 'string' && CHART_TEMPLATE_BASE64.length > 100) {
    try {
      const buffer = base64ToArrayBuffer(CHART_TEMPLATE_BASE64);
      if (buffer && buffer.byteLength > 1000) {
        return buffer;
      }
    } catch (err) {
      console.warn('Could not decode embedded template base64, falling back:', err);
    }
  }

  // 2. Fetch fallback with relative and base paths
  const urlsToTry = [
    './chart_template.xlsx',
    'chart_template.xlsx',
    '/chart_template.xlsx',
    (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : './') + 'chart_template.xlsx'
  ];

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch {
      // Continue to next URL
    }
  }

  // 3. Electron Node.js filesystem fallback
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const fs = (window as any).require('fs');
      const path = (window as any).require('path');
      const possiblePaths = [
        path.join(process.cwd(), 'chart_template.xlsx'),
        path.join(process.cwd(), 'public', 'chart_template.xlsx'),
        path.join(process.cwd(), 'dist', 'chart_template.xlsx')
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const fBuf = fs.readFileSync(p);
          return fBuf.buffer.slice(fBuf.byteOffset, fBuf.byteOffset + fBuf.byteLength);
        }
      }
    } catch {
      // Ignore
    }
  }

  throw new Error('Could not load chart_template.xlsx from embedded data or filesystem.');
}

async function getXlsxPopulate(): Promise<any> {
  if (typeof window !== 'undefined' && window.XlsxPopulate) {
    return window.XlsxPopulate;
  }

  // Electron Node require if available
  if (typeof window !== 'undefined' && (window as any).require) {
    try {
      const xp = (window as any).require('xlsx-populate');
      if (xp) return xp;
    } catch {
      // Ignore
    }
  }

  // Try dynamic script injection with relative paths
  if (typeof document !== 'undefined') {
    const scripts = ['./xlsx-populate.min.js', 'xlsx-populate.min.js', '/xlsx-populate.min.js'];
    for (const src of scripts) {
      try {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = src;
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
        if (typeof window !== 'undefined' && window.XlsxPopulate) {
          return window.XlsxPopulate;
        }
      } catch {
        // Try next
      }
    }
  }

  return typeof window !== 'undefined' ? window.XlsxPopulate : null;
}

function downloadExcelBlob(blob: Blob, filename: string): void {
  try {
    saveAs(blob, filename);
  } catch (err) {
    console.warn('saveAs failed, using anchor download fallback:', err);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }
}

export function generateCalibrationChartImage(
  points: CalibrationPoint[],
  result: CalibrationResult,
  wavelength?: string,
  hplcUsed?: string
): string | null {
  if (typeof document === 'undefined') return null;
  const validPts = getValidCalibrationPoints(points);
  if (!result.valid || validPts.length < 2) return null;

  const width = 1200;
  const height = 675;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  const padLeft = 120, padRight = 60, padTop = 60, padBottom = 95;
  const plotX = padLeft, plotY = padTop, plotW = width - padLeft - padRight, plotH = height - padTop - padBottom;

  const maxDataX = Math.max(...validPts.map(p => p.x));
  const maxX = maxDataX > 0 ? maxDataX * 1.15 : 1;
  const minX = 0;

  const maxDataY = Math.max(...validPts.map(p => p.y), result.slope * maxX + result.intercept);
  const maxY = maxDataY > 0 ? maxDataY * 1.15 : 1000;
  const minY = 0;

  const getCanvasX = (xVal: number) => plotX + ((xVal - minX) / (maxX - minX)) * plotW;
  const getCanvasY = (yVal: number) => plotY + plotH - ((yVal - minY) / (maxY - minY)) * plotH;

  const yTickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= yTickCount; i++) yTicks.push((maxY / yTickCount) * i);

  const xTickCount = 4;
  const xTicks: number[] = [];
  for (let i = 0; i <= xTickCount; i++) xTicks.push((maxX / xTickCount) * i);

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.2;
  yTicks.forEach(val => {
    const yPos = getCanvasY(val);
    ctx.beginPath(); ctx.moveTo(plotX, yPos); ctx.lineTo(plotX + plotW, yPos); ctx.stroke();
  });
  xTicks.forEach(val => {
    const xPos = getCanvasX(val);
    ctx.beginPath(); ctx.moveTo(xPos, plotY); ctx.lineTo(xPos, plotY + plotH); ctx.stroke();
  });
  ctx.restore();

  ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 2; ctx.beginPath();
  ctx.moveTo(plotX, plotY); ctx.lineTo(plotX, plotY + plotH);
  ctx.lineTo(plotX + plotW, plotY + plotH); ctx.stroke();

  ctx.fillStyle = '#64748b'; ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  yTicks.forEach(val => {
    const yPos = getCanvasY(val);
    ctx.beginPath(); ctx.moveTo(plotX - 6, yPos); ctx.lineTo(plotX, yPos); ctx.stroke();
    ctx.fillText(Math.round(val).toString(), plotX - 12, yPos);
  });

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  xTicks.forEach(val => {
    const xPos = getCanvasX(val);
    ctx.beginPath(); ctx.moveTo(xPos, plotY + plotH); ctx.lineTo(xPos, plotY + plotH + 6); ctx.stroke();
    ctx.fillText(String(Number(val.toFixed(3))), xPos, plotY + plotH + 12);
  });

  ctx.fillStyle = '#334155'; ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillText('Concentration in mg/mL', plotX + plotW / 2, height - 20);

  ctx.save(); ctx.translate(35, plotY + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#334155'; ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Absorbtion in mAU', 0, 0); ctx.restore();

  ctx.save(); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(getCanvasX(0), getCanvasY(result.intercept));
  ctx.lineTo(getCanvasX(maxX), getCanvasY(result.slope * maxX + result.intercept));
  ctx.stroke(); ctx.restore();

  validPts.forEach(pt => {
    const cx = getCanvasX(pt.x), cy = getCanvasY(pt.y);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#3b82f6'; ctx.fill();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  });

  const badgeW = 270, badgeH = 75, badgeX = plotX + plotW - badgeW - 15, badgeY = plotY + 15;
  ctx.save(); ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'; ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5;
  ctx.beginPath(); const r = 8;
  ctx.moveTo(badgeX + r, badgeY); ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
  ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
  ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r); ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  ctx.fillStyle = '#0f172a'; ctx.font = '600 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText(`y = ${roundTo(result.slope, 4)}x ${result.intercept >= 0 ? '+' : '-'} ${Math.abs(roundTo(result.intercept, 4))}`, badgeX + 16, badgeY + 14);

  ctx.fillStyle = '#2563eb'; ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`R² = ${roundTo(result.rSquared, 5)}`, badgeX + 16, badgeY + 36);

  if (wavelength || hplcUsed) {
    ctx.fillStyle = '#64748b'; ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const metaParts = [];
    if (wavelength) metaParts.push(`λ: ${wavelength} nm`);
    if (hplcUsed) metaParts.push(`${hplcUsed}`);
    ctx.fillText(metaParts.join(' | '), badgeX + 16, badgeY + 54);
  }
  ctx.restore();
  return canvas.toDataURL('image/png');
}

export async function exportProjectToExcelFallback(
  calibrationPoints: CalibrationPoint[],
  samples: SampleData[],
  calibrationResult: CalibrationResult,
  wavelength?: string,
  hplcUsed?: string,
  experimentName?: string
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default || (await import('exceljs'));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'HPLC Solubility Calculator';
  workbook.created = new Date();

  // Sheet 1: Calibration
  const sheet1 = workbook.addWorksheet('Calibration');
  sheet1.views = [{ showGridLines: true }];

  // Column headers
  const hRow1 = sheet1.addRow(['ID', 'Mass (mg)', 'Solvent Vol (mL)', 'Concentration (mg/mL)', 'UV Area']);
  hRow1.height = 24;
  hRow1.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium' } };
  });

  for (let i = 0; i < 5; i++) {
    const pt = i < calibrationPoints.length ? calibrationPoints[i] : null;
    if (pt) {
      const mass = pt.massMg !== '' ? Number(String(pt.massMg).replace(',', '.')) : null;
      const vol = pt.volMl !== '' ? Number(String(pt.volMl).replace(',', '.')) : null;
      const conc = mass !== null && vol !== null && vol > 0 ? roundTo(mass / vol, 4) : null;
      const area = pt.area !== '' ? Number(String(pt.area).replace(',', '.')) : null;

      const row = sheet1.addRow([`Measurement ${i + 1}`, mass, vol, conc, area]);
      row.height = 20;
      row.font = { name: 'Calibri', size: 11 };
      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      for (let c = 2; c <= 5; c++) {
        row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    } else {
      const row = sheet1.addRow(['', '', '', '', '']);
      row.height = 20;
    }
  }

  // Row 7: Spacer
  sheet1.addRow([]);

  // Row 8: Regression Results header
  const regH = sheet1.addRow(['Regression Results', '']);
  regH.height = 22;
  regH.getCell(1).font = { name: 'Calibri', size: 11, bold: true };

  const eqStr = calibrationResult.valid 
    ? `y = ${roundTo(calibrationResult.slope, 4)}x ${calibrationResult.intercept >= 0 ? '+' : '-'} ${Math.abs(roundTo(calibrationResult.intercept, 4))}`
    : '-';

  const regFields: [string, any][] = [
    ['Equation:', eqStr],
    ['Slope (m):', calibrationResult.valid ? calibrationResult.slope : '-'],
    ['Intercept (c):', calibrationResult.valid ? calibrationResult.intercept : '-'],
    ['R Squared (R²):', calibrationResult.valid ? calibrationResult.rSquared : '-'],
    ['Wavelength (nm):', wavelength || 'Not specified'],
    ['HPLC Used:', hplcUsed || 'Not specified']
  ];

  regFields.forEach(([label, val]) => {
    const r = sheet1.addRow([label, val]);
    r.height = 20;
    r.getCell(1).font = { name: 'Calibri', size: 11, bold: true };
    r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    r.getCell(2).font = { name: 'Calibri', size: 11 };
    r.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
  });

  sheet1.getColumn(1).width = 22;
  sheet1.getColumn(2).width = 18;
  sheet1.getColumn(3).width = 20;
  sheet1.getColumn(4).width = 26;
  sheet1.getColumn(5).width = 16;

  // Add native chart image to sheet 1
  try {
    const chartImgBase64 = generateCalibrationChartImage(calibrationPoints, calibrationResult, wavelength, hplcUsed);
    if (chartImgBase64) {
      const imageId = workbook.addImage({
        base64: chartImgBase64,
        extension: 'png'
      });
      sheet1.addImage(imageId, {
        tl: { col: 6, row: 1 },
        ext: { width: 550, height: 320 }
      });
    }
  } catch (imgErr) {
    console.warn('Could not attach chart image in fallback Excel:', imgErr);
  }

  // Sheet 2: Samples
  const sheet2 = workbook.addWorksheet('Samples');
  sheet2.views = [{ showGridLines: true }];

  const sHeaders = [
    'Sample Name',
    'Solvent 1',
    'Solvent 2',
    'Solv 1 (%)',
    'Temp (°C)',
    'UV Area',
    'Sampling Vol. (µL)',
    'Added Solvent (mL)',
    'Reaction Conc. (mg/mL)'
  ];
  const hRow2 = sheet2.addRow(sHeaders);
  hRow2.height = 24;
  hRow2.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium' } };
  });

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const s1Frac = s.solvent1Fraction !== '' ? Number(String(s.solvent1Fraction).replace(',', '.')) : null;
    const temp = s.temperature !== '' ? Number(String(s.temperature).replace(',', '.')) : null;
    const area = s.area !== '' ? Number(String(s.area).replace(',', '.')) : null;
    const volTaken = s.volumeTakenUl !== '' ? Number(String(s.volumeTakenUl).replace(',', '.')) : null;
    const addSolv = s.addedSolventMl !== '' ? Number(String(s.addedSolventMl).replace(',', '.')) : null;
    const rawReactionConc = calculateReactionConcentration(s.area, s.volumeTakenUl, s.addedSolventMl, calibrationResult);
    const conc = rawReactionConc !== null ? roundTo(rawReactionConc, 4) : null;

    const row = sheet2.addRow([
      s.name || '',
      s.solvent1 || '',
      s.solvent2 || '---',
      s1Frac,
      temp,
      area,
      volTaken,
      addSolv,
      conc
    ]);
    row.height = 20;
    row.font = { name: 'Calibri', size: 11 };
    for (let c = 1; c <= 9; c++) {
      row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
    }
  }

  sheet2.getColumn(1).width = 16;
  sheet2.getColumn(2).width = 16;
  sheet2.getColumn(3).width = 16;
  sheet2.getColumn(4).width = 14;
  sheet2.getColumn(5).width = 14;
  sheet2.getColumn(6).width = 14;
  sheet2.getColumn(7).width = 20;
  sheet2.getColumn(8).width = 20;
  sheet2.getColumn(9).width = 25;

  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadExcelBlob(blob, getExportFileName(experimentName, 'xlsx'));
}

export async function exportProjectToExcel(
  calibrationPoints: CalibrationPoint[],
  samples: SampleData[],
  calibrationResult: CalibrationResult,
  wavelength?: string,
  hplcUsed?: string,
  experimentName?: string
): Promise<void> {
  try {
    const XlsxPopulate = await getXlsxPopulate();
    if (!XlsxPopulate) {
      console.warn("XlsxPopulate library not available, using high-fidelity fallback export.");
      await exportProjectToExcelFallback(calibrationPoints, samples, calibrationResult, wavelength, hplcUsed, experimentName);
      return;
    }

    const arrayBuffer = await getTemplateArrayBuffer();

    // Dynamically adjust chart range to exact count of valid points (max 5)
    const validPts = getValidCalibrationPoints(calibrationPoints);
    const ptCount = Math.min(5, Math.max(2, validPts.length));

    const zip = await JSZip.loadAsync(arrayBuffer);
    let chartXml = await zip.file('xl/charts/chart1.xml')?.async('text');
    if (chartXml) {
      chartXml = chartXml.replace(/<c:f>Calibration!\$D\$2:\$D\$\d+<\/c:f>/g, `<c:f>Calibration!$D$2:$D$${1 + ptCount}</c:f>`);
      chartXml = chartXml.replace(/<c:f>Calibration!\$E\$2:\$E\$\d+<\/c:f>/g, `<c:f>Calibration!$E$2:$E$${1 + ptCount}</c:f>`);
      chartXml = chartXml.replace(/<c:ptCount val="\d+"\/>/g, `<c:ptCount val="${ptCount}"/>`);
      zip.file('xl/charts/chart1.xml', chartXml);
    }
    const modifiedBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    const workbook = await XlsxPopulate.fromDataAsync(modifiedBuffer);
    
    // ==========================================
    // Sheet 1: Calibration
    // ==========================================
    const sheet1 = workbook.sheet('Calibration');
    
    // Header row (Row 1)
    const headers1 = ['ID', 'Mass (mg)', 'Solvent Vol (mL)', 'Concentration (mg/mL)', 'UV Area'];
    headers1.forEach((h, idx) => {
      const colLetter = String.fromCharCode(65 + idx);
      sheet1.cell(`${colLetter}1`).value(h).style({
        bold: true,
        fontSize: 11,
        fontFamily: 'Calibri',
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        bottomBorderStyle: 'thick'
      });
    });
    sheet1.row(1).height(24);

    // Calibration points rows (Rows 2 to 6, max 5 measurements)
    for (let i = 0; i < 5; i++) {
      const row = i + 2;
      sheet1.row(row).height(20);
      const pt = i < calibrationPoints.length ? calibrationPoints[i] : null;

      if (pt) {
        sheet1.cell(`A${row}`).value(`Measurement ${i + 1}`).style({
          fontFamily: 'Calibri',
          fontSize: 11,
          horizontalAlignment: 'left',
          verticalAlignment: 'center'
        });

        const mass = pt.massMg !== '' ? Number(String(pt.massMg).replace(',', '.')) : undefined;
        sheet1.cell(`B${row}`).value(mass).style({
          fontFamily: 'Calibri',
          fontSize: 11,
          horizontalAlignment: 'center',
          verticalAlignment: 'center'
        });

        const vol = pt.volMl !== '' ? Number(String(pt.volMl).replace(',', '.')) : undefined;
        sheet1.cell(`C${row}`).value(vol).style({
          fontFamily: 'Calibri',
          fontSize: 11,
          horizontalAlignment: 'center',
          verticalAlignment: 'center'
        });

        const conc = (mass !== undefined && vol !== undefined && vol > 0) ? mass / vol : undefined;
        sheet1.cell(`D${row}`).value(conc !== undefined ? roundTo(conc, 4) : undefined).style({
          fontFamily: 'Calibri',
          fontSize: 11,
          horizontalAlignment: 'center',
          verticalAlignment: 'center'
        });

        const area = pt.area !== '' ? Number(String(pt.area).replace(',', '.')) : undefined;
        sheet1.cell(`E${row}`).value(area).style({
          fontFamily: 'Calibri',
          fontSize: 11,
          horizontalAlignment: 'center',
          verticalAlignment: 'center'
        });
      } else {
        sheet1.cell(`A${row}`).value(undefined);
        sheet1.cell(`B${row}`).value(undefined);
        sheet1.cell(`C${row}`).value(undefined);
        sheet1.cell(`D${row}`).value(undefined);
        sheet1.cell(`E${row}`).value(undefined);
      }
    }

    // Row 7: Empty spacer row
    sheet1.row(7).height(16);
    sheet1.cell('A7').value(undefined);
    sheet1.cell('B7').value(undefined);

    // Row 8: Regression Results header
    sheet1.row(8).height(22);
    sheet1.cell('A8').value('Regression Results').style({
      bold: true,
      fontSize: 11,
      fontFamily: 'Calibri',
      horizontalAlignment: 'left',
      verticalAlignment: 'center'
    });
    sheet1.cell('B8').value(undefined);

    // Rows 9 to 14: Regression Results Data
    const eqStr = calibrationResult.valid 
      ? `y = ${roundTo(calibrationResult.slope, 4)}x ${calibrationResult.intercept >= 0 ? '+' : '-'} ${Math.abs(roundTo(calibrationResult.intercept, 4))}`
      : '-';

    const regFields: [string, any][] = [
      ['Equation:', eqStr],
      ['Slope (m):', calibrationResult.valid ? calibrationResult.slope : '-'],
      ['Intercept (c):', calibrationResult.valid ? calibrationResult.intercept : '-'],
      ['R Squared (R²):', calibrationResult.valid ? calibrationResult.rSquared : '-'],
      ['Wavelength (nm):', wavelength || 'Not specified'],
      ['HPLC Used:', hplcUsed || 'Not specified']
    ];

    regFields.forEach(([label, val], idx) => {
      const row = 9 + idx;
      sheet1.row(row).height(20);
      sheet1.cell(`A${row}`).value(label).style({
        bold: true,
        fontSize: 11,
        fontFamily: 'Calibri',
        horizontalAlignment: 'left',
        verticalAlignment: 'center'
      });
      sheet1.cell(`B${row}`).value(val).style({
        fontSize: 11,
        fontFamily: 'Calibri',
        horizontalAlignment: 'left',
        verticalAlignment: 'center'
      });
    });

    // Clear any residual cells below row 14
    for (let r = 15; r <= 60; r++) {
      sheet1.cell(`A${r}`).value(undefined);
      sheet1.cell(`B${r}`).value(undefined);
      sheet1.cell(`C${r}`).value(undefined);
      sheet1.cell(`D${r}`).value(undefined);
      sheet1.cell(`E${r}`).value(undefined);
    }

    // Set column widths for Sheet 1
    sheet1.column('A').width(22);
    sheet1.column('B').width(18);
    sheet1.column('C').width(20);
    sheet1.column('D').width(26);
    sheet1.column('E').width(16);
    sheet1.column('F').width(5); // Spacer column between table and graph
    // Columns G to P behind the graph
    for (let c = 7; c <= 16; c++) {
      const colLetter = String.fromCharCode(64 + c);
      sheet1.column(colLetter).width(9.5);
    }

    // ==========================================
    // Sheet 2: Samples
    // ==========================================
    const sheet2 = workbook.sheet('Samples');
    
    // Header row (Row 1)
    const sHeaders = [
      'Sample Name',
      'Solvent 1',
      'Solvent 2',
      'Solv 1 (%)',
      'Temp (°C)',
      'UV Area',
      'Sampling Vol. (µL)',
      'Added Solvent (mL)',
      'Reaction Conc. (mg/mL)'
    ];

    sHeaders.forEach((h, idx) => {
      const colLetter = String.fromCharCode(65 + idx);
      sheet2.cell(`${colLetter}1`).value(h).style({
        bold: true,
        fontSize: 11,
        fontFamily: 'Calibri',
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        bottomBorderStyle: 'thick'
      });
    });
    sheet2.row(1).height(24);

    // Column widths for Sheet 2 matching Screenshot 2
    sheet2.column('A').width(16);
    sheet2.column('B').width(16);
    sheet2.column('C').width(16);
    sheet2.column('D').width(14);
    sheet2.column('E').width(14);
    sheet2.column('F').width(14);
    sheet2.column('G').width(20);
    sheet2.column('H').width(20);
    sheet2.column('I').width(25);

    // Data rows
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const row = i + 2;
      sheet2.row(row).height(20);

      sheet2.cell(`A${row}`).value(s.name || undefined);
      sheet2.cell(`B${row}`).value(s.solvent1 || undefined);
      sheet2.cell(`C${row}`).value(s.solvent2 || '---');
      sheet2.cell(`D${row}`).value(s.solvent1Fraction !== '' ? Number(String(s.solvent1Fraction).replace(',', '.')) : undefined);
      sheet2.cell(`E${row}`).value(s.temperature !== '' ? Number(String(s.temperature).replace(',', '.')) : undefined);
      sheet2.cell(`F${row}`).value(s.area !== '' ? Number(String(s.area).replace(',', '.')) : undefined);
      sheet2.cell(`G${row}`).value(s.volumeTakenUl !== '' ? Number(String(s.volumeTakenUl).replace(',', '.')) : undefined);
      sheet2.cell(`H${row}`).value(s.addedSolventMl !== '' ? Number(String(s.addedSolventMl).replace(',', '.')) : undefined);

      const rawReactionConc = calculateReactionConcentration(s.area, s.volumeTakenUl, s.addedSolventMl, calibrationResult);
      sheet2.cell(`I${row}`).value(rawReactionConc !== null ? roundTo(rawReactionConc, 4) : undefined);

      // Center all cells in Samples table exactly as shown in Screenshot 2
      for (let col = 0; col < 9; col++) {
        const colLetter = String.fromCharCode(65 + col);
        sheet2.cell(`${colLetter}${row}`).style({
          fontFamily: 'Calibri',
          fontSize: 11,
          horizontalAlignment: 'center',
          verticalAlignment: 'center'
        });
      }
    }

    const output = await workbook.outputAsync();
    let blob: Blob;
    if (output instanceof Blob) {
      blob = output;
    } else if (typeof output === 'string') {
      const byteCharacters = atob(output);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      blob = new Blob([new Uint8Array(byteNumbers)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    } else {
      blob = new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }
    downloadExcelBlob(blob, getExportFileName(experimentName, 'xlsx'));
  } catch (err) {
    console.warn('Template-based Excel export encountered an issue, falling back to ExcelJS export:', err);
    try {
      await exportProjectToExcelFallback(calibrationPoints, samples, calibrationResult, wavelength, hplcUsed, experimentName);
    } catch (fallbackErr) {
      console.error('All Excel export methods failed:', fallbackErr);
      alert('Failed to export Excel file. Please check console for details.');
    }
  }
}

