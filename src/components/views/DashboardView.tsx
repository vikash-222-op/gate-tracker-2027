import React, { useMemo } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ListTodo,
  FileText,
  Award,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Target,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CountdownWidget } from '../common/CountdownWidget';
import {
  SAMPLE_LECTURES,
  SAMPLE_PYQS,
  SAMPLE_REVISIONS,
  SAMPLE_WEEKLY_QUIZZES,
  SAMPLE_TESTS,
  SAMPLE_DAILY_PROGRESS,
  SAMPLE_PLANNING,
  getWithSampleFallback
} from '../../services/sampleData';

interface Props {
  onNavigate: (view: string) => void;
}

export const DashboardView: React.FC<Props> = ({ onNavigate }) => {
  const { state, updatePlanning } = useApp();

  // Sample data fallback for zero-state preview
  const { items: effectiveLectures, isSampleState: isSampleLec } = useMemo(
    () => getWithSampleFallback(state.lectureTracker, SAMPLE_LECTURES),
    [state.lectureTracker]
  );
  const { items: effectivePYQs, isSampleState: isSamplePYQ } = useMemo(
    () => getWithSampleFallback(state.pyqTracker, SAMPLE_PYQS),
    [state.pyqTracker]
  );
  const { items: effectiveRevisions } = useMemo(
    () => getWithSampleFallback(state.revisionTracker, SAMPLE_REVISIONS),
    [state.revisionTracker]
  );
  const { items: effectiveQuizzes } = useMemo(
    () => getWithSampleFallback(state.weeklyQuiz, SAMPLE_WEEKLY_QUIZZES),
    [state.weeklyQuiz]
  );
  const { items: effectiveTests } = useMemo(
    () => getWithSampleFallback(state.testTracker, SAMPLE_TESTS),
    [state.testTracker]
  );
  const { items: effectiveDaily } = useMemo(
    () => getWithSampleFallback(state.dailyProgress, SAMPLE_DAILY_PROGRESS),
    [state.dailyProgress]
  );
  const { items: effectivePlanning } = useMemo(
    () => getWithSampleFallback(state.planning, SAMPLE_PLANNING),
    [state.planning]
  );

  const isSampleDashboard = isSampleLec && isSamplePYQ && state.dailyProgress.length === 0;

  // 1. Lecture Stats
  const totalLectures = effectiveLectures.length;
  const completedLectures = effectiveLectures.filter(l => 
    l.done === true || l.done === 'Completed' || String(l.done).toLowerCase() === 'done'
  ).length;
  const lectureProgressPct = totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0;

  // 2. PYQ Stats
  const totalPYQs = effectivePYQs.reduce((acc, p) => acc + (p.totalPYQs || 0), 0);
  const solvedPYQs = effectivePYQs.reduce((acc, p) => acc + (p.solved || 0), 0);
  const remainingPYQs = Math.max(0, totalPYQs - solvedPYQs);
  const pyqProgressPct = totalPYQs > 0 ? Math.round((solvedPYQs / totalPYQs) * 100) : 0;

  // 3. Revision Stats (Module-wise)
  const totalRevisions = effectiveRevisions.length;
  const completedRevisions = effectiveRevisions.filter(r => r.completed || r.lastRevision).length;
  const revisionProgressPct = totalRevisions > 0 ? Math.round((completedRevisions / totalRevisions) * 100) : 0;

  // 4. Weekly Quiz Stats
  const totalQuizzes = effectiveQuizzes.length;
  const quizzesAttempted = effectiveQuizzes.filter(q => q.complete || (q.attempted && q.attempted > 0)).length;

  // 5. Test Stats
  const totalTests = effectiveTests.length;
  const testsAttempted = effectiveTests.filter(t => t.completed || (t.attempted && t.attempted > 0)).length;

  // 6. Total Study Hours from Daily Progress
  const totalStudyHours = effectiveDaily.reduce((acc, d) => acc + (d.totalStudyHours || 0), 0);
  const todayDateStr = new Date().toISOString().split('T')[0];
  const todayEntry = effectiveDaily.find(d => d.date === todayDateStr);
  const todayHours = todayEntry ? todayEntry.totalStudyHours : 0;

  // 5.3 Subject-wise Lecture Progress
  const subjectLectureMap = new Map<string, { total: number; completed: number }>();
  effectiveLectures.forEach(lec => {
    const subj = lec.subject || lec.module || 'General';
    const isDone = lec.done === true || lec.done === 'Completed' || String(lec.done).toLowerCase() === 'done';
    const curr = subjectLectureMap.get(subj) || { total: 0, completed: 0 };
    curr.total += 1;
    if (isDone) curr.completed += 1;
    subjectLectureMap.set(subj, curr);
  });
  const subjectLectureProgress = Array.from(subjectLectureMap.entries()).map(([subject, data]) => ({
    subject,
    total: data.total,
    completed: data.completed,
    pct: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0
  })).sort((a, b) => b.total - a.total);

  // 5.4 Subject-wise PYQ Progress
  const subjectPyqMap = new Map<string, { total: number; solved: number }>();
  effectivePYQs.forEach(pyq => {
    const subj = pyq.subject || 'General';
    const curr = subjectPyqMap.get(subj) || { total: 0, solved: 0 };
    curr.total += (pyq.totalPYQs || 0);
    curr.solved += (pyq.solved || 0);
    subjectPyqMap.set(subj, curr);
  });
  const subjectPyqProgress = Array.from(subjectPyqMap.entries()).map(([subject, data]) => {
    const remaining = Math.max(0, data.total - data.solved);
    const pct = data.total > 0 ? Math.round((data.solved / data.total) * 100) : 0;
    return { subject, total: data.total, solved: data.solved, remaining, pct };
  }).sort((a, b) => b.total - a.total);

  // 5.5 Recent Activity Feed
  const recentActivities: Array<{ id: string; type: string; title: string; date: string; tag: string }> = [];

  effectiveLectures
    .filter(l => l.doneDate)
    .slice(-4)
    .forEach(l => {
      recentActivities.push({
        id: `act_lec_${l.id}`,
        type: 'Lecture Completed',
        title: `${l.module}: ${l.lectureTitle}`,
        date: l.doneDate!,
        tag: 'Lecture'
      });
    });

  effectiveQuizzes
    .filter(q => q.testDate)
    .slice(-4)
    .forEach(q => {
      recentActivities.push({
        id: `act_quiz_${q.id}`,
        type: 'Quiz Attempted',
        title: `${q.quizName} (${q.netMarks ?? q.accuracy + '%'})`,
        date: q.testDate!,
        tag: 'Quiz'
      });
    });

  effectiveTests
    .filter(t => t.testDate)
    .slice(-4)
    .forEach(t => {
      recentActivities.push({
        id: `act_test_${t.id}`,
        type: 'Test Completed',
        title: `${t.testName} (${t.marksObtained ?? t.accuracy + '%'})`,
        date: t.testDate!,
        tag: 'Test'
      });
    });

  effectiveRevisions
    .filter(r => r.lastRevision)
    .slice(-3)
    .forEach(r => {
      recentActivities.push({
        id: `act_rev_${r.id}`,
        type: 'Revision Recorded',
        title: `${r.subject} - ${r.module}`,
        date: r.lastRevision!,
        tag: 'Revision'
      });
    });

  // Sort activities by date descending
  recentActivities.sort((a, b) => (b.date > a.date ? 1 : -1));
  const topActivities = recentActivities.slice(0, 6);

  // 5.6 Today's Focus (Real-time synchronized with Planning Tracker)
  const pendingLectures = effectiveLectures.filter(l => 
    !l.done || l.done === 'In Progress' || l.done === 'Not Started'
  ).slice(0, 3);

  // Synchronized Planning Tasks: Active before completed, sorted by priority
  const organizedPlanningTasks = useMemo(() => {
    const priorityWeight: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
    return [...effectivePlanning].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const pA = priorityWeight[a.priority || 'Medium'] || 2;
      const pB = priorityWeight[b.priority || 'Medium'] || 2;
      if (pA !== pB) return pB - pA;
      return 0;
    }).slice(0, 6);
  }, [effectivePlanning]);

  const todayPlans = organizedPlanningTasks;

  const handleToggleTask = async (task: any) => {
    if (task.isSample) return;
    await updatePlanning({
      ...task,
      completed: !task.completed
    });
  };

  // Weak areas from quizzes & tests
  const identifiedWeakAreas: string[] = [];
  effectiveQuizzes.forEach(q => {
    if (q.weakAreas && q.weakAreas.trim() && !identifiedWeakAreas.includes(q.weakAreas.trim())) {
      identifiedWeakAreas.push(q.weakAreas.trim());
    }
  });
  effectiveTests.forEach(t => {
    if (t.weakArea && t.weakArea.trim() && !identifiedWeakAreas.includes(t.weakArea.trim())) {
      identifiedWeakAreas.push(t.weakArea.trim());
    }
  });

  return (
    <div className="space-y-6">
      {/* 5.1 GATE Countdown */}
      <CountdownWidget onOpenSettings={() => onNavigate('settings')} />

      {/* Sample Preview Banner if in sample state */}
      {isSampleDashboard && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 uppercase tracking-wider shrink-0">
              Sample Preview (1-2 Rows)
            </span>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Showing a realistic 1-2 row demo state. Paste rows or upload your Excel workbook anytime to see your actual GATE progress.
            </p>
          </div>
          <button
            onClick={() => onNavigate('import_export')}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm whitespace-nowrap flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            Import Excel
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5.2 Preparation Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Lectures Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Lectures</span>
            <BookOpen className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {completedLectures}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {totalLectures}</span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[11px] mb-1 font-medium">
              <span className="text-slate-500 dark:text-slate-400">Progress</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{lectureProgressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                style={{ width: `${lectureProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* PYQs Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">PYQs Solved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {solvedPYQs}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {totalPYQs}</span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[11px] mb-1 font-medium">
              <span className="text-slate-500 dark:text-slate-400">Remaining</span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold">{remainingPYQs}</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${pyqProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Revisions Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Revisions</span>
            <RotateCcw className="w-4 h-4 text-purple-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {completedRevisions}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {totalRevisions} mods</span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[11px] mb-1 font-medium">
              <span className="text-slate-500 dark:text-slate-400">Coverage</span>
              <span className="text-purple-600 dark:text-purple-400 font-semibold">{revisionProgressPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${revisionProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quizzes Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Weekly Quizzes</span>
            <Award className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {quizzesAttempted}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {totalQuizzes}</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            {totalQuizzes - quizzesAttempted > 0 ? `${totalQuizzes - quizzesAttempted} pending` : 'All attempted'}
          </p>
        </div>

        {/* Tests Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Test Series</span>
            <FileText className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {testsAttempted}
            </span>
            <span className="text-xs text-slate-400 font-mono">/ {totalTests}</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Mocks & Topic Tests
          </p>
        </div>

        {/* Study Hours Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-xs font-medium uppercase tracking-wider">Total Hours</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {totalStudyHours.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">hrs</span>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Today: <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">{todayHours}h</span>
          </p>
        </div>
      </div>

      {/* 5.3 & 5.4 Subject Progress Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5.3 Subject-wise Lecture Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Subject-wise Lecture Progress
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Derived from actual Lecture Tracker data</p>
            </div>
            <button
              onClick={() => onNavigate('lecture_tracker')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {subjectLectureProgress.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No lecture data recorded yet. Upload Excel or add lectures.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {subjectLectureProgress.map(item => (
                <div key={item.subject} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={item.subject}>
                      {item.subject}
                    </span>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span>{item.completed}/{item.total}</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 w-9 text-right">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 5.4 Subject-wise PYQ Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Subject-wise PYQ Progress
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Solved vs Remaining PYQs per subject</p>
            </div>
            <button
              onClick={() => onNavigate('pyq_tracker')}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {subjectPyqProgress.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No PYQ data recorded yet. Upload Excel or add PYQ groups.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
              {subjectPyqProgress.map(item => (
                <div key={item.subject} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={item.subject}>
                      {item.subject}
                    </span>
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      <span>{item.solved}/{item.total}</span>
                      <span className="text-amber-600 dark:text-amber-400">({item.remaining} rem)</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 w-9 text-right">
                        {item.pct}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 5.5 Recent Activity & 5.6 Today's Focus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 5.6 Today's Focus */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-rose-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Today's Focus & Action Items
              </h3>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
              Based on Stored Data
            </span>
          </div>

          <div className="space-y-4">
            {/* Planned Tasks */}
            {todayPlans.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Planned Tasks
                </span>
                <div className="space-y-1.5">
                  {todayPlans.map(plan => (
                    <div
                      key={plan.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${plan.completed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{plan.task}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{plan.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Lectures */}
            {pendingLectures.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Next Lectures to Watch
                </span>
                <div className="space-y-1.5">
                  {pendingLectures.map(lec => (
                    <div
                      key={lec.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="text-slate-500 dark:text-slate-400 text-[11px] block">{lec.module}</span>
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          Lec #{lec.lectureNo}: {lec.lectureTitle}
                        </span>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium">
                        {lec.duration || 'Watch'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weak Areas from Quizzes */}
            {identifiedWeakAreas.length > 0 && (
              <div>
                <span className="text-[11px] font-semibold text-rose-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Weak Areas Identified in Tests/Quizzes
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {identifiedWeakAreas.slice(0, 6).map((area, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-900/40"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {pendingLectures.length === 0 && todayPlans.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-xs">
                No active pending items found. Plan your day in the Planning tab!
              </div>
            )}
          </div>
        </div>

        {/* 5.5 Recent Activity Feed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Recent Preparation Activity
            </h3>
            <span className="text-xs text-slate-400">Log history</span>
          </div>

          {topActivities.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No recent logged activities. Completed lectures, tests, and revisions will appear here automatically.
            </div>
          ) : (
            <div className="relative pl-4 space-y-4 border-l-2 border-slate-200 dark:border-slate-800">
              {topActivities.map((act) => (
                <div key={act.id} className="relative group">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" />
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                        {act.type}
                      </span>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                        {act.title}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {act.date}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
