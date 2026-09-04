import React, { useState } from 'react';
import { ProcessedRecord, recalculateRecord } from '../utils';
import { Edit2, Save, X, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface DataTableProps {
  data: ProcessedRecord[];
  onUpdate: (id: string, updatedFields: Partial<ProcessedRecord>) => void;
  onDelete: (id: string) => void;
}

export function DataTable({ data, onUpdate, onDelete }: DataTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProcessedRecord>>({});
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const rowsPerPage = 20;

  const filteredData = data.filter(d => 
    Object.values(d).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);
  const currentData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handleEdit = (record: ProcessedRecord) => {
    setEditingId(record.id);
    setEditForm({ ...record });
  };

  const handleSave = () => {
    if (!editingId) return;
    
    // Recalculate derived fields (wait time, fixed cbo, etc.)
    const recalculated = recalculateRecord(editForm as ProcessedRecord);
    
    onUpdate(editingId, recalculated);
    setEditingId(null);
    setEditForm({});
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <h3 className="font-semibold text-slate-800">Dados Importados</h3>
        <input 
          type="text" 
          placeholder="Buscar nos dados..." 
          className="px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
        />
      </div>
      
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-500 uppercase bg-slate-100/50 whitespace-nowrap">
            <tr>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3">Criação</th>
              <th className="px-4 py-3">Atendimento</th>
              <th className="px-4 py-3">Espera (Dias)</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Profissional</th>
              <th className="px-4 py-3">CBO Original</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              currentData.map(row => {
                const isEditing = editingId === row.id;
                
                return (
                  <tr key={row.id} className={cn("border-b border-slate-100 hover:bg-slate-50/50", isEditing && "bg-teal-50/30")}>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input className="w-full border-slate-300 rounded px-2 py-1 text-xs" value={editForm.unidadeSaude || ''} onChange={e => setEditForm({...editForm, unidadeSaude: e.target.value})} />
                      ) : row.unidadeSaude}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input className="w-full border-slate-300 rounded px-2 py-1 text-xs" value={editForm.dataCriacaoStr || ''} onChange={e => setEditForm({...editForm, dataCriacaoStr: e.target.value})} />
                      ) : row.dataCriacaoStr}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input className="w-full border-slate-300 rounded px-2 py-1 text-xs" value={editForm.dataAtendimentoStr || ''} onChange={e => setEditForm({...editForm, dataAtendimentoStr: e.target.value})} />
                      ) : row.dataAtendimentoStr}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      {isEditing ? (
                        <span className="text-slate-400 italic">Auto</span>
                      ) : row.tempoEsperaDias}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <select className="w-full border-slate-300 rounded px-2 py-1 text-xs" value={editForm.tipoConsulta} onChange={e => setEditForm({...editForm, tipoConsulta: e.target.value})}>
                          <option value="Primeiro Atendimento">Primeiro Atendimento</option>
                          <option value="Retorno">Retorno</option>
                        </select>
                      ) : row.tipoConsulta}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input className="w-full border-slate-300 rounded px-2 py-1 text-xs" value={editForm.profissional || ''} onChange={e => setEditForm({...editForm, profissional: e.target.value})} />
                      ) : row.profissional}
                    </td>
                    <td className="px-4 py-2">
                      {isEditing ? (
                        <input className="w-full border-slate-300 rounded px-2 py-1 text-xs" value={editForm.cboOriginal || ''} onChange={e => setEditForm({...editForm, cboOriginal: e.target.value})} />
                      ) : (
                        <div className="flex flex-col">
                          <span>{row.cboOriginal}</span>
                          <span className="text-[10px] text-teal-600 font-medium">({row.cboCorrigido})</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <button onClick={handleSave} className="text-green-600 hover:text-green-700 p-1"><Save className="w-4 h-4" /></button>
                          <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEdit(row)} className="text-teal-600 hover:text-teal-700 p-1"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => onDelete(row.id)} className="text-rose-500 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs text-slate-600">
          <span>Mostrando {((page - 1) * rowsPerPage) + 1} a {Math.min(page * rowsPerPage, filteredData.length)} de {filteredData.length}</span>
          <div className="flex items-center gap-1">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 hover:bg-slate-100"
            >
              Anterior
            </button>
            <span className="px-2">Página {page} de {totalPages}</span>
            <button 
              disabled={page === totalPages} 
              onClick={() => setPage(p => p + 1)}
              className="px-2 py-1 rounded border border-slate-300 disabled:opacity-50 hover:bg-slate-100"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
