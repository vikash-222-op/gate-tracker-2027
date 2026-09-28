import React, { useState, useMemo } from 'react';
import {
  Layers,
  Search,
  Download,
  Trash2,
  Plus,
  Table as TableIcon
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CustomSheet } from '../../types';
import { exportTableToSpreadsheet } from '../../services/excelEngine';
import { HyperlinkView } from '../common/HyperlinkView';

export const CustomSheetsView: React.FC = () => {
  const { state, addOrUpdateCustomSheet, deleteCustomSheet } = useApp();
  const sheets = state.customSheets;

  const [activeSheetId, setActiveSheetId] = useState<string>(sheets[0]?.id || '');
  const [searchTerm, setSearchTerm] = useState('');

  // Active sheet
  const activeSheet = useMemo(() => {
    return sheets.find(s => s.id === activeSheetId) || sheets[0] || null;
  }, [sheets, activeSheetId]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    if (!activeSheet) return [];
    if (!searchTerm) return activeSheet.rows;
    const term = searchTerm.toLowerCase();

    return activeSheet.rows.filter(row => {
      return Object.values(row).some(v => 
        String(typeof v === 'object' && v !== null && (v as any).url ? (v as any).url : v || '')
          .toLowerCase()
          .includes(term)
      );
    });
  }, [activeSheet, searchTerm]);

  if (sheets.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center space-y-3">
        <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
          <Layers className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          No Custom / Extra Sheets Imported
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Whenever you upload an Excel workbook containing extra or custom sheets (such as "Lookup Tables", "Master Database", or reference formulas), they are automatically preserved here as dynamic tables without deleting any columns.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Custom & Reference Sheets
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {sheets.length} extra sheet(s) preserved from your Excel workbook with 100% data fidelity.
          </p>
        </div>

        {activeSheet && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportTableToSpreadsheet(activeSheet.rows, activeSheet.name)}
              className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export Table (.xlsx)
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete custom table "${activeSheet.name}"?`)) {
                  deleteCustomSheet(activeSheet.id);
                }
              }}
              className="px-3 py-2 text-xs font-medium border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Sheet
            </button>
          </div>
        )}
      </div>

      {/* Sheet Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        {sheets.map(sheet => {
          const isActive = (activeSheet?.id === sheet.id);
          return (
            <button
              key={sheet.id}
              onClick={() => {
                setActiveSheetId(sheet.id);
                setSearchTerm('');
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-t-2 border-indigo-600 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>{sheet.name}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                {sheet.rows.length}
              </span>
            </button>
          );
        })}
      </div>

      {activeSheet && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={`Search inside ${activeSheet.name}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">
              Showing {filteredRows.length} of {activeSheet.rows.length} rows
            </span>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-3 text-center w-12 text-slate-400">#</th>
                    {activeSheet.headers.map((h, idx) => (
                      <th key={idx} className="py-3 px-4 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={activeSheet.headers.length + 1} className="py-8 text-center text-slate-400 italic">
                        No rows found matching search query.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                          {rIdx + 1}
                        </td>
                        {activeSheet.headers.map((h, cIdx) => {
                          const val = row[h];
                          const isLink = val && typeof val === 'object' && 'url' in val;
                          return (
                            <td key={cIdx} className="py-2.5 px-4 whitespace-nowrap max-w-xs truncate">
                              {isLink ? (
                                <HyperlinkView value={val} />
                              ) : val !== undefined && val !== null && String(val).trim() !== '' ? (
                                String(val)
                              ) : (
                                <span className="text-slate-400 italic">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
