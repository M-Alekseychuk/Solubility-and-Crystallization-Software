import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalibrationPoint, CalibrationResult, SampleData } from '../types';
import { roundTo, getExportFileName } from '../utils';
import logoImg from '../assets/Logo.png';
import { calculateReactionConcentration, getValidCalibrationPoints } from './calculations';

interface ExportPDFParams {
  experimentName: string;
  calibrationData: CalibrationPoint[];
  calibrationResult: CalibrationResult;
  samples: SampleData[];
  wavelength: string;
  hplcUsed: string;
}

export const exportToPDF = async ({
  experimentName,
  calibrationData,
  calibrationResult,
  samples,
  wavelength,
  hplcUsed
}: ExportPDFParams) => {
  const doc = new jsPDF('p', 'pt', 'a4');

  // Load logo as base64 (custom logo if uploaded, otherwise default OPCP logo)
  const customLogo = typeof window !== 'undefined' ? localStorage.getItem('hplc-custom-logo') : null;
  const img = new Image();
  img.src = customLogo || logoImg;
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve; // Continue even if logo fails
  });

  // Header
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`HPLC Solubility Report - ${experimentName}`, 40, 50);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .replace(/ /g, '. ');
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  doc.text(`Generated on: ${dateStr}, ${timeStr}`, 40, 65);

  // Logo
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      doc.addImage(dataUrl, 'PNG', 450, 20, 100, 40);
    }
  } catch (e) {
    console.error("Failed to add logo to PDF", e);
  }

  doc.setTextColor(0);
  
  // Section 1
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Calibration Curve', 40, 100);

  // Calibration Table
  const calibBody = calibrationData.map((p, i) => [
    `Meas. ${i + 1}`,
    p.massMg,
    p.volMl,
    (Number(p.massMg) / Number(p.volMl)).toFixed(3),
    p.area
  ]);

  autoTable(doc, {
    startY: 110,
    head: [['', 'ID Mass (mg)', 'Solvent Vol (mL)', 'Concentration (mg/mL)', 'UV Area (mAU)']],
    body: calibBody,
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.5, lineColor: [0, 0, 0], fontStyle: 'bold' },
    bodyStyles: { textColor: [0, 0, 0], lineWidth: 0.5, lineColor: [0, 0, 0] },
    margin: { left: 40 },
    columnStyles: {
      0: { fontStyle: 'normal' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 30;

  // Regression Results
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Regression Results', 40, finalY);

  doc.setFontSize(10);
  let textY = finalY + 20;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Equation: ', 40, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(`y = ${roundTo(calibrationResult.slope)}x ${calibrationResult.intercept >= 0 ? '+' : '-'} ${Math.abs(roundTo(calibrationResult.intercept))}`, 100, textY);
  
  textY += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Slope: ', 40, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${roundTo(calibrationResult.slope)}`, 80, textY);
  
  textY += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Intercept: ', 40, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${roundTo(calibrationResult.intercept)}`, 95, textY);
  
  textY += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('R Squared (R²): ', 40, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${roundTo(calibrationResult.rSquared, 5)}`, 130, textY);
  
  textY += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Wavelength: ', 40, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${wavelength || 'Not specified'}`, 115, textY);
  
  textY += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('HPLC Used: ', 40, textY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${hplcUsed || 'Not specified'}`, 110, textY);

  // Render chart natively with canvas for maximum reliability
  try {
    const validDataPoints = getValidCalibrationPoints(calibrationData);

    if (validDataPoints.length > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = 700;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const padTop = 20;
        const padRight = 30;
        const padBottom = 50;
        const padLeft = 70;
        
        const plotWidth = canvas.width - padLeft - padRight;
        const plotHeight = canvas.height - padTop - padBottom;
        
        let minX = 0;
        let maxX = Math.max(...validDataPoints.map(d => d.x));
        if (maxX === 0) maxX = 1;
        maxX *= 1.1;
        
        let minY = 0;
        let maxY = Math.max(...validDataPoints.map(d => d.y));
        if (calibrationResult.valid) {
          maxY = Math.max(maxY, calibrationResult.slope * maxX + calibrationResult.intercept);
        }
        if (maxY <= 0) maxY = 1;
        maxY *= 1.1;

        // Draw grid
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) {
          const yPos = canvas.height - padBottom - (i / 5) * plotHeight;
          ctx.moveTo(padLeft, yPos);
          ctx.lineTo(padLeft + plotWidth, yPos);
        }
        for (let i = 0; i <= 5; i++) {
          const xPos = padLeft + (i / 5) * plotWidth;
          ctx.moveTo(xPos, padTop);
          ctx.lineTo(xPos, canvas.height - padBottom);
        }
        ctx.stroke();

        // Draw axes
        ctx.strokeStyle = '#666666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padLeft, padTop);
        ctx.lineTo(padLeft, canvas.height - padBottom);
        ctx.lineTo(canvas.width - padRight, canvas.height - padBottom);
        ctx.stroke();

        // X and Y tick labels
        ctx.fillStyle = '#666666';
        ctx.font = '14px helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i <= 5; i++) {
          const xVal = minX + (maxX - minX) * (i / 5);
          const xPos = padLeft + (i / 5) * plotWidth;
          ctx.fillText(xVal.toFixed(2), xPos, canvas.height - padBottom + 10);
        }

        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let i = 0; i <= 5; i++) {
          const yVal = minY + (maxY - minY) * (i / 5);
          const yPos = canvas.height - padBottom - (i / 5) * plotHeight;
          ctx.fillText(Math.round(yVal).toString(), padLeft - 10, yPos);
        }

        // Axes titles
        ctx.fillStyle = '#333333';
        ctx.font = '18px helvetica, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Concentration in mg/ml', padLeft + plotWidth / 2, canvas.height - 25);
        
        ctx.save();
        ctx.translate(20, padTop + plotHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textBaseline = 'bottom';
        ctx.fillText('Absorbtion in mAU', 0, 0);
        ctx.restore();

        // Draw trendline
        if (calibrationResult.valid) {
          const y1 = calibrationResult.slope * minX + calibrationResult.intercept;
          const y2 = calibrationResult.slope * maxX + calibrationResult.intercept;
          
          const x1Pos = padLeft;
          const y1Pos = canvas.height - padBottom - ((y1 - minY) / (maxY - minY)) * plotHeight;
          const x2Pos = padLeft + plotWidth;
          const y2Pos = canvas.height - padBottom - ((y2 - minY) / (maxY - minY)) * plotHeight;
          
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x1Pos, y1Pos);
          ctx.lineTo(x2Pos, y2Pos);
          ctx.stroke();
        }

        // Draw points
        for (const p of validDataPoints) {
          const xPos = padLeft + ((p.x - minX) / (maxX - minX)) * plotWidth;
          const yPos = canvas.height - padBottom - ((p.y - minY) / (maxY - minY)) * plotHeight;
          
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(xPos, yPos, 5, 0, Math.PI * 2);
          ctx.fill();
        }

        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 200, finalY - 20, 350, 180);
      }
    }
  } catch (e) {
    console.error("Failed to capture native canvas chart", e);
  }

  // Section 2
  const nextSectionY = Math.max(textY + 40, finalY + 180);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Solubility Calculations', 40, nextSectionY);

  const sampleBody = samples.map(s => {
    const rawReactionConc = calculateReactionConcentration(s.area, s.volumeTakenUl, s.addedSolventMl, calibrationResult);
    const reactionConcStr = rawReactionConc !== null ? Number(rawReactionConc).toFixed(4) : '-';
    
    return [
      s.name,
      s.solvent1,
      s.solvent2,
      s.solvent1Fraction,
      s.temperature,
      s.area,
      s.volumeTakenUl,
      s.addedSolventMl,
      s.excluded ? '-' : reactionConcStr
    ];
  });

  autoTable(doc, {
    startY: nextSectionY + 10,
    head: [['Sample Name', 'Solvent 1', 'Solvent 2', 'Solv 1 (%)', 'Temp (°C)', 'UV Area', 'Samp. Vol (µL)', 'Added Solv (mL)', 'React Conc (mg/mL)']],
    body: sampleBody,
    theme: 'grid',
    headStyles: { fillColor: [99, 148, 203], textColor: [255, 255, 255], lineWidth: 0.1, lineColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { textColor: [100, 100, 100], fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: 40, right: 40 }
  });

  doc.save(getExportFileName(experimentName, 'pdf'));
};
