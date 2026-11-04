import { exportToInteractiveHTML } from './src/utils/htmlExport';
// Mock URL.createObjectURL
global.URL.createObjectURL = () => "mock_url";
global.URL.revokeObjectURL = () => {};
global.document = {
  createElement: () => ({ click: () => {} })
} as any;

exportToInteractiveHTML({
  experimentName: "Test",
  calibrationData: [{ id: '1', massMg: 10, volMl: 10, area: 100 }],
  calibrationResult: { slope: 1, intercept: 0, rSquared: 1, valid: true },
  samples: [],
  activePredictionModel: {
    modelName: 'Linear',
    stats: { r2: 1, rmse: 0 },
    beta: [1, 2]
  }
}).then(() => console.log("Success")).catch(e => console.error("Error:", e));
