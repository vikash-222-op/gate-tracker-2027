import React, { useState, useMemo } from 'react';
import {
  Award,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  ClipboardPaste,
  CheckCircle2,
  ArrowUpDown,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WeeklyQuizItem, MistakePattern, DifficultyLevel } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BulkActionBar } from '../common/BulkActionBar';
import { HyperlinkView } from '../common/HyperlinkView';
import { exportTableToSpreadsheet } from '../../services/excelEngine';
import { UniversalPasteModal } from '../common/UniversalPasteModal';
import { SAMPLE_WEEKLY_QUIZZES, getWithSampleFallback } from '../../services/sampleData';

const MISTAKE_PATTERNS: MistakePattern[] = [
  'Conceptual',
  'Silly Mistake',
  'Formula',
  'Calculation',
  'Question Misread',
  'Time Pressure',
  'Guess',
  'Other'
];

export const WeeklyQuizView: React.FC = () => {
  const { state, addWeeklyQuiz, updateWeeklyQuiz, deleteWeeklyQuiz, bulkDeleteWeeklyQuizzes, resetSection, importBulkData } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMistake, setSelectedMistake] = useState('All');
  const [sortField, setSortField] = useState<'testDate' | 'quizName' | 'netMarks' | 'accuracy'>('testDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-select & Dialog States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isResetSectionOpen, setIsResetSectionOpen] = useState(false);

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WeeklyQuizItem | null>(null);

  // Universal Paste from Excel Modal
  const [isUniversalPasteOpen, setIsUniversalPasteOpen] = useState(false);

  // Sample fallback
  const { items: displayQuizzes, isSampleState } = useMemo(() => {
    return getWithSampleFallback(state.weeklyQuiz, SAMPLE_WEEKLY_QUIZZES);
  }, [state.weeklyQuiz]);

  // Form State (empty strings by default so missing values are not fabricated)
  const [formQuizName, setFormQuizName] = useState('');
  const [formTopicCovered, setFormTopicCovered] = useState('');
  const [formQuizLinkUrl, setFormQuizLinkUrl] = useState('');
  const [formQuizLinkText, setFormQuizLinkText] = useState('');
  const [formTestDate, setFormTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [formTotalQuestions, setFormTotalQuestions] = useState('');
  const [formCorrect, setFormCorrect] = useState('');
  const [formWrong, setFormWrong] = useState('');
  const [formSkipped, setFormSkipped] = useState('');
  const [formFullMarks, setFormFullMarks] = useState('');
  const [formNetMarks, setFormNetMarks] = useState('');
  const [formAccuracy, setFormAccuracy] = useState('');
  const [formTimeTaken, setFormTimeTaken] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formWeakAreas, setFormWeakAreas] = useState('');
  const [formMistakePattern, setFormMistakePattern] = useState<MistakePattern | ''>('');
  const [formComplete, setFormComplete] = useState(false);

  // Summary Metrics
  const totalQuizzes = displayQuizzes.length;
  const totalAttempted = displayQuizzes.filter(q => q.complete || (q.correct !== undefined && q.correct > 0) || (q.attempted && q.attempted > 0)).length;
  const quizzesWithAcc = displayQuizzes.filter(q => q.accuracy !== undefined);
  const avgAccuracy = quizzesWithAcc.length > 0 
    ? Math.round(quizzesWithAcc.reduce((acc, q) => acc + (q.accuracy || 0), 0) / quizzesWithAcc.length)
    : 0;
  const totalMarksEarned = displayQuizzes.reduce((acc, q) => acc + (q.netMarks || 0), 0);
  const totalMarksPossible = displayQuizzes.reduce((acc, q) => acc + (q.fullMarks || 0), 0);

  const openAddModal = () => {
    setEditingItem(null);
    setFormQuizName('');
    setFormTopicCovered('');
    setFormQuizLinkUrl('');
    setFormQuizLinkText('');
    setFormTestDate(new Date().toISOString().split('T')[0]);
    setFormTotalQuestions('');
    setFormCorrect('');
    setFormWrong('');
    setFormSkipped('');
    setFormFullMarks('');
    setFormNetMarks('');
    setFormAccuracy('');
    setFormTimeTaken('');
    setFormRemarks('');
    setFormWeakAreas('');
    setFormMistakePattern('');
    setFormComplete(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: WeeklyQuizItem) => {
    setEditingItem(item);
    setFormQuizName(item.quizName);
    setFormTopicCovered(item.topicCovered || '');
    if (item.quizLink && typeof item.quizLink === 'object') {
      setFormQuizLinkUrl(item.quizLink.url || '');
      setFormQuizLinkText(item.quizLink.text || '');
    } else {
      setFormQuizLinkUrl(String(item.quizLink || ''));
      setFormQuizLinkText('');
    }
    setFormTestDate(item.testDate || '');
    setFormTotalQuestions(item.totalQuestions !== undefined ? String(item.totalQuestions) : '');
    setFormCorrect(item.correct !== undefined ? String(item.correct) : '');
    setFormWrong(item.wrong !== undefined ? String(item.wrong) : '');
    setFormSkipped(item.skipped !== undefined ? String(item.skipped) : '');
    setFormFullMarks(item.fullMarks !== undefined ? String(item.fullMarks) : '');
    setFormNetMarks(item.netMarks !== undefined ? String(item.netMarks) : '');
    setFormAccuracy(item.accuracy !== undefined ? String(item.accuracy) : '');
    setFormTimeTaken(item.timeTaken || '');
    setFormRemarks(item.remarks || '');
    setFormWeakAreas(item.weakAreas || '');
    setFormMistakePattern((item.mistakePattern as MistakePattern) || '');
    setFormComplete(Boolean(item.complete));
    setIsModalOpen(true);
  };

  const ensureRealWeeklyQuiz = async (item: WeeklyQuizItem): Promise<WeeklyQuizItem> => {
    if (!item.isSample) return item;
    const realItems: WeeklyQuizItem[] = displayQuizzes.map(q => ({
      ...q,
      isSample: undefined
    }));
    await importBulkData({ weeklyQuiz: realItems }, 'add');
    const matched = realItems.find(q => q.id === item.id) || realItems[0];
    return matched;
  };

  const handleToggleComplete = async (item: WeeklyQuizItem) => {
    const target = await ensureRealWeeklyQuiz(item);
    await updateWeeklyQuiz({
      ...target,
      complete: !target.complete
    });
  };

  const handleInlineRemarkChange = async (item: WeeklyQuizItem, newRemarks: string) => {
    const target = await ensureRealWeeklyQuiz(item);
    await updateWeeklyQuiz({
      ...target,
      remarks: newRemarks.trim()
    });
  };

  const handleInlineWeakAreaChange = async (item: WeeklyQuizItem, newWeak: string) => {
    const target = await ensureRealWeeklyQuiz(item);
    await updateWeeklyQuiz({
      ...target,
      weakAreas: newWeak.trim()
    });
  };

  const handleInlineMistakeChange = async (item: WeeklyQuizItem, newMistake: string) => {
    const target = await ensureRealWeeklyQuiz(item);
    await updateWeeklyQuiz({
      ...target,
      mistakePattern: newMistake ? (newMistake as MistakePattern) : undefined
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let linkField: any = undefined;
    if (formQuizLinkUrl.trim()) {
      linkField = {
        url: formQuizLinkUrl.trim(),
        text: formQuizLinkText.trim() || 'Quiz Link'
      };
    } else if (formQuizLinkText.trim()) {
      linkField = formQuizLinkText.trim();
    }

    const tQ = formTotalQuestions.trim() ? parseInt(formTotalQuestions) : undefined;
    const cQ = formCorrect.trim() ? parseInt(formCorrect) : undefined;
    const wQ = formWrong.trim() ? parseInt(formWrong) : undefined;
    const sQ = formSkipped.trim() ? parseInt(formSkipped) : undefined;
    const fM = formFullMarks.trim() ? parseFloat(formFullMarks) : undefined;
    const nM = formNetMarks.trim() ? parseFloat(formNetMarks) : undefined;
    let acc = formAccuracy.trim() ? parseFloat(formAccuracy) : undefined;

    if (acc === undefined && cQ !== undefined && (cQ + (wQ || 0)) > 0) {
      acc = Math.round((cQ / (cQ + (wQ || 0))) * 100);
    }

    const payload = {
      complete: formComplete,
      quizName: formQuizName.trim(),
      topicCovered: formTopicCovered.trim() || undefined,
      quizLink: linkField,
      testDate: formTestDate.trim() || undefined,
      totalQuestions: tQ,
      correct: cQ,
      wrong: wQ,
      skipped: sQ,
      attempted: cQ !== undefined || wQ !== undefined ? (cQ || 0) + (wQ || 0) : undefined,
      fullMarks: fM,
      netMarks: nM,
      accuracy: acc,
      timeTaken: formTimeTaken.trim() || undefined,
      remarks: formRemarks.trim() || undefined,
      weakAreas: formWeakAreas.trim() || undefined,
      mistakePattern: formMistakePattern || undefined
    };

    if (editingItem) {
      await updateWeeklyQuiz({
        ...editingItem,
        ...payload
      });
    } else {
      await addWeeklyQuiz(payload);
    }
    setIsModalOpen(false);
  };

  const handleSort = (field: 'testDate' | 'quizName' | 'netMarks' | 'accuracy') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredQuizzes = useMemo(() => {
    return displayQuizzes
      .filter(q => {
        if (selectedMistake !== 'All' && q.mistakePattern !== selectedMistake) return false;

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchName = q.quizName.toLowerCase().includes(term);
          const matchTopic = (q.topicCovered || '').toLowerCase().includes(term);
          const matchWeak = (q.weakAreas || '').toLowerCase().includes(term);
          const matchRemarks = (q.remarks || '').toLowerCase().includes(term);
          if (!matchName && !matchTopic && !matchWeak && !matchRemarks) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'netMarks' || sortField === 'accuracy') {
          const numA = a[sortField] || 0;
          const numB = b[sortField] || 0;
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
        const valA = String(a[sortField] || '').toLowerCase();
        const valB = String(b[sortField] || '').toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [displayQuizzes, selectedMistake, searchTerm, sortField, sortOrder]);

  // Real items that are visible under current filters (excluding sample preview)
  const visibleRealQuizzes = useMemo(() => {
    return filteredQuizzes.filter(q => !q.isSample);
  }, [filteredQuizzes]);

  const isAllVisibleSelected = visibleRealQuizzes.length > 0 && visibleRealQuizzes.every(q => selectedIds.has(q.id));
  const isSomeVisibleSelected = visibleRealQuizzes.some(q => selectedIds.has(q.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealQuizzes.forEach(q => next.delete(q.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealQuizzes.forEach(q => next.add(q.id));
        return next;
      });
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              Weekly Quiz Tracker
            </h2>
            {isSampleState && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 uppercase tracking-wider">
                Sample Preview (1-2 Rows)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete 16-field structure with Excel copy/paste, inline editing, and clickable links.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportTableToSpreadsheet(state.weeklyQuiz, 'GATE_Weekly_Quiz_Tracker')}
            className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={() => setIsUniversalPasteOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold border border-sky-600 dark:border-sky-500 bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 rounded-lg flex items-center gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer shadow-xs"
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste from Excel / GO Classes
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Quiz
          </button>
          <button
            onClick={() => setIsResetSectionOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Weekly Quiz records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Section Data
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Quizzes
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
            {totalQuizzes}
          </span>
          <span className="text-[11px] text-slate-400">{totalAttempted} attempted</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Average Accuracy
          </span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
            {avgAccuracy}%
          </span>
          <span className="text-[11px] text-slate-400">Across attempted quizzes</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Net Marks
          </span>
          <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 font-mono mt-0.5 block">
            {totalMarksEarned.toFixed(1)}
          </span>
          <span className="text-[11px] text-slate-400">Out of {totalMarksPossible.toFixed(0)} max marks</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Score Efficiency
          </span>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
            {totalMarksPossible > 0 ? Math.round((totalMarksEarned / totalMarksPossible) * 100) : 0}%
          </span>
          <span className="text-[11px] text-slate-400">Net marks percentage</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search quiz name, topic covered, remarks, or weak areas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <select
          value={selectedMistake}
          onChange={(e) => setSelectedMistake(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="All">All Mistake Patterns</option>
          {MISTAKE_PATTERNS.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {(selectedMistake !== 'All' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedMistake('All');
              setSearchTerm('');
            }}
            className="text-xs text-sky-600 dark:text-sky-400 hover:underline px-1 cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalVisibleCount={visibleRealQuizzes.length}
        onSelectAllVisible={() => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            visibleRealQuizzes.forEach(q => next.add(q.id));
            return next;
          });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        itemLabel="quizzes"
      />

      {/* Table — Exactly 16 Specified Fields in Exact Order */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={visibleRealQuizzes.length > 0 && isAllVisibleSelected}
                    ref={input => {
                      if (input) input.indeterminate = isSomeVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleRealQuizzes.length === 0}
                    aria-label="Select all visible weekly quizzes"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                {/* 1. Complete — Checkbox */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Done</th>
                {/* 2. Quiz Name */}
                <th
                  onClick={() => handleSort('quizName')}
                  className="py-3 px-4 cursor-pointer hover:text-sky-600 select-none whitespace-nowrap min-w-[180px]"
                >
                  <div className="flex items-center gap-1">
                    Quiz Name <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                {/* 3. Topic Covered */}
                <th className="py-3 px-3 whitespace-nowrap min-w-[140px]">Topic Covered</th>
                {/* 4. Quiz Link */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Quiz Link</th>
                {/* 5. Test Date */}
                <th
                  onClick={() => handleSort('testDate')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-sky-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Date <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                {/* 6. Total Question */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Total Q</th>
                {/* 7. Correct */}
                <th className="py-3 px-3 text-center whitespace-nowrap text-emerald-600 font-bold">Correct</th>
                {/* 8. Wrong */}
                <th className="py-3 px-3 text-center whitespace-nowrap text-rose-500 font-bold">Wrong</th>
                {/* 9. Skipped */}
                <th className="py-3 px-3 text-center whitespace-nowrap text-amber-500 font-bold">Skipped</th>
                {/* 10. Full Marks */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Full Marks</th>
                {/* 11. Net Marks */}
                <th
                  onClick={() => handleSort('netMarks')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-sky-600 select-none whitespace-nowrap text-sky-600 font-bold"
                >
                  <div className="flex items-center justify-center gap-1">
                    Net Marks <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                {/* 12. Accuracy % */}
                <th
                  onClick={() => handleSort('accuracy')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-sky-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Accuracy % <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                {/* 13. Time Taken */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Time Taken</th>
                {/* 14. Remarks (editable) */}
                <th className="py-3 px-4 min-w-[160px]">Remarks</th>
                {/* 15. Weak Areas (editable) */}
                <th className="py-3 px-4 min-w-[160px]">Weak Areas</th>
                {/* 16. Mistake Pattern (editable) */}
                <th className="py-3 px-3 whitespace-nowrap min-w-[130px]">Mistake Pattern</th>
                {/* Actions */}
                <th className="py-3 px-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredQuizzes.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-8 text-center text-slate-400 italic">
                    No weekly quizzes found. Paste directly from Excel / GO Classes or click "Add Quiz".
                  </td>
                </tr>
              ) : (
                filteredQuizzes.map((item) => {
                  const isDone = Boolean(item.complete);
                  const isSelected = !item.isSample && selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? 'bg-sky-50/60 dark:bg-sky-950/40'
                          : isDone
                          ? 'bg-sky-50/20 dark:bg-sky-950/10'
                          : ''
                      }`}
                    >
                      {/* Selection Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => !item.isSample && toggleSelectOne(item.id)}
                          disabled={!!item.isSample}
                          title={item.isSample ? "Sample demo record cannot be selected or deleted" : "Select row"}
                          aria-label={`Select quiz ${item.quizName}`}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-sky-600 focus:ring-sky-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 1. Complete — Checkbox */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer mx-auto ${
                            isDone
                              ? 'bg-sky-600 text-white hover:bg-sky-700'
                              : 'border-2 border-slate-300 dark:border-slate-600 hover:border-sky-500'
                          }`}
                          title={isDone ? 'Mark Incomplete' : 'Mark Complete'}
                        >
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* 2. Quiz Name */}
                      <td className={`py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-xs ${isDone ? 'line-through text-slate-400' : ''}`}>
                        <div className="flex items-center gap-1.5 truncate" title={item.quizName}>
                          {item.isSample && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0 no-underline">
                              SAMPLE
                            </span>
                          )}
                          <span className="truncate">{item.quizName}</span>
                        </div>
                      </td>

                      {/* 3. Topic Covered */}
                      <td className={`py-3 px-3 text-slate-600 dark:text-slate-400 max-w-[160px] truncate ${isDone ? 'line-through text-slate-400' : ''}`} title={item.topicCovered}>
                        {item.topicCovered || '—'}
                      </td>

                      {/* 4. Quiz Link */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <HyperlinkView value={item.quizLink} defaultLabel="Start" />
                      </td>

                      {/* 5. Test Date */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.testDate || '—'}
                      </td>

                      {/* 6. Total Question */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-medium">
                        {item.totalQuestions !== undefined ? item.totalQuestions : '—'}
                      </td>

                      {/* 7. Correct */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                        {item.correct !== undefined ? item.correct : '—'}
                      </td>

                      {/* 8. Wrong */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-bold text-rose-500 dark:text-rose-400">
                        {item.wrong !== undefined ? item.wrong : '—'}
                      </td>

                      {/* 9. Skipped */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-bold text-amber-500 dark:text-amber-400">
                        {item.skipped !== undefined ? item.skipped : '—'}
                      </td>

                      {/* 10. Full Marks */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.fullMarks !== undefined ? item.fullMarks : '—'}
                      </td>

                      {/* 11. Net Marks */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                        {item.netMarks !== undefined ? item.netMarks : '—'}
                      </td>

                      {/* 12. Accuracy % */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap">
                        {item.accuracy !== undefined ? (
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              item.accuracy >= 80
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : item.accuracy >= 60
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {item.accuracy}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* 13. Time Taken */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.timeTaken || '—'}
                      </td>

                      {/* 14. Remarks (editable inline) */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          defaultValue={item.remarks || ''}
                          onBlur={(e) => handleInlineRemarkChange(item, e.target.value)}
                          placeholder="Type remarks..."
                          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-sky-500 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden"
                        />
                      </td>

                      {/* 15. Weak Areas (editable inline) */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          defaultValue={item.weakAreas || ''}
                          onBlur={(e) => handleInlineWeakAreaChange(item, e.target.value)}
                          placeholder="Weak concepts..."
                          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-sky-500 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden"
                        />
                      </td>

                      {/* 16. Mistake Pattern (editable inline) */}
                      <td className="py-2 px-3">
                        <select
                          value={item.mistakePattern || ''}
                          onChange={(e) => handleInlineMistakeChange(item, e.target.value)}
                          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded text-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <option value="">— None —</option>
                          {MISTAKE_PATTERNS.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 rounded text-slate-400 hover:text-sky-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!item.isSample && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete quiz "${item.quizName}"?`)) {
                                  deleteWeeklyQuiz(item.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete quiz"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Quiz Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Weekly Quiz' : 'Add Weekly Quiz'}
        subtitle="Record score, answers, and analysis. Missing fields can be left blank."
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Quiz Name *
            </label>
            <input
              type="text"
              required
              value={formQuizName}
              onChange={(e) => setFormQuizName(e.target.value)}
              placeholder="e.g. GO Classes GATE CS/DA | DM | Propositional Logic | Weekly Quiz 1"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Topic Covered
              </label>
              <input
                type="text"
                value={formTopicCovered}
                onChange={(e) => setFormTopicCovered(e.target.value)}
                placeholder="Propositional Logic"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Test Date
              </label>
              <input
                type="date"
                value={formTestDate}
                onChange={(e) => setFormTestDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Quiz Link URL (optional)
              </label>
              <input
                type="url"
                value={formQuizLinkUrl}
                onChange={(e) => setFormQuizLinkUrl(e.target.value)}
                placeholder="https://goclasses.in/quiz/..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Quiz Link Label
              </label>
              <input
                type="text"
                value={formQuizLinkText}
                onChange={(e) => setFormQuizLinkText(e.target.value)}
                placeholder="Start"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Total Questions
              </label>
              <input
                type="number"
                min="0"
                value={formTotalQuestions}
                onChange={(e) => setFormTotalQuestions(e.target.value)}
                placeholder="e.g. 15"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-emerald-600 mb-1">
                Correct
              </label>
              <input
                type="number"
                min="0"
                value={formCorrect}
                onChange={(e) => setFormCorrect(e.target.value)}
                placeholder="e.g. 12"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-rose-500 mb-1">
                Wrong
              </label>
              <input
                type="number"
                min="0"
                value={formWrong}
                onChange={(e) => setFormWrong(e.target.value)}
                placeholder="e.g. 2"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-amber-500 mb-1">
                Skipped
              </label>
              <input
                type="number"
                min="0"
                value={formSkipped}
                onChange={(e) => setFormSkipped(e.target.value)}
                placeholder="e.g. 1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Full Marks
              </label>
              <input
                type="number"
                step="0.01"
                value={formFullMarks}
                onChange={(e) => setFormFullMarks(e.target.value)}
                placeholder="e.g. 30"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-sky-600 mb-1">
                Net Marks
              </label>
              <input
                type="number"
                step="0.01"
                value={formNetMarks}
                onChange={(e) => setFormNetMarks(e.target.value)}
                placeholder="e.g. 23.33"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Accuracy %
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={formAccuracy}
                onChange={(e) => setFormAccuracy(e.target.value)}
                placeholder="e.g. 86"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Time Taken
              </label>
              <input
                type="text"
                value={formTimeTaken}
                onChange={(e) => setFormTimeTaken(e.target.value)}
                placeholder="e.g. 45 mins"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Weak Areas (Concepts to Review)
              </label>
              <input
                type="text"
                value={formWeakAreas}
                onChange={(e) => setFormWeakAreas(e.target.value)}
                placeholder="e.g. Negation of conditional statements"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mistake Pattern
              </label>
              <select
                value={formMistakePattern}
                onChange={(e) => setFormMistakePattern(e.target.value as MistakePattern)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="">Select Mistake Pattern (optional)</option>
                {MISTAKE_PATTERNS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="e.g. Good time management"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="form-complete-check"
              checked={formComplete}
              onChange={(e) => setFormComplete(e.target.checked)}
              className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
            />
            <label htmlFor="form-complete-check" className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Mark Quiz as Completed
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg shadow-sm cursor-pointer"
            >
              {editingItem ? 'Save Changes' : 'Save Quiz'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Paste Modal */}
      <UniversalPasteModal
        isOpen={isUniversalPasteOpen}
        onClose={() => setIsUniversalPasteOpen(false)}
        targetSection="weekly_quiz"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={async () => {
          await bulkDeleteWeeklyQuizzes(Array.from(selectedIds));
          setSelectedIds(new Set());
          setIsBulkDeleteOpen(false);
        }}
        title={`Delete ${selectedIds.size} selected records?`}
        message={`Are you sure you want to delete ${selectedIds.size} selected weekly quiz record(s)?`}
        subMessage="This action can be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Section-Wise Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isResetSectionOpen}
        onClose={() => setIsResetSectionOpen(false)}
        onConfirm={async () => {
          await resetSection('weekly_quiz');
          setSelectedIds(new Set());
          setIsResetSectionOpen(false);
        }}
        title="Reset Weekly Quiz Tracker?"
        message="This will permanently remove all Weekly Quiz Tracker records. Other sections will not be affected."
        subMessage="Sample preview will be restored if no records remain. This action can be undone with Undo."
        confirmText="Reset Section"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
