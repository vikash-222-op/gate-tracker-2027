import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  Calendar,
  CheckCircle2,
  ArrowUpDown,
  ClipboardPaste
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { RevisionItem } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BulkActionBar } from '../common/BulkActionBar';
import { exportTableToSpreadsheet } from '../../services/excelEngine';
import { UniversalPasteModal } from '../common/UniversalPasteModal';
import { SAMPLE_REVISIONS, getWithSampleFallback } from '../../services/sampleData';

export const RevisionTrackerView: React.FC = () => {
  const { state, addRevision, updateRevision, deleteRevision, bulkDeleteRevisions, resetSection } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState<'subject' | 'module' | 'lastRevision'>('subject');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-select & Dialog States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isResetSectionOpen, setIsResetSectionOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RevisionItem | null>(null);

  // Form State
  const [formSubject, setFormSubject] = useState('');
  const [formModule, setFormModule] = useState('');
  const [formRevision1, setFormRevision1] = useState('');
  const [formRevision2, setFormRevision2] = useState('');
  const [formRevision3, setFormRevision3] = useState('');
  const [formLastRevision, setFormLastRevision] = useState('');
  const [formCompleted, setFormCompleted] = useState(false);
  const [formRemarks, setFormRemarks] = useState('');

  // Sample data fallback
  const { items: displayRevisions, isSampleState } = useMemo(() => {
    return getWithSampleFallback(state.revisionTracker, SAMPLE_REVISIONS);
  }, [state.revisionTracker]);

  // Extract Subjects
  const subjects = useMemo(() => {
    const set = new Set<string>();
    displayRevisions.forEach(r => r.subject && set.add(r.subject));
    return Array.from(set).sort();
  }, [displayRevisions]);

  // Overall metrics
  const totalModules = displayRevisions.length;
  const fullyRevised = displayRevisions.filter(r => r.completed || (r.revision1 && r.revision2 && r.revision3)).length;
  const pendingRev = totalModules - fullyRevised;
  const rev1Count = displayRevisions.filter(r => r.revision1).length;
  const rev2Count = displayRevisions.filter(r => r.revision2).length;
  const rev3Count = displayRevisions.filter(r => r.revision3).length;

  const openAddModal = () => {
    setEditingItem(null);
    const defaultSubj = selectedSubject !== 'All' ? selectedSubject : (subjects[0] || '');
    setFormSubject(defaultSubj);
    setFormModule('');
    setFormRevision1(new Date().toISOString().split('T')[0]);
    setFormRevision2('');
    setFormRevision3('');
    setFormLastRevision(new Date().toISOString().split('T')[0]);
    setFormCompleted(false);
    setFormRemarks('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: RevisionItem) => {
    setEditingItem(item);
    setFormSubject(item.subject);
    setFormModule(item.module);
    setFormRevision1(item.revision1 || '');
    setFormRevision2(item.revision2 || '');
    setFormRevision3(item.revision3 || '');
    setFormLastRevision(item.lastRevision || '');
    setFormCompleted(Boolean(item.completed));
    setFormRemarks(item.remarks || '');
    setIsModalOpen(true);
  };

  const handleToggleDone = async (item: RevisionItem) => {
    if (item.isSample) return;
    await updateRevision({
      ...item,
      completed: !item.completed
    });
  };

  const handleQuickLogRevision = async (item: RevisionItem, slot: 1 | 2 | 3) => {
    if (item.isSample) return;
    const today = new Date().toISOString().split('T')[0];
    const updated: RevisionItem = { ...item };
    if (slot === 1) updated.revision1 = today;
    if (slot === 2) updated.revision2 = today;
    if (slot === 3) updated.revision3 = today;
    updated.lastRevision = today;
    if (updated.revision1 && updated.revision2 && updated.revision3) {
      updated.completed = true;
    }
    await updateRevision(updated);
  };

  const handleInlineRemarkChange = async (item: RevisionItem, newRemarks: string) => {
    if (item.isSample) return;
    await updateRevision({ ...item, remarks: newRemarks.trim() });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const latest = formRevision3 || formRevision2 || formRevision1 || formLastRevision;

    const payload = {
      subject: formSubject.trim(),
      module: formModule.trim(),
      revision1: formRevision1,
      revision2: formRevision2,
      revision3: formRevision3,
      lastRevision: latest,
      completed: formCompleted || (Boolean(formRevision1) && Boolean(formRevision2) && Boolean(formRevision3)),
      remarks: formRemarks.trim()
    };

    if (editingItem) {
      await updateRevision({
        ...editingItem,
        ...payload
      });
    } else {
      await addRevision(payload);
    }
    setIsModalOpen(false);
  };

  const handleSort = (field: 'subject' | 'module' | 'lastRevision') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredRevisions = useMemo(() => {
    return displayRevisions
      .filter(r => {
        if (selectedSubject !== 'All' && r.subject !== selectedSubject) return false;
        if (selectedStatus === 'Completed' && !r.completed) return false;
        if (selectedStatus === 'Pending' && r.completed) return false;
        if (selectedStatus === 'Need Rev 1' && r.revision1) return false;
        if (selectedStatus === 'Need Rev 2' && (r.revision2 || !r.revision1)) return false;
        if (selectedStatus === 'Need Rev 3' && (r.revision3 || !r.revision2)) return false;

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchSub = r.subject.toLowerCase().includes(term);
          const matchMod = r.module.toLowerCase().includes(term);
          const matchRem = (r.remarks || '').toLowerCase().includes(term);
          if (!matchSub && !matchMod && !matchRem) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const valA = String(a[sortField] || '').toLowerCase();
        const valB = String(b[sortField] || '').toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [displayRevisions, selectedSubject, selectedStatus, searchTerm, sortField, sortOrder]);

  // Real items that are visible under current filters (excluding sample preview)
  const visibleRealRevisions = useMemo(() => {
    return filteredRevisions.filter(r => !r.isSample);
  }, [filteredRevisions]);

  const isAllVisibleSelected = visibleRealRevisions.length > 0 && visibleRealRevisions.every(r => selectedIds.has(r.id));
  const isSomeVisibleSelected = visibleRealRevisions.some(r => selectedIds.has(r.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealRevisions.forEach(r => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealRevisions.forEach(r => next.add(r.id));
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
              <RotateCcw className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Revision Tracker (Module-Wise)
            </h2>
            {isSampleState && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 uppercase tracking-wider">
                Sample Preview (1-2 Rows)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Module-wise repetition system (Subject + Module unique). Track Revision 1, 2, 3 and Last Revision.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportTableToSpreadsheet(state.revisionTracker, 'GATE_Revision_Tracker')}
            className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={() => setIsPasteModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-purple-600 dark:border-purple-500 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 rounded-lg flex items-center gap-1.5 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste from Excel
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Module
          </button>
          <button
            onClick={() => setIsResetSectionOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Revision Tracker records"
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
            Total Modules
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
            {totalModules}
          </span>
          <span className="text-[11px] text-slate-400">Unique Subject-Module units</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Revision 1 Done
          </span>
          <span className="text-2xl font-bold text-sky-600 dark:text-sky-400 font-mono mt-0.5 block">
            {rev1Count} <span className="text-xs text-slate-400">/ {totalModules}</span>
          </span>
          <span className="text-[11px] text-slate-400">1st Consolidation</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Revision 2 Done
          </span>
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
            {rev2Count} <span className="text-xs text-slate-400">/ {totalModules}</span>
          </span>
          <span className="text-[11px] text-slate-400">2nd Deep Review</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
            Revision 3 Done (Mastery)
          </span>
          <span className="text-2xl font-bold text-purple-600 dark:text-purple-400 font-mono mt-0.5 block">
            {rev3Count} <span className="text-xs text-slate-400">/ {totalModules}</span>
          </span>
          <span className="text-[11px] text-slate-400">Exam-Ready retention</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search module, subject or remarks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

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
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="All">All Revisions</option>
          <option value="Completed">Mastered (Completed)</option>
          <option value="Pending">Pending Revisions</option>
          <option value="Need Rev 1">Pending Rev 1</option>
          <option value="Need Rev 2">Pending Rev 2</option>
          <option value="Need Rev 3">Pending Rev 3</option>
        </select>

        {(selectedSubject !== 'All' || selectedStatus !== 'All' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedSubject('All');
              setSelectedStatus('All');
              setSearchTerm('');
            }}
            className="text-xs text-purple-600 dark:text-purple-400 hover:underline px-1"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalVisibleCount={visibleRealRevisions.length}
        onSelectAllVisible={() => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            visibleRealRevisions.forEach(r => next.add(r.id));
            return next;
          });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        itemLabel="modules"
      />

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={visibleRealRevisions.length > 0 && isAllVisibleSelected}
                    ref={input => {
                      if (input) input.indeterminate = isSomeVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleRealRevisions.length === 0}
                    aria-label="Select all visible revision modules"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Done</th>
                <th
                  onClick={() => handleSort('subject')}
                  className="py-3 px-4 cursor-pointer hover:text-purple-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Subject <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('module')}
                  className="py-3 px-4 cursor-pointer hover:text-purple-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Module <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Revision 1</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Revision 2</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Revision 3</th>
                <th
                  onClick={() => handleSort('lastRevision')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-purple-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Last Revision <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredRevisions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                    No revision modules found. Add a module or import from your Excel workbook.
                  </td>
                </tr>
              ) : (
                filteredRevisions.map((item) => {
                  const isDone = item.completed || (Boolean(item.revision1) && Boolean(item.revision2) && Boolean(item.revision3));
                  const isSelected = !item.isSample && selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? 'bg-purple-50/60 dark:bg-purple-950/40'
                          : isDone
                          ? 'bg-purple-50/20 dark:bg-purple-950/10 text-slate-500 dark:text-slate-400'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => !item.isSample && toggleSelectOne(item.id)}
                          disabled={!!item.isSample}
                          title={item.isSample ? "Sample demo record cannot be selected or deleted" : "Select row"}
                          aria-label={`Select revision module ${item.module}`}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleDone(item)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                            isDone
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'border-2 border-slate-300 dark:border-slate-600 hover:border-purple-500'
                          }`}
                          title={isDone ? 'Mark Incomplete' : 'Mark Complete'}
                        >
                          {isDone && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className={`py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap ${isDone ? 'line-through text-slate-500 dark:text-slate-400' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          {item.isSample && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 no-underline">
                              SAMPLE
                            </span>
                          )}
                          <span>{item.subject}</span>
                        </div>
                      </td>
                      <td className={`py-3 px-4 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                        {item.module}
                      </td>

                      {/* Revision 1 */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.revision1 ? (
                          <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${isDone ? 'line-through text-slate-400 bg-slate-100 dark:bg-slate-800' : 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40'}`}>
                            {item.revision1}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleQuickLogRevision(item, 1)}
                            className="text-[11px] text-slate-400 hover:text-sky-600 hover:underline cursor-pointer"
                          >
                            + Log Rev 1
                          </button>
                        )}
                      </td>

                      {/* Revision 2 */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.revision2 ? (
                          <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${isDone ? 'line-through text-slate-400 bg-slate-100 dark:bg-slate-800' : 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'}`}>
                            {item.revision2}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleQuickLogRevision(item, 2)}
                            className="text-[11px] text-slate-400 hover:text-indigo-600 hover:underline cursor-pointer"
                          >
                            + Log Rev 2
                          </button>
                        )}
                      </td>

                      {/* Revision 3 */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.revision3 ? (
                          <span className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${isDone ? 'line-through text-slate-400 bg-slate-100 dark:bg-slate-800' : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'}`}>
                            {item.revision3}
                          </span>
                        ) : (
                          <button
                            onClick={() => handleQuickLogRevision(item, 3)}
                            className="text-[11px] text-slate-400 hover:text-purple-600 hover:underline cursor-pointer"
                          >
                            + Log Rev 3
                          </button>
                        )}
                      </td>

                      {/* Last Revision */}
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {item.lastRevision || '—'}
                      </td>

                      {/* Inline Editable Remarks */}
                      <td className="py-3 px-4 min-w-[200px]">
                        <input
                          type="text"
                          defaultValue={item.remarks || ''}
                          onBlur={(e) => handleInlineRemarkChange(item, e.target.value)}
                          placeholder="Type remarks freely..."
                          className={`w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-purple-500 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden ${
                            isDone ? 'line-through text-slate-400' : ''
                          }`}
                        />
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 rounded text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!item.isSample && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete revision entry for "${item.subject} - ${item.module}"?`)) {
                                  deleteRevision(item.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Module Revision' : 'Add Module to Revision Tracker'}
        subtitle="Each unique Subject + Module appears only once"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Subject *
              </label>
              <input
                type="text"
                required
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder="e.g. Discrete Mathematics"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
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
                placeholder="e.g. Propositional Logic"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Revision 1 Date
              </label>
              <input
                type="date"
                value={formRevision1}
                onChange={(e) => setFormRevision1(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Revision 2 Date
              </label>
              <input
                type="date"
                value={formRevision2}
                onChange={(e) => setFormRevision2(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Revision 3 Date
              </label>
              <input
                type="date"
                value={formRevision3}
                onChange={(e) => setFormRevision3(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="formCompletedRev"
              checked={formCompleted}
              onChange={(e) => setFormCompleted(e.target.checked)}
              className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="formCompletedRev" className="text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              Mark this module revision as completely mastered
            </label>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="e.g. Reviewed short notes and tricky theorems"
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
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-sm"
            >
              {editingItem ? 'Save Changes' : 'Add Module'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Paste Modal */}
      <UniversalPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        targetSection="revision_tracker"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={async () => {
          await bulkDeleteRevisions(Array.from(selectedIds));
          setSelectedIds(new Set());
          setIsBulkDeleteOpen(false);
        }}
        title={`Delete ${selectedIds.size} selected records?`}
        message={`Are you sure you want to delete ${selectedIds.size} selected revision record(s)?`}
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
          await resetSection('revision_tracker');
          setSelectedIds(new Set());
          setIsResetSectionOpen(false);
        }}
        title="Reset Revision Tracker?"
        message="This will permanently remove all Revision Tracker records. Other sections will not be affected."
        subMessage="Sample preview will be restored if no records remain. This action can be undone with Undo."
        confirmText="Reset Section"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
