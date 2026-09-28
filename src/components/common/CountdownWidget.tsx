import React from 'react';
import { Calendar, Clock, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CountdownWidget: React.FC<{ onOpenSettings?: () => void }> = ({ onOpenSettings }) => {
  const { state } = useApp();
  const examDateStr = state.settings.examDate || '2027-02-06';

  const examDate = new Date(examDateStr);
  const now = new Date();
  
  // Calculate difference
  const diffTime = examDate.getTime() - now.getTime();
  const isPast = diffTime <= 0;
  
  const totalDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  const totalWeeks = Math.floor(totalDays / 7);
  const remainingDaysInWeek = totalDays % 7;
  const totalMonths = (totalDays / 30.4).toFixed(1);

  // Formatted date string
  const formattedExamDate = !isNaN(examDate.getTime())
    ? examDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : examDateStr;

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-xl p-4 sm:p-5 shadow-md border border-indigo-700/50 flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3.5 w-full md:w-auto">
        <div className="p-3 bg-indigo-600/40 rounded-lg border border-indigo-500/30 text-indigo-300 shrink-0">
          <Calendar className="w-6 h-6" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wider text-indigo-300 uppercase">
              {state.settings.targetExam || 'GATE CS / DA 2027'}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/30 text-indigo-200">
              Exam: {formattedExamDate}
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
            Target Gateway to IITs & PSUs
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6 w-full md:w-auto justify-around md:justify-end">
        <div className="text-center px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 min-w-[70px]">
          <span className="block text-2xl sm:text-3xl font-black text-amber-400 font-mono">
            {isPast ? 0 : totalDays}
          </span>
          <span className="text-[10px] sm:text-xs font-medium text-slate-300 uppercase tracking-wider">
            Days Left
          </span>
        </div>

        <div className="text-center px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 min-w-[70px]">
          <span className="block text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {isPast ? 0 : totalWeeks}
          </span>
          <span className="text-[10px] sm:text-xs font-medium text-slate-300 uppercase tracking-wider">
            Weeks (+{remainingDaysInWeek}d)
          </span>
        </div>

        <div className="text-center px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-sm border border-white/10 min-w-[70px]">
          <span className="block text-2xl sm:text-3xl font-black text-sky-400 font-mono">
            {isPast ? 0 : totalMonths}
          </span>
          <span className="text-[10px] sm:text-xs font-medium text-slate-300 uppercase tracking-wider">
            Months
          </span>
        </div>

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            title="Configure Exam Date in Settings"
            className="text-xs px-2.5 py-1 rounded bg-indigo-700/60 hover:bg-indigo-600 text-indigo-200 hover:text-white transition-colors border border-indigo-500/40"
          >
            Edit Date
          </button>
        )}
      </div>
    </div>
  );
};
