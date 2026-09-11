import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { UploadCloud, FileSpreadsheet, Loader2, Filter, Calendar, Trash2, AlertTriangle, X } from 'lucide-react';
import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { 
  ProcessedRecord, processCsvData, getAverageWaitTimeByCbo, getAppointmentsByCbo, 
  getAppointmentsByType, getAverageWaitTimeByUnit, getAverageWaitTimeByProfessional, getWaitTimeTimeline, recalculateRecord
} from './utils';
import { exportToExcel } from './exportExcel';
import { DataTable } from './components/DataTable';
import { SummaryTables } from './components/SummaryTables';

const COLORS = ['#0f766e', '#0369a1', '#be123c', '#b45309', '#6d28d9', '#15803d'];

export default function App() {
  const [data, setData] = useState<ProcessedRecord[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [selectedPros, setSelectedPros] = useState<Set<string>>(new Set());
  const [selectedCbos, setSelectedCbos] = useState<Set<string>>(new Set());
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  
  // Time filter state
  const [atendimentoStart, setAtendimentoStart] = useState<string>('');
  const [atendimentoEnd, setAtendimentoEnd] = useState<string>('');
  const [criacaoStart, setCriacaoStart] = useState<string>('');
  const [criacaoEnd, setCriacaoEnd] = useState<string>('');

  // Bulk Delete state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteAtendimentoStart, setDeleteAtendimentoStart] = useState<string>('');
  const [deleteAtendimentoEnd, setDeleteAtendimentoEnd] = useState<string>('');
  const [deleteCriacaoStart, setDeleteCriacaoStart] = useState<string>('');
  const [deleteCriacaoEnd, setDeleteCriacaoEnd] = useState<string>('');

  // Initial load
  useEffect(() => {
    fetch('/api/agendamentos')
      .then(res => res.json())
      .then(rows => {
        if (Array.isArray(rows)) {
          // Rehydrate Date objects
          const hydrated = rows.map(r => recalculateRecord(r as ProcessedRecord));
          setData(hydrated);
        }
      })
      .catch(err => console.error("Error loading data:", err));
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const processed = processCsvData(results.data);
        
        try {
          // Serialize dates for DB storage (using the Str fields which are already populated)
          // We can just send the processed records, the backend only takes the explicit string/number fields in SQL
          await fetch('/api/agendamentos/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: processed })
          });
          
          setData(prev => {
            const combined = [...prev, ...processed];
            // Basic deduplication by ID if necessary, or just rely on backend REPLACE
            const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
            return unique;
          });
          
          // Reset filters when new file is loaded
          setSelectedUnits(new Set());
          setSelectedPros(new Set());
          setSelectedCbos(new Set());
          setSelectedTypes(new Set());
          setAtendimentoStart('');
          setAtendimentoEnd('');
          setCriacaoStart('');
          setCriacaoEnd('');
        } catch (err) {
          console.error("Error saving to DB:", err);
          alert("Erro ao salvar os dados no banco.");
        } finally {
          setIsProcessing(false);
        }
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setIsProcessing(false);
      }
    });
  };

  const handleUpdateRecord = async (id: string, updatedRecord: Partial<ProcessedRecord>) => {
    // Optimistic update
    let fullUpdatedRecord: ProcessedRecord | null = null;
    setData(prev => prev.map(row => {
      if (row.id === id) {
        fullUpdatedRecord = { ...row, ...updatedRecord } as ProcessedRecord;
        return fullUpdatedRecord;
      }
      return row;
    }));

    if (fullUpdatedRecord) {
      try {
        await fetch(`/api/agendamentos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fullUpdatedRecord)
        });
      } catch (err) {
        console.error("Error updating record:", err);
      }
    }
  };

  const handleDeleteRecord = async (id: string) => {
    setData(prev => prev.filter(row => row.id !== id));
    try {
      await fetch(`/api/agendamentos/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error("Error deleting record:", err);
    }
  };

  const handleBulkDelete = async () => {
    const sDateAtend = deleteAtendimentoStart ? startOfDay(parseISO(deleteAtendimentoStart)) : null;
    const eDateAtend = deleteAtendimentoEnd ? endOfDay(parseISO(deleteAtendimentoEnd)) : null;
    const sDateCriac = deleteCriacaoStart ? startOfDay(parseISO(deleteCriacaoStart)) : null;
    const eDateCriac = deleteCriacaoEnd ? endOfDay(parseISO(deleteCriacaoEnd)) : null;
    
    const hasAtendimentoFilter = sDateAtend || eDateAtend;
    const hasCriacaoFilter = sDateCriac || eDateCriac;

    if (!hasAtendimentoFilter && !hasCriacaoFilter) {
      alert("Por favor, selecione ao menos uma data (Criação ou Atendimento) para exclusão.");
      return;
    }

    const idsToDelete: string[] = [];
    const newData = data.filter(d => {
      let matchesDelete = true;

      if (hasAtendimentoFilter) {
        if (!d.dataAtendimento) matchesDelete = false;
        else {
          if (sDateAtend && d.dataAtendimento < sDateAtend) matchesDelete = false;
          if (eDateAtend && d.dataAtendimento > eDateAtend) matchesDelete = false;
        }
      }

      if (hasCriacaoFilter) {
        if (!d.dataCriacao) matchesDelete = false;
        else {
          if (sDateCriac && d.dataCriacao < sDateCriac) matchesDelete = false;
          if (eDateCriac && d.dataCriacao > eDateCriac) matchesDelete = false;
        }
      }

      if (matchesDelete) {
        idsToDelete.push(d.id);
        return false;
      }
      return true;
    });

    setData(newData);
    setIsDeleteModalOpen(false);
    setDeleteAtendimentoStart('');
    setDeleteAtendimentoEnd('');
    setDeleteCriacaoStart('');
    setDeleteCriacaoEnd('');

    if (idsToDelete.length > 0) {
      try {
        await fetch('/api/agendamentos/delete-bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToDelete })
        });
      } catch (err) {
        console.error("Error bulk deleting:", err);
      }
    }
  };

  // Extract unique values for filters
  const uniqueUnits = useMemo(() => Array.from(new Set(data.map(d => d.unidadeSaude).filter(Boolean))).sort(), [data]);
  const uniquePros = useMemo(() => Array.from(new Set(data.map(d => d.profissional).filter(Boolean))).sort(), [data]);
  const uniqueCbos = useMemo(() => Array.from(new Set(data.map(d => d.cboCorrigido).filter(Boolean))).sort(), [data]);
  
  // Apply filters
  const filteredData = useMemo(() => {
    const sDateAtend = atendimentoStart ? startOfDay(parseISO(atendimentoStart)) : null;
    const eDateAtend = atendimentoEnd ? endOfDay(parseISO(atendimentoEnd)) : null;
    const sDateCriac = criacaoStart ? startOfDay(parseISO(criacaoStart)) : null;
    const eDateCriac = criacaoEnd ? endOfDay(parseISO(criacaoEnd)) : null;

    return data.filter(d => {
      // Time Filters
      if (sDateAtend && (!d.dataAtendimento || d.dataAtendimento < sDateAtend)) return false;
      if (eDateAtend && (!d.dataAtendimento || d.dataAtendimento > eDateAtend)) return false;
      if (sDateCriac && (!d.dataCriacao || d.dataCriacao < sDateCriac)) return false;
      if (eDateCriac && (!d.dataCriacao || d.dataCriacao > eDateCriac)) return false;

      // Categorical Filters
      if (selectedUnits.size > 0 && !selectedUnits.has(d.unidadeSaude)) return false;
      if (selectedPros.size > 0 && !selectedPros.has(d.profissional)) return false;
      if (selectedCbos.size > 0 && !selectedCbos.has(d.cboCorrigido)) return false;
      if (selectedTypes.size > 0 && !selectedTypes.has(d.tipoConsulta)) return false;
      
      return true;
    });
  }, [data, selectedUnits, selectedPros, selectedCbos, selectedTypes, atendimentoStart, atendimentoEnd, criacaoStart, criacaoEnd]);

  const handleExport = async () => {
    if (filteredData.length === 0) return;
    setIsExporting(true);
    
    try {
      await exportToExcel(filteredData, [
        { id: 'chart-wait-time', name: 'Média de Tempo de Espera (Dias) por Profissão' },
        { id: 'chart-appointments-cbo', name: 'Total de Atendimentos por Profissão' },
        { id: 'chart-type', name: 'Proporção: Primeiro Atendimento vs Retorno' },
        { id: 'chart-wait-unit', name: 'Média de Tempo de Espera por Unidade' },
        { id: 'chart-wait-pro', name: 'Média de Tempo de Espera por Profissional (Top 20)' },
        { id: 'chart-timeline', name: 'Evolução do Tempo de Espera (Mensal)' }
      ]);
    } catch (error) {
      console.error("Failed to export Excel", error);
      alert("Erro ao exportar a planilha. Verifique o console para mais detalhes. " + String(error));
    } finally {
      setIsExporting(false);
    }
  };

  const hasData = data.length > 0;
  
  const waitTimeData = hasData ? getAverageWaitTimeByCbo(filteredData) : [];
  const appointmentsCboData = hasData ? getAppointmentsByCbo(filteredData) : [];
  const typeData = hasData ? getAppointmentsByType(filteredData) : [];
  const waitUnitData = hasData ? getAverageWaitTimeByUnit(filteredData) : [];
  const waitProData = hasData ? getAverageWaitTimeByProfessional(filteredData) : [];
  const timelineData = hasData ? getWaitTimeTimeline(filteredData) : [];

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, value: string) => {
    setter(prev => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 font-sans relative">
      <div className="max-w-[1400px] mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Análise de Agendamentos</h1>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">Carregue seu relatório CSV, edite ou filtre os dados e gere relatórios completos automaticamente.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {hasData && (
              <>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filtros {(selectedUnits.size + selectedPros.size + selectedCbos.size + selectedTypes.size) > 0 && `(${(selectedUnits.size + selectedPros.size + selectedCbos.size + selectedTypes.size)})`}</span>
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-lg shadow-sm text-sm font-medium text-rose-700 hover:bg-rose-100 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Excluir em Lote</span>
                </button>
              </>
            )}

            <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-teal-500">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <span>Importar CSV</span>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isProcessing}
              />
            </label>
            
            {hasData && (
              <button 
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-700 rounded-lg shadow-sm text-sm font-medium text-white hover:bg-teal-800 cursor-pointer transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                <span>Exportar XLSX</span>
              </button>
            )}
          </div>
        </header>

        {/* Empty State */}
        {!hasData && !isProcessing && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-teal-50 text-teal-700 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Nenhum dado carregado</h3>
            <p className="text-slate-500 max-w-md mt-2 mb-6">
              Faça upload do arquivo CSV contendo os dados de agendamentos.
            </p>
          </div>
        )}

        {/* Main Content Area */}
        {hasData && (
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Filters Sidebar */}
            {showFilters && (
              <aside className="w-full lg:w-72 flex-shrink-0 space-y-6 transition-all">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800">Filtros</h3>
                    <button 
                      onClick={() => {
                        setSelectedUnits(new Set());
                        setSelectedPros(new Set());
                        setSelectedCbos(new Set());
                        setSelectedTypes(new Set());
                        setAtendimentoStart('');
                        setAtendimentoEnd('');
                        setCriacaoStart('');
                        setCriacaoEnd('');
                      }}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Limpar Tudo
                    </button>
                  </div>

                  <div className="space-y-6">
                    
                    {/* Time Filters */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Calendar className="w-3 h-3"/> Criação</h4>
                      <div className="flex flex-col gap-2 mb-4">
                        <div>
                          <label className="text-[10px] text-slate-500 mb-1 block">Inicial</label>
                          <input 
                            type="date" 
                            className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500"
                            value={criacaoStart}
                            onChange={(e) => setCriacaoStart(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 mb-1 block">Final</label>
                          <input 
                            type="date" 
                            className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500"
                            value={criacaoEnd}
                            onChange={(e) => setCriacaoEnd(e.target.value)}
                          />
                        </div>
                      </div>

                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1"><Calendar className="w-3 h-3"/> Atendimento</h4>
                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 mb-1 block">Inicial</label>
                          <input 
                            type="date" 
                            className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500"
                            value={atendimentoStart}
                            onChange={(e) => setAtendimentoStart(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 mb-1 block">Final</label>
                          <input 
                            type="date" 
                            className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:ring-teal-500 focus:border-teal-500"
                            value={atendimentoEnd}
                            onChange={(e) => setAtendimentoEnd(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Unidade</h4>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {uniqueUnits.map(u => (
                          <label key={u} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer group">
                            <input type="checkbox" className="mt-0.5 rounded text-teal-600 focus:ring-teal-500" checked={selectedUnits.has(u)} onChange={() => toggleFilter(setSelectedUnits, u)} />
                            <span className="truncate leading-tight group-hover:text-teal-700 transition-colors" title={u}>{u}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Profissão (CBO)</h4>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {uniqueCbos.map(c => (
                          <label key={c} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer group">
                            <input type="checkbox" className="mt-0.5 rounded text-teal-600 focus:ring-teal-500" checked={selectedCbos.has(c)} onChange={() => toggleFilter(setSelectedCbos, c)} />
                            <span className="truncate leading-tight group-hover:text-teal-700 transition-colors" title={c}>{c}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Profissional</h4>
                      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {uniquePros.map(p => (
                          <label key={p} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer group">
                            <input type="checkbox" className="mt-0.5 rounded text-teal-600 focus:ring-teal-500" checked={selectedPros.has(p)} onChange={() => toggleFilter(setSelectedPros, p)} />
                            <span className="truncate leading-tight group-hover:text-teal-700 transition-colors" title={p}>{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tipo de Consulta</h4>
                      <div className="space-y-2">
                        {['Primeiro Atendimento', 'Retorno'].map(t => (
                          <label key={t} className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer group">
                            <input type="checkbox" className="mt-0.5 rounded text-teal-600 focus:ring-teal-500" checked={selectedTypes.has(t)} onChange={() => toggleFilter(setSelectedTypes, t)} />
                            <span className="leading-tight group-hover:text-teal-700 transition-colors">{t}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            )}

            {/* Dashboard & Table Area */}
            <div className="flex-1 space-y-8 min-w-0">
              
              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registros Filtrados</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">{filteredData.length} <span className="text-sm font-normal text-slate-400">/ {data.length}</span></p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Média Espera Geral</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {filteredData.length > 0 ? (filteredData.reduce((acc, curr) => acc + curr.tempoEsperaDias, 0) / filteredData.length).toFixed(1) : 0} <span className="text-sm font-normal text-slate-400">dias</span>
                  </p>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Profissionais / Unidades</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">
                    {new Set(filteredData.map(d => d.profissional)).size} / {new Set(filteredData.map(d => d.unidadeSaude)).size}
                  </p>
                </div>
              </div>

              {/* Data Table */}
              <div className="h-[450px]">
                <DataTable data={filteredData} onUpdate={handleUpdateRecord} onDelete={handleDeleteRecord} />
              </div>

              {/* Exact Formatting Summaries requested via image */}
              {filteredData.length > 0 && (
                <SummaryTables data={filteredData} />
              )}

              {/* Charts Grid */}
              {filteredData.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  
                  {/* Timeline Chart */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 xl:col-span-2">
                    <h3 className="text-base font-semibold text-slate-800 mb-6">Evolução da Média de Tempo de Espera (Mensal)</h3>
                    <div id="chart-timeline" className="h-[350px] w-full bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timelineData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} cursor={{ fill: '#f8fafc' }} />
                          <Legend verticalAlign="top" height={36} />
                          <Bar name="Primeiro Atendimento (Dias)" dataKey="Primeiro Atendimento" fill="#0f766e" radius={[4, 4, 0, 0]} />
                          <Bar name="Retorno (Dias)" dataKey="Retorno" fill="#b45309" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 4 - Wait time by Unit */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 xl:col-span-2">
                    <h3 className="text-base font-semibold text-slate-800 mb-6">Tempo de Espera por Unidade (Dias)</h3>
                    <div id="chart-wait-unit" className="h-[350px] w-full bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={waitUnitData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={80} interval={0} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="mediaEspera" name="Dias" fill="#be123c" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 5 - Wait time by Professional */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 xl:col-span-2">
                    <h3 className="text-base font-semibold text-slate-800 mb-6">Tempo de Espera por Profissional - Top 20 (Dias)</h3>
                    <div id="chart-wait-pro" className="h-[350px] w-full bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={waitProData} margin={{ top: 10, right: 30, left: 0, bottom: 80 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={100} interval={0} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="mediaEspera" name="Dias" fill="#0369a1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 1 - Wait time by CBO */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <h3 className="text-base font-semibold text-slate-800 mb-6">Tempo de Espera por Profissão (Dias)</h3>
                    <div id="chart-wait-time" className="h-[300px] w-full bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={waitTimeData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={60} interval={0} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="mediaEspera" name="Dias" fill="#0f766e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2 - Appointments by CBO */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                    <h3 className="text-base font-semibold text-slate-800 mb-6">Atendimentos por Profissão</h3>
                    <div id="chart-appointments-cbo" className="h-[300px] w-full bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={appointmentsCboData} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" height={60} interval={0} />
                          <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Bar dataKey="atendimentos" name="Atendimentos" fill="#15803d" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 3 - First vs Return */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 xl:col-span-2 flex flex-col items-center">
                    <h3 className="text-base font-semibold text-slate-800 mb-2 self-start">Primeiro Atendimento vs Retorno</h3>
                    <div id="chart-type" className="h-[280px] w-full bg-white">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={typeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="atendimentos"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}
                          >
                            {typeData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600" />
                Excluir Dados em Lote
              </h2>
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-800">
                  Os registros que combinarem com <strong>qualquer</strong> um dos períodos selecionados (Criação ou Atendimento) serão excluídos <strong>permanentemente</strong> do sistema.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2">Período de Criação</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1.5">Data Inicial</label>
                    <input 
                      type="date" 
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-rose-500 focus:border-rose-500"
                      value={deleteCriacaoStart}
                      onChange={(e) => setDeleteCriacaoStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1.5">Data Final</label>
                    <input 
                      type="date" 
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-rose-500 focus:border-rose-500"
                      value={deleteCriacaoEnd}
                      onChange={(e) => setDeleteCriacaoEnd(e.target.value)}
                    />
                  </div>
                </div>

                <h4 className="text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2 mt-4">Período de Atendimento</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1.5">Data Inicial</label>
                    <input 
                      type="date" 
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-rose-500 focus:border-rose-500"
                      value={deleteAtendimentoStart}
                      onChange={(e) => setDeleteAtendimentoStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1.5">Data Final</label>
                    <input 
                      type="date" 
                      className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:ring-rose-500 focus:border-rose-500"
                      value={deleteAtendimentoEnd}
                      onChange={(e) => setDeleteAtendimentoEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-sm"
              >
                Excluir Registros
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
