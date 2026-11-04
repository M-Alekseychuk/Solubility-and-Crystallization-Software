const fs = require('fs');
let content = fs.readFileSync('src/utils/htmlExport.ts', 'utf8');

const funcStart = 'function calculatePrediction() {';
const funcEnd = 'function drawPredictionPlot(fixedT, fixedF, modelName, beta) {';

const cleanFunctions = `function calculatePrediction() {
            if (!activePredictionModel) return;
            const tStr = document.getElementById('predTemp').value;
            const fStr = document.getElementById('predFrac').value;
            const T = tStr ? parseFloat(tStr) : 25;
            const f = (fStr ? parseFloat(fStr) : 50) / 100;
            
            let features = [];
            let isLog = false;
            const modelName = activePredictionModel.modelName;
            
            if (modelName.includes('Linear') && !modelName.includes('Mixing') && !modelName.includes('2D')) {
                features = [1, T];
            } else if (modelName.includes('Quadratic Polynomial') && !modelName.includes('2D')) {
                features = [1, T, T*T];
            } else if (modelName === "Van't Hoff") {
                features = [1, 1/(T+273.15)];
                isLog = true;
            } else if (modelName.includes('Modified Apelblat') && !modelName.includes('Jouyban')) {
                features = [1, 1/(T+273.15), Math.log(T+273.15)];
                isLog = true;
            } else if (modelName.includes('Clarke-Glew')) {
                features = [1, 1/(T+273.15), Math.log(T+273.15), T+273.15];
                isLog = true;
            } else if (modelName === 'Linear Mixing') {
                features = [1, f];
            } else if (modelName === 'Quadratic Regression') {
                features = [1, f, f*f];
            } else if (modelName.includes('Yalkowsky') && !modelName.includes('Combined')) {
                features = [1, f];
                isLog = true;
            } else if (modelName === 'Jouyban-Acree' || modelName.includes('Jouyban-Acree (Simplified)')) {
                features = [1, f, f*(1-f), f*(1-f)*(2*f-1)];
                isLog = true;
            } else if (modelName.includes('Jouyban-Acree (Full)')) {
                features = [1, f, f*(1-f), f*(1-f)*(2*f-1), f*(1-f)*Math.pow(2*f-1, 2)];
                isLog = true;
            } else if (modelName.includes('Polynomial (4th)') || modelName === 'Polynomial Regression') {
                features = [1, f, f*f, Math.pow(f, 3), Math.pow(f, 4)];
            } else if (modelName.includes('Cubic Regression') || modelName.includes('Wohl')) {
                features = [1, f, f*f, Math.pow(f, 3)];
                if (modelName.includes('Wohl')) isLog = true;
            } else if (modelName.includes('2D Linear Regression')) {
                features = [1, f, T];
            } else if (modelName.includes('2D Quadratic Polynomial')) {
                features = [1, f, T, f*T, f*f, T*T];
            } else if (modelName.includes('2D Polynomial Regression')) {
                features = [1, f, T, f*f, T*T, f*T, Math.pow(f, 3), Math.pow(T, 3), f*f*T, f*T*T];
            } else if (modelName.includes("Van't Hoff + Yalkowsky Combined")) {
                features = [1, 1/(T+273.15), f, f/(T+273.15)];
                isLog = true;
            } else if (modelName.includes("Jouyban-Acree + Van't Hoff")) {
                features = [1, 1/(T+273.15), f, f/(T+273.15), f*(1-f)/(T+273.15), f*(1-f)*(2*f-1)/(T+273.15)];
                isLog = true;
            } else if (modelName.includes('Apelblat') && modelName.includes('Jouyban-Acree')) {
                features = [1, 1/(T+273.15), Math.log(T+273.15), f, f/(T+273.15), f*Math.log(T+273.15), f*(1-f)/(T+273.15), f*(1-f)*(2*f-1)/(T+273.15)];
                isLog = true;
            } else if (modelName.includes('Redlich-Kister')) {
                features = [1, f, f*(1-f), f*(1-f)*(2*f-1), f*(1-f)*Math.pow(2*f-1, 2)];
            } else {
                document.getElementById('predValue').textContent = "Model not fully supported in static HTML. (" + modelName + ")";
                document.getElementById('predValue').classList.add('text-amber-600', 'text-xl');
                document.getElementById('predResult').classList.remove('hidden');
                return;
            }
            
            let pred = 0;
            const beta = activePredictionModel.beta;
            for(let i=0; i<features.length; i++) {
                if (i < beta.length) pred += features[i] * beta[i];
            }
            if (isLog) pred = Math.exp(pred);
            
            document.getElementById('predValue').textContent = Math.max(0, pred).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
            document.getElementById('predValue').classList.remove('text-amber-600', 'text-xl');
            document.getElementById('predResult').classList.remove('hidden');
            
            drawPredictionPlot(T, f, modelName, beta);
        }

        function calculatePredFor(T, f, modelName, beta) {
            let features = [];
            let isLog = false;
            
            if (modelName.includes('Linear') && !modelName.includes('Mixing') && !modelName.includes('2D')) { features = [1, T]; }
            else if (modelName.includes('Quadratic Polynomial') && !modelName.includes('2D')) { features = [1, T, T*T]; }
            else if (modelName === "Van't Hoff") { features = [1, 1/(T+273.15)]; isLog = true; }
            else if (modelName.includes('Modified Apelblat') && !modelName.includes('Jouyban')) { features = [1, 1/(T+273.15), Math.log(T+273.15)]; isLog = true; }
            else if (modelName.includes('Clarke-Glew')) { features = [1, 1/(T+273.15), Math.log(T+273.15), T+273.15]; isLog = true; }
            else if (modelName === 'Linear Mixing') { features = [1, f]; }
            else if (modelName === 'Quadratic Regression') { features = [1, f, f*f]; }
            else if (modelName.includes('Yalkowsky') && !modelName.includes('Combined')) { features = [1, f]; isLog = true; }
            else if (modelName === 'Jouyban-Acree' || modelName.includes('Jouyban-Acree (Simplified)')) { features = [1, f, f*(1-f), f*(1-f)*(2*f-1)]; isLog = true; }
            else if (modelName.includes('Jouyban-Acree (Full)')) { features = [1, f, f*(1-f), f*(1-f)*(2*f-1), f*(1-f)*Math.pow(2*f-1, 2)]; isLog = true; }
            else if (modelName.includes('Polynomial (4th)') || modelName === 'Polynomial Regression') { features = [1, f, f*f, Math.pow(f, 3), Math.pow(f, 4)]; }
            else if (modelName.includes('Cubic Regression') || modelName.includes('Wohl')) { features = [1, f, f*f, Math.pow(f, 3)]; if (modelName.includes('Wohl')) isLog = true; }
            else if (modelName.includes('2D Linear Regression')) { features = [1, f, T]; }
            else if (modelName.includes('2D Quadratic Polynomial')) { features = [1, f, T, f*T, f*f, T*T]; }
            else if (modelName.includes('2D Polynomial Regression')) { features = [1, f, T, f*f, T*T, f*T, Math.pow(f, 3), Math.pow(T, 3), f*f*T, f*T*T]; }
            else if (modelName.includes("Van't Hoff + Yalkowsky Combined")) { features = [1, 1/(T+273.15), f, f/(T+273.15)]; isLog = true; }
            else if (modelName.includes("Jouyban-Acree + Van't Hoff")) { features = [1, 1/(T+273.15), f, f/(T+273.15), f*(1-f)/(T+273.15), f*(1-f)*(2*f-1)/(T+273.15)]; isLog = true; }
            else if (modelName.includes('Apelblat') && modelName.includes('Jouyban-Acree')) { features = [1, 1/(T+273.15), Math.log(T+273.15), f, f/(T+273.15), f*Math.log(T+273.15), f*(1-f)/(T+273.15), f*(1-f)*(2*f-1)/(T+273.15)]; isLog = true; }
            else if (modelName.includes('Redlich-Kister')) { features = [1, f, f*(1-f), f*(1-f)*(2*f-1), f*(1-f)*Math.pow(2*f-1, 2)]; }
            else { return null; }
            
            let pred = 0;
            for(let i=0; i<features.length; i++) {
                if (i < beta.length) pred += features[i] * beta[i];
            }
            if (isLog) pred = Math.exp(pred);
            return Math.max(0, pred);
        }

        function drawPredictionPlot(fixedT, fixedF, modelName, beta) {`;

const startIndex = content.indexOf(funcStart);
const endIndex = content.indexOf(funcEnd);

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + cleanFunctions + content.substring(endIndex + funcEnd.length);
    fs.writeFileSync('src/utils/htmlExport.ts', content);
    console.log("Functions safely replaced!");
} else {
    console.log("Could not find boundaries.");
}
