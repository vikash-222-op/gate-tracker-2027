import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  AlertCircle,
  ArrowUpDown,
  CheckCircle2,
  ClipboardPaste,
  Info,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PYQItem } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BulkActionBar } from '../common/BulkActionBar';
import { exportTableToSpreadsheet } from '../../services/excelEngine';
import { UniversalPasteModal } from '../common/UniversalPasteModal';
import { SAMPLE_PYQS, getWithSampleFallback } from '../../services/sampleData';

export const PYQTrackerView: React.FC = () => {
  const { state, addPYQ, updatePYQ, deletePYQ, bulkDeletePYQs, resetSection, importBulkData } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [selectedModule, setSelectedModule] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortField, setSortField] = useState<'subject' | 'module' | 'topic' | 'remaining' | 'totalPYQs'>('subject');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Multi-select & Dialog States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isResetSectionOpen, setIsResetSectionOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PYQItem | null>(null);

  // Notification / Alert message for solved limit
  const [limitNotice, setLimitNotice] = useState<string | null>(null);

  // Form State
  const [formSubject, setFormSubject] = useState('');
  const [formModule, setFormModule] = useState('');
  const [formTopic, setFormTopic] = useState('');
  const [formTotalPYQs, setFormTotalPYQs] = useState('30');
  const [formSolved, setFormSolved] = useState('0');
  const [formCompleted, setFormCompleted] = useState(false);
  const [formRemarks, setFormRemarks] = useState('');

  // Sample data fallback
  const { items: displayPYQs, isSampleState } = useMemo(() => {
    return getWithSampleFallback(state.pyqTracker, SAMPLE_PYQS);
  }, [state.pyqTracker]);

  // Extract filter options
  const subjects = useMemo(() => {
    const set = new Set<string>();
    displayPYQs.forEach(p => p.subject && set.add(p.subject));
    return Array.from(set).sort();
  }, [displayPYQs]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    displayPYQs.forEach(p => {
      if (selectedSubject === 'All' || p.subject === selectedSubject) {
        if (p.module) set.add(p.module);
      }
    });
    return Array.from(set).sort();
  }, [displayPYQs, selectedSubject]);

  // Overall metrics
  const totalPYQs = displayPYQs.reduce((acc, p) => acc + (p.totalPYQs || 0), 0);
  const totalSolved = displayPYQs.reduce((acc, p) => acc + (p.solved || 0), 0);
  const totalRemaining = Math.max(0, totalPYQs - totalSolved);
  const completedGroups = displayPYQs.filter(p => p.completed).length;
  const progressPct = totalPYQs > 0 ? Math.round((totalSolved / totalPYQs) * 100) : 0;

  const ensureRealPYQ = async (item: PYQItem): Promise<PYQItem> => {
    if (!item.isSample) return item;
    const realItems: PYQItem[] = displayPYQs.map(p => ({
      ...p,
      isSample: undefined
    }));
    await importBulkData({ pyqTracker: realItems }, 'add');
    const matched = realItems.find(p => p.id === item.id) || realItems[0];
    return matched;
  };

  const openAddModal = () => {
    setEditingItem(null);
    const defaultSubj = selectedSubject !== 'All' ? selectedSubject : (subjects[0] || '');
    setFormSubject(defaultSubj);
    setFormModule(modules[0] || 'Module 1');
    setFormTopic('');
    setFormTotalPYQs('30');
    setFormSolved('0');
    setFormCompleted(false);
    setFormRemarks('');
    setIsModalOpen(true);
  };

  const openEditModal = async (item: PYQItem) => {
    const target = await ensureRealPYQ(item);
    setEditingItem(target);
    setFormSubject(target.subject);
    setFormModule(target.module);
    setFormTopic(target.topic);
    setFormTotalPYQs(String(target.totalPYQs || 0));
    setFormSolved(String(target.solved || 0));
    setFormCompleted(target.completed);
    setFormRemarks(target.remarks || '');
    setIsModalOpen(true);
  };

  const handleToggleCompleted = async (item: PYQItem) => {
    const target = await ensureRealPYQ(item);
    await updatePYQ({
      ...target,
      completed: !target.completed
    });
  };

  const handleQuickUpdateSolved = async (item: PYQItem, delta: number) => {
    const target = await ensureRealPYQ(item);
    
    // Strict Limit Check: Solved must NEVER exceed Total PYQs
    if (delta > 0 && target.solved >= target.totalPYQs) {
      setLimitNotice(`Topic "${target.topic}": All available PYQs have been solved.`);
      setTimeout(() => setLimitNotice(null), 3500);
      return;
    }

    const newSolved = Math.min(target.totalPYQs, Math.max(0, (target.solved || 0) + delta));
    const newRemaining = Math.max(0, target.totalPYQs - newSolved);
    
    // Automatic completion behavior: When Solved == Total PYQs, automatically mark completed
    let isCompleted = target.completed;
    if (target.totalPYQs > 0 && newSolved >= target.totalPYQs) {
      isCompleted = true;
    }
    
    await updatePYQ({
      ...target,
      solved: newSolved,
      remaining: newRemaining,
      completed: isCompleted
    });
  };

  const handleInlineRemarkChange = async (item: PYQItem, newRemarks: string) => {
    const target = await ensureRealPYQ(item);
    await updatePYQ({ ...target, remarks: newRemarks.trim() });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const tot = Math.max(0, parseInt(formTotalPYQs) || 0);
    const solRaw = Math.max(0, parseInt(formSolved) || 0);
    // Solved must NEVER exceed Total PYQs
    const sol = Math.min(tot, solRaw);
    const rem = Math.max(0, tot - sol);
    // Separate editable state: if editing, honor formCompleted directly
    const isComp = editingItem ? formCompleted : (formCompleted || (tot > 0 && sol >= tot));

    const payload = {
      subject: formSubject.trim(),
      module: formModule.trim(),
      topic: formTopic.trim(),
      totalPYQs: tot,
      solved: sol,
      remaining: rem,
      completed: isComp,
      remarks: formRemarks.trim()
    };

    if (editingItem) {
      await updatePYQ({
        ...editingItem,
        ...payload
      });
    } else {
      await addPYQ(payload);
    }
    setIsModalOpen(false);
  };

  const handleSort = (field: 'subject' | 'module' | 'topic' | 'remaining' | 'totalPYQs') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredPYQs = useMemo(() => {
    return displayPYQs
      .filter(p => {
        if (selectedSubject !== 'All' && p.subject !== selectedSubject) return false;
        if (selectedModule !== 'All' && p.module !== selectedModule) return false;
        if (selectedStatus === 'Completed' && !p.completed) return false;
        if (selectedStatus === 'Pending' && p.completed) return false;

        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const matchTopic = p.topic.toLowerCase().includes(term);
          const matchMod = p.module.toLowerCase().includes(term);
          const matchSubj = p.subject.toLowerCase().includes(term);
          const matchRem = (p.remarks || '').toLowerCase().includes(term);
          if (!matchTopic && !matchMod && !matchSubj && !matchRem) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortField === 'remaining' || sortField === 'totalPYQs') {
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
  }, [displayPYQs, selectedSubject, selectedModule, selectedStatus, searchTerm, sortField, sortOrder]);

  // Real items that are visible under current filters (excluding sample preview)
  const visibleRealPYQs = useMemo(() => {
    return filteredPYQs.filter(p => !p.isSample);
  }, [filteredPYQs]);

  const isAllVisibleSelected = visibleRealPYQs.length > 0 && visibleRealPYQs.every(p => selectedIds.has(p.id));
  const isSomeVisibleSelected = visibleRealPYQs.some(p => selectedIds.has(p.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealPYQs.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealPYQs.forEach(p => next.add(p.id));
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
              <CheckSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              PYQ Tracker
            </h2>
            {isSampleState && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 uppercase tracking-wider">
                Sample Preview (1-2 Rows)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Exact order: Checkbox → Subject → Module → Topic → Total PYQs → Solved → Remaining → Remarks
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportTableToSpreadsheet(state.pyqTracker, 'GATE_PYQ_Tracker')}
            className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export Excel
          </button>
          <button
            onClick={() => setIsPasteModalOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-lg flex items-center gap-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Paste from Excel
          </button>
          <button
            onClick={openAddModal}
            className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add PYQ Group
          </button>
          <button
            onClick={() => setIsResetSectionOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset PYQ Tracker records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Section Data
          </button>
        </div>
      </div>

      {/* Solved Limit Alert Notice */}
      {limitNotice && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{limitNotice}</span>
          </div>
          <button
            onClick={() => setLimitNotice(null)}
            className="text-amber-700 dark:text-amber-300 hover:underline font-medium text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Total PYQs
            </span>
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
              {totalPYQs}
            </span>
            <span className="text-[11px] text-slate-400">Across {state.pyqTracker.length} topic groups</span>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Solved
            </span>
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
              {totalSolved}
            </span>
            <span className="text-[11px] text-slate-400">{completedGroups} topics fully completed</span>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Remaining
            </span>
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono mt-0.5 block">
              {totalRemaining}
            </span>
            <span className="text-[11px] text-slate-400">Unsolved questions</span>
          </div>

          <div>
            <div className="flex justify-between items-center text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              <span>Solved Progress</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{progressPct}%</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
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
            placeholder="Search topic, module, subject, or remarks..."
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
          <option value="Completed">Completed Only</option>
          <option value="Pending">Pending Only</option>
        </select>

        {(selectedSubject !== 'All' || selectedModule !== 'All' || selectedStatus !== 'All' || searchTerm) && (
          <button
            onClick={() => {
              setSelectedSubject('All');
              setSelectedModule('All');
              setSelectedStatus('All');
              setSearchTerm('');
            }}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline px-1"
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalVisibleCount={visibleRealPYQs.length}
        onSelectAllVisible={() => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            visibleRealPYQs.forEach(p => next.add(p.id));
            return next;
          });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        itemLabel="topics"
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
                    checked={visibleRealPYQs.length > 0 && isAllVisibleSelected}
                    ref={input => {
                      if (input) input.indeterminate = isSomeVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleRealPYQs.length === 0}
                    aria-label="Select all visible PYQs"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Done</th>
                <th
                  onClick={() => handleSort('subject')}
                  className="py-3 px-4 cursor-pointer hover:text-emerald-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Subject <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('module')}
                  className="py-3 px-4 cursor-pointer hover:text-emerald-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    Module <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('topic')}
                  className="py-3 px-4 cursor-pointer hover:text-emerald-600 select-none"
                >
                  <div className="flex items-center gap-1">
                    Topic <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalPYQs')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-emerald-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Total PYQs <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Solved (Fast Track)</th>
                <th
                  onClick={() => handleSort('remaining')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-emerald-600 select-none whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1">
                    Remaining <ArrowUpDown className="w-3 h-3 opacity-60" />
                  </div>
                </th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredPYQs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                    No PYQ topics found. Click "Add PYQ Group" or import your Excel file.
                  </td>
                </tr>
              ) : (
                filteredPYQs.map((item) => {
                  const isDone = Boolean(item.completed);
                  const isOverflow = item.solved > item.totalPYQs;
                  const isSelected = !item.isSample && selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/40'
                          : isDone
                          ? 'bg-emerald-50/20 dark:bg-emerald-950/10 text-slate-500 dark:text-slate-400'
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
                          aria-label={`Select topic ${item.topic}`}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleToggleCompleted(item)}
                          className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                            isDone
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                          }`}
                          title={isDone ? 'Mark as Incomplete' : 'Mark as Complete'}
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
                      <td className={`py-3 px-4 font-medium text-slate-900 dark:text-white ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                        {item.topic}
                      </td>
                      <td className={`py-3 px-3 text-center font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap ${isDone ? 'line-through text-slate-400' : ''}`}>
                        {item.totalPYQs}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleQuickUpdateSolved(item, -1)}
                            disabled={item.solved <= 0}
                            className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                            title="Decrease solved"
                          >
                            -
                          </button>
                          <span
                            className={`font-mono font-bold px-1.5 py-0.5 rounded text-xs min-w-[28px] text-center ${
                              isDone ? 'line-through text-slate-400' : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {item.solved}
                          </span>
                          <button
                            onClick={() => handleQuickUpdateSolved(item, 1)}
                            className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center font-bold cursor-pointer"
                            title={item.solved >= item.totalPYQs ? 'All available PYQs have been solved' : 'Increase solved'}
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            item.remaining === 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {item.remaining}
                        </span>
                      </td>
                      {/* Direct Inline Editable Remarks */}
                      <td className="py-3 px-4 min-w-[220px]">
                        <input
                          type="text"
                          defaultValue={item.remarks || ''}
                          onBlur={(e) => handleInlineRemarkChange(item, e.target.value)}
                          placeholder="Type remarks freely..."
                          className={`w-full px-2 py-1 text-xs bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-emerald-500 rounded text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden ${
                            isDone ? 'line-through text-slate-400' : ''
                          }`}
                        />
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {!item.isSample && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete PYQ topic "${item.topic}"?`)) {
                                  deletePYQ(item.id);
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
        title={editingItem ? 'Edit PYQ Group' : 'Add New PYQ Group'}
        subtitle="One row represents a topic/PYQ group"
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

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Topic Name *
            </label>
            <input
              type="text"
              required
              value={formTopic}
              onChange={(e) => setFormTopic(e.target.value)}
              placeholder="e.g. Propositional Equivalences & Truth Tables"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Total PYQs *
              </label>
              <input
                type="number"
                min="0"
                required
                value={formTotalPYQs}
                onChange={(e) => setFormTotalPYQs(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Solved
              </label>
              <input
                type="number"
                min="0"
                value={formSolved}
                onChange={(e) => setFormSolved(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Remaining (Calculated)
              </label>
              <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold">
                {Math.max(0, (parseInt(formTotalPYQs) || 0) - (parseInt(formSolved) || 0))}
              </div>
            </div>
          </div>

          {parseInt(formSolved) > parseInt(formTotalPYQs) && (
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-center gap-2 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Note: Solved count ({formSolved}) is greater than Total PYQs ({formTotalPYQs}).</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="formCompleted"
              checked={formCompleted}
              onChange={(e) => setFormCompleted(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="formCompleted" className="text-slate-700 dark:text-slate-300 select-none cursor-pointer">
              Mark this topic PYQ work as fully completed
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
              placeholder="e.g. All GATE 1990-2026 solved; 5 tough MSQs marked for revision"
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
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shadow-sm"
            >
              {editingItem ? 'Save Changes' : 'Add PYQ Group'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Paste Modal */}
      <UniversalPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        targetSection="pyq_tracker"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={async () => {
          await bulkDeletePYQs(Array.from(selectedIds));
          setSelectedIds(new Set());
          setIsBulkDeleteOpen(false);
        }}
        title={`Delete ${selectedIds.size} selected records?`}
        message={`Are you sure you want to delete ${selectedIds.size} selected PYQ record(s)?`}
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
          await resetSection('pyq_tracker');
          setSelectedIds(new Set());
          setIsResetSectionOpen(false);
        }}
        title="Reset PYQ Tracker?"
        message="This will permanently remove all PYQ Tracker records. Other sections will not be affected."
        subMessage="Sample preview will be restored if no records remain. This action can be undone with Undo."
        confirmText="Reset Section"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
