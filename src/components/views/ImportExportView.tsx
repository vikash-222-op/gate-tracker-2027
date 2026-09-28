import React, { useState, useRef } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  ClipboardPaste,
  Database,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Layers
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  inspectExcelFile,
  WorkbookInspection,
  mapToDailyProgress,
  mapToTopicMaster,
  mapToLectureTracker,
  mapToPYQTracker,
  mapToRevisionTracker,
  mapToWeeklyQuiz,
  mapToTestTracker,
  mapToPlanning,
  parsePastedSpreadsheet,
  exportEntireDatabaseToWorkbook,
  generateSampleGateWorkbook,
  SheetDetectionResult
} from '../../services/excelEngine';
import { CustomSheet } from '../../types';

export const ImportExportView: React.FC = () => {
  const { state, importBulkData, restoreBackup, refreshData } = useApp();

  const [activeTab, setActiveTab] = useState<'excel' | 'paste' | 'backup'>('excel');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inspectionResult, setInspectionResult] = useState<WorkbookInspection | null>(null);
  const [conflictMode, setConflictMode] = useState<'update' | 'add' | 'skip'>('update');
  const [importStatusMessage, setImportStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  // Copy-Paste state
  const [pasteText, setPasteText] = useState('');
  const [pasteTarget, setPasteTarget] = useState<'weekly_quiz' | 'lecture_tracker' | 'pyq_tracker' | 'revision_tracker' | 'daily_progress' | 'test_tracker' | 'planning'>('weekly_quiz');
  const [pastedHeaders, setPastedHeaders] = useState<string[]>([]);
  const [pastedRows, setPastedRows] = useState<Record<string, string>[]>([]);

  // 1. File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setImportStatusMessage(null);
    try {
      const inspection = await inspectExcelFile(file);
      setInspectionResult(inspection);
    } catch (err: any) {
      console.error(err);
      setImportStatusMessage({
        type: 'error',
        message: `Failed to read Excel workbook: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Perform Import of All Detected Sheets
  const handleImportAllSheets = async () => {
    if (!inspectionResult) return;
    setIsProcessing(true);
    setImportStatusMessage(null);

    try {
      const bulkPayload: any = {
        customSheets: []
      };

      for (const sheet of inspectionResult.sheets) {
        if (sheet.rowCount === 0) continue;

        switch (sheet.matchedTarget) {
          case 'daily_progress':
            bulkPayload.dailyProgress = mapToDailyProgress(sheet.rawRows);
            break;
          case 'topic_master':
            bulkPayload.topicMaster = mapToTopicMaster(sheet.rawRows);
            break;
          case 'lecture_tracker':
            bulkPayload.lectureTracker = mapToLectureTracker(sheet.rawRows);
            break;
          case 'pyq_tracker':
            bulkPayload.pyqTracker = mapToPYQTracker(sheet.rawRows);
            break;
          case 'revision_tracker':
            bulkPayload.revisionTracker = mapToRevisionTracker(sheet.rawRows);
            break;
          case 'weekly_quiz':
            bulkPayload.weeklyQuiz = mapToWeeklyQuiz(sheet.rawRows);
            break;
          case 'test_tracker':
            bulkPayload.testTracker = mapToTestTracker(sheet.rawRows);
            break;
          case 'planning':
            bulkPayload.planning = mapToPlanning(sheet.rawRows);
            break;
          case 'custom':
          default: {
            // Preserve unknown sheets as Custom Table!
            const customSheet: CustomSheet = {
              id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
              name: sheet.sheetName,
              headers: sheet.headers,
              rows: sheet.rawRows,
              importedAt: new Date().toISOString()
            };
            bulkPayload.customSheets.push(customSheet);
            break;
          }
        }
      }

      const res = await importBulkData(bulkPayload, conflictMode);
      setImportStatusMessage({
        type: 'success',
        message: `Successfully imported ${res.importedCount} records across ${inspectionResult.sheets.length} sheets! All data is saved and persisted in browser storage.`
      });
      setInspectionResult(null);
    } catch (err: any) {
      console.error('Import failed:', err);
      setImportStatusMessage({
        type: 'error',
        message: `Import failed: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Handle Paste Change
  const handlePasteChange = (text: string) => {
    setPasteText(text);
    if (!text.trim()) {
      setPastedHeaders([]);
      setPastedRows([]);
      return;
    }
    const res = parsePastedSpreadsheet(text);
    setPastedHeaders(res.headers);
    setPastedRows(res.rows);
  };

  // 4. Import Pasted Data
  const handleImportPastedData = async () => {
    if (pastedRows.length === 0) return;
    setIsProcessing(true);
    setImportStatusMessage(null);

    try {
      const payload: any = {};
      switch (pasteTarget) {
        case 'weekly_quiz':
          payload.weeklyQuiz = mapToWeeklyQuiz(pastedRows);
          break;
        case 'lecture_tracker':
          payload.lectureTracker = mapToLectureTracker(pastedRows);
          break;
        case 'pyq_tracker':
          payload.pyqTracker = mapToPYQTracker(pastedRows);
          break;
        case 'revision_tracker':
          payload.revisionTracker = mapToRevisionTracker(pastedRows);
          break;
        case 'daily_progress':
          payload.dailyProgress = mapToDailyProgress(pastedRows);
          break;
        case 'test_tracker':
          payload.testTracker = mapToTestTracker(pastedRows);
          break;
        case 'planning':
          payload.planning = mapToPlanning(pastedRows);
          break;
      }

      const res = await importBulkData(payload, conflictMode);
      setImportStatusMessage({
        type: 'success',
        message: `Imported ${res.importedCount} records into ${pasteTarget.replace('_', ' ')}!`
      });
      setPasteText('');
      setPastedHeaders([]);
      setPastedRows([]);
    } catch (err: any) {
      setImportStatusMessage({
        type: 'error',
        message: `Pasted data import failed: ${err.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Full JSON Backup Export
  const handleExportJsonBackup = () => {
    const backupJson = JSON.stringify(state, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GATE_GPMS_Complete_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 6. Full JSON Backup Restore
  const handleRestoreJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && (json.settings || json.lectureTracker || json.pyqTracker)) {
          await restoreBackup(json);
          setImportStatusMessage({
            type: 'success',
            message: 'Complete database backup restored successfully!'
          });
        } else {
          throw new Error('Invalid backup file structure.');
        }
      } catch (err: any) {
        setImportStatusMessage({
          type: 'error',
          message: `Restore failed: ${err.message}`
        });
      } finally {
        if (backupInputRef.current) backupInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Import & Export System
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Import your preparation Excel workbook or paste tables directly from GO Classes & Google Sheets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => generateSampleGateWorkbook()}
            className="px-3.5 py-2 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-colors cursor-pointer"
            title="Download reference workbook matching user's exact structure"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Download Sample Reference Workbook (.xlsx)
          </button>
          <button
            onClick={() => exportEntireDatabaseToWorkbook(state)}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Export Entire Workbook (.xlsx)
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {importStatusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
            importStatusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}
        >
          {importStatusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">
              {importStatusMessage.type === 'success' ? 'Import Succeeded' : 'Notice'}
            </span>
            <span>{importStatusMessage.message}</span>
          </div>
          <button
            onClick={() => setImportStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'excel'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel / CSV Upload (.xlsx, .csv, .xls)</span>
        </button>

        <button
          onClick={() => setActiveTab('paste')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'paste'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <ClipboardPaste className="w-4 h-4" />
          <span>Copy-Paste Import</span>
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'backup'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Complete Backup & Restore (JSON)</span>
        </button>
      </div>

      {/* Tab 1: Excel Upload */}
      {activeTab === 'excel' && (
        <div className="space-y-6">
          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".xlsx,.xls,.csv"
              className="hidden"
              id="excel-file-input"
            />
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Upload GATE Preparation Workbook
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Supports <code>.xlsx</code>, <code>.xls</code>, and <code>.csv</code>.
                  Sheet names, hyperlinks, columns, and custom tables are recognized automatically.
                </p>
              </div>
              <label
                htmlFor="excel-file-input"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                Select Excel File to Inspect
              </label>
            </div>
          </div>

          {/* Inspection Preview Table */}
          {inspectionResult && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                    Inspection Preview
                  </span>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    {inspectionResult.fileName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Found {inspectionResult.sheets.length} sheets containing a total of {inspectionResult.totalRows} data rows.
                  </p>
                </div>

                {/* Duplicate handling strategy */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    If items match:
                  </span>
                  <select
                    value={conflictMode}
                    onChange={(e) => setConflictMode(e.target.value as any)}
                    className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="update">Update Existing (Merge)</option>
                    <option value="add">Add as New Copies</option>
                    <option value="skip">Skip Existing</option>
                  </select>
                </div>
              </div>

              {/* Sheet breakdown list */}
              <div className="space-y-2.5">
                {inspectionResult.sheets.map((s, idx) => {
                  const targetLabelMap: Record<string, string> = {
                    daily_progress: 'Daily Progress Tracker',
                    lecture_tracker: 'Lecture Tracker',
                    pyq_tracker: 'PYQ Tracker',
                    revision_tracker: 'Revision Tracker (Module-Wise)',
                    weekly_quiz: 'Weekly Quiz Tracker',
                    test_tracker: 'Test Series Tracker',
                    planning: 'Study Planning',
                    custom: 'Custom Table (Preserved)'
                  };

                  const isCustom = s.matchedTarget === 'custom';

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            {s.sheetName}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              isCustom
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                            }`}
                          >
                            → {targetLabelMap[s.matchedTarget] || s.matchedTarget}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 text-[11px]">
                          <span><strong>{s.rowCount}</strong> rows</span>
                          <span>•</span>
                          <span><strong>{s.columnCount}</strong> columns</span>
                          <span>•</span>
                          <span className="truncate max-w-md">Headers: {s.headers.slice(0, 5).join(', ')}{s.headers.length > 5 ? '...' : ''}</span>
                        </div>
                      </div>

                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Import Action Button */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => setInspectionResult(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-50 text-xs"
                >
                  Cancel
                </button>

                <button
                  disabled={isProcessing}
                  onClick={handleImportAllSheets}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Import All {inspectionResult.sheets.length} Sheets
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Copy-Paste Import */}
      {activeTab === 'paste' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Paste from Spreadsheets (Excel / Google Sheets / GO Classes)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Copy any table from Google Sheets or Excel and paste here. Tabs, columns, numbers, and hyperlinks will be automatically parsed.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Import Destination Tracker:
            </label>
            <select
              value={pasteTarget}
              onChange={(e) => setPasteTarget(e.target.value as any)}
              className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-medium"
            >
              <option value="weekly_quiz">Weekly Quiz Tracker</option>
              <option value="lecture_tracker">Lecture Tracker</option>
              <option value="pyq_tracker">PYQ Tracker</option>
              <option value="revision_tracker">Revision Tracker</option>
              <option value="daily_progress">Daily Progress</option>
              <option value="test_tracker">Test Series Tracker</option>
              <option value="planning">Study Planning</option>
            </select>
          </div>

          <div>
            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => handlePasteChange(e.target.value)}
              placeholder="Paste table cells copied directly from Excel, Google Sheets, or GO Classes..."
              className="w-full px-3.5 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-xs"
            />
          </div>

          {pastedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Detected {pastedRows.length} rows and {pastedHeaders.length} columns:
                </span>
                <span className="text-slate-400">Showing first 3 rows</span>
              </div>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-48">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      {pastedHeaders.map((h, idx) => (
                        <th key={idx} className="p-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {pastedRows.slice(0, 3).map((row, rIdx) => (
                      <tr key={rIdx}>
                        {pastedHeaders.map((h, cIdx) => (
                          <td key={cIdx} className="p-2 truncate max-w-[160px]">
                            {row[h] || '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleImportPastedData}
                  disabled={isProcessing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Import {pastedRows.length} Pasted Rows
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Complete Backup & Restore */}
      {activeTab === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Backup Export */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Full Application Backup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Export complete database state as a portable JSON snapshot.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              The backup contains all daily hours, topics, lectures, PYQs, revisions, weekly quizzes, tests, planning items, custom tables, and preferences.
            </p>

            <button
              onClick={handleExportJsonBackup}
              className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download Full JSON Backup
            </button>
          </div>

          {/* Backup Restore */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Restore from Backup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Restore entire preparation data from a previously downloaded JSON file.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Restoring replaces the local database with the contents of the backup file.
            </p>

            <input
              type="file"
              ref={backupInputRef}
              onChange={handleRestoreJsonBackup}
              accept=".json"
              className="hidden"
              id="backup-file-input"
            />
            <label
              htmlFor="backup-file-input"
              className="w-full px-4 py-2.5 border border-emerald-600 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer text-center"
            >
              <Upload className="w-4 h-4" />
              Select JSON Backup File
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
