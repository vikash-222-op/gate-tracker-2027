import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  ClipboardPaste,
  CheckCircle2,
  ArrowUpDown,
  ExternalLink,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { LectureItem, LectureStatus } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BulkActionBar } from '../common/BulkActionBar';
import { HyperlinkView } from '../common/HyperlinkView';
import { exportTableToSpreadsheet, STANDARD_GATE_SUBJECTS } from '../../services/excelEngine';
import { UniversalPasteModal } from '../common/UniversalPasteModal';
import { SAMPLE_LECTURES, getWithSampleFallback } from '../../services/sampleData';

export const LectureTrackerView: React.FC = () => {
  const {
    state,
    addLecture,
    updateLecture,
    deleteLecture,
    bulkDeleteLectures,
    resetSection,
    setLectureStatus,
    toggleLectureNotes,
    importBulkData
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedModule, setSelectedModule] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState<'lectureNo' | 'subject' | 'module' | 'lectureTitle' | 'doneDate'>('lectureNo');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-select & Dialog States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isResetSectionOpen, setIsResetSectionOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LectureItem | null>(null);

  // Form State
  const [formSubject, setFormSubject] = useState('');
  const [formModule, setFormModule] = useState('');
  const [formLectureNo, setFormLectureNo] = useState('');
  const [formLectureTitle, setFormLectureTitle] = useState('');
  const [formType, setFormType] = useState('Theory');
  const [formDuration, setFormDuration] = useState('1h 15m');
  const [formNotes, setFormNotes] = useState(false);
  const [formStatus, setFormStatus] = useState<LectureStatus>('Not Started');
  const [formDoneDate, setFormDoneDate] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formLinkUrl, setFormLinkUrl] = useState('');
  const [formLinkText, setFormLinkText] = useState('');

  // Sample data fallback if no real lectures exist
  const { items: displayLectures, isSampleState } = useMemo(() => {
    return getWithSampleFallback(state.lectureTracker, SAMPLE_LECTURES);
  }, [state.lectureTracker]);

  // Extract filter subjects and modules dynamically from displayLectures
  const subjects = useMemo(() => {
    const set = new Set<string>();
    displayLectures.forEach(l => l.subject && set.add(l.subject));
    return Array.from(set).sort();
  }, [displayLectures]);

  // All available subjects for manual entry suggestions:
  // Standard GATE CS subjects + all existing/imported subjects
  const allAvailableSubjects = useMemo(() => {
    const set = new Set<string>(STANDARD_GATE_SUBJECTS);
    state.lectureTracker.forEach(l => l.subject && set.add(l.subject));
    return Array.from(set).sort();
  }, [state.lectureTracker]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    displayLectures.forEach(l => {
      if (selectedSubject === 'All' || l.subject === selectedSubject) {
        if (l.module) set.add(l.module);
      }
    });
    return Array.from(set).sort();
  }, [displayLectures, selectedSubject]);

  // Summary Metrics (calculated from real data if present, or sample)
  const totalLectures = displayLectures.length;
  const completedLectures = displayLectures.filter(l => l.done === 'Completed' || l.done === true).length;
  const skippedLectures = displayLectures.filter(l => l.done === 'Skipped').length;
  const remainingLectures = totalLectures - completedLectures - skippedLectures;
  const progressPct = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;

  const openAddModal = () => {
    setEditingItem(null);
    const defaultSubj = selectedSubject !== 'All' ? selectedSubject : (subjects[0] || '');
    setFormSubject(defaultSubj);
    setFormModule(modules[0] || '');
    setFormLectureNo(String(state.lectureTracker.length + 1));
    setFormLectureTitle('');
    setFormType('Theory');
    setFormDuration('1h 15m');
    setFormNotes(false);
    setFormStatus('Not Started');
    setFormDoneDate('');
    setFormRemarks('');
    setFormLinkUrl('');
    setFormLinkText('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: LectureItem) => {
    setEditingItem(item);
    setFormSubject(item.subject || '');
    setFormModule(item.module);
    setFormLectureNo(String(item.lectureNo ?? ''));
    setFormLectureTitle(item.lectureTitle);
    setFormType(item.type || 'Theory');
    setFormDuration(item.duration || '');
    setFormNotes(Boolean(item.notes));
    setFormStatus((item.done as LectureStatus) || 'Not Started');
    setFormDoneDate(item.doneDate || '');
    setFormRemarks(item.remarks || '');

    if (item.lectureLink && typeof item.lectureLink === 'object') {
      setFormLinkUrl(item.lectureLink.url || '');
      setFormLinkText(item.lectureLink.text || '');
    } else {
      setFormLinkUrl(String(item.lectureLink || ''));
      setFormLinkText('');
    }

    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    let linkField: any = undefined;
    if (formLinkUrl.trim()) {
      linkField = {
        url: formLinkUrl.trim(),
        text: formLinkText.trim() || 'Watch'
      };
    }

    const payload = {
      subject: formSubject.trim() || undefined,
      module: formModule.trim(),
      lectureNo: formLectureNo.trim() || undefined,
      lectureTitle: formLectureTitle.trim(),
      type: formType.trim(),
      duration: formDuration.trim(),
      notes: formNotes,
      done: formStatus,
      doneDate: formStatus === 'Completed' ? (formDoneDate || new Date().toISOString().split('T')[0]) : formDoneDate,
      remarks: formRemarks.trim(),
      lectureLink: linkField
    };

    if (editingItem) {
      await updateLecture({
        ...editingItem,
        ...payload
      });
    } else {
      await addLecture(payload);
    }
    setIsModalOpen(false);
  };

  const handleSort = (field: 'lectureNo' | 'subject' | 'module' | 'lectureTitle' | 'doneDate') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Inline remarks update
  const ensureRealLecture = async (item: LectureItem): Promise<LectureItem> => {
    if (!item.isSample) return item;
    const realItems: LectureItem[] = displayLectures.map(l => ({
      ...l,
      isSample: undefined
    }));
    await importBulkData({ lectureTracker: realItems }, 'add');
    const matched = realItems.find(l => l.id === item.id) || realItems[0];
    return matched;
  };

  const handleInlineRemarkChange = async (item: LectureItem, newRemarks: string) => {
    const target = await ensureRealLecture(item);
    await updateLecture({ ...target, remarks: newRemarks });
  };

  // Inline date update
  const handleInlineDateChange = async (item: LectureItem, newDate: string) => {
    const target = await ensureRealLecture(item);
    await updateLecture({ ...target, doneDate: newDate });
  };

  const handleToggleNotes = async (item: LectureItem) => {
    const target = await ensureRealLecture(item);
    toggleLectureNotes(target.id);
  };

  const handleStatusChange = async (item: LectureItem, status: LectureStatus) => {
    const target = await ensureRealLecture(item);
    setLectureStatus(target.id, status);
  };

  const filteredLectures = useMemo(() => {
    return displayLectures
      .filter(l => {
        if (selectedSubject !== 'All' && l.subject !== selectedSubject) return false;
        if (selectedModule !== 'All' && l.module !== selectedModule) return false;
        if (selectedStatus !== 'All' && l.done !== selectedStatus) return false;

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchTitle = l.lectureTitle.toLowerCase().includes(term);
          const matchModule = l.module.toLowerCase().includes(term);
          const matchSubj = (l.subject || '').toLowerCase().includes(term);
          const matchRemarks = (l.remarks || '').toLowerCase().includes(term);
          const matchNo = String(l.lectureNo || '').includes(term);
          if (!matchTitle && !matchModule && !matchSubj && !matchRemarks && !matchNo) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'lectureNo') {
          const numA = parseFloat(String(a.lectureNo)) || 0;
          const numB = parseFloat(String(b.lectureNo)) || 0;
          return sortOrder === 'asc' ? numA - numB : numB - numA;
        }
        const valA = String(a[sortField] || '').toLowerCase();
        const valB = String(b[sortField] || '').toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [displayLectures, selectedSubject, selectedModule, selectedStatus, searchTerm, sortField, sortOrder]);

  // Real items that are visible under current filters (excluding sample preview)
  const visibleRealLectures = useMemo(() => {
    return filteredLectures.filter(l => !l.isSample);
  }, [filteredLectures]);

  const isAllVisibleSelected = visibleRealLectures.length > 0 && visibleRealLectures.every(l => selectedIds.has(l.id));
  const isSomeVisibleSelected = visibleRealLectures.some(l => selectedIds.has(l.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealLectures.forEach(l => next.delete(l.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealLectures.forEach(l => next.add(l.id));
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
              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Lecture Tracker
            </h2>
            {isSampleState && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 uppercase tracking-wider">
                Sample Preview (1-2 Rows)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Exact order: Subject → Lecture No. → Module → Title → Type → Duration → Notes → Done → Done Date → Remarks
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportTableToSpreadsheet(state.lectureTracker, 'GATE_Lecture_Tracker')}
            className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={() => setIsPasteModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste from Excel
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Lecture
          </button>
          <button
            onClick={() => setIsResetSectionOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Lecture Tracker records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Section Data
          </button>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total Lectures
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
              {totalLectures}
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Completed
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              {completedLectures}
            </span>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Remaining / Not Started
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
              {remainingLectures}
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              <span>Overall Progress</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">{progressPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search lecture title, module, # or remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {subjects.length > 0 && (
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedModule('All');
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
          >
            <option value="All">All Subjects ({subjects.length})</option>
            {subjects.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        <select
          value={selectedModule}
          onChange={(e) => setSelectedModule(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="All">All Modules ({modules.length})</option>
          {modules.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="All">All Status</option>
          <option value="Not Started">Not Started</option>
          <option value="Completed">Completed</option>
          <option value="Skipped">Skipped</option>
        </select>

        {(selectedSubject !== 'All' || selectedModule !== 'All' || selectedStatus !== 'All' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedSubject('All');
              setSelectedModule('All');
              setSelectedStatus('All');
              setSearchTerm('');
            }}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-1 cursor-pointer"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalVisibleCount={visibleRealLectures.length}
        onSelectAllVisible={() => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            visibleRealLectures.forEach(l => next.add(l.id));
            return next;
          });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        itemLabel="lectures"
      />

      {/* Lectures Table: Exact Logical Order */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={visibleRealLectures.length > 0 && isAllVisibleSelected}
                    ref={input => {
                      if (input) input.indeterminate = isSomeVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleRealLectures.length === 0}
                    aria-label="Select all visible lectures"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th
                  onClick={() => handleSort('subject')}
                  className="py-3 px-3 cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Subject <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lectureNo')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Lec # <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('module')}
                  className="py-3 px-4 cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Module <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lectureTitle')}
                  className="py-3 px-4 cursor-pointer hover:text-indigo-600 select-none"
                >
                  <div className="flex items-center gap-1">
                    Lecture Title <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Type</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Duration</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Notes (☐)</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Done Status</th>
                <th
                  onClick={() => handleSort('doneDate')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Done Date <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredLectures.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400 italic">
                    No lectures found. Click "Paste from Excel" or "Add Lecture" to start tracking.
                  </td>
                </tr>
              ) : (
                filteredLectures.map((item) => {
                  const isDone = item.done === 'Completed' || item.done === true;
                  const isSkipped = item.done === 'Skipped';
                  const isSelected = !item.isSample && selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/40'
                          : isDone
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/10'
                          : isSkipped
                          ? 'opacity-60 bg-slate-100/50 dark:bg-slate-900/50'
                          : ''
                      }`}
                    >
                      {/* Checkbox column */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => !item.isSample && toggleSelectOne(item.id)}
                          disabled={!!item.isSample}
                          title={item.isSample ? "Sample demo record cannot be selected or deleted" : "Select row"}
                          aria-label={`Select lecture ${item.lectureTitle}`}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* 1. Subject */}
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {item.isSample && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              SAMPLE
                            </span>
                          )}
                          <span>{item.subject || '—'}</span>
                        </div>
                      </td>

                      {/* 2. Lecture No. */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {item.lectureNo ?? '—'}
                      </td>

                      {/* 3. Module */}
                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {item.module || '—'}
                      </td>

                      {/* 4. Lecture Title */}
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          <span>{item.lectureTitle}</span>
                          {item.lectureLink && (
                            <HyperlinkView value={item.lectureLink} defaultLabel="Video" className="text-xs" />
                          )}
                        </div>
                      </td>

                      {/* 5. Type */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {item.type || '—'}
                        </span>
                      </td>

                      {/* 6. Duration */}
                      <td className="py-3 px-3 text-center font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.duration || '—'}
                      </td>

                      {/* 7. Notes (CHECKBOX) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={Boolean(item.notes)}
                          onChange={() => handleToggleNotes(item)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          title="Notes completed checkbox"
                        />
                      </td>

                      {/* 8. Done (Direct Inline Status Selection: Not Started / Completed / Skipped) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <select
                          value={(item.done as LectureStatus) || 'Not Started'}
                          onChange={(e) => handleStatusChange(item, e.target.value as LectureStatus)}
                          className={`text-xs font-semibold px-2 py-1 rounded-md border cursor-pointer ${
                            isDone
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                              : isSkipped
                              ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500'
                              : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <option value="Not Started">Not Started</option>
                          <option value="Completed">Completed</option>
                          <option value="Skipped">Skipped</option>
                        </select>
                      </td>

                      {/* 9. Done Date (Editable input, enabled when Completed) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {isDone ? (
                          <input
                            type="date"
                            value={item.doneDate || ''}
                            onChange={(e) => handleInlineDateChange(item, e.target.value)}
                            className="text-xs font-mono px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200"
                          />
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* 10. Remarks (Directly editable text input) */}
                      <td className="py-3 px-4 min-w-[200px]">
                        <input
                          type="text"
                          defaultValue={item.remarks || ''}
                          onBlur={(e) => handleInlineRemarkChange(item, e.target.value)}
                          placeholder="Type remarks freely..."
                          className="w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-indigo-500 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden"
                        />
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Edit Lecture Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!item.isSample && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete Lecture #${item.lectureNo}: "${item.lectureTitle}"?`)) {
                                  deleteLecture(item.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete"
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

      {/* Universal Paste from Excel Modal */}
      <UniversalPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        targetSection="lecture_tracker"
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Lecture' : 'Add New Lecture'}
        subtitle="Subject → Lecture No. → Module → Title → Type → Duration → Notes → Done → Done Date → Remarks"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                list="lecture-subject-suggestions"
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Operating System, DBMS, TOC..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
              <datalist id="lecture-subject-suggestions">
                {allAvailableSubjects.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Lecture No.
              </label>
              <input
                type="text"
                value={formLectureNo}
                onChange={(e) => setFormLectureNo(e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Module *
              </label>
              <input
                type="text"
                required
                value={formModule}
                onChange={(e) => setFormModule(e.target.value)}
                placeholder="e.g. Process Management"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Lecture Title *
            </label>
            <input
              type="text"
              required
              value={formLectureTitle}
              onChange={(e) => setFormLectureTitle(e.target.value)}
              placeholder="e.g. Introduction to Process Management"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Type
              </label>
              <input
                type="text"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                placeholder="Theory / Problems"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Duration
              </label>
              <input
                type="text"
                value={formDuration}
                onChange={(e) => setFormDuration(e.target.value)}
                placeholder="1h 25m"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Notes Completed (☐)
              </label>
              <div className="flex items-center h-9">
                <input
                  type="checkbox"
                  checked={formNotes}
                  onChange={(e) => setFormNotes(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="ml-2 text-slate-600 dark:text-slate-400">Notes done</span>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Done Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as LectureStatus)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Not Started">Not Started (Default)</option>
                <option value="Completed">Completed</option>
                <option value="Skipped">Skipped</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Done Date (Optional)
              </label>
              <input
                type="date"
                value={formDoneDate}
                onChange={(e) => setFormDoneDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Lecture Video Link (URL)
              </label>
              <input
                type="url"
                value={formLinkUrl}
                onChange={(e) => setFormLinkUrl(e.target.value)}
                placeholder="https://goclasses.in/..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks (Free text input)
            </label>
            <textarea
              rows={2}
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="e.g. Revise paging again, important trick at 45m"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm"
            >
              {editingItem ? 'Save Changes' : 'Add Lecture'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={async () => {
          await bulkDeleteLectures(Array.from(selectedIds));
          setSelectedIds(new Set());
          setIsBulkDeleteOpen(false);
        }}
        title={`Delete ${selectedIds.size} selected records?`}
        message={`Are you sure you want to delete ${selectedIds.size} selected lecture record(s)?`}
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
          await resetSection('lecture_tracker');
          setSelectedIds(new Set());
          setIsResetSectionOpen(false);
        }}
        title="Reset Lecture Tracker?"
        message="This will permanently remove all Lecture Tracker records. Other sections will not be affected."
        subMessage="Sample preview will be restored if no records remain. This action can be undone with Undo."
        confirmText="Reset Section"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
