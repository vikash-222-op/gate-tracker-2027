import React, { useState, useEffect } from 'react';
import { ClipboardPaste, CheckCircle2, AlertCircle, FileSpreadsheet, ArrowRight } from 'lucide-react';
import { Modal } from './Modal';
import {
  parsePastedSpreadsheet,
  mapToLectureTracker,
  mapToPYQTracker,
  mapToRevisionTracker,
  mapToWeeklyQuiz,
  mapToTestTracker,
  mapToPlanning,
  mapToDailyProgress
} from '../../services/excelEngine';
import { useApp } from '../../context/AppContext';

export type PasteTargetSection = 
  | 'lecture_tracker'
  | 'pyq_tracker'
  | 'revision_tracker'
  | 'weekly_quiz'
  | 'test_tracker'
  | 'planning'
  | 'daily_progress';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetSection: PasteTargetSection;
  onSuccess?: (count: number) => void;
}

const SECTION_TITLES: Record<PasteTargetSection, string> = {
  lecture_tracker: 'Lecture Tracker',
  pyq_tracker: 'PYQ Tracker',
  revision_tracker: 'Revision Tracker',
  weekly_quiz: 'Weekly Quiz',
  test_tracker: 'Test Tracker',
  planning: 'Planning',
  daily_progress: 'Daily Progress'
};

export const UniversalPasteModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetSection,
  onSuccess
}) => {
  const { importBulkData } = useApp();
  const [pastedText, setPastedText] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPastedText('');
      setParsedHeaders([]);
      setParsedRows([]);
      setPreviewItems([]);
      setStatusMessage(null);
    }
  }, [isOpen]);

  const handleTextChange = (text: string) => {
    setPastedText(text);
    if (!text.trim()) {
      setParsedHeaders([]);
      setParsedRows([]);
      setPreviewItems([]);
      return;
    }

    const { headers, rows } = parsePastedSpreadsheet(text);
    setParsedHeaders(headers);
    setParsedRows(rows);

    let mapped: any[] = [];
    switch (targetSection) {
      case 'lecture_tracker':
        mapped = mapToLectureTracker(rows);
        break;
      case 'pyq_tracker':
        mapped = mapToPYQTracker(rows);
        break;
      case 'revision_tracker':
        mapped = mapToRevisionTracker(rows);
        break;
      case 'weekly_quiz':
        mapped = mapToWeeklyQuiz(rows);
        break;
      case 'test_tracker':
        mapped = mapToTestTracker(rows);
        break;
      case 'planning':
        mapped = mapToPlanning(rows);
        break;
      case 'daily_progress':
        mapped = mapToDailyProgress(rows);
        break;
    }
    setPreviewItems(mapped);
  };

  const handleImport = async () => {
    if (previewItems.length === 0) return;
    setIsImporting(true);
    setStatusMessage(null);

    try {
      const payload: any = {};
      switch (targetSection) {
        case 'lecture_tracker':
          payload.lectureTracker = previewItems;
          break;
        case 'pyq_tracker':
          payload.pyqTracker = previewItems;
          break;
        case 'revision_tracker':
          payload.revisionTracker = previewItems;
          break;
        case 'weekly_quiz':
          payload.weeklyQuiz = previewItems;
          break;
        case 'test_tracker':
          payload.testTracker = previewItems;
          break;
        case 'planning':
          payload.planning = previewItems;
          break;
        case 'daily_progress':
          payload.dailyProgress = previewItems;
          break;
      }

      const res = await importBulkData(payload, 'update');
      if (onSuccess) onSuccess(res.importedCount);
      onClose();
    } catch (err: any) {
      setStatusMessage(`Import failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Paste from Excel / Google Sheets → ${SECTION_TITLES[targetSection]}`}
      subtitle="Copy table rows directly from Excel, Google Sheets, or GO Classes and paste below."
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
            Paste Data (Tabs, columns, headers, and hyperlinks are detected automatically):
          </label>
          <textarea
            rows={6}
            value={pastedText}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Paste cells copied directly from Excel, Sheets, or GO Classes here..."
            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        {statusMessage && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {parsedRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Detected {parsedRows.length} rows and {parsedHeaders.length} columns
              </span>
              <span className="text-slate-400 text-[11px]">
                Previewing first {Math.min(parsedRows.length, 3)} rows
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto max-h-48 bg-slate-50/50 dark:bg-slate-900/50">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0">
                  <tr>
                    {parsedHeaders.map((h, i) => (
                      <th key={i} className="p-2 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {parsedRows.slice(0, 3).map((r, rIdx) => (
                    <tr key={rIdx}>
                      {parsedHeaders.map((h, cIdx) => (
                        <td key={cIdx} className="p-2 truncate max-w-[160px] text-slate-800 dark:text-slate-200 font-mono">
                          {r[h] || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={parsedRows.length === 0 || isImporting}
            onClick={handleImport}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-4 h-4" />
            <span>{isImporting ? 'Importing...' : `Import ${parsedRows.length} Rows`}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
