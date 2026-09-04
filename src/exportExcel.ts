import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import { ProcessedRecord, getGeneralSummary, getDetailedSummaryByField } from './utils';

export async function exportToExcel(
  data: ProcessedRecord[], 
  chartElements: { id: string, name: string }[]
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'App Analytics';
  
  // 1. Data Sheet
  const dataSheet = workbook.addWorksheet('Dados Processados');
  dataSheet.columns = [
    { header: 'Unidade de Saúde', key: 'unidade', width: 30 },
    { header: 'Data Criação', key: 'dt_criacao', width: 20 },
    { header: 'Data Atendimento', key: 'dt_atendimento', width: 20 },
    { header: 'Tempo Espera (Dias)', key: 'espera', width: 20 },
    { header: 'Tipo Consulta', key: 'tipo', width: 25 },
    { header: 'Profissional', key: 'prof', width: 40 },
    { header: 'CBO Original', key: 'cbo_orig', width: 30 },
    { header: 'CBO Corrigido', key: 'cbo', width: 30 },
  ];

  dataSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  dataSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  dataSheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

  data.forEach(d => {
    dataSheet.addRow({
      unidade: d.unidadeSaude,
      dt_criacao: d.dataCriacaoStr,
      dt_atendimento: d.dataAtendimentoStr,
      espera: d.tempoEsperaDias,
      tipo: d.tipoConsulta,
      prof: d.profissional,
      cbo_orig: d.cboOriginal,
      cbo: d.cboCorrigido
    });
  });

  // 2. Dashboard Sheet
  const dashSheet = workbook.addWorksheet('Dashboard Visuais');
  dashSheet.properties.defaultColWidth = 15;
  dashSheet.mergeCells('A1:H2');
  const titleCell = dashSheet.getCell('A1');
  titleCell.value = 'Relatório de Atendimentos e Tempos de Espera';
  titleCell.font = { size: 16, bold: true, color: { argb: 'FF0F766E' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

  let currentImageRow = 4;
  for (const chart of chartElements) {
    const el = document.getElementById(chart.id);
    if (el) {
      try {
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        const imageId = workbook.addImage({ base64: imgData, extension: 'png' });
        
        dashSheet.getCell(`B${currentImageRow}`).value = chart.name;
        dashSheet.getCell(`B${currentImageRow}`).font = { bold: true, size: 12 };
        dashSheet.addImage(imageId, { tl: { col: 1, row: currentImageRow + 1 }, ext: { width: 800, height: 400 } });
        currentImageRow += 24; 
      } catch (err) {
        console.warn(`Failed to render chart ${chart.id} to Excel`, err);
      }
    }
  }

  // 3. Resumo Sheet (Styled perfectly to match UI)
  const resumeSheet = workbook.addWorksheet('Resumo Analítico');
  resumeSheet.columns = [
    { key: 'A', width: 40 },
    { key: 'B', width: 20 },
    { key: 'C', width: 20 },
    { key: 'D', width: 15 },
    { key: 'E', width: 20 },
    { key: 'F', width: 20 },
    { key: 'G', width: 15 },
  ];

  const applyMainHeader = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF205284' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  };

  const applySubHeader = (cell: ExcelJS.Cell) => {
    cell.font = { bold: true, color: { argb: 'FF205284' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCBDCED' } };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  };

  const applyDataCell = (cell: ExcelJS.Cell, align: 'left' | 'center' = 'center', bold: boolean = false) => {
    cell.font = { bold };
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    cell.alignment = { vertical: 'middle', horizontal: align };
  };

  let r = 1;

  // --- Tabela Geral ---
  resumeSheet.getCell(`A${r}`).value = 'Resumo Geral';
  resumeSheet.getCell(`A${r}`).font = { bold: true, size: 14, color: { argb: 'FF205284' } };
  r += 1;

  const headGeral = ['Categoria', 'Qtd. Atendimentos', 'Média Dias de Espera', 'Mín. Dias', 'Máx. Dias'];
  headGeral.forEach((h, i) => {
    const c = resumeSheet.getCell(r, i + 1);
    c.value = h;
    applyMainHeader(c);
  });
  r += 1;

  const generalSummary = getGeneralSummary(data);
  generalSummary.forEach(row => {
    applyDataCell(resumeSheet.getCell(r, 1), 'left'); resumeSheet.getCell(r, 1).value = row.categoria;
    applyDataCell(resumeSheet.getCell(r, 2)); resumeSheet.getCell(r, 2).value = row.qtd;
    applyDataCell(resumeSheet.getCell(r, 3)); resumeSheet.getCell(r, 3).value = row.media;
    applyDataCell(resumeSheet.getCell(r, 4)); resumeSheet.getCell(r, 4).value = row.min;
    applyDataCell(resumeSheet.getCell(r, 5)); resumeSheet.getCell(r, 5).value = row.max;
    r++;
  });
  r += 2;

  // Function to render Detailed Tables (Units / Professionals)
  const renderDetailedTable = (title: string, fieldName: string, summaryData: ReturnType<typeof getDetailedSummaryByField>) => {
    resumeSheet.getCell(`A${r}`).value = title;
    resumeSheet.getCell(`A${r}`).font = { bold: true, size: 14, color: { argb: 'FF205284' } };
    r += 1;

    // Row 1 of Header
    resumeSheet.mergeCells(r, 1, r + 1, 1);
    const c1 = resumeSheet.getCell(r, 1);
    c1.value = fieldName;
    applyMainHeader(c1);

    resumeSheet.mergeCells(r, 2, r, 4);
    const c2 = resumeSheet.getCell(r, 2);
    c2.value = '1º Atendimento';
    applyMainHeader(c2);

    resumeSheet.mergeCells(r, 5, r, 7);
    const c3 = resumeSheet.getCell(r, 5);
    c3.value = 'Retorno';
    applyMainHeader(c3);

    r += 1;
    // Row 2 of Header
    const subHeaders = ['Qtd.', 'Média Dias', 'Máx. Dias', 'Qtd.', 'Média Dias', 'Máx. Dias'];
    subHeaders.forEach((h, i) => {
      const c = resumeSheet.getCell(r, i + 2);
      c.value = h;
      applySubHeader(c);
    });
    r += 1;

    summaryData.forEach(row => {
      applyDataCell(resumeSheet.getCell(r, 1), 'left'); resumeSheet.getCell(r, 1).value = row.name;
      
      applyDataCell(resumeSheet.getCell(r, 2)); resumeSheet.getCell(r, 2).value = row.prim.qtd;
      applyDataCell(resumeSheet.getCell(r, 3), 'center', true); resumeSheet.getCell(r, 3).value = row.prim.media;
      applyDataCell(resumeSheet.getCell(r, 4)); resumeSheet.getCell(r, 4).value = row.prim.max;
      
      applyDataCell(resumeSheet.getCell(r, 5)); resumeSheet.getCell(r, 5).value = row.ret.qtd;
      applyDataCell(resumeSheet.getCell(r, 6), 'center', true); resumeSheet.getCell(r, 6).value = row.ret.media;
      applyDataCell(resumeSheet.getCell(r, 7)); resumeSheet.getCell(r, 7).value = row.ret.max;
      r++;
    });
    r += 2;
  };

  renderDetailedTable('Relatório por Unidade', 'Unidade', getDetailedSummaryByField(data, 'unidadeSaude'));
  renderDetailedTable('Relatório por Profissional', 'Profissional', getDetailedSummaryByField(data, 'profissional'));

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), 'relatorio_atendimentos.xlsx');
}
