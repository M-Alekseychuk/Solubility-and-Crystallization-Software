import React, { useState, useRef, useEffect } from 'react';
import { Download, Edit, Save, FileText, Upload, BookOpen, AlertCircle, CheckCircle } from 'lucide-react';
import { GuideStep, GuideAlert } from '../types';
import { generateId } from '../utils';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

const defaultSteps: GuideStep[] = [
  {
    "id": "3kih9bs",
    "title": "Preparing Calibration Standards",
    "content": "Weigh roughly 25 mg of your clean, dry sample (use analytical balance and note the precise mass of sample) into a 25 mL volumetric flask. Fill the flask to the 25 mL mark with 3:1 MeCN/water. This should give you a roughly 1 mg/mL solution of your sample. Take 1 mL of this solution into an HPLC vial as the first calibration point.",
    "alerts": [
      {
        "id": "3yko6in",
        "text": "It's not important to weigh in exactly 25.00 mg, but it is crucial to note the exact amount weight in. To avoid losses by transfer please weigh your substance straight into the volumetric flask. Also, make sure that all your substance is dissolved and you have a clear solution!",
        "type": "tip"
      }
    ]
  },
  {
    "id": "llmj38t",
    "title": "Diluting of Calibration Standards",
    "content": "Take 2 x 1 mL of the previous solution with a positive displacement pipette and put them in a 10 mL volumetric flask and a 50 mL volumetric flask and fill them to the mark. Take 1 mL of each solution as a second and a third calibration point (10x dilution [0.1 mg/mL] and 50x dilution [0.02 mg/mL]).",
    "alerts": [
      {
        "id": "e2bsrnr",
        "text": "Use positive displacement pipette for most accurate results.",
        "type": "tip"
      }
    ]
  },
  {
    "id": "itllj7f",
    "title": "Measuring the Calibration Curve",
    "content": "On the HPLC, chose a method where a good separation of the sample from any known impurities can be observed. Run an equilibration of the column, followed by two blank measurement, followed by the three previously prepared calibration standards. ",
    "alerts": []
  },
  {
    "id": "6zqgdp3",
    "title": "Analysis",
    "content": "First do baseline subtraction of the three measured calibration standards with the second blank sample. Then integrate the sample peak at your desired wavelenght, and fill in the absorbance values (mAU) into the program, together with the exact mass you measured before. The calibration curve should appear and the table in the “Calculate Sample” tab should work as intended for all future quantitative HPLC measurements.",
    "alerts": [
      {
        "id": "9gjlvvp",
        "text": "The table is only valid for measurements at the same wavelength as were the absorbance values (mAU) for the calibration curve have been taken from. E.g. if the calibration curve has been established for 210 nm, analyse your samples only at 210 nm",
        "type": "warning"
      }
    ]
  },
  {
    "id": "a0sb8sg",
    "title": "Measuring solubility of compounds in various solvents",
    "content": "Measure roughly 50 mg of your compound into HPLC vials (1 vial per solvent you want to investigate). Add 1 mL of the respective solvent using a positive displacement pipette, then stir the mixture at 25 °C for a few hours. \nUse the centrifuge to settle any suspensions you have and transfer a defined amount (e.g. 20 µL) of your solution into an empty HPLC vial using a positive displacement pipette. Dilute the sample with 980 µL of 3:1 MeCN/water or pure MeCN. \nMeasure the sample on the HPLC using the same method the calibration was run in (run blank before for most accurate results). Note the absorbance values and the sample volume into the table.\nRepeat this process at 50 °C and 80 °C (adjust temperatures if above the boiling point of a measured solvent)",
    "alerts": [
      {
        "id": "1xvau30",
        "text": "Using positive displacement pipetts for sample preparation gives best acuracy",
        "type": "tip"
      },
      {
        "id": "jqh9tin",
        "text": "Stirring samples for >1 h ensures full saturation of the solution",
        "type": "info"
      },
      {
        "id": "gcnd0d1",
        "text": "An alternative to using the centrifuge, is taking 0.5 mL of the solution, transferring it to a filter vial, filtration, and then taking 20 µL of the filtered solution. This approach gives better results for hot solutions (reduced handling time) which can cool down in the centrifuge, but also requires multiple samples in the same solvent for different temperatures, as the sample isn’t usable anymore afterwards.",
        "type": "info"
      }
    ]
  }
];

