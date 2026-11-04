const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  `              ) : activeTab === 'prediction' ? (
                <PredictionTab key={activeExperiment!.id} experimentId={activeExperiment!.id} samples={activeExperiment!.samples} calibrationResult={calibrationResult} onActiveModelChange={setActivePredictionModel} />
              ) : (
                <GuideTab />
              )}`,
  `              ) : activeTab === 'prediction' ? (
                <PredictionTab key={activeExperiment!.id} experimentId={activeExperiment!.id} samples={activeExperiment!.samples} calibrationResult={calibrationResult} onActiveModelChange={setActivePredictionModel} />
              ) : activeTab === 'crystallization' ? (
                <CrystallizationTab activeExperiment={activeExperiment!} predictionContext={activePredictionModel} />
              ) : (
                <GuideTab />
              )}`
);

fs.writeFileSync('src/App.tsx', code);
