import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Trash2,
  Edit2,
  Download,
  ClipboardPaste,
  RotateCcw,
  Play,
  Pause,
  Square,
  Target,
  TrendingUp,
  Award,
  Flame,
  BarChart2,
  CheckCircle2,
  ChevronDown,
  BookOpen,
  HelpCircle,
  Layers,
  FileCheck,
  Zap,
  Info
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { DailyProgressItem, StudySession } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { BulkActionBar } from '../common/BulkActionBar';
import { exportTableToSpreadsheet } from '../../services/excelEngine';
import { UniversalPasteModal } from '../common/UniversalPasteModal';
import { SAMPLE_DAILY_PROGRESS, getWithSampleFallback } from '../../services/sampleData';

// Format hours (e.g. 7.5833 -> "7h 35m", 0.8333 -> "50m", 0 -> "0h 00m")
function formatHoursToHM(hours: number): string {
  if (!hours || isNaN(hours) || hours <= 0) return '0h 00m';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m < 10 ? '0' : ''}${m}m`;
}

// Format seconds to HH:MM:SS
function formatSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => (n < 10 ? '0' : '') + n;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Format date nicely (e.g., "2026-09-28" -> "28 Sep")
function formatShortDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-');
    if (!y || !m || !d) return dateStr;
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return dateStr;
  }
}

export const DailyProgressView: React.FC = () => {
  const {
    state,
    updateSettings,
    activeTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
    addStudySession,
    deleteStudySession,
    bulkDeleteStudySessions,
    addDailyProgress,
    updateDailyProgress,
    deleteDailyProgress,
    bulkDeleteDailyProgress,
    resetSection
  } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Target Settings
  const currentDailyTargetHours = state.settings.dailyGoalHours ?? 10;
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [tempTargetHours, setTempTargetHours] = useState<string>(String(currentDailyTargetHours));

  // Timer Local Form State (before starting)
  const [selectedSessionType, setSelectedSessionType] = useState<StudySession['sessionType']>('Lecture');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isCustomSubject, setIsCustomSubject] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [isCustomModule, setIsCustomModule] = useState(false);
  const [customModuleInput, setCustomModuleInput] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [remarksInput, setRemarksInput] = useState('');

  // Daily Progress Log Table Filter & State
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Multi-select & Dialog States for Daily Logs
  const [selectedDailyIds, setSelectedDailyIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteDailyOpen, setIsBulkDeleteDailyOpen] = useState(false);
  const [isResetSectionOpen, setIsResetSectionOpen] = useState(false);

  // Multi-select & Dialog States for Study Sessions
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteSessionsOpen, setIsBulkDeleteSessionsOpen] = useState(false);
  const [isAddSessionModalOpen, setIsAddSessionModalOpen] = useState(false);

  // Modal State for Manual Daily Log
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyProgressItem | null>(null);

  // Manual Session Modal State
  const [manualSessionDate, setManualSessionDate] = useState(todayStr);
  const [manualSessionStart, setManualSessionStart] = useState('09:00');
  const [manualSessionEnd, setManualSessionEnd] = useState('10:30');
  const [manualSessionType, setManualSessionType] = useState<StudySession['sessionType']>('Lecture');
  const [manualSessionSubject, setManualSessionSubject] = useState('');
  const [manualSessionModule, setManualSessionModule] = useState('');
  const [manualSessionTopic, setManualSessionTopic] = useState('');
  const [manualSessionRemarks, setManualSessionRemarks] = useState('');

  // Dynamic Subjects & Modules from existing tracker database
  const availableSubjects = useMemo(() => {
    const set = new Set<string>();
    state.topicMaster.forEach(t => t.subject && set.add(t.subject.trim()));
    state.lectureTracker.forEach(l => l.subject && set.add(l.subject.trim()));
    state.pyqTracker.forEach(p => p.subject && set.add(p.subject.trim()));
    state.studySessions.forEach(s => s.subject && set.add(s.subject.trim()));
    return Array.from(set).sort();
  }, [state.topicMaster, state.lectureTracker, state.pyqTracker, state.studySessions]);

  const activeEffectiveSubject = isCustomSubject ? customSubjectInput.trim() : selectedSubject;

  const availableModules = useMemo(() => {
    if (!activeEffectiveSubject) return [];
    const set = new Set<string>();
    state.topicMaster
      .filter(t => t.subject?.toLowerCase() === activeEffectiveSubject.toLowerCase() && t.module)
      .forEach(t => { if (t.module) set.add(t.module.trim()); });
    state.lectureTracker
      .filter(l => l.subject?.toLowerCase() === activeEffectiveSubject.toLowerCase() && l.module)
      .forEach(l => { if (l.module) set.add(l.module.trim()); });
    state.pyqTracker
      .filter(p => p.subject?.toLowerCase() === activeEffectiveSubject.toLowerCase() && p.module)
      .forEach(p => { if (p.module) set.add(p.module.trim()); });
    state.studySessions
      .filter(s => s.subject?.toLowerCase() === activeEffectiveSubject.toLowerCase() && s.module)
      .forEach(s => { if (s.module) set.add(s.module.trim()); });
    return Array.from(set).sort();
  }, [activeEffectiveSubject, state.topicMaster, state.lectureTracker, state.pyqTracker, state.studySessions]);

  // Set default subject if not selected
  useEffect(() => {
    if (!selectedSubject && availableSubjects.length > 0 && !isCustomSubject) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [availableSubjects, selectedSubject, isCustomSubject]);

  // Handle Target Save
  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    const hours = Math.max(1, Math.min(24, parseFloat(tempTargetHours) || 10));
    await updateSettings({ dailyGoalHours: hours });
    setIsTargetModalOpen(false);
  };

  // Sample data fallback for the legacy/table view
  const { items: displayDailyProgress, isSampleState } = useMemo(() => {
    return getWithSampleFallback(state.dailyProgress, SAMPLE_DAILY_PROGRESS);
  }, [state.dailyProgress]);

  // Real data only for calculations (never use sample preview in calculations!)
  const realDailyLogs = useMemo(() => {
    return state.dailyProgress.filter(d => !d.isSample);
  }, [state.dailyProgress]);

  const realSessions = useMemo(() => {
    return state.studySessions.filter(s => !s.isSample);
  }, [state.studySessions]);

  // Calculate study stats by date across real sessions and daily progress logs
  // Returns aggregated map: date -> { totalHours, lectureHours, pyqHours, revisionHours, testHours, otherHours }
  const dailyStatsMap = useMemo(() => {
    const map = new Map<
      string,
      {
        totalHours: number;
        lectureHours: number;
        pyqHours: number;
        revisionHours: number;
        testHours: number;
        otherHours: number;
      }
    >();

    // 1. Rollup from individual sessions
    realSessions.forEach(sess => {
      const d = sess.date;
      const durationHours = (sess.durationMinutes || 0) / 60;
      const existing = map.get(d) || {
        totalHours: 0,
        lectureHours: 0,
        pyqHours: 0,
        revisionHours: 0,
        testHours: 0,
        otherHours: 0
      };

      existing.totalHours += durationHours;
      if (sess.sessionType === 'Lecture') existing.lectureHours += durationHours;
      else if (sess.sessionType === 'PYQ') existing.pyqHours += durationHours;
      else if (sess.sessionType === 'Revision') existing.revisionHours += durationHours;
      else if (sess.sessionType === 'Quiz' || sess.sessionType === 'Test') existing.testHours += durationHours;
      else existing.otherHours += durationHours;

      map.set(d, existing);
    });

    // 2. Also incorporate real DailyProgress logs (especially if imported or manual without sessions)
    realDailyLogs.forEach(log => {
      const d = log.date;
      const sessionStat = map.get(d);
      if (!sessionStat) {
        map.set(d, {
          totalHours: log.totalStudyHours || log.studyHours || 0,
          lectureHours: log.lectureHours || 0,
          pyqHours: log.pyqHours || 0,
          revisionHours: log.revisionHours || 0,
          testHours: log.testQuizHours || 0,
          otherHours: log.otherStudy || 0
        });
      } else {
        // If log total exceeds session total (e.g. user logged additional hours outside timer)
        const logTot = log.totalStudyHours || log.studyHours || 0;
        if (logTot > sessionStat.totalHours) {
          sessionStat.totalHours = logTot;
          sessionStat.lectureHours = Math.max(sessionStat.lectureHours, log.lectureHours || 0);
          sessionStat.pyqHours = Math.max(sessionStat.pyqHours, log.pyqHours || 0);
          sessionStat.revisionHours = Math.max(sessionStat.revisionHours, log.revisionHours || 0);
          sessionStat.testHours = Math.max(sessionStat.testHours, log.testQuizHours || 0);
          sessionStat.otherHours = Math.max(sessionStat.otherHours, log.otherStudy || 0);
        }
      }
    });

    return map;
  }, [realSessions, realDailyLogs]);

  // 1. TODAY'S DATA
  const todayStats = useMemo(() => {
    return dailyStatsMap.get(todayStr) || {
      totalHours: 0,
      lectureHours: 0,
      pyqHours: 0,
      revisionHours: 0,
      testHours: 0,
      otherHours: 0
    };
  }, [dailyStatsMap, todayStr]);

  const todayTarget = currentDailyTargetHours;
  const todayProgressPct = todayTarget > 0 ? (todayStats.totalHours / todayTarget) * 100 : 0;
  const todayRemainingHours = Math.max(0, todayTarget - todayStats.totalHours);
  const isTodayTargetCompleted = todayStats.totalHours >= todayTarget && todayTarget > 0;

  // 2. PREVIOUS DAY COMPARISON
  // Find the most recent date prior to today that has real study recorded
  const previousDayComparison = useMemo(() => {
    const datesWithStudy = Array.from(dailyStatsMap.keys())
      .filter(d => d < todayStr && (dailyStatsMap.get(d)?.totalHours || 0) > 0)
      .sort((a, b) => (b > a ? 1 : -1));

    if (datesWithStudy.length === 0) return null;

    const prevDate = datesWithStudy[0];
    const prevStats = dailyStatsMap.get(prevDate)!;
    const prevTarget = state.settings.dailyTargetsByDate?.[prevDate] ?? currentDailyTargetHours;
    const prevAchievedPct = prevTarget > 0 ? (prevStats.totalHours / prevTarget) * 100 : 0;

    const diffHours = todayStats.totalHours - prevStats.totalHours;

    return {
      prevDate,
      prevStats,
      prevTarget,
      prevAchievedPct,
      diffHours
    };
  }, [dailyStatsMap, todayStr, todayStats.totalHours, state.settings.dailyTargetsByDate, currentDailyTargetHours]);

  // 3. LAST 7 DAYS
  const last7Days = useMemo(() => {
    const days: {
      date: string;
      target: number;
      actual: number;
      achievementPct: number;
      difference: number;
      breakdown: {
        lecture: number;
        pyq: number;
        revision: number;
        test: number;
        other: number;
      };
    }[] = [];

    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const stats = dailyStatsMap.get(dateStr) || {
        totalHours: 0,
        lectureHours: 0,
        pyqHours: 0,
        revisionHours: 0,
        testHours: 0,
        otherHours: 0
      };

      const target = state.settings.dailyTargetsByDate?.[dateStr] ?? currentDailyTargetHours;
      const actual = stats.totalHours;
      const achievementPct = target > 0 ? (actual / target) * 100 : 0;
      const difference = actual - target;

      days.push({
        date: dateStr,
        target,
        actual,
        achievementPct,
        difference,
        breakdown: {
          lecture: stats.lectureHours,
          pyq: stats.pyqHours,
          revision: stats.revisionHours,
          test: stats.testHours,
          other: stats.otherHours
        }
      });
    }

    return days;
  }, [dailyStatsMap, currentDailyTargetHours, state.settings.dailyTargetsByDate]);

  // Maximum hours for chart scaling
  const maxChartHours = useMemo(() => {
    const maxVal = Math.max(
      ...last7Days.map(d => Math.max(d.actual, d.target)),
      currentDailyTargetHours,
      8
    );
    return Math.ceil(maxVal);
  }, [last7Days, currentDailyTargetHours]);

  // 4. 30-DAY ANALYTICS
  const thirtyDayAnalytics = useMemo(() => {
    const dates30: string[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dates30.push(d.toISOString().split('T')[0]);
    }

    let totalStudyHours = 0;
    let activeStudyDays = 0;
    let daysTargetAchieved = 0;
    let totalLectureHours = 0;
    let totalPyqHours = 0;
    let totalRevisionHours = 0;
    let totalTestHours = 0;
    let totalOtherHours = 0;

    let highestDay = { date: '', hours: 0 };
    let lowestActiveDay = { date: '', hours: Infinity };

    dates30.forEach(dateStr => {
      const stats = dailyStatsMap.get(dateStr);
      const hours = stats?.totalHours || 0;
      const target = state.settings.dailyTargetsByDate?.[dateStr] ?? currentDailyTargetHours;

      if (hours > 0) {
        totalStudyHours += hours;
        activeStudyDays += 1;
        totalLectureHours += stats?.lectureHours || 0;
        totalPyqHours += stats?.pyqHours || 0;
        totalRevisionHours += stats?.revisionHours || 0;
        totalTestHours += stats?.testHours || 0;
        totalOtherHours += stats?.otherHours || 0;

        if (hours > highestDay.hours) {
          highestDay = { date: dateStr, hours };
        }
        if (hours < lowestActiveDay.hours) {
          lowestActiveDay = { date: dateStr, hours };
        }
      }

      if (hours >= target && target > 0) {
        daysTargetAchieved += 1;
      }
    });

    const avgHoursPerDay = totalStudyHours / 30;
    const avgHoursActiveDays = activeStudyDays > 0 ? totalStudyHours / activeStudyDays : 0;
    const targetAchievementPct = (daysTargetAchieved / 30) * 100;
    const zeroStudyDays = 30 - activeStudyDays;

    // Streaks calculation: Check consecutive days backwards
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Count all real dates chronologically for longest streak
    const allSortedDates = Array.from(dailyStatsMap.keys()).sort();
    if (allSortedDates.length > 0) {
      // Find streak for 30 days
      for (let i = dates30.length - 1; i >= 0; i--) {
        const dStr = dates30[i];
        const h = dailyStatsMap.get(dStr)?.totalHours || 0;
        if (h > 0) {
          if (i === dates30.length - 1 || currentStreak > 0) {
            currentStreak += 1;
          }
        } else if (i === dates30.length - 1) {
          // If today has 0 hours yet, check if yesterday was active
          continue;
        } else {
          break;
        }
      }

      // Longest streak across 30 days
      for (let i = 0; i < dates30.length; i++) {
        const h = dailyStatsMap.get(dates30[i])?.totalHours || 0;
        if (h > 0) {
          tempStreak += 1;
          if (tempStreak > longestStreak) longestStreak = tempStreak;
        } else {
          tempStreak = 0;
        }
      }
    }

    return {
      totalStudyHours,
      avgHoursPerDay,
      avgHoursActiveDays,
      highestDay: highestDay.hours > 0 ? highestDay : null,
      lowestActiveDay: lowestActiveDay.hours < Infinity ? lowestActiveDay : null,
      numberTargetDays: 30,
      daysTargetAchieved,
      targetAchievementPct,
      totalLectureHours,
      totalPyqHours,
      totalRevisionHours,
      totalTestHours,
      totalOtherHours,
      activeStudyDays,
      zeroStudyDays,
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak)
    };
  }, [dailyStatsMap, currentDailyTargetHours, state.settings.dailyTargetsByDate]);

  // Handle Timer Actions
  const handleStartTimer = () => {
    const finalSubject = isCustomSubject ? customSubjectInput.trim() : selectedSubject.trim();
    const finalModule = isCustomModule ? customModuleInput.trim() : selectedModule.trim();
    startTimer(selectedSessionType, finalSubject, finalModule, topicInput.trim(), remarksInput.trim());
  };

  const handleStopTimer = async () => {
    const session = await stopTimer();
    if (session) {
      // Clear inputs
      setTopicInput('');
      setRemarksInput('');
    }
  };

  // Handle Manual Session Save
  const handleSaveManualSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const [sh, sm] = manualSessionStart.split(':').map(Number);
    const [eh, em] = manualSessionEnd.split(':').map(Number);
    let durMin = (eh * 60 + em) - (sh * 60 + sm);
    if (durMin <= 0) durMin += 24 * 60; // Cross midnight

    await addStudySession({
      date: manualSessionDate,
      startTime: manualSessionStart,
      endTime: manualSessionEnd,
      durationMinutes: durMin,
      sessionType: manualSessionType,
      subject: manualSessionSubject.trim() || undefined,
      module: manualSessionModule.trim() || undefined,
      topic: manualSessionTopic.trim() || undefined,
      remarks: manualSessionRemarks.trim() || undefined
    });

    setIsAddSessionModalOpen(false);
  };

  // Form State for Manual Daily Log
  const [formDate, setFormDate] = useState(todayStr);
  const [formLectureHours, setFormLectureHours] = useState('0');
  const [formPyqHours, setFormPyqHours] = useState('0');
  const [formRevisionHours, setFormRevisionHours] = useState('0');
  const [formTestHours, setFormTestHours] = useState('0');
  const [formOtherStudy, setFormOtherStudy] = useState('0');
  const [formRemarks, setFormRemarks] = useState('');

  const autoTotalHours = useMemo(() => {
    const l = parseFloat(formLectureHours) || 0;
    const p = parseFloat(formPyqHours) || 0;
    const r = parseFloat(formRevisionHours) || 0;
    const t = parseFloat(formTestHours) || 0;
    const o = parseFloat(formOtherStudy) || 0;
    return parseFloat((l + p + r + t + o).toFixed(2));
  }, [formLectureHours, formPyqHours, formRevisionHours, formTestHours, formOtherStudy]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormDate(todayStr);
    setFormLectureHours('0');
    setFormPyqHours('0');
    setFormRevisionHours('0');
    setFormTestHours('0');
    setFormOtherStudy('0');
    setFormRemarks('');
    setIsModalOpen(true);
  };

  const openEditModal = (item: DailyProgressItem) => {
    setEditingItem(item);
    setFormDate(item.date);
    setFormLectureHours(String(item.lectureHours || 0));
    setFormPyqHours(String(item.pyqHours || 0));
    setFormRevisionHours(String(item.revisionHours || 0));
    setFormTestHours(String(item.testQuizHours || 0));
    setFormOtherStudy(String(item.otherStudy || 0));
    setFormRemarks(item.remarks || '');
    setIsModalOpen(true);
  };

  const handleSaveDailyLog = async (e: React.FormEvent) => {
    e.preventDefault();
    const l = Math.max(0, parseFloat(formLectureHours) || 0);
    const p = Math.max(0, parseFloat(formPyqHours) || 0);
    const r = Math.max(0, parseFloat(formRevisionHours) || 0);
    const t = Math.max(0, parseFloat(formTestHours) || 0);
    const o = Math.max(0, parseFloat(formOtherStudy) || 0);
    const tot = parseFloat((l + p + r + t + o).toFixed(2));

    if (editingItem) {
      await updateDailyProgress({
        ...editingItem,
        date: formDate,
        lectureHours: l,
        pyqHours: p,
        revisionHours: r,
        testQuizHours: t,
        otherStudy: o,
        studyHours: tot,
        totalStudyHours: tot,
        remarks: formRemarks.trim()
      });
    } else {
      await addDailyProgress({
        date: formDate,
        lectureHours: l,
        pyqHours: p,
        revisionHours: r,
        testQuizHours: t,
        otherStudy: o,
        studyHours: tot,
        totalStudyHours: tot,
        remarks: formRemarks.trim()
      });
    }
    setIsModalOpen(false);
  };

  // Filtered & Sorted items for Daily Progress Table
  const filteredDailyLogs = useMemo(() => {
    return displayDailyProgress
      .filter(item => {
        if (searchTerm) {
          const matchRemark = (item.remarks || '').toLowerCase().includes(searchTerm.toLowerCase());
          const matchDate = item.date.includes(searchTerm);
          if (!matchRemark && !matchDate) return false;
        }
        if (startDate && item.date < startDate) return false;
        if (endDate && item.date > endDate) return false;
        return true;
      })
      .sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [displayDailyProgress, searchTerm, startDate, endDate]);

  // Real items that are visible under current filters (excluding sample preview)
  const visibleRealDaily = useMemo(() => {
    return filteredDailyLogs.filter(item => !item.isSample);
  }, [filteredDailyLogs]);

  const isAllVisibleDailySelected =
    visibleRealDaily.length > 0 && visibleRealDaily.every(d => selectedDailyIds.has(d.id));
  const isSomeVisibleDailySelected =
    visibleRealDaily.some(d => selectedDailyIds.has(d.id)) && !isAllVisibleDailySelected;

  const toggleSelectAllVisibleDaily = () => {
    if (isAllVisibleDailySelected) {
      setSelectedDailyIds(prev => {
        const next = new Set(prev);
        visibleRealDaily.forEach(d => next.delete(d.id));
        return next;
      });
    } else {
      setSelectedDailyIds(prev => {
        const next = new Set(prev);
        visibleRealDaily.forEach(d => next.add(d.id));
        return next;
      });
    }
  };

  // Sessions Table Sorting & Selection
  const sortedSessions = useMemo(() => {
    return [...state.studySessions].sort((a, b) => {
      if (a.date !== b.date) return b.date > a.date ? 1 : -1;
      return (b.startTime || '') > (a.startTime || '') ? 1 : -1;
    });
  }, [state.studySessions]);

  const isAllSessionsSelected =
    sortedSessions.length > 0 && sortedSessions.every(s => selectedSessionIds.has(s.id));
  const isSomeSessionsSelected =
    sortedSessions.some(s => selectedSessionIds.has(s.id)) && !isAllSessionsSelected;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Daily Study Control Center
            </h2>
            {isSampleState && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 uppercase tracking-wider">
                Sample Preview (1-2 Rows)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Real study timer, daily target tracking, analytics, and session history for GATE 2027.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setTempTargetHours(String(currentDailyTargetHours));
              setIsTargetModalOpen(true);
            }}
            className="px-3 py-2 text-xs font-semibold border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Configure daily study target"
          >
            <Target className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Change Daily Target ({currentDailyTargetHours}h)
          </button>
          <button
            onClick={() => exportTableToSpreadsheet(state.dailyProgress, 'GATE_Daily_Progress')}
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
            Log Today's Study
          </button>
          <button
            onClick={() => setIsResetSectionOpen(true)}
            className="px-3 py-2 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset Daily Progress records"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Section Data
          </button>
        </div>
      </div>

      {/* 1. REAL STUDY TIMER */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          {/* Left: Timer Display & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="text-center sm:text-left">
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest block mb-1 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Live Study Timer
              </span>
              <div className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                {formatSeconds(activeTimer.elapsedSeconds)}
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-xs text-indigo-200/80">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    activeTimer.isRunning
                      ? 'bg-emerald-400 animate-pulse'
                      : activeTimer.elapsedSeconds > 0
                      ? 'bg-amber-400'
                      : 'bg-slate-400'
                  }`}
                />
                <span>
                  {activeTimer.isRunning
                    ? `Active Session • Started at ${activeTimer.startTime || 'Now'}`
                    : activeTimer.elapsedSeconds > 0
                    ? `Paused • ${formatHoursToHM(activeTimer.elapsedSeconds / 3600)} recorded`
                    : 'Ready to study • Select parameters and start'}
                </span>
              </div>
            </div>

            {/* Timer Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {!activeTimer.isRunning && activeTimer.elapsedSeconds === 0 ? (
                <button
                  onClick={handleStartTimer}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white" />
                  Start Timer
                </button>
              ) : activeTimer.isRunning ? (
                <>
                  <button
                    onClick={pauseTimer}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Pause className="w-4 h-4 fill-white" />
                    Pause
                  </button>
                  <button
                    onClick={handleStopTimer}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Stop & Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={resumeTimer}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    Resume
                  </button>
                  <button
                    onClick={handleStopTimer}
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-xl flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Square className="w-4 h-4 fill-white" />
                    Stop & Save
                  </button>
                  <button
                    onClick={resetTimer}
                    className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: Session Parameter Configuration */}
          <div className="bg-slate-800/70 backdrop-blur-xs border border-indigo-700/30 rounded-xl p-3 sm:p-4 text-xs space-y-3 flex-1 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Session Type */}
              <div>
                <label className="block text-[10px] font-semibold text-indigo-200 uppercase mb-1">
                  Session Type
                </label>
                <select
                  value={activeTimer.isRunning ? activeTimer.sessionType : selectedSessionType}
                  onChange={e => setSelectedSessionType(e.target.value as any)}
                  disabled={activeTimer.isRunning}
                  className="w-full bg-slate-900/90 border border-indigo-700/40 rounded-lg px-2.5 py-1.5 text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-400 text-xs disabled:opacity-70"
                >
                  <option value="Lecture">Lecture</option>
                  <option value="PYQ">PYQ</option>
                  <option value="Revision">Revision</option>
                  <option value="Quiz">Weekly Quiz</option>
                  <option value="Test">Test Tracker</option>
                  <option value="Other">Other Study</option>
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[10px] font-semibold text-indigo-200 uppercase mb-1">
                  Subject
                </label>
                {!isCustomSubject ? (
                  <div className="flex gap-1">
                    <select
                      value={activeTimer.isRunning ? activeTimer.subject : selectedSubject}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setIsCustomSubject(true);
                          setSelectedSubject('');
                        } else {
                          setSelectedSubject(e.target.value);
                        }
                      }}
                      disabled={activeTimer.isRunning}
                      className="w-full bg-slate-900/90 border border-indigo-700/40 rounded-lg px-2.5 py-1.5 text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-400 text-xs disabled:opacity-70 truncate"
                    >
                      <option value="">Select subject...</option>
                      {availableSubjects.map(sub => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                      <option value="__custom__">+ Custom Subject...</option>
                    </select>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Enter subject name"
                      value={customSubjectInput}
                      onChange={e => setCustomSubjectInput(e.target.value)}
                      disabled={activeTimer.isRunning}
                      className="w-full bg-slate-900/90 border border-indigo-700/40 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-400 text-xs focus:ring-1 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomSubject(false)}
                      className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-[10px] hover:bg-slate-600"
                    >
                      List
                    </button>
                  </div>
                )}
              </div>

              {/* Module */}
              <div>
                <label className="block text-[10px] font-semibold text-indigo-200 uppercase mb-1">
                  Module (Optional)
                </label>
                {!isCustomModule ? (
                  <select
                    value={activeTimer.isRunning ? activeTimer.module : selectedModule}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setIsCustomModule(true);
                        setSelectedModule('');
                      } else {
                        setSelectedModule(e.target.value);
                      }
                    }}
                    disabled={activeTimer.isRunning}
                    className="w-full bg-slate-900/90 border border-indigo-700/40 rounded-lg px-2.5 py-1.5 text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-400 text-xs disabled:opacity-70 truncate"
                  >
                    <option value="">Select module...</option>
                    {availableModules.map(mod => (
                      <option key={mod} value={mod}>
                        {mod}
                      </option>
                    ))}
                    <option value="__custom__">+ Custom Module...</option>
                  </select>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="Enter module"
                      value={customModuleInput}
                      onChange={e => setCustomModuleInput(e.target.value)}
                      disabled={activeTimer.isRunning}
                      className="w-full bg-slate-900/90 border border-indigo-700/40 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-400 text-xs focus:ring-1 focus:ring-indigo-400"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomModule(false)}
                      className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-[10px] hover:bg-slate-600"
                    >
                      List
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Topic & Remarks row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="Topic e.g. Graph Theory, Normalization..."
                value={activeTimer.isRunning ? activeTimer.topic || '' : topicInput}
                onChange={e => setTopicInput(e.target.value)}
                disabled={activeTimer.isRunning}
                className="w-full bg-slate-900/90 border border-indigo-700/40 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-400 text-xs focus:ring-1 focus:ring-indigo-400 disabled:opacity-70"
              />
              <input
                type="text"
                placeholder="Remarks e.g. Solved 15 hard problems..."
                value={activeTimer.isRunning ? activeTimer.remarks : remarksInput}
                onChange={e => setRemarksInput(e.target.value)}
                disabled={activeTimer.isRunning}
                className="w-full bg-slate-900/90 border border-indigo-700/40 rounded-lg px-2.5 py-1.5 text-white placeholder-slate-400 text-xs focus:ring-1 focus:ring-indigo-400 disabled:opacity-70"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. TODAY'S DASHBOARD & TARGET PROGRESS */}
      <div className="space-y-3">
        {/* Prominent Today Target & Progress Banner */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Today's Target Overview • {formatShortDate(todayStr)}
              </span>
              <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
                  {formatHoursToHM(todayStats.totalHours)}
                </span>
                <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                  / {formatHoursToHM(todayTarget)}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black font-mono ${
                    isTodayTargetCompleted
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                  }`}
                >
                  {todayProgressPct.toFixed(1)}%
                </span>
                {isTodayTargetCompleted && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500 text-white flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Target completed
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setTempTargetHours(String(currentDailyTargetHours));
                setIsTargetModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:underline flex items-center gap-1 self-start md:self-auto cursor-pointer"
            >
              <Target className="w-3.5 h-3.5" />
              Change Target
            </button>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isTodayTargetCompleted
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-400'
              }`}
              style={{ width: `${Math.min(100, todayProgressPct)}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-mono">
            <span>0h 00m</span>
            <span>Target: {formatHoursToHM(todayTarget)}</span>
            <span>
              {isTodayTargetCompleted
                ? `Exceeded by +${formatHoursToHM(todayStats.totalHours - todayTarget)}`
                : `Remaining: ${formatHoursToHM(todayRemainingHours)}`}
            </span>
          </div>

          {/* 4 Cards: Today's Target, Studied, Remaining, Progress */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Today's Target
              </span>
              <span className="text-lg font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                {formatHoursToHM(todayTarget)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Studied
              </span>
              <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 block">
                {formatHoursToHM(todayStats.totalHours)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Remaining
              </span>
              <span
                className={`text-lg font-bold font-mono mt-0.5 block ${
                  isTodayTargetCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                {isTodayTargetCompleted ? '0h 00m' : formatHoursToHM(todayRemainingHours)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                Progress
              </span>
              <span
                className={`text-lg font-black font-mono mt-0.5 block ${
                  isTodayTargetCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
                }`}
              >
                {todayProgressPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2.5">
              Today's Category Breakdown (Calculated from Actual Sessions)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-lg">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block">
                  Lecture
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {formatHoursToHM(todayStats.lectureHours)}
                </span>
              </div>

              <div className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-lg">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase block">
                  PYQ
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {formatHoursToHM(todayStats.pyqHours)}
                </span>
              </div>

              <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-lg">
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase block">
                  Revision
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {formatHoursToHM(todayStats.revisionHours)}
                </span>
              </div>

              <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40 rounded-lg">
                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase block">
                  Quiz / Test
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {formatHoursToHM(todayStats.testHours)}
                </span>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-lg">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase block">
                  Other
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono mt-0.5 block">
                  {formatHoursToHM(todayStats.otherHours)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. PREVIOUS DAY COMPARISON */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Previous Study Day Comparison
          </h3>
        </div>

        {previousDayComparison ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Yesterday */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Previous Day ({formatShortDate(previousDayComparison.prevDate)})
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                    {formatHoursToHM(previousDayComparison.prevStats.totalHours)}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    ({previousDayComparison.prevAchievedPct.toFixed(1)}% of{' '}
                    {formatHoursToHM(previousDayComparison.prevTarget)})
                  </span>
                </div>
              </div>

              {/* Today */}
              <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/40">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  Today ({formatShortDate(todayStr)})
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                    {formatHoursToHM(todayStats.totalHours)}
                  </span>
                  <span className="text-xs text-indigo-600/80 dark:text-indigo-300/80 font-mono">
                    ({todayProgressPct.toFixed(1)}% of {formatHoursToHM(todayTarget)})
                  </span>
                </div>
              </div>

              {/* Difference */}
              <div
                className={`p-3.5 rounded-xl border ${
                  previousDayComparison.diffHours >= 0
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                    : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800'
                }`}
              >
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block ${
                    previousDayComparison.diffHours >= 0
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300'
                  }`}
                >
                  Day-over-Day Difference
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span
                    className={`text-2xl font-black font-mono ${
                      previousDayComparison.diffHours >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {previousDayComparison.diffHours >= 0 ? '+' : '-'}
                    {formatHoursToHM(Math.abs(previousDayComparison.diffHours))}
                  </span>
                  <span className="text-xs text-slate-500">
                    {previousDayComparison.diffHours >= 0 ? 'more than prev day' : 'less than prev day'}
                  </span>
                </div>
              </div>
            </div>

            {/* Breakdown Comparison Table */}
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                    <th className="py-2 px-3">Period</th>
                    <th className="py-2 px-3 text-center">Lecture</th>
                    <th className="py-2 px-3 text-center">PYQ</th>
                    <th className="py-2 px-3 text-center">Revision</th>
                    <th className="py-2 px-3 text-center">Quiz / Test</th>
                    <th className="py-2 px-3 text-center">Other</th>
                    <th className="py-2 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
                  <tr>
                    <td className="py-2 px-3 font-sans font-semibold text-slate-600 dark:text-slate-300">
                      Previous Day ({previousDayComparison.prevDate})
                    </td>
                    <td className="py-2 px-3 text-center">
                      {formatHoursToHM(previousDayComparison.prevStats.lectureHours)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {formatHoursToHM(previousDayComparison.prevStats.pyqHours)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {formatHoursToHM(previousDayComparison.prevStats.revisionHours)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {formatHoursToHM(previousDayComparison.prevStats.testHours)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {formatHoursToHM(previousDayComparison.prevStats.otherHours)}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatHoursToHM(previousDayComparison.prevStats.totalHours)}
                    </td>
                  </tr>
                  <tr className="bg-indigo-50/30 dark:bg-indigo-950/20">
                    <td className="py-2 px-3 font-sans font-bold text-indigo-600 dark:text-indigo-400">
                      Today ({todayStr})
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {formatHoursToHM(todayStats.lectureHours)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {formatHoursToHM(todayStats.pyqHours)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {formatHoursToHM(todayStats.revisionHours)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {formatHoursToHM(todayStats.testHours)}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">
                      {formatHoursToHM(todayStats.otherHours)}
                    </td>
                    <td className="py-2 px-3 text-right font-black text-indigo-600 dark:text-indigo-400">
                      {formatHoursToHM(todayStats.totalHours)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center text-slate-400 italic text-xs bg-slate-50 dark:bg-slate-800/40 rounded-xl">
            No previous study data available yet. Start logging sessions to compare daily trends!
          </div>
        )}
      </div>

      {/* 4. LAST 7 DAYS TREND & VISUAL CHART */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Last 7 Days Study Trend & Targets
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Target Line: {formatHoursToHM(currentDailyTargetHours)}
          </span>
        </div>

        {/* Visual Bar Chart */}
        <div className="pt-4 pb-2">
          <div className="h-44 flex items-end justify-between gap-2 sm:gap-4 px-2 border-b border-slate-200 dark:border-slate-700 relative">
            {/* Target line across chart */}
            <div
              className="absolute left-0 right-0 border-b-2 border-dashed border-indigo-400/60 dark:border-indigo-400/40 z-0 pointer-events-none"
              style={{
                bottom: `${Math.min(100, (currentDailyTargetHours / maxChartHours) * 100)}%`
              }}
            >
              <span className="absolute -top-4 right-2 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold bg-white dark:bg-slate-900 px-1 rounded">
                Target {currentDailyTargetHours}h
              </span>
            </div>

            {last7Days.map(day => {
              const heightPct = Math.min(100, (day.actual / maxChartHours) * 100);
              const isTargetMet = day.actual >= day.target && day.target > 0;
              const isToday = day.date === todayStr;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end group relative z-10">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 bg-slate-900 text-white text-[10px] rounded px-2 py-1 shadow-lg pointer-events-none whitespace-nowrap z-30 font-mono">
                    {formatShortDate(day.date)}: {formatHoursToHM(day.actual)} / {formatHoursToHM(day.target)} (
                    {day.achievementPct.toFixed(0)}%)
                  </div>

                  {/* Value above bar */}
                  <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {day.actual > 0 ? formatHoursToHM(day.actual) : '0h'}
                  </span>

                  {/* Bar */}
                  <div className="w-full max-w-[48px] bg-slate-100 dark:bg-slate-800 rounded-t-lg overflow-hidden h-full flex items-end">
                    <div
                      className={`w-full rounded-t-lg transition-all duration-300 ${
                        isTargetMet
                          ? 'bg-gradient-to-t from-emerald-600 to-teal-400'
                          : isToday
                          ? 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                          : 'bg-gradient-to-t from-indigo-400/80 to-indigo-300/80 dark:from-indigo-600 dark:to-indigo-500'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>

                  {/* Date label */}
                  <span
                    className={`text-[10px] font-bold mt-2 font-mono ${
                      isToday
                        ? 'text-indigo-600 dark:text-indigo-400 underline decoration-2'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {formatShortDate(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7 Days Table */}
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-center">Target</th>
                <th className="py-2.5 px-3 text-center">Actual Studied</th>
                <th className="py-2.5 px-3 text-center">Achievement %</th>
                <th className="py-2.5 px-3 text-right">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300 font-mono">
              {last7Days.map(day => {
                const isMet = day.actual >= day.target && day.target > 0;
                const isToday = day.date === todayStr;

                return (
                  <tr
                    key={day.date}
                    className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                      isToday ? 'bg-indigo-50/30 dark:bg-indigo-950/20 font-semibold' : ''
                    }`}
                  >
                    <td className="py-2.5 px-3 font-sans">
                      <div className="flex items-center gap-1.5">
                        {isToday && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                            TODAY
                          </span>
                        )}
                        <span>{formatShortDate(day.date)}</span>
                        <span className="text-[10px] text-slate-400">({day.date})</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">{formatHoursToHM(day.target)}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                      {formatHoursToHM(day.actual)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          isMet
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : day.actual > 0
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {day.achievementPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`font-bold ${
                          day.difference >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {day.difference >= 0 ? '+' : '-'}
                        {formatHoursToHM(Math.abs(day.difference))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. 30-DAY ANALYTICS & CONSISTENCY */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            30-Day Performance & Study Consistency Analytics
          </h3>
        </div>

        {/* 4 Consistency Metric Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40 rounded-xl">
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
              Active Study Days
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
                {thirtyDayAnalytics.activeStudyDays}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ 30 days</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {thirtyDayAnalytics.zeroStudyDays} zero-study days
            </span>
          </div>

          <div className="p-3 bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-xl">
            <span className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider block">
              Target Days Met
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-indigo-700 dark:text-indigo-400 font-mono">
                {thirtyDayAnalytics.daysTargetAchieved}
              </span>
              <span className="text-xs text-slate-500 font-mono">/ 30 days</span>
            </div>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1 block font-bold">
              {thirtyDayAnalytics.targetAchievementPct.toFixed(1)}% success rate
            </span>
          </div>

          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-xl">
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Current Streak
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
                {thirtyDayAnalytics.currentStreak}
              </span>
              <span className="text-xs text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Consecutive study</span>
          </div>

          <div className="p-3 bg-purple-50/60 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-xl">
            <span className="text-[11px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider block">
              Longest Streak
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-purple-700 dark:text-purple-400 font-mono">
                {thirtyDayAnalytics.longestStreak}
              </span>
              <span className="text-xs text-slate-500">days</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-1 block">Personal best streak</span>
          </div>
        </div>

        {/* Detailed Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-2">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Total 30-Day Hours</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
              {formatHoursToHM(thirtyDayAnalytics.totalStudyHours)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Average Hours / Day</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
              {formatHoursToHM(thirtyDayAnalytics.avgHoursPerDay)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Avg on Active Days</span>
            <span className="text-lg font-bold font-mono text-slate-900 dark:text-white mt-0.5 block">
              {formatHoursToHM(thirtyDayAnalytics.avgHoursActiveDays)}
            </span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <span className="text-slate-500 dark:text-slate-400 text-[11px] block">Highest Study Day</span>
            <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate">
              {thirtyDayAnalytics.highestDay
                ? `${formatHoursToHM(thirtyDayAnalytics.highestDay.hours)} (${formatShortDate(
                    thirtyDayAnalytics.highestDay.date
                  )})`
                : '—'}
            </span>
          </div>
        </div>

        {/* Category breakdown for 30 Days */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-2">
            30-Day Category Hours Distribution
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-slate-400 block font-sans">Lectures</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatHoursToHM(thirtyDayAnalytics.totalLectureHours)}
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-slate-400 block font-sans">PYQs</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatHoursToHM(thirtyDayAnalytics.totalPyqHours)}
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-slate-400 block font-sans">Revisions</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatHoursToHM(thirtyDayAnalytics.totalRevisionHours)}
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-slate-400 block font-sans">Quiz / Test</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatHoursToHM(thirtyDayAnalytics.totalTestHours)}
              </span>
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
              <span className="text-[10px] text-slate-400 block font-sans">Other</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {formatHoursToHM(thirtyDayAnalytics.totalOtherHours)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 6. STUDY SESSIONS HISTORY */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Recorded Study Sessions History
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Individual timer intervals and saved study blocks. Source of truth for daily statistics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setManualSessionDate(todayStr);
                setIsAddSessionModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold border border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Manual Session
            </button>
          </div>
        </div>

        {/* Bulk Action Bar for Sessions */}
        <BulkActionBar
          selectedCount={selectedSessionIds.size}
          totalVisibleCount={sortedSessions.length}
          onSelectAllVisible={() => {
            setSelectedSessionIds(new Set(sortedSessions.map(s => s.id)));
          }}
          onClearSelection={() => setSelectedSessionIds(new Set())}
          onDeleteSelected={() => setIsBulkDeleteSessionsOpen(true)}
          itemLabel="sessions"
        />

        {/* Sessions Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={sortedSessions.length > 0 && isAllSessionsSelected}
                      ref={input => {
                        if (input) input.indeterminate = isSomeSessionsSelected;
                      }}
                      onChange={() => {
                        if (isAllSessionsSelected) setSelectedSessionIds(new Set());
                        else setSelectedSessionIds(new Set(sortedSessions.map(s => s.id)));
                      }}
                      disabled={sortedSessions.length === 0}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Module</th>
                  <th className="py-2.5 px-3">Topic</th>
                  <th className="py-2.5 px-3 text-center">Session Type</th>
                  <th className="py-2.5 px-3 text-center">Duration</th>
                  <th className="py-2.5 px-3">Remarks</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {sortedSessions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                      No study sessions recorded yet. Start the study timer above to record your first session!
                    </td>
                  </tr>
                ) : (
                  sortedSessions.map(sess => {
                    const isSelected = selectedSessionIds.has(sess.id);
                    return (
                      <tr
                        key={sess.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                          isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/40' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedSessionIds(prev => {
                                const next = new Set(prev);
                                if (next.has(sess.id)) next.delete(sess.id);
                                else next.add(sess.id);
                                return next;
                              });
                            }}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {formatShortDate(sess.date)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {sess.startTime || '—'} – {sess.endTime || '—'}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                          {sess.subject || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {sess.module || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 truncate max-w-xs" title={sess.topic}>
                          {sess.topic || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sess.sessionType === 'Lecture'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : sess.sessionType === 'PYQ'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : sess.sessionType === 'Revision'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                            }`}
                          >
                            {sess.sessionType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {formatHoursToHM((sess.durationMinutes || 0) / 60)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs" title={sess.remarks}>
                          {sess.remarks || <span className="text-slate-400 italic">—</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={async () => {
                              if (window.confirm('Delete this study session?')) {
                                await deleteStudySession(sess.id);
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Delete session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 7. DAILY PROGRESS SUMMARY LOGS TABLE (Preserved with bulk delete & reset) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Daily Progress Summaries (Date-Wise Log Table)
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {realDailyLogs.length} logged record(s)
          </span>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search date or remarks..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>From:</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>To:</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            {(startDate || endDate || searchTerm) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setSearchTerm('');
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline px-1 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Bar for Daily Logs */}
        <BulkActionBar
          selectedCount={selectedDailyIds.size}
          totalVisibleCount={visibleRealDaily.length}
          onSelectAllVisible={toggleSelectAllVisibleDaily}
          onClearSelection={() => setSelectedDailyIds(new Set())}
          onDeleteSelected={() => setIsBulkDeleteDailyOpen(true)}
          itemLabel="logs"
        />

        {/* Daily Progress Data Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={visibleRealDaily.length > 0 && isAllVisibleDailySelected}
                      ref={input => {
                        if (input) input.indeterminate = isSomeVisibleDailySelected;
                      }}
                      onChange={toggleSelectAllVisibleDaily}
                      disabled={visibleRealDaily.length === 0}
                      aria-label="Select all visible daily progress logs"
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                    />
                  </th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-3 text-center">Lectures</th>
                  <th className="py-3 px-3 text-center">PYQ</th>
                  <th className="py-3 px-3 text-center">Revision</th>
                  <th className="py-3 px-3 text-center">Test/Quiz</th>
                  <th className="py-3 px-3 text-center">Other</th>
                  <th className="py-3 px-4 text-center font-bold text-indigo-600 dark:text-indigo-400">Total Hours</th>
                  <th className="py-3 px-4">Remarks</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {filteredDailyLogs.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400 italic">
                      No daily study logs found. Click "Log Today's Study" or import your Excel file.
                    </td>
                  </tr>
                ) : (
                  filteredDailyLogs.map(item => {
                    const isSelected = !item.isSample && selectedDailyIds.has(item.id);

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                          isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/40' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (!item.isSample) {
                                setSelectedDailyIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }
                            }}
                            disabled={!!item.isSample}
                            title={
                              item.isSample
                                ? 'Sample demo record cannot be selected or deleted'
                                : 'Select row'
                            }
                            aria-label={`Select log for ${item.date}`}
                            className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            {item.isSample && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shrink-0 font-sans">
                                SAMPLE
                              </span>
                            )}
                            <span>{item.date}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{item.lectureHours || 0}h</td>
                        <td className="py-3 px-3 text-center font-mono">{item.pyqHours || 0}h</td>
                        <td className="py-3 px-3 text-center font-mono">{item.revisionHours || 0}h</td>
                        <td className="py-3 px-3 text-center font-mono">{item.testQuizHours || 0}h</td>
                        <td className="py-3 px-3 text-center font-mono">{item.otherStudy || 0}h</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/40 dark:bg-indigo-950/20 whitespace-nowrap">
                          {(item.totalStudyHours || 0).toFixed(1)} hrs
                        </td>
                        <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-300" title={item.remarks}>
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
                                if (window.confirm(`Delete log for ${item.date}?`)) {
                                  deleteDailyProgress(item.id);
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
      </div>

      {/* Target Configuration Modal */}
      <Modal
        isOpen={isTargetModalOpen}
        onClose={() => setIsTargetModalOpen(false)}
        title="Configure Daily Study Target"
        subtitle="Set your daily commitment for preparation"
      >
        <form onSubmit={handleSaveTarget} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Select or Enter Target Hours per Day
            </label>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {[6, 8, 10, 12].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setTempTargetHours(String(preset))}
                  className={`py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                    parseFloat(tempTargetHours) === preset
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {preset} hours
                </button>
              ))}
            </div>

            <div className="relative">
              <input
                type="number"
                min="1"
                max="24"
                step="0.5"
                required
                value={tempTargetHours}
                onChange={e => setTempTargetHours(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                hours / day
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Your target will apply to the live progress bar, daily completion checks, and streak analytics.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsTargetModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm"
            >
              Save Target
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Manual Session Modal */}
      <Modal
        isOpen={isAddSessionModalOpen}
        onClose={() => setIsAddSessionModalOpen(false)}
        title="Add Manual Study Session"
        subtitle="Record past study time directly into session history"
      >
        <form onSubmit={handleSaveManualSession} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={manualSessionDate}
                onChange={e => setManualSessionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Start Time *
              </label>
              <input
                type="time"
                required
                value={manualSessionStart}
                onChange={e => setManualSessionStart(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                End Time *
              </label>
              <input
                type="time"
                required
                value={manualSessionEnd}
                onChange={e => setManualSessionEnd(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Session Type *
              </label>
              <select
                value={manualSessionType}
                onChange={e => setManualSessionType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              >
                <option value="Lecture">Lecture</option>
                <option value="PYQ">PYQ</option>
                <option value="Revision">Revision</option>
                <option value="Quiz">Weekly Quiz</option>
                <option value="Test">Test Tracker</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Subject
              </label>
              <input
                type="text"
                placeholder="e.g. Operating Systems"
                value={manualSessionSubject}
                onChange={e => setManualSessionSubject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Module (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. CPU Scheduling"
                value={manualSessionModule}
                onChange={e => setManualSessionModule(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Topic (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Round Robin Algorithm"
                value={manualSessionTopic}
                onChange={e => setManualSessionTopic(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="Session summary or notes..."
              value={manualSessionRemarks}
              onChange={e => setManualSessionRemarks(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddSessionModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm"
            >
              Save Session
            </button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Daily Log Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Study Log' : 'Log Daily Study Hours'}
        subtitle="Total study hours will calculate automatically"
      >
        <form onSubmit={handleSaveDailyLog} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Date *
            </label>
            <input
              type="date"
              required
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Lecture Hours
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formLectureHours}
                onChange={e => setFormLectureHours(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                PYQ Hours
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formPyqHours}
                onChange={e => setFormPyqHours(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Revision Hours
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formRevisionHours}
                onChange={e => setFormRevisionHours(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Test / Quiz Hours
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formTestHours}
                onChange={e => setFormTestHours(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Other Study
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formOtherStudy}
                onChange={e => setFormOtherStudy(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-indigo-600 dark:text-indigo-400 mb-1">
                Total (Calculated)
              </label>
              <div className="w-full px-3 py-2 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                {autoTotalHours} hrs
              </div>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Remarks
            </label>
            <textarea
              rows={3}
              value={formRemarks}
              onChange={e => setFormRemarks(e.target.value)}
              placeholder="What topics were covered today? Any roadblocks?"
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
              {editingItem ? 'Save Changes' : 'Record Hours'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Paste Modal */}
      <UniversalPasteModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        targetSection="daily_progress"
      />

      {/* Bulk Delete Daily Logs Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteDailyOpen}
        onClose={() => setIsBulkDeleteDailyOpen(false)}
        onConfirm={async () => {
          await bulkDeleteDailyProgress(Array.from(selectedDailyIds));
          setSelectedDailyIds(new Set());
          setIsBulkDeleteDailyOpen(false);
        }}
        title={`Delete ${selectedDailyIds.size} selected records?`}
        message={`Are you sure you want to delete ${selectedDailyIds.size} selected daily study log(s)?`}
        subMessage="This action can be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Bulk Delete Sessions Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteSessionsOpen}
        onClose={() => setIsBulkDeleteSessionsOpen(false)}
        onConfirm={async () => {
          await bulkDeleteStudySessions(Array.from(selectedSessionIds));
          setSelectedSessionIds(new Set());
          setIsBulkDeleteSessionsOpen(false);
        }}
        title={`Delete ${selectedSessionIds.size} selected sessions?`}
        message={`Are you sure you want to delete ${selectedSessionIds.size} selected study session(s)?`}
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
          await resetSection('daily_progress');
          setSelectedDailyIds(new Set());
          setSelectedSessionIds(new Set());
          setIsResetSectionOpen(false);
        }}
        title="Reset Daily Progress?"
        message="This will permanently remove all Daily Progress records and study sessions. Other sections will not be affected."
        subMessage="Sample preview will be restored if no records remain. This action can be undone with Undo."
        confirmText="Reset Section"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};
