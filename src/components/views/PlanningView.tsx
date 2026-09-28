import React, { useState, useMemo } from 'react';
import {
  ListTodo,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowUpDown,
  ClipboardPaste,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlanningItem, Priority } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BulkActionBar } from '../common/BulkActionBar';
import { exportTableToSpreadsheet } from '../../services/excelEngine';
import { UniversalPasteModal } from '../common/UniversalPasteModal';
import { SAMPLE_PLANNING, getWithSampleFallback } from '../../services/sampleData';

export const PlanningView: React.FC = () => {
  const { state, addPlanning, updatePlanning, deletePlanning, bulkDeletePlanning, resetSection } = useApp();

  const [activeTab, setActiveTab] = useState<'today' | 'upcoming' | 'completed' | 'all'>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');

  // Multi-select & Dialog States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isResetSectionOpen, setIsResetSectionOpen] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);

  // Sample data fallback
  const { items: displayPlanning, isSampleState } = useMemo(() => {
    return getWithSampleFallback(state.planning, SAMPLE_PLANNING);
  }, [state.planning]);

  // Form State
  const todayStr = new Date().toISOString().split('T')[0];
  const [formDate, setFormDate] = useState(todayStr);
  const [formTask, setFormTask] = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formModule, setFormModule] = useState('');
  const [formType, setFormType] = useState<'Lecture' | 'PYQ' | 'Revision' | 'Quiz' | 'Test' | 'Other'>('Lecture');
  const [formPriority, setFormPriority] = useState<Priority>('High');
  const [formTarget, setFormTarget] = useState('');
  const [formCompleted, setFormCompleted] = useState(false);
  const [formRemarks, setFormRemarks] = useState('');

  const openAddModal = () => {
    setEditingItem(null);
    setFormDate(todayStr);
    setFormTask('');
    setFormSubject('');
    setFormModule('');
    setFormType('Lecture');
    setFormPriority('High');
    setFormTarget('2 Hours / 1 Topic');
    setFormCompleted(false);
    setFormRemarks('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: PlanningItem) => {
    setEditingItem(item);
    setFormDate(item.date);
    setFormTask(item.task);
    setFormSubject(item.subject || '');
    setFormModule(item.module || '');
    setFormType((item.type as any) || 'Lecture');
    setFormPriority((item.priority as Priority) || 'High');
    setFormTarget(item.target || '');
    setFormCompleted(item.completed);
    setFormRemarks(item.remarks || '');
    setIsModalOpen(true);
  };

  const handleToggleComplete = async (item: PlanningItem) => {
    if (item.isSample) return;
    await updatePlanning({
      ...item,
      completed: !item.completed
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      date: formDate,
      task: formTask.trim(),
      subject: formSubject.trim() || undefined,
      module: formModule.trim() || undefined,
      type: formType,
      priority: formPriority,
      target: formTarget.trim() || undefined,
      completed: formCompleted,
      remarks: formRemarks.trim() || undefined
    };

    if (editingItem) {
      await updatePlanning({
        ...editingItem,
        ...payload
      });
    } else {
      await addPlanning(payload);
    }
    setIsModalOpen(false);
  };

  // Tab Filtering & Sorting (completed tasks pushed below active tasks)
  const filteredTasks = useMemo(() => {
    return displayPlanning.filter(p => {
      if (activeTab === 'today') {
        if (p.date !== todayStr) return false;
      } else if (activeTab === 'upcoming') {
        if (p.date <= todayStr || p.completed) return false;
      } else if (activeTab === 'completed') {
        if (!p.completed) return false;
      }

      if (selectedType !== 'All' && p.type !== selectedType) return false;
      if (selectedPriority !== 'All' && p.priority !== selectedPriority) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchTask = p.task.toLowerCase().includes(term);
        const matchSub = (p.subject || '').toLowerCase().includes(term);
        const matchMod = (p.module || '').toLowerCase().includes(term);
        if (!matchTask && !matchSub && !matchMod) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.date > b.date ? 1 : -1;
    });
  }, [displayPlanning, activeTab, todayStr, selectedType, selectedPriority, searchTerm]);

  // Counts
  const todayCount = displayPlanning.filter(p => p.date === todayStr).length;
  const upcomingCount = displayPlanning.filter(p => p.date > todayStr && !p.completed).length;
  const completedCount = displayPlanning.filter(p => p.completed).length;
  const allCount = displayPlanning.length;

  // Real items that are visible under current filters (excluding sample preview)
  const visibleRealPlanning = useMemo(() => {
    return filteredTasks.filter(p => !p.isSample);
  }, [filteredTasks]);

  const isAllVisibleSelected = visibleRealPlanning.length > 0 && visibleRealPlanning.every(p => selectedIds.has(p.id));
  const isSomeVisibleSelected = visibleRealPlanning.some(p => selectedIds.has(p.id)) && !isAllVisibleSelected;

  const toggleSelectAllVisible = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealPlanning.forEach(p => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        visibleRealPlanning.forEach(p => next.add(p.id));
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
              <ListTodo className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Study Planning & Daily Schedule
            </h2>
            {isSampleState && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 uppercase tracking-wider">
                Sample Preview (1-2 Rows)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Set concise targets for lectures, PYQs, revisions, and tests without overcomplicated project management.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => exportTableToSpreadsheet(state.planning, 'GATE_Study_Plan')}
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
            Add Task
          </button>
          <button
            onClick={() => setIsResetSectionOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Planning records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Section Data
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('today')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'today'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <span>Today's Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 dark:bg-indigo-950/60 font-mono">
            {todayCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'upcoming'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <span>Upcoming</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">
            {upcomingCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'completed'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <span>Completed</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono">
            {completedCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
          }`}
        >
          <span>All Tasks</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-slate-800 font-mono">
            {allCount}
          </span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search tasks, subjects, modules..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="All">All Types</option>
          <option value="Lecture">Lecture</option>
          <option value="PYQ">PYQ</option>
          <option value="Revision">Revision</option>
          <option value="Quiz">Quiz</option>
          <option value="Test">Test</option>
          <option value="Other">Other</option>
        </select>

        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
        >
          <option value="All">All Priorities</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalVisibleCount={visibleRealPlanning.length}
        onSelectAllVisible={() => {
          setSelectedIds(prev => {
            const next = new Set(prev);
            visibleRealPlanning.forEach(p => next.add(p.id));
            return next;
          });
        }}
        onClearSelection={() => setSelectedIds(new Set())}
        onDeleteSelected={() => setIsBulkDeleteOpen(true)}
        itemLabel="tasks"
      />

      {/* Task List / Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={visibleRealPlanning.length > 0 && isAllVisibleSelected}
                    ref={input => {
                      if (input) input.indeterminate = isSomeVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    disabled={visibleRealPlanning.length === 0}
                    aria-label="Select all visible tasks"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Status</th>
                <th className="py-3 px-4">Task Description</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Target Date</th>
                <th className="py-3 px-3 whitespace-nowrap">Subject / Module</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Type</th>
                <th className="py-3 px-3 text-center whitespace-nowrap">Priority</th>
                <th className="py-3 px-3 whitespace-nowrap">Target</th>
                <th className="py-3 px-4">Remarks</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                    No tasks found in this view. Click "Add Task" to plan your next session.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((item) => {
                  const isSelected = !item.isSample && selectedIds.has(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/60 dark:bg-indigo-950/40'
                          : item.completed
                          ? 'bg-slate-50/40 dark:bg-slate-800/20 opacity-75'
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
                          aria-label={`Select task ${item.task}`}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleToggleComplete(item)}
                        className={`w-5 h-5 rounded flex items-center justify-center transition-colors cursor-pointer ${
                          item.completed
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border-2 border-slate-300 dark:border-slate-600 hover:border-emerald-500'
                        }`}
                        title={item.completed ? 'Mark pending' : 'Mark completed'}
                      >
                        {item.completed && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                      <div className="flex items-center gap-1.5">
                        {item.isSample && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 no-underline shrink-0">
                            SAMPLE
                          </span>
                        )}
                        <span className={item.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}>
                          {item.task}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {item.date}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      <div>
                        <span>{item.subject || '—'}</span>
                        {item.module && (
                          <span className="block text-[10px] text-slate-400 font-normal">
                            {item.module}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          item.priority === 'High'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                            : item.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {item.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {item.target || '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-500 dark:text-slate-400" title={item.remarks}>
                      {item.remarks || <span className="text-slate-400 italic">—</span>}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete task "${item.task}"?`)) {
                              deletePlanning(item.id);
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
        title={editingItem ? 'Edit Planned Task' : 'Add Study Task'}
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Task Description *
            </label>
            <input
              type="text"
              required
              value={formTask}
              onChange={(e) => setFormTask(e.target.value)}
              placeholder="e.g. Complete Graph Theory Planar Graphs Lectures 6 & 7"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Date *
              </label>
              <input
                type="date"
                required
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Type
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Lecture">Lecture</option>
                <option value="PYQ">PYQ</option>
                <option value="Revision">Revision</option>
                <option value="Quiz">Quiz</option>
                <option value="Test">Test</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Module
              </label>
              <input
                type="text"
                value={formModule}
                onChange={(e) => setFormModule(e.target.value)}
                placeholder="e.g. Graph Theory"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value as Priority)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target / Goal
              </label>
              <input
                type="text"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value)}
                placeholder="e.g. 2 Lectures + Notes"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks
            </label>
            <textarea
              rows={2}
              value={formRemarks}
              onChange={(e) => setFormRemarks(e.target.value)}
              placeholder="e.g. Target before 5 PM"
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
              {editingItem ? 'Save Changes' : 'Add Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Paste Modal */}
      <UniversalPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        targetSection="planning"
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteOpen}
        onClose={() => setIsBulkDeleteOpen(false)}
        onConfirm={async () => {
          await bulkDeletePlanning(Array.from(selectedIds));
          setSelectedIds(new Set());
          setIsBulkDeleteOpen(false);
        }}
        title={`Delete ${selectedIds.size} selected records?`}
        message={`Are you sure you want to delete ${selectedIds.size} selected planned task record(s)?`}
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
          await resetSection('planning');
          setSelectedIds(new Set());
          setIsResetSectionOpen(false);
        }}
        title="Reset Study Planning?"
        message="This will permanently remove all Planning records. Other sections will not be affected."
        subMessage="Sample preview will be restored if no records remain. This action can be undone with Undo."
        confirmText="Reset Section"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