export function GuideTab() {
  const [steps, setSteps] = useState<GuideStep[]>(() => {
    const saved = localStorage.getItem('hplc-guide-steps');
    return saved ? JSON.parse(saved) : defaultSteps;
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editedSteps, setEditedSteps] = useState<GuideStep[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('hplc-guide-steps', JSON.stringify(steps));
  }, [steps]);

  const handleEdit = () => {
    setEditedSteps([...steps]);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    setSteps(editedSteps);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const updateEditedStep = (id: string, field: keyof GuideStep, value: string) => {
    setEditedSteps(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addAlert = (stepId: string) => {
    setEditedSteps(prev => prev.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          alerts: [...(s.alerts || []), { id: generateId(), text: '', type: 'info' }]
        };
      }
      return s;
    }));
  };

  const updateAlert = (stepId: string, alertId: string, field: keyof GuideAlert, value: string) => {
    setEditedSteps(prev => prev.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          alerts: (s.alerts || []).map(a => a.id === alertId ? { ...a, [field]: value } : a)
        };
      }
      return s;
    }));
  };

  const removeAlert = (stepId: string, alertId: string) => {
    setEditedSteps(prev => prev.map(s => {
      if (s.id === stepId) {
        return {
          ...s,
          alerts: (s.alerts || []).filter(a => a.id !== alertId)
        };
      }
      return s;
    }));
  };

  const addStep = () => {
    setEditedSteps([
      ...editedSteps,
      {
        id: generateId(),
        title: 'New Step',
        content: 'Description here...',
        alerts: []
      }
    ]);
  };

  const removeStep = (id: string) => {
    setEditedSteps(editedSteps.filter(s => s.id !== id));
  };

  const handleWordExport = () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Step-by-Step Guide", bold: true, size: 32 })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Follow these guidelines to ensure metrological traceability and measurement uncertainty < 1%." })
            ]
          }),
          new Paragraph({ text: "" }),
          ...steps.flatMap((step, index) => {
            const pars = [
              new Paragraph({
                children: [
                  new TextRun({ text: `${index + 1}. ${step.title}`, bold: true, size: 24 })
                ]
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: step.content })
                ]
              })
            ];
            
            if (step.alerts && step.alerts.length > 0) {
              step.alerts.forEach(alert => {
                pars.push(
                  new Paragraph({
                    children: [
                      new TextRun({ text: `Note (${alert.type}): ${alert.text}`, italics: true })
                    ]
                  })
                );
              });
            }
            
            pars.push(new Paragraph({ text: "" }));
            return pars;
          })
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, "HPLC_Solubility_Calculator_Step-by-Step-Guide.docx");
    });
  };

  const handleSaveJson = () => {
    const blob = new Blob([JSON.stringify(steps, null, 2)], { type: 'application/json' });
    saveAs(blob, 'HPLC_Solubility_Calculator_guide-steps.json');
  };

  const handleLoadJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const loadedSteps = JSON.parse(evt.target?.result as string);
        if (Array.isArray(loadedSteps)) {
          setSteps(loadedSteps);
        }
      } catch (err) {
        alert('Failed to load JSON file.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm" ref={contentRef}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <BookOpen className="text-blue-600" size={28} />
            Step-by-Step Guide
          </h2>
          <p className="text-slate-500 mt-2 text-sm max-w-lg">
            Follow these guidelines to ensure metrological traceability and measurement uncertainty {'<'} 1%.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <input type="file" accept=".json" className="hidden" ref={fileInputRef} onChange={handleLoadJson} />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
          >
            <Upload size={16} /> Load
          </button>
          
          <button 
            onClick={handleSaveJson}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
          >
            <Save size={16} /> Save
          </button>
          
          <button 
            onClick={handleWordExport}
            className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
          >
            <FileText size={16} /> Word
          </button>
          
          {!isEditing ? (
            <button 
              onClick={handleEdit}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
            >
              <Edit size={16} /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button 
                onClick={handleCancelEdit}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {(isEditing ? editedSteps : steps).map((step, index) => (
          <div key={step.id} className="relative border border-slate-200 rounded-xl p-6 bg-white shadow-sm flex gap-6 group">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                {index + 1}
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Title</label>
                    <input 
                      type="text"
                      value={step.title}
                      onChange={(e) => updateEditedStep(step.id, 'title', e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Content</label>
                    <textarea 
                      value={step.content}
                      onChange={(e) => updateEditedStep(step.id, 'content', e.target.value)}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-500">Alerts (Tips/Warnings)</label>
                      <button 
                        onClick={() => addAlert(step.id)}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        + Add Alert
                      </button>
                    </div>
                    
                    {(step.alerts || []).map((alert) => (
                      <div key={alert.id} className="flex gap-4 items-start relative group">
                        <div className="flex-1">
                          <input 
                            type="text"
                            value={alert.text}
                            onChange={(e) => updateAlert(step.id, alert.id, 'text', e.target.value)}
                            placeholder="Alert text..."
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="w-40">
                          <select
                            value={alert.type}
                            onChange={(e) => updateAlert(step.id, alert.id, 'type', e.target.value as any)}
                            className="w-full border border-slate-300 rounded-md px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="warning">Warning</option>
                            <option value="tip">Tip</option>
                            <option value="info">Info</option>
                          </select>
                        </div>
                        <button 
                          onClick={() => removeAlert(step.id, alert.id)}
                          className="mt-2 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove Alert"
                        >
                          <AlertCircle size={18} className="rotate-45" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-slate-800 mb-3">{step.title}</h3>
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    {step.content}
                  </p>
                  
                  {step.alerts && step.alerts.length > 0 && (
                    <div className="space-y-3">
                      {step.alerts.map(alert => (
                        <div key={alert.id} className={`flex items-start gap-3 p-4 rounded-lg border ${
                          alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                          alert.type === 'tip' ? 'bg-green-50 border-green-200 text-green-900' :
                          'bg-blue-50 border-blue-200 text-blue-900'
                        }`}>
                          {alert.type === 'warning' ? <AlertCircle className="text-amber-600 mt-0.5 flex-shrink-0" size={18} /> :
                           alert.type === 'tip' ? <CheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={18} /> :
                           <AlertCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={18} />}
                          <span className="text-sm font-medium">{alert.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            
            {isEditing && (
              <button 
                onClick={() => removeStep(step.id)}
                className="absolute top-4 right-4 text-slate-400 hover:text-red-600 transition-colors"
                title="Remove Step"
              >
                <AlertCircle size={20} className="rotate-45" />
              </button>
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <button 
          onClick={addStep}
          className="mt-6 w-full py-4 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
        >
          <span className="text-lg">+</span> Add Step
        </button>
      )}
    </div>
  );
}
