import { parse, differenceInDays, isValid, format } from 'date-fns';

export interface RawCsvRow {
  no_unidade_saude: string;
  dt_criacao: string;
  consulta_retorno: string;
  hr_inicial_agendado: string;
  no_profissional: string;
  no_cbo: string;
}

export interface ProcessedRecord {
  id: string;
  unidadeSaude: string;
  dataCriacaoStr: string;
  dataAtendimentoStr: string;
  dataCriacao: Date | null;
  dataAtendimento: Date | null;
  tempoEsperaDias: number;
  tipoConsulta: string;
  profissional: string;
  cboOriginal: string;
  cboCorrigido: string;
}

export function fixCbo(rawCbo: string): string {
  if (!rawCbo) return 'Não Informado';
  const upper = rawCbo.toUpperCase();
  
  if (upper.includes('MÃ‰DICO') || upper.includes('MÉDICO') || upper.includes('MEDICO')) return 'Médico';
  if (upper.includes('ENFERMEIRO')) return 'Enfermeiro';
  if (upper.includes('PSICOLOGO') || upper.includes('PSICÓLOGO') || upper.includes('PSICÃ“LOGO')) return 'Psicólogo';
  if (upper.includes('DENTISTA') || upper.includes('ODONTÓLOGO') || upper.includes('ODONTOLOGO') || upper.includes('ODONTÃ“LOGO') || upper.includes('BUCOMAXILO')) return 'Dentista';
  if (upper.includes('NUTRICIONISTA')) return 'Nutricionista';
  
  // Return original capitalized nicely if no match found
  return rawCbo.charAt(0).toUpperCase() + rawCbo.slice(1).toLowerCase();
}

export function parseCustomDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const cleanStr = dateStr.trim();
  let parsedDate = null;

  // Try multiple common formats
  const formatsToTry = [
    'dd/MM/yyyy HH:mm:ss',
    'dd/MM/yyyy HH:mm',
    'dd/MM/yyyy',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd',
    'MM/dd/yyyy HH:mm',
    'MM/dd/yyyy'
  ];

  for (const fmt of formatsToTry) {
    parsedDate = parse(cleanStr, fmt, new Date());
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  
  return null;
}

export function recalculateRecord(record: ProcessedRecord): ProcessedRecord {
  const start = parseCustomDate(record.dataCriacaoStr);
  const end = parseCustomDate(record.dataAtendimentoStr);
  
  let waitTime = 0;
  if (start && end) {
    waitTime = differenceInDays(end, start);
    if (waitTime < 0) waitTime = 0;
  }

  // Handle textual or numeric type
  let tipo = record.tipoConsulta;
  if (tipo === '1' || tipo.toLowerCase() === 'retorno') tipo = 'Retorno';
  else if (tipo === '0' || tipo.toLowerCase() === 'primeiro atendimento') tipo = 'Primeiro Atendimento';

  return {
    ...record,
    dataCriacao: start,
    dataAtendimento: end,
    tempoEsperaDias: waitTime,
    tipoConsulta: tipo,
    cboCorrigido: fixCbo(record.cboOriginal),
  };
}

export function processCsvData(rawData: any[]): ProcessedRecord[] {
  return rawData.map((row, index) => {
    const dtCriacao = row.dt_criacao || row.dt_criação || row.DT_CRIACAO || row['dt_criacao'] || '';
    const hrInicial = row.hr_inicial_agendado || row.hr_inicial || row.HR_INICIAL_AGENDADO || row['hr_inicial_agendado'] || '';
    const retorno = row.consulta_retorno || row.retorno || row['consulta_retorno'] || '0';
    const cbo = row.no_cbo || row.cbo || row['no_cbo'] || '';
    const prof = row.no_profissional || row.profissional || row['no_profissional'] || '';
    const unidade = row.no_unidade_saude || row.unidade || row['no_unidade_saude'] || '';

    const start = parseCustomDate(dtCriacao);
    const end = parseCustomDate(hrInicial);
    
    let waitTime = 0;
    if (start && end) {
      waitTime = differenceInDays(end, start);
      if (waitTime < 0) waitTime = 0;
    }

    return {
      id: `row-${index}-${Date.now()}`,
      unidadeSaude: unidade,
      dataCriacaoStr: dtCriacao,
      dataAtendimentoStr: hrInicial,
      dataCriacao: start,
      dataAtendimento: end,
      tempoEsperaDias: waitTime,
      tipoConsulta: String(retorno).trim() === '1' ? 'Retorno' : 'Primeiro Atendimento',
      profissional: prof,
      cboOriginal: cbo,
      cboCorrigido: fixCbo(cbo),
    };
  }).filter(r => r.cboOriginal || r.profissional || r.unidadeSaude);
}

// --- Aggregation Functions ---

function getAverage(map: Map<string, { total: number, count: number }>) {
  return Array.from(map.entries()).map(([key, stats]) => ({
    name: key,
    mediaEspera: Number((stats.total / stats.count).toFixed(1))
  })).sort((a, b) => b.mediaEspera - a.mediaEspera);
}

export function getAverageWaitTimeByCbo(data: ProcessedRecord[]) {
  const map = new Map<string, { total: number, count: number }>();
  data.forEach(d => {
    if (!map.has(d.cboCorrigido)) map.set(d.cboCorrigido, { total: 0, count: 0 });
    const entry = map.get(d.cboCorrigido)!;
    entry.total += d.tempoEsperaDias;
    entry.count += 1;
  });
  return getAverage(map);
}

