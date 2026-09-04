import React from 'react';
import { ProcessedRecord } from '../utils';
import { getGeneralSummary, getDetailedSummaryByField } from '../utils';

interface SummaryTablesProps {
  data: ProcessedRecord[];
}

export function SummaryTables({ data }: SummaryTablesProps) {
  if (data.length === 0) return null;

  const generalSummary = getGeneralSummary(data);
  const unitSummary = getDetailedSummaryByField(data, 'unidadeSaude');
  const proSummary = getDetailedSummaryByField(data, 'profissional');

  // Styles replicating the corporate blue standard
  const thMainClass = "bg-[#205284] text-white font-bold p-2 border border-slate-400 text-center text-sm";
  const thSubClass = "bg-[#cbdced] text-[#205284] font-bold p-2 border border-slate-400 text-center text-sm";
  const tdClass = "p-2 border border-slate-300 text-center text-sm text-slate-700 bg-white";
  const tdLeftClass = "p-2 border border-slate-300 text-left text-sm text-slate-800 bg-white";

  return (
    <div className="space-y-8 mt-8">
      
      {/* Tabela Geral */}
      <div className="overflow-x-auto shadow-sm">
        <h3 className="text-lg font-bold text-[#205284] mb-3">Resumo Geral</h3>
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr>
              <th className={thMainClass}>Categoria</th>
              <th className={thMainClass}>Qtd. Atendimentos</th>
              <th className={thMainClass}>Média Dias de Espera</th>
              <th className={thMainClass}>Mín. Dias</th>
              <th className={thMainClass}>Máx. Dias</th>
            </tr>
          </thead>
          <tbody>
            {generalSummary.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className={tdLeftClass}>{row.categoria}</td>
                <td className={tdClass}>{row.qtd}</td>
                <td className={tdClass}>{row.media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={tdClass}>{row.min}</td>
                <td className={tdClass}>{row.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabela Unidade */}
      <div className="overflow-x-auto shadow-sm">
        <h3 className="text-lg font-bold text-[#205284] mb-3">Relatório por Unidade</h3>
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr>
              <th className={thMainClass} rowSpan={2}>Unidade</th>
              <th className={thMainClass} colSpan={3}>1º Atendimento</th>
              <th className={thMainClass} colSpan={3}>Retorno</th>
            </tr>
            <tr>
              <th className={thSubClass}>Qtd.</th>
              <th className={thSubClass}>Média Dias</th>
              <th className={thSubClass}>Máx. Dias</th>
              <th className={thSubClass}>Qtd.</th>
              <th className={thSubClass}>Média Dias</th>
              <th className={thSubClass}>Máx. Dias</th>
            </tr>
          </thead>
          <tbody>
            {unitSummary.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className={tdLeftClass}>{row.name}</td>
                <td className={tdClass}>{row.prim.qtd}</td>
                <td className={`${tdClass} font-semibold text-[#b45309]`}>{row.prim.media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={tdClass}>{row.prim.max}</td>
                <td className={tdClass}>{row.ret.qtd}</td>
                <td className={`${tdClass} font-semibold text-[#b45309]`}>{row.ret.media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={tdClass}>{row.ret.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tabela Profissional */}
      <div className="overflow-x-auto shadow-sm">
        <h3 className="text-lg font-bold text-[#205284] mb-3">Relatório por Profissional</h3>
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr>
              <th className={thMainClass} rowSpan={2}>Profissional</th>
              <th className={thMainClass} colSpan={3}>1º Atendimento</th>
              <th className={thMainClass} colSpan={3}>Retorno</th>
            </tr>
            <tr>
              <th className={thSubClass}>Qtd.</th>
              <th className={thSubClass}>Média Dias</th>
              <th className={thSubClass}>Máx. Dias</th>
              <th className={thSubClass}>Qtd.</th>
              <th className={thSubClass}>Média Dias</th>
              <th className={thSubClass}>Máx. Dias</th>
            </tr>
          </thead>
          <tbody>
            {proSummary.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className={tdLeftClass}>{row.name}</td>
                <td className={tdClass}>{row.prim.qtd}</td>
                <td className={`${tdClass} font-semibold text-[#0f766e]`}>{row.prim.media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={tdClass}>{row.prim.max}</td>
                <td className={tdClass}>{row.ret.qtd}</td>
                <td className={`${tdClass} font-semibold text-[#0f766e]`}>{row.ret.media.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td className={tdClass}>{row.ret.max}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
