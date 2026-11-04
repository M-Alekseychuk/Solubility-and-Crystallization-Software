import { exportToInteractiveHTML } from './src/utils/htmlExport';
global.URL.createObjectURL = () => "mock_url";
global.document = { createElement: () => ({ click: () => {} }) } as any;
exportToInteractiveHTML({
  experimentName: "Test", calibrationData: [], calibrationResult: { slope: 1, intercept: 0, rSquared: 1, valid: true }, samples: [],
  activePredictionModel: { modelName: '2D Polynomial Regression', stats: { r2: 1, rmse: 0 }, beta: [1, 2] }
}).then(() => console.log("Success")).catch(e => console.error(e));