export function getAverageWaitTimeByUnit(data: ProcessedRecord[]) {
  const map = new Map<string, { total: number, count: number }>();
  data.forEach(d => {
    if (!d.unidadeSaude) return;
    if (!map.has(d.unidadeSaude)) map.set(d.unidadeSaude, { total: 0, count: 0 });
    const entry = map.get(d.unidadeSaude)!;
    entry.total += d.tempoEsperaDias;
    entry.count += 1;
  });
  return getAverage(map);
}

export function getAverageWaitTimeByProfessional(data: ProcessedRecord[]) {
  const map = new Map<string, { total: number, count: number }>();
  data.forEach(d => {
    if (!d.profissional) return;
    if (!map.has(d.profissional)) map.set(d.profissional, { total: 0, count: 0 });
    const entry = map.get(d.profissional)!;
    entry.total += d.tempoEsperaDias;
    entry.count += 1;
  });
  return getAverage(map).slice(0, 20); // Limit to top 20 for chart readability
}

export function getAppointmentsByCbo(data: ProcessedRecord[]) {
  const map = new Map<string, number>();
  data.forEach(d => {
    map.set(d.cboCorrigido, (map.get(d.cboCorrigido) || 0) + 1);
  });
  return Array.from(map.entries()).map(([cbo, count]) => ({
    name: cbo,
    atendimentos: count
  })).sort((a, b) => b.atendimentos - a.atendimentos);
}

export function getAppointmentsByType(data: ProcessedRecord[]) {
  const map = new Map<string, number>();
  data.forEach(d => {
    map.set(d.tipoConsulta, (map.get(d.tipoConsulta) || 0) + 1);
  });
  return Array.from(map.entries()).map(([tipo, count]) => ({
    name: tipo,
    atendimentos: count
  }));
}

export function getWaitTimeTimeline(data: ProcessedRecord[]) {
  // Aggregate by Month-Year of Atendimento
  const map = new Map<string, { prim: {t: number, c: number}, ret: {t: number, c: number} }>();
  
  data.forEach(d => {
    if (!d.dataAtendimento) return;
    const dateKey = format(d.dataAtendimento, 'MM/yyyy');
    
    if (!map.has(dateKey)) {
      map.set(dateKey, { prim: {t: 0, c: 0}, ret: {t: 0, c: 0} });
    }
    const entry = map.get(dateKey)!;
    
    if (d.tipoConsulta === 'Primeiro Atendimento') {
      entry.prim.t += d.tempoEsperaDias;
      entry.prim.c += 1;
    } else {
      entry.ret.t += d.tempoEsperaDias;
      entry.ret.c += 1;
    }
  });

  return Array.from(map.entries()).map(([date, stats]) => {
    const mediaPrim = stats.prim.c > 0 ? Number((stats.prim.t / stats.prim.c).toFixed(1)) : 0;
    const mediaRet = stats.ret.c > 0 ? Number((stats.ret.t / stats.ret.c).toFixed(1)) : 0;
    
    // Convert to Date for sorting
    const [month, year] = date.split('/');
    const sortDate = new Date(parseInt(year), parseInt(month) - 1, 1).getTime();

    return {
      name: date,
      'Primeiro Atendimento': mediaPrim,
      'Retorno': mediaRet,
      _sort: sortDate
    };
  }).sort((a, b) => a._sort - b._sort);
}

// --- Detailed Summary Tables Functions ---

export function getGeneralSummary(data: ProcessedRecord[]) {
  const calc = (records: ProcessedRecord[]) => {
    if (records.length === 0) return { qtd: 0, media: 0, min: 0, max: 0 };
    const waits = records.map(r => r.tempoEsperaDias);
    const total = waits.reduce((a, b) => a + b, 0);
    return {
      qtd: records.length,
      media: Number((total / records.length).toFixed(2)),
      min: Math.min(...waits),
      max: Math.max(...waits)
    };
  };

  return [
    { categoria: 'Geral (Todos)', ...calc(data) },
    { categoria: '1º Atendimento', ...calc(data.filter(d => d.tipoConsulta === 'Primeiro Atendimento')) },
    { categoria: 'Retorno', ...calc(data.filter(d => d.tipoConsulta === 'Retorno')) }
  ];
}

export function getDetailedSummaryByField(data: ProcessedRecord[], field: keyof ProcessedRecord) {
  const map = new Map<string, { prim: number[], ret: number[] }>();

  data.forEach(d => {
    const key = String(d[field] || 'Não Informado');
    if (!map.has(key)) map.set(key, { prim: [], ret: [] });
    const entry = map.get(key)!;
    if (d.tipoConsulta === 'Primeiro Atendimento') entry.prim.push(d.tempoEsperaDias);
    else entry.ret.push(d.tempoEsperaDias);
  });

  const calc = (arr: number[]) => {
    if (arr.length === 0) return { qtd: 0, media: 0, max: 0 };
    return {
      qtd: arr.length,
      media: Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)),
      max: Math.max(...arr)
    };
  };

  return Array.from(map.entries()).map(([name, arrays]) => {
    return {
      name,
      prim: calc(arrays.prim),
      ret: calc(arrays.ret)
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}
