import React from 'react';
import {
  Menu,
  Sun,
  Moon,
  Upload,
  Calendar,
  Sparkles,
  Undo2,
  Redo2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CloudSyncButton } from '../common/CloudSyncButton';

interface NavbarProps {
  currentView: string;
  onOpenMobileMenu: () => void;
  onNavigate: (view: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onOpenMobileMenu,
  onNavigate
}) => {
  const { theme, setTheme, state, undo, redo, canUndo, canRedo, undoCount, redoCount } = useApp();

  const viewTitles: Record<string, string> = {
    dashboard: 'Dashboard Overview',
    daily_progress: 'Daily Progress Tracker',
    lecture_tracker: 'Lecture Tracker',
    pyq_tracker: 'PYQ Tracker',
    revision_tracker: 'Revision Tracker (Module-Wise)',
    weekly_quiz: 'Weekly Quiz Tracker',
    test_tracker: 'Test Series Tracker',
    planning: 'Study Planning',
    analytics: 'Analytics & Insights',
    custom_sheets: 'Custom Sheets & Lookup Tables',
    import_export: 'Import / Export System',
    settings: 'Settings & Data Management'
  };

  const title = viewTitles[currentView] || 'GATE 2027 System';

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 flex items-center justify-between">
      {/* Left: Mobile hamburger & title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-tight">
            {title}
          </h2>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline-block">
            {state.settings.targetExam || 'GATE CS / DA 2027'}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Global Undo & Redo Controls */}
        <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/60 shadow-2xs">
          <button
            onClick={() => undo()}
            disabled={!canUndo}
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
            title={canUndo ? `Undo (${undoCount} available, Ctrl+Z)` : 'Undo (Ctrl+Z)'}
            aria-label="Undo"
          >
            <Undo2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Undo</span>
          </button>
          <button
            onClick={() => redo()}
            disabled={!canRedo}
            className="p-1.5 rounded-md text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
            title={canRedo ? `Redo (${redoCount} available, Ctrl+Y)` : 'Redo (Ctrl+Y)'}
            aria-label="Redo"
          >
            <Redo2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline text-[11px]">Redo</span>
          </button>
        </div>

        <button
          onClick={() => onNavigate('import_export')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Excel Import</span>
        </button>

        {/* Google Cloud Sync Button */}
        <CloudSyncButton />

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>
      </div>
    </header>
  );
};
