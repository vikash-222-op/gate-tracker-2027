import React, { useMemo } from 'react';
import {
  TrendingUp,
  BarChart3,
  PieChart,
  Calendar,
  Clock,
  BookOpen,
  CheckSquare,
  Award,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AnalyticsView: React.FC = () => {
  const { state } = useApp();

  // 1. Study Hours Aggregates
  const totalStudyHours = state.dailyProgress.reduce((sum, d) => sum + (d.totalStudyHours || 0), 0);
  const now = new Date().getTime();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const weeklyHours = state.dailyProgress
    .filter(d => new Date(d.date).getTime() >= sevenDaysAgo)
    .reduce((sum, d) => sum + (d.totalStudyHours || 0), 0);

  const monthlyHours = state.dailyProgress
    .filter(d => new Date(d.date).getTime() >= thirtyDaysAgo)
    .reduce((sum, d) => sum + (d.totalStudyHours || 0), 0);

  // Daily study history (last 14 logged entries sorted by date)
  const recentDailyLogs = useMemo(() => {
    return [...state.dailyProgress]
      .sort((a, b) => (a.date > b.date ? 1 : -1))
      .slice(-14);
  }, [state.dailyProgress]);

  const maxDailyHour = useMemo(() => {
    const max = Math.max(...recentDailyLogs.map(d => d.totalStudyHours || 0), 6);
    return max > 0 ? max : 6;
  }, [recentDailyLogs]);

  // 2. Subject-wise Lecture Progress
  const subjectLectureMap = new Map<string, { total: number; completed: number }>();
  state.lectureTracker.forEach(l => {
    const s = l.subject || l.module || 'General';
    const curr = subjectLectureMap.get(s) || { total: 0, completed: 0 };
    curr.total += 1;
    if (l.done === true || l.done === 'Completed' || String(l.done).toLowerCase() === 'done') {
      curr.completed += 1;
    }
    subjectLectureMap.set(s, curr);
  });
  const subjectLectureData = Array.from(subjectLectureMap.entries()).map(([subj, d]) => ({
    subj,
    total: d.total,
    completed: d.completed,
    pct: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0
  })).sort((a, b) => b.total - a.total);

  // 3. Subject-wise PYQ Progress
  const subjectPyqMap = new Map<string, { total: number; solved: number }>();
  state.pyqTracker.forEach(p => {
    const s = p.subject || 'General';
    const curr = subjectPyqMap.get(s) || { total: 0, solved: 0 };
    curr.total += (p.totalPYQs || 0);
    curr.solved += (p.solved || 0);
    subjectPyqMap.set(s, curr);
  });
  const subjectPyqData = Array.from(subjectPyqMap.entries()).map(([subj, d]) => {
    const remaining = Math.max(0, d.total - d.solved);
    const pct = d.total > 0 ? Math.round((d.solved / d.total) * 100) : 0;
    return { subj, total: d.total, solved: d.solved, remaining, pct };
  }).sort((a, b) => b.total - a.total);

  // 4. Mistake Pattern Distribution (Quizzes + Tests)
  const mistakePatternCounts: Record<string, number> = {};
  state.weeklyQuiz.forEach(q => {
    if (q.mistakePattern && q.mistakePattern.trim()) {
      const p = q.mistakePattern.trim();
      mistakePatternCounts[p] = (mistakePatternCounts[p] || 0) + 1;
    }
  });
  state.testTracker.forEach(t => {
    if (t.mistakePattern && t.mistakePattern.trim()) {
      const p = t.mistakePattern.trim();
      mistakePatternCounts[p] = (mistakePatternCounts[p] || 0) + 1;
    }
  });
  const mistakePatterns = Object.entries(mistakePatternCounts)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
  const totalMistakesLogged = mistakePatterns.reduce((acc, m) => acc + m.count, 0);

  // 5. Quiz & Test Performance Trends (Chronological)
  const chronologicalAssessments = useMemo(() => {
    const list: Array<{ name: string; date: string; accuracy: number; netMarks: number; type: 'Quiz' | 'Test' }> = [];
    state.weeklyQuiz.forEach(q => {
      if (q.testDate && q.accuracy !== undefined) {
        list.push({
          name: q.quizName,
          date: q.testDate,
          accuracy: q.accuracy,
          netMarks: q.netMarks ?? 0,
          type: 'Quiz'
        });
      }
    });
    state.testTracker.forEach(t => {
      if (t.testDate && t.accuracy !== undefined) {
        list.push({
          name: t.testName,
          date: t.testDate,
          accuracy: t.accuracy,
          netMarks: t.marksObtained ?? 0,
          type: 'Test'
        });
      }
    });
    return list.sort((a, b) => (a.date > b.date ? 1 : -1)).slice(-10);
  }, [state.weeklyQuiz, state.testTracker]);

  // 6. Revision Module Status
  const totalRevModules = state.revisionTracker.length;
  const revMastered = state.revisionTracker.filter(r => r.completed || (r.revision1 && r.revision2 && r.revision3)).length;
  const rev2Done = state.revisionTracker.filter(r => r.revision2 && !r.completed && !r.revision3).length;
  const rev1Done = state.revisionTracker.filter(r => r.revision1 && !r.revision2 && !r.revision3).length;
  const rev0Done = state.revisionTracker.filter(r => !r.revision1 && !r.revision2 && !r.revision3 && !r.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Preparation Analytics & Trends
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Strictly calculated from your logged lectures, PYQs, revisions, daily hours, and tests.
        </p>
      </div>

      {/* KPI Top Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Study Time</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {totalStudyHours.toFixed(1)}
            </span>
            <span className="text-xs text-slate-400">hrs</span>
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Last 7d: {weeklyHours.toFixed(1)}h | Last 30d: {monthlyHours.toFixed(1)}h
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Lecture Completion</span>
            <BookOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {state.lectureTracker.filter(l => l.done === true || l.done === 'Completed' || String(l.done).toLowerCase() === 'done').length}
            </span>
            <span className="text-xs text-slate-400">/ {state.lectureTracker.length}</span>
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
            {state.lectureTracker.length > 0
              ? Math.round((state.lectureTracker.filter(l => l.done === true || l.done === 'Completed').length / state.lectureTracker.length) * 100)
              : 0}% syllabus watched
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">PYQ Solved Ratio</span>
            <CheckSquare className="w-4 h-4 text-amber-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {state.pyqTracker.reduce((acc, p) => acc + (p.solved || 0), 0)}
            </span>
            <span className="text-xs text-slate-400">
              / {state.pyqTracker.reduce((acc, p) => acc + (p.totalPYQs || 0), 0)}
            </span>
          </div>
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold mt-1 block">
            {state.pyqTracker.reduce((acc, p) => acc + (p.remaining || 0), 0)} questions remaining
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tests & Quizzes</span>
            <Award className="w-4 h-4 text-sky-500" />
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
              {state.weeklyQuiz.length + state.testTracker.length}
            </span>
            <span className="text-xs text-slate-400">attempts</span>
          </div>
          <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold mt-1 block">
            {state.weeklyQuiz.length} Quizzes + {state.testTracker.length} Test Series
          </span>
        </div>
      </div>

      {/* Chart Row 1: Daily Study Hours Timeline */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Study Hours Over Time (Recent Days)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Hours invested per day</p>
          </div>
          <span className="text-xs font-mono text-slate-400">Max: {maxDailyHour}h</span>
        </div>

        {recentDailyLogs.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs italic">
            No daily study hours logged yet. Record hours in the Daily Progress tracker to see timeline visualization.
          </div>
        ) : (
          <div className="flex items-end gap-2 sm:gap-4 h-40 pt-6 px-2 overflow-x-auto">
            {recentDailyLogs.map((log) => {
              const h = log.totalStudyHours || 0;
              const heightPct = Math.min(100, Math.round((h / maxDailyHour) * 100));

              return (
                <div key={log.id} className="flex-1 flex flex-col items-center gap-1.5 min-w-[36px] group">
                  <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    {h}h
                  </span>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md h-28 flex items-end">
                    <div
                      className="w-full bg-gradient-to-t from-indigo-600 to-indigo-500 rounded-t-md transition-all duration-300 group-hover:brightness-110"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 truncate max-w-[42px]">
                    {log.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 2: Subject-Wise Progress Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Lecture Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
            Subject-wise Lecture Completion
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Completed lectures vs total syllabus</p>

          {subjectLectureData.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              No lecture data available.
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {subjectLectureData.map(item => (
                <div key={item.subj} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{item.subj}</span>
                    <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{item.pct}% ({item.completed}/{item.total})</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subject PYQ Progress */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
            Subject-wise PYQ Solved Distribution
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Solved questions vs remaining backlog</p>

          {subjectPyqData.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              No PYQ data available.
            </div>
          ) : (
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {subjectPyqData.map(item => (
                <div key={item.subj} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-800 dark:text-slate-200 truncate max-w-[200px]">{item.subj}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                      {item.pct}% ({item.solved}/{item.total} | {item.remaining} rem)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Mistake Pattern Distribution & Revision Completion Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mistake Pattern Distribution */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Mistake Pattern Distribution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Analysis of errors across all quizzes & tests</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{totalMistakesLogged} logged</span>
          </div>

          {mistakePatterns.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              No mistake patterns tagged yet. When logging quiz or test errors, select categories like "Conceptual", "Silly Mistake", or "Calculation".
            </div>
          ) : (
            <div className="space-y-2.5">
              {mistakePatterns.map(m => {
                const pct = totalMistakesLogged > 0 ? Math.round((m.count / totalMistakesLogged) * 100) : 0;
                return (
                  <div key={m.pattern} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-800 dark:text-slate-200">{m.pattern}</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">{m.count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-rose-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Revision Cycle Status */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Module Revision Stage Breakdown
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Distribution of modules through Revision 1, 2, 3</p>
            </div>
            <span className="text-xs font-mono text-slate-400">{totalRevModules} modules</span>
          </div>

          {totalRevModules === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              No revision modules recorded yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-purple-600 dark:text-purple-400">Mastered (3 Revisions Done)</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {revMastered} ({Math.round((revMastered / totalRevModules) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full"
                    style={{ width: `${(revMastered / totalRevModules) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">In Revision 2 Stage</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {rev2Done} ({Math.round((rev2Done / totalRevModules) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{ width: `${(rev2Done / totalRevModules) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-sky-600 dark:text-sky-400">In Revision 1 Stage</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {rev1Done} ({Math.round((rev1Done / totalRevModules) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-sky-500 rounded-full"
                    style={{ width: `${(rev1Done / totalRevModules) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-500">Not Yet Revised</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {rev0Done} ({Math.round((rev0Done / totalRevModules) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-slate-400 rounded-full"
                    style={{ width: `${(rev0Done / totalRevModules) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Recent Assessment Accuracy Trend */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-1">
          Recent Test & Quiz Accuracy Trend
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Accuracy percentage over latest 10 attempts</p>

        {chronologicalAssessments.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs italic">
            No quiz or test results logged yet.
          </div>
        ) : (
          <div className="space-y-2">
            {chronologicalAssessments.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      item.type === 'Quiz'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-sm">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-slate-400 font-mono text-[11px]">{item.date}</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded text-xs ${
                      item.accuracy >= 80
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : item.accuracy >= 60
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                    }`}
                  >
                    {item.accuracy}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
