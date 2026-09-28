import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  CheckCircle2,
  ArrowUpDown,
  ClipboardPaste,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { TestItem, TestType, DifficultyLevel, MistakePattern } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BulkActionBar } from '../common/BulkActionBar';
import { HyperlinkView } from '../common/HyperlinkView';
import { exportTableToSpreadsheet } from '../../services/excelEngine';
import { UniversalPasteModal } from '../common/UniversalPasteModal';
import { SAMPLE_TESTS, getWithSampleFallback } from '../../services/sampleData';

const TEST_TYPES: TestType[] = [
  'Topic Test',
  'Subject Test',
  'Mixed Test',
  'Full Mock Test',
  'Weekly Test'
];

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

export const TestTrackerView: React.FC = () => {
  const { state, addTest, updateTest, deleteTest, bulkDeleteTests, resetSection, importBulkData } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedMistake, setSelectedMistake] = useState('All');
  const [sortField, setSortField] = useState<'testDate' | 'testName' | 'marksObtained' | 'accuracy'>('testDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Multi-select & Dialog States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isResetSectionOpen, setIsResetSectionOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestItem | null>(null);

  // Sample data fallback
  const { items: displayTests, isSampleState } = useMemo(() => {
    return getWithSampleFallback(state.testTracker, SAMPLE_TESTS);
  }, [state.testTracker]);

  // Form State (empty strings by default so missing values are not fabricated)
  const [formTestType, setFormTestType] = useState<TestType>('Topic Test');
  const [formTestName, setFormTestName] = useState('');
  const [formTestLinkUrl, setFormTestLinkUrl] = useState('');
  const [formTestLinkText, setFormTestLinkText] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formTestDate, setFormTestDate] = useState(new Date().toISOString().split('T')[0]);
  const [formFullMarks, setFormFullMarks] = useState('');
  const [formMarksObtained, setFormMarksObtained] = useState('');
  const [formCorrect, setFormCorrect] = useState('');
  const [formWrong, setFormWrong] = useState('');
  const [formSkipped, setFormSkipped] = useState('');
  const [formTotalQuestions, setFormTotalQuestions] = useState('');
  const [formAccuracy, setFormAccuracy] = useState('');
  const [formTimeTaken, setFormTimeTaken] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formWeakArea, setFormWeakArea] = useState('');
  const [formMistakePattern, setFormMistakePattern] = useState<MistakePattern | ''>('');
  const [formCompleted, setFormCompleted] = useState(false);

  // Extract Subjects for filter
  const subjects = useMemo(() => {
    const set = new Set<string>();
    displayTests.forEach(t => t.subject && set.add(t.subject));
    return Array.from(set).sort();
  }, [displayTests]);

  // Overall KPIs
  const totalTests = displayTests.length;
  const completedTests = displayTests.filter(t => t.completed || (t.marksObtained !== undefined && t.marksObtained > 0) || (t.attempted && t.attempted > 0)).length;
  const testsWithAcc = displayTests.filter(t => t.accuracy !== undefined);
  const avgAccuracy = testsWithAcc.length > 0
    ? Math.round(testsWithAcc.reduce((acc, t) => acc + (t.accuracy || 0), 0) / testsWithAcc.length)
    : 0;
  const totalMarksEarned = displayTests.reduce((acc, t) => acc + (t.marksObtained ?? t.netMarks ?? 0), 0);
  const totalFullMarks = displayTests.reduce((acc, t) => acc + (t.fullMarks || 0), 0);

  const openAddModal = () => {
    setEditingItem(null);
    setFormTestType('Topic Test');
    setFormTestName('');
    setFormTestLinkUrl('');
    setFormTestLinkText('');
    const defaultSubj = selectedSubject !== 'All' ? selectedSubject : (subjects[0] || '');
    setFormSubject(defaultSubj);
    setFormTestDate(new Date().toISOString().split('T')[0]);
    setFormFullMarks('');
    setFormMarksObtained('');
    setFormCorrect('');
    setFormWrong('');
    setFormSkipped('');
    setFormTotalQuestions('');
    setFormAccuracy('');
    setFormTimeTaken('');
    setFormRemarks('');
    setFormWeakArea('');
    setFormMistakePattern('');
    setFormCompleted(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: TestItem) => {
    setEditingItem(item);
    setFormTestType((item.testType as TestType) || 'Topic Test');
    setFormTestName(item.testName);
    if (item.testLink && typeof item.testLink === 'object') {
      setFormTestLinkUrl(item.testLink.url || '');
      setFormTestLinkText(item.testLink.text || '');
    } else {
      setFormTestLinkUrl(String(item.testLink || ''));
      setFormTestLinkText('');
    }
    setFormSubject(item.subject || '');
    setFormTestDate(item.testDate || '');
    setFormFullMarks(item.fullMarks !== undefined ? String(item.fullMarks) : '');
    const m = item.marksObtained ?? item.netMarks;
    setFormMarksObtained(m !== undefined ? String(m) : '');
    setFormCorrect(item.correct !== undefined ? String(item.correct) : '');
    setFormWrong(item.wrong !== undefined ? String(item.wrong) : '');
    setFormSkipped(item.skipped !== undefined ? String(item.skipped) : '');
    setFormTotalQuestions(item.totalQuestions !== undefined ? String(item.totalQuestions) : '');
    setFormAccuracy(item.accuracy !== undefined ? String(item.accuracy) : '');
    setFormTimeTaken(item.timeTaken || '');
    setFormRemarks(item.remarks || '');
    setFormWeakArea(item.weakArea || item.weakAreas || '');
    setFormMistakePattern((item.mistakePattern as MistakePattern) || '');
    setFormCompleted(Boolean(item.completed));
    setIsModalOpen(true);
  };

  const ensureRealTest = async (item: TestItem): Promise<TestItem> => {
    if (!item.isSample) return item;
    const realItems: TestItem[] = displayTests.map(t => ({
      ...t,
      isSample: undefined
    }));
    await importBulkData({ testTracker: realItems }, 'add');
    const matched = realItems.find(t => t.id === item.id) || realItems[0];
    return matched;
  };

  const handleToggleCompleted = async (item: TestItem) => {
    const target = await ensureRealTest(item);
    await updateTest({
      ...target,
      completed: !target.completed
    });
  };

  const handleInlineRemarkChange = async (item: TestItem, newRemarks: string) => {
    const target = await ensureRealTest(item);
    await updateTest({
      ...target,
      remarks: newRemarks.trim()
    });
  };

  const handleInlineWeakAreaChange = async (item: TestItem, newWeak: string) => {
    const target = await ensureRealTest(item);
    await updateTest({
      ...target,
      weakArea: newWeak.trim(),
      weakAreas: newWeak.trim()
    });
  };

  const handleInlineMistakeChange = async (item: TestItem, newMistake: string) => {
    const target = await ensureRealTest(item);
    await updateTest({
      ...target,
      mistakePattern: newMistake ? (newMistake as MistakePattern) : undefined
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let linkField: any = undefined;
    if (formTestLinkUrl.trim()) {
      linkField = {
        url: formTestLinkUrl.trim(),
        text: formTestLinkText.trim() || 'Test Link'
      };
    } else if (formTestLinkText.trim()) {
      linkField = formTestLinkText.trim();
    }

    const fM = formFullMarks.trim() ? parseFloat(formFullMarks) : undefined;
    const mO = formMarksObtained.trim() ? parseFloat(formMarksObtained) : undefined;
    const cQ = formCorrect.trim() ? parseInt(formCorrect) : undefined;
    const wQ = formWrong.trim() ? parseInt(formWrong) : undefined;
    const sQ = formSkipped.trim() ? parseInt(formSkipped) : undefined;
    const tQ = formTotalQuestions.trim() ? parseInt(formTotalQuestions) : undefined;
    let acc = formAccuracy.trim() ? parseFloat(formAccuracy) : undefined;

    if (acc === undefined && cQ !== undefined && (cQ + (wQ || 0)) > 0) {
      acc = Math.round((cQ / (cQ + (wQ || 0))) * 100);
    }

    const payload = {
      completed: formCompleted,
      testType: formTestType,
      testName: formTestName.trim(),
      testLink: linkField,
      subject: formSubject.trim() || undefined,
      testDate: formTestDate.trim() || undefined,
      fullMarks: fM,
      marksObtained: mO,
      netMarks: mO,
      correct: cQ,
      wrong: wQ,
      skipped: sQ,
      totalQuestions: tQ,
      attempted: cQ !== undefined || wQ !== undefined ? (cQ || 0) + (wQ || 0) : undefined,
      accuracy: acc,
      timeTaken: formTimeTaken.trim() || undefined,
      remarks: formRemarks.trim() || undefined,
      weakArea: formWeakArea.trim() || undefined,
      weakAreas: formWeakArea.trim() || undefined,
      mistakePattern: formMistakePattern || undefined
    };

    if (editingItem) {
      await updateTest({
        ...editingItem,
        ...payload
      });
    } else {
      await addTest(payload);
    }
    setIsModalOpen(false);
  };

  const handleSort = (field: 'testDate' | 'testName' | 'marksObtained' | 'accuracy') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredTests = useMemo(() => {
    return displayTests
      .filter(t => {
        if (selectedType !== 'All' && t.testType !== selectedType) return false;
        if (selectedSubject !== 'All' && t.subject !== selectedSubject) return false;
        if (selectedMistake !== 'All' && t.mistakePattern !== selectedMistake) return false;

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchName = t.testName.toLowerCase().includes(term);
          const matchSub = (t.subject || '').toLowerCase().includes(term);
          const matchWeak = (t.weakArea || t.weakAreas || '').toLowerCase().includes(term);
          const matchRemarks = (t.remarks || '').toLowerCase().includes(term);
          if (!matchName && !matchSub && !matchWeak && !matchRemarks) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'marksObtained' || sortField === 'accuracy') {
          const numA = (a.marksObtained ?? a.netMarks) || 0;
          const numB = (b.marksObtained ?? b.netMarks) || 0;
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
        const valA = String(a[sortField] || '').toLowerCase();
        const valB = String(b[sortField] || '').toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [displayTests, selectedType, selectedSubject, selectedMistake, searchTerm, sortField, sortOrder]);

  // Real items that are visible under current filters (excluding sample preview)
  const visibleRealTests = useMemo(() => {
    return filteredTests.filter(t => !t.isSample);
  }, [filteredTests]);

  const isAllVisibleSelected = visibleRealTests.length > 0 && visibleRealTests.every(t => selectedIds.has(t.id));
  const isSomeVisibleSelected = visibleRealTests.some(t => selectedIds.has(t.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealTests.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealTests.forEach(t => next.add(t.id));
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
              <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Test Series & Mock Tracker
            </h2>
            {isSampleState && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 uppercase tracking-wider">
                Sample Preview (1-2 Rows)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Complete 16-field test tracking with direct Excel copy/paste, inline editing, and clickable test links.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportTableToSpreadsheet(state.testTracker, 'GATE_Test_Series_Tracker')}
            className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={() => setIsPasteModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold border border-amber-600 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 rounded-lg flex items-center gap-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors cursor-pointer shadow-xs"
          >
            <ClipboardPaste className="w-4 h-4" />
            Paste from Excel
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Test
          </button>
          <button
            onClick={() => setIsResetSectionOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Test Tracker records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Section Data
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Tests
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
            {totalTests}
          </span>
          <span className="text-[11px] text-slate-400">{completedTests} completed</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Average Accuracy
          </span>
          <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
            {avgAccuracy}%
          </span>
          <span className="text-[11px] text-slate-400">Across attempted tests</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Total Marks Earned
          </span>
          <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
            {totalMarksEarned.toFixed(1)}
          </span>
          <span className="text-[11px] text-slate-400">Out of {totalFullMarks.toFixed(0)} maximum marks</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Marks Conversion
          </span>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
            {totalFullMarks > 0 ? Math.round((totalMarksEarned / totalFullMarks) * 100) : 0}%
          </span>
          <span className="text-[11px] text-slate-400">Aggregate test percentage</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search test name, subject, remarks, or weak area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="All">All Test Types</option>
          {TEST_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {subjects.length > 0 && (
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
          >
            <option value="All">All Subjects ({subjects.length})</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

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

        {(selectedType !== 'All' || selectedSubject !== 'All' || selectedMistake !== 'All' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedType('All');
              setSelectedSubject('All');
              setSelectedMistake('All');
              setSearchTerm('');
            }}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline px-1 cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalVisibleCount={visibleRealTests.length}
        onSelectAllVisible={() => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            visibleRealTests.forEach(t => next.add(t.id));
            return next;
          });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        itemLabel="tests"
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
                    checked={visibleRealTests.length > 0 && isAllVisibleSelected}
                    ref={input => {
                      if (input) input.indeterminate = isSomeVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleRealTests.length === 0}
                    aria-label="Select all visible tests"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                {/* 1. Complete — Checkbox */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Done</th>
                {/* 2. Test Type */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Test Type</th>
                {/* 3. Test Name */}
                <th
                  onClick={() => handleSort('testName')}
                  className="py-3 px-4 cursor-pointer hover:text-amber-600 select-none whitespace-nowrap min-w-[180px]"
                >
                  <div className="flex items-center gap-1">
                    Test Name <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                {/* 4. Test Link */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Test Link</th>
                {/* 5. Subject */}
                <th className="py-3 px-3 whitespace-nowrap min-w-[140px]">Subject</th>
                {/* 6. Test Date */}
                <th
                  onClick={() => handleSort('testDate')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-amber-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Date <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                {/* 7. Full Marks */}
                <th className="py-3 px-3 text-center whitespace-nowrap">Full Marks</th>
                {/* 8. Marks / Net Marks */}
                <th
                  onClick={() => handleSort('marksObtained')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-amber-600 select-none whitespace-nowrap text-amber-600 font-bold"
                >
                  <div className="flex items-center justify-center gap-1">
                    Marks / Net Marks <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                {/* 9. Correct */}
                <th className="py-3 px-3 text-center whitespace-nowrap text-emerald-600 font-bold">Correct</th>
                {/* 10. Wrong */}
                <th className="py-3 px-3 text-center whitespace-nowrap text-rose-500 font-bold">Wrong</th>
                {/* 11. Blank / Skipped */}
                <th className="py-3 px-3 text-center whitespace-nowrap text-amber-500 font-bold">Blank / Skipped</th>
                {/* 12. Accuracy % */}
                <th
                  onClick={() => handleSort('accuracy')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-amber-600 select-none whitespace-nowrap"
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
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={18} className="py-8 text-center text-slate-400 italic">
                    No tests found. Click "Add Test" or upload/paste your test series tracker sheet.
                  </td>
                </tr>
              ) : (
                filteredTests.map((item) => {
                  const isDone = Boolean(item.completed);
                  const marksVal = item.marksObtained ?? item.netMarks;
                  const isSelected = !item.isSample && selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? 'bg-amber-50/60 dark:bg-amber-950/40'
                          : isDone
                          ? 'bg-amber-50/20 dark:bg-amber-950/10'
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
                          aria-label={`Select test ${item.testName}`}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-amber-600 focus:ring-amber-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 1. Complete — Checkbox */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleCompleted(item)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer mx-auto ${
                            isDone
                              ? 'bg-amber-600 text-white hover:bg-amber-700'
                              : 'border-2 border-slate-300 dark:border-slate-600 hover:border-amber-500'
                          }`}
                          title={isDone ? 'Mark Incomplete' : 'Mark Complete'}
                        >
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* 2. Test Type */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {item.testType || 'Topic Test'}
                        </span>
                      </td>

                      {/* 3. Test Name */}
                      <td className={`py-3 px-4 font-semibold text-slate-900 dark:text-white max-w-xs ${isDone ? 'line-through text-slate-400' : ''}`}>
                        <div className="flex items-center gap-1.5 truncate" title={item.testName}>
                          {item.isSample && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0 no-underline">
                              SAMPLE
                            </span>
                          )}
                          <span className="truncate">{item.testName}</span>
                        </div>
                      </td>

                      {/* 4. Test Link */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <HyperlinkView value={item.testLink} defaultLabel="Test Link" />
                      </td>

                      {/* 5. Subject */}
                      <td className={`py-3 px-3 text-slate-600 dark:text-slate-400 max-w-[140px] truncate ${isDone ? 'line-through text-slate-400' : ''}`} title={item.subject}>
                        {item.subject || '—'}
                      </td>

                      {/* 6. Test Date */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.testDate || '—'}
                      </td>

                      {/* 7. Full Marks */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.fullMarks !== undefined ? item.fullMarks : '—'}
                      </td>

                      {/* 8. Marks / Net Marks */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                        {marksVal !== undefined ? marksVal : '—'}
                      </td>

                      {/* 9. Correct */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-bold text-emerald-600 dark:text-emerald-400">
                        {item.correct !== undefined ? item.correct : '—'}
                      </td>

                      {/* 10. Wrong */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-bold text-rose-500 dark:text-rose-400">
                        {item.wrong !== undefined ? item.wrong : '—'}
                      </td>

                      {/* 11. Blank / Skipped */}
                      <td className="py-3 px-3 text-center font-mono whitespace-nowrap font-bold text-amber-500 dark:text-amber-400">
                        {item.skipped !== undefined ? item.skipped : '—'}
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
                          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-amber-500 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden"
                        />
                      </td>

                      {/* 15. Weak Areas (editable inline) */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          defaultValue={item.weakArea || item.weakAreas || ''}
                          onBlur={(e) => handleInlineWeakAreaChange(item, e.target.value)}
                          placeholder="Weak concepts..."
                          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-amber-500 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden"
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
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit test"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!item.isSample && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete test "${item.testName}"?`)) {
                                  deleteTest(item.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete test"
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

      {/* Add / Edit Test Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Test' : 'Add Test'}
        subtitle="Log test series result and analysis. Missing fields can be left blank."
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Test Type
              </label>
              <select
                value={formTestType}
                onChange={(e) => setFormTestType(e.target.value as TestType)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                {TEST_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Discrete Mathematics"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Test Name *
            </label>
            <input
              type="text"
              required
              value={formTestName}
              onChange={(e) => setFormTestName(e.target.value)}
              placeholder="e.g. DM - Topic Test 1 (Propositional Logic)"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Test Link URL (optional)
              </label>
              <input
                type="url"
                value={formTestLinkUrl}
                onChange={(e) => setFormTestLinkUrl(e.target.value)}
                placeholder="https://testseries.com/test/..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
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
                placeholder="e.g. 50"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-amber-600 mb-1">
                Marks / Net Marks
              </label>
              <input
                type="number"
                step="0.01"
                value={formMarksObtained}
                onChange={(e) => setFormMarksObtained(e.target.value)}
                placeholder="e.g. 36.67"
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
                placeholder="e.g. 80"
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
                placeholder="e.g. 90 mins"
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
                placeholder="e.g. 33"
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
                placeholder="e.g. 24"
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
                placeholder="e.g. 6"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-amber-500 mb-1">
                Blank / Skipped
              </label>
              <input
                type="number"
                min="0"
                value={formSkipped}
                onChange={(e) => setFormSkipped(e.target.value)}
                placeholder="e.g. 3"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
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
                value={formWeakArea}
                onChange={(e) => setFormWeakArea(e.target.value)}
                placeholder="e.g. Planar Graph Face Calculation"
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
              placeholder="e.g. Section B numericals need fast arithmetic"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="form-test-complete-check"
              checked={formCompleted}
              onChange={(e) => setFormCompleted(e.target.checked)}
              className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
            />
            <label htmlFor="form-test-complete-check" className="font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
              Mark Test as Completed
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
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg shadow-sm cursor-pointer"
            >
              {editingItem ? 'Save Changes' : 'Save Test'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Paste Modal */}
      <UniversalPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        targetSection="test_tracker"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={async () => {
          await bulkDeleteTests(Array.from(selectedIds));
          setSelectedIds(new Set());
          setIsBulkDeleteOpen(false);
        }}
        title={`Delete ${selectedIds.size} selected records?`}
        message={`Are you sure you want to delete ${selectedIds.size} selected test record(s)?`}
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
          await resetSection('test_tracker');
          setSelectedIds(new Set());
          setIsResetSectionOpen(false);
        }}
        title="Reset Test Series Tracker?"
        message="This will permanently remove all Test Series Tracker records. Other sections will not be affected."
        subMessage="Sample preview will be restored if no records remain. This action can be undone with Undo."
        confirmText="Reset Section"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
