const ExcelJS = require('exceljs');
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet('Test');
try {
  ws.getCell(1, 1).value = 'Hello';
  console.log('Success');
} catch (e) {
  console.log('Error:', e.message);
}
