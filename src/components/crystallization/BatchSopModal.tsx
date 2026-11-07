import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Copy,
  Check,
  X,
  ShieldCheck,
  AlertTriangle,
  Beaker,
  Scale,
  Clock,
  Layers,
  Thermometer
} from 'lucide-react';
import { SopDocument, generateScheduleCsv, ScheduleSummary } from '../../utils/crystallization';

interface BatchSopModalProps {
  isOpen: boolean;
  onClose: () => void;
  sop: SopDocument;
  scheduleSummary: ScheduleSummary;
}

export const BatchSopModal: React.FC<BatchSopModalProps> = ({
  isOpen,
  onClose,
  sop,
  scheduleSummary
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const csvContent = generateScheduleCsv(scheduleSummary, sop.apiName);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${sop.docId}_Schedule.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    const md = `# STANDARD OPERATING PROCEDURE (SOP)
## ${sop.recipeName}
**Document ID:** ${sop.docId} | **Date:** ${sop.generatedDate} | **Target API:** ${sop.apiName}
**Batch Scale:** ${sop.apiBatchMassG} g API | **Target Yield:** ${sop.expectedDryYieldG} g (${sop.expectedYieldPct.toFixed(1)}%)
**Process Mass Intensity (PMI):** ${sop.pmi} | **Total Cycle Time:** ${sop.cycleTimeHours} hours

---

### 1. EQUIPMENT REQUIREMENTS
- Minimum Reactor Size: ${sop.equipmentRequirements.recommendedVesselSizeMl} mL jacketed vessel
- Agitation: ${sop.equipmentRequirements.recommendedAgitationRpm}
- Temperature Range: ${sop.equipmentRequirements.temperatureRange}
- Metering Pump: ${sop.equipmentRequirements.dosingPumpCapability}
- Filter: ${sop.equipmentRequirements.recommendedFilterDiameterMm} mm diameter Nutsche / Büchner

---

### 2. BILL OF MATERIALS (BOM)
${sop.billOfMaterials.map(b => `- **${b.item}** (${b.role}): ${b.amount} [${b.purityGrade}] — ${b.notes || ''}`).join('\n')}

---

### 3. CRITICAL PROCESS PARAMETERS (CPPs)
${sop.criticalProcessParameters.map(c => `- **${c.parameter}**: Target = ${c.targetValue} (Tolerance: ${c.operatingRange}) [${c.criticality}]`).join('\n')}

---

### 4. CHRONOLOGICAL EXECUTION PROCEDURE
${sop.steps.map(s => `#### Step ${s.stepNumber}: ${s.title} (${s.stage})
- **Instruction:** ${s.instruction}
- **Critical Check:** ${s.criticalCheck}
- **Duration:** ${s.durationMin || '—'} min
- [ ] Operator Initial: _______  Date/Time: _______
`).join('\n')}
`;

    navigator.clipboard.writeText(md).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Container */}
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Top Modal Bar (Excluded from print) */}
        <div className="print:hidden flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-600 rounded-lg">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                Batch Crystallization Recipe & SOP Protocol
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {sop.docId}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Copy formatted Markdown for Electronic Lab Notebooks (ELN)"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              <span>{copied ? 'Copied to ELN!' : 'Copy ELN'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Export discretized setpoints to CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">CSV Schedule</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Printer size={14} />
              <span>Print SOP</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors ml-1"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Document Body */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 font-sans print:p-0 print:m-0 print:overflow-visible">
          {/* Official Document Header */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-4">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] tracking-widest font-bold text-indigo-600 dark:text-indigo-400 uppercase">
                  PHARMACEUTICAL PROCESS DEVELOPMENT • BATCH RECORD
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
                  {sop.recipeName}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Standard Operating Procedure for Laboratory, Kilo-Lab & Pilot Plant Crystallization
                </p>
              </div>
              <div className="text-right font-mono text-xs text-slate-500">
                <div className="font-bold text-slate-800 dark:text-slate-200">{sop.docId}</div>
                <div>Issued: {sop.generatedDate}</div>
                <div>Status: APPROVED FOR TRIAL</div>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">API Charge</span>
                <strong className="text-sm">{sop.apiBatchMassG} g</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Target Dry Yield</span>
                <strong className="text-sm text-emerald-600 dark:text-emerald-400">
                  {sop.expectedDryYieldG} g ({sop.expectedYieldPct}%)
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Process Mass Intensity</span>
                <strong className="text-sm text-indigo-600 dark:text-indigo-400">{sop.pmi}</strong> (E: {sop.eFactor})
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Total Cycle Time</span>
                <strong className="text-sm">{sop.cycleTimeHours} hours</strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Batch Mode</span>
                <strong className="text-sm uppercase">{sop.taskType}</strong>
              </div>
            </div>
          </div>

          {/* Section 1: Equipment Requirements */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-1">
              1. Equipment & Facility Specifications
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-500 block">Jacketed Reactor Volume:</span>
                <strong>&ge; {sop.equipmentRequirements.recommendedVesselSizeMl} mL</strong> with baffle & bottom harvest valve
              </div>
              <div>
                <span className="text-slate-500 block">Impeller & Agitation:</span>
                <strong>{sop.equipmentRequirements.recommendedAgitationRpm}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Temperature Range:</span>
                <strong>{sop.equipmentRequirements.temperatureRange}</strong> with programmed chiller/heater
              </div>
              <div>
                <span className="text-slate-500 block">Anti-Solvent Dosing Pump:</span>
                <strong>{sop.equipmentRequirements.dosingPumpCapability}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 block">Filtration Apparatus:</span>
                <strong>{sop.equipmentRequirements.recommendedFilterDiameterMm} mm diameter Nutsche or Büchner filter</strong> with 5–10 μm PTFE or polypropylene cloth
              </div>
            </div>
          </div>

          {/* Section 2: Bill of Materials (BOM) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-1">
              2. Bill of Materials (BOM) & Charging Table
            </h3>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Material / Component</th>
                    <th className="p-2.5">Function</th>
                    <th className="p-2.5">Specified Charge</th>
                    <th className="p-2.5">Grade / Specs</th>
                    <th className="p-2.5">Actual Charged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sop.billOfMaterials.map((m, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-bold">{m.item}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{m.role}</td>
                      <td className="p-2.5 font-semibold text-indigo-700 dark:text-indigo-400">{m.amount}</td>
                      <td className="p-2.5 text-slate-500">{m.purityGrade}</td>
                      <td className="p-2.5 border-l border-slate-200 dark:border-slate-700 font-mono text-slate-400">
                        [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Critical Process Parameters (CPPs) */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-1">
              3. Critical Process Parameters (CPPs) & Control Limits
            </h3>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="p-2.5">Parameter</th>
                    <th className="p-2.5">Target Value</th>
                    <th className="p-2.5">Permissible Operating Range</th>
                    <th className="p-2.5">Classification</th>
                    <th className="p-2.5">Observed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {sop.criticalProcessParameters.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 font-medium">{c.parameter}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">{c.targetValue}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{c.operatingRange}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            c.criticality === 'Critical (CPP)'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300'
                          }`}
                        >
                          {c.criticality}
                        </span>
                      </td>
                      <td className="p-2.5 border-l border-slate-200 dark:border-slate-700 font-mono text-slate-400">
                        [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Chronological Step-by-Step Procedure */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-1">
              4. Chronological Step-by-Step Operating Instructions
            </h3>

            <div className="space-y-3">
              {sop.steps.map(step => (
                <div
                  key={step.stepNumber}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 space-y-2 text-xs shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 dark:border-slate-700/60 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                        {step.stepNumber}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {step.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-medium">
                        Stage: {step.stage}
                      </span>
                      {step.durationMin && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> ~{step.durationMin} min
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed pt-0.5">
                    {step.instruction}
                  </p>

                  {/* Setpoints strip if available */}
                  {(step.setpoints.tempC !== undefined || step.setpoints.coolingRate || step.setpoints.flowRate) && (
                    <div className="flex flex-wrap gap-2 text-[11px] bg-slate-50 dark:bg-slate-900/60 p-2 rounded-lg border border-slate-100 dark:border-slate-800 font-mono">
                      {step.setpoints.tempC !== undefined && (
                        <span>Temp Setpoint: <strong>{step.setpoints.tempC} °C</strong></span>
                      )}
                      {step.setpoints.coolingRate && (
                        <span> | Cooling: <strong>{step.setpoints.coolingRate}</strong></span>
                      )}
                      {step.setpoints.flowRate && (
                        <span> | Pump: <strong>{step.setpoints.flowRate}</strong></span>
                      )}
                      {step.setpoints.volumeMl && (
                        <span> | Volume: <strong>{step.setpoints.volumeMl} mL</strong></span>
                      )}
                    </div>
                  )}

                  {/* Critical in-process check */}
                  <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400 bg-amber-50/50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-200/50 dark:border-amber-800/30 text-[11px]">
                    <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
                    <span><strong>In-Process Control Check:</strong> {step.criticalCheck}</span>
                  </div>

                  {/* Sign-off Field */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-500 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" className="rounded border-slate-300 cursor-pointer" />
                      <span>Action verified & completed</span>
                    </div>
                    <div className="flex items-center gap-4 font-mono">
                      <span>Operator Initials: [ ________ ]</span>
                      <span>Time: [ ________ ]</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Batch Yield Reconciliation & Sign-off */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-1">
              5. Final Yield Reconciliation & Quality Sign-Off
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Mass Reconciliation:</span>
                <div className="flex justify-between">
                  <span>Gross Wet Cake:</span>
                  <span className="font-mono">[ ________ ] g</span>
                </div>
                <div className="flex justify-between">
                  <span>Net Dry Cake Mass:</span>
                  <span className="font-mono">[ ________ ] g (Target: {sop.expectedDryYieldG} g)</span>
                </div>
                <div className="flex justify-between">
                  <span>Isolated Yield (%):</span>
                  <span className="font-mono">[ ________ ] % (Target: {sop.expectedYieldPct}%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Moisture / LOD (%):</span>
                  <span className="font-mono">[ ________ ] % (Limit: &le; 0.5%)</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block">Approvals & Signatures:</span>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Lead Process Chemist:</span>
                  <span className="font-mono border-b border-slate-400 w-36 text-center pb-0.5">[ Sign & Date ]</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span>Quality Assurance / Reviewer:</span>
                  <span className="font-mono border-b border-slate-400 w-36 text-center pb-0.5">[ Sign & Date ]</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
