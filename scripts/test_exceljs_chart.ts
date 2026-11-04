import ExcelJS from 'exceljs';

async function test() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('public/chart_template.xlsx');
  
  const ws = wb.getWorksheet('Calibration');
  if (ws) {
    ws.getCell('D2').value = 0.1;
    ws.getCell('E2').value = 100;
  }
  
  await wb.xlsx.writeFile('public/test_output.xlsx');
  console.log('Saved test_output.xlsx');
}

test().catch(console.error);
