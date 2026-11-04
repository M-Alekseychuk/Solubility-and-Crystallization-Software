const XlsxPopulate = require('xlsx-populate');

async function test() {
  const workbook = await XlsxPopulate.fromFileAsync('public/chart_template.xlsx');
  
  const sheet = workbook.sheet('Calibration');
  sheet.cell('D2').value(0.1);
  sheet.cell('E2').value(100);
  
  await workbook.toFileAsync('public/test_populate.xlsx');
  console.log('Saved test_populate.xlsx');
}

test().catch(console.error);
