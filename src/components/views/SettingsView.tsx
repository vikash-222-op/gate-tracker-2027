import React, { useState, useEffect } from 'react';
import {
  Settings,
  Calendar,
  Moon,
  Sun,
  Database,
  Trash2,
  AlertTriangle,
  Download,
  Upload,
  CheckCircle2,
  ShieldAlert,
  Cloud,
  RefreshCw,
  LogOut
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

export const SettingsView: React.FC = () => {
  const {
    state,
    updateSettings,
    setTheme,
    resetDatabase,
    restoreBackup,
    user,
    loginWithGoogle,
    logoutUser,
    cloudSyncStatus,
    lastCloudSyncTime,
    manualCloudSync,
    effectiveUserName,
    saveUserName
  } = useApp();

  const [examDate, setExamDate] = useState(state.settings.examDate || '2027-02-06');
  const [targetExam, setTargetExam] = useState(state.settings.targetExam || 'GATE CS / DA 2027');
  const [userName, setUserName] = useState(effectiveUserName);
  const [dailyGoalHours, setDailyGoalHours] = useState(String(state.settings.dailyGoalHours ?? 10));
  const [isSavedMessage, setIsSavedMessage] = useState(false);

  useEffect(() => {
    setUserName(effectiveUserName);
  }, [effectiveUserName]);

  // Reset Confirmation Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState('');

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const hours = Math.max(1, Math.min(24, parseFloat(dailyGoalHours) || 10));
    const trimmedName = userName.trim() || effectiveUserName;
    await updateSettings({
      examDate,
      targetExam: targetExam.trim(),
      userName: trimmedName,
      dailyGoalHours: hours
    });
    await saveUserName(trimmedName);
    setIsSavedMessage(true);
    setTimeout(() => setIsSavedMessage(false), 3000);
  };

  const handleConfirmReset = async () => {
    if (resetConfirmationText !== 'RESET') return;
    await resetDatabase();
    setIsResetModalOpen(false);
    setResetConfirmationText('');
  };

  const handleDownloadBackup = () => {
    const backupJson = JSON.stringify(state, null, 2);
    const blob = new Blob([backupJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GATE_GPMS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUploadBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && json.settings) {
          await restoreBackup(json);
          alert('Backup restored successfully!');
        } else {
          alert('Invalid backup file.');
        }
      } catch (err: any) {
        alert(`Restore failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Database stats
  const totalLectures = state.lectureTracker.length;
  const totalPYQGroups = state.pyqTracker.length;
  const totalRevisions = state.revisionTracker.length;
  const totalQuizzes = state.weeklyQuiz.length;
  const totalTests = state.testTracker.length;
  const totalDailyLogs = state.dailyProgress.length;
  const totalCustomSheets = state.customSheets.length;
  const totalRecords = totalLectures + totalPYQGroups + totalRevisions + totalQuizzes + totalTests + totalDailyLogs + state.planning.length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Settings & Local Data Management
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure countdown dates, appearance, and local browser database options.
        </p>
      </div>

      {isSavedMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Settings saved successfully! Countdown has updated.</span>
        </div>
      )}

      {/* Target Exam & Countdown Date Form */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          GATE Countdown & Aspirant Profile
        </h3>

        <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                GATE Exam Date *
              </label>
              <input
                type="date"
                required
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Countdown widget updates immediately.
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Target Exam Name
              </label>
              <input
                type="text"
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                placeholder="e.g. GATE CS / DA 2027"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Aspirant Name / Title
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Aspirant"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Daily Study Target (Hours)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.5"
                  value={dailyGoalHours}
                  onChange={(e) => setDailyGoalHours(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono font-bold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium">
                  hrs/day
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">
                Used in Daily Progress & Timer.
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </div>

      {/* Google Cloud Auto-Sync (Permanent & Free) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Cloud className="w-4 h-4 text-indigo-500" />
              Google Cloud Auto-Sync (Permanent & Free)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Sync all your GATE progress automatically across your MacBook, phone, and tablet in real time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={manualCloudSync}
                  disabled={cloudSyncStatus === 'syncing'}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  Sync to Cloud Now
                </button>
                <button
                  onClick={logoutUser}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
                Sign in with Google
              </button>
            )}
          </div>
        </div>

        {user ? (
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{effectiveUserName}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                    Connected
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 font-mono">{user.email}</div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-bold block">
                Status: {cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Real-time Synchronized'}
              </span>
              {lastCloudSyncTime && (
                <span className="text-[10px] text-slate-400 font-mono">Last sync: {lastCloudSyncTime}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              Currently storing data only on this browser. Click <strong>"Sign in with Google"</strong> to enable automatic cross-device cloud synchronization.
            </span>
          </div>
        )}
      </div>

      {/* Theme Selection */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Appearance Theme
        </h3>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              state.settings.theme === 'light'
                ? 'border-indigo-600 bg-indigo-50/60 text-indigo-700 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
            }`}
          >
            <Sun className="w-4 h-4 text-amber-500" />
            <span>Light Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              state.settings.theme === 'dark'
                ? 'border-indigo-500 bg-indigo-950/60 text-indigo-300 shadow-xs'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-800'
            }`}
          >
            <Moon className="w-4 h-4 text-indigo-400" />
            <span>Dark Mode</span>
          </button>
        </div>
      </div>

      {/* Storage & Backup Info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              IndexedDB Storage Statistics
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Total {totalRecords} records stored securely in your browser's persistent database.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            {totalRecords} items
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Lectures</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">{totalLectures}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">PYQ Topics</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">{totalPYQGroups}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Revision Modules</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">{totalRevisions}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Quizzes & Tests</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">{totalQuizzes + totalTests}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Daily Logs</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">{totalDailyLogs}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Planning Tasks</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">{state.planning.length}</span>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Custom Sheets</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">{totalCustomSheets}</span>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={handleDownloadBackup}
            className="px-3.5 py-2 text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-750 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Download Full JSON Backup
          </button>
        </div>
      </div>

      {/* Danger Zone: Reset Data */}
      <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <h3 className="text-sm font-bold uppercase tracking-wider">
            Reset Application Data
          </h3>
        </div>
        <p className="text-xs text-rose-800/80 dark:text-rose-300">
          Erases all local preparation records across all tables. This action cannot be undone unless you have a JSON backup or your original Excel workbook.
        </p>

        <button
          onClick={() => {
            setResetConfirmationText('');
            setIsResetModalOpen(true);
          }}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Reset All Data...
        </button>
      </div>

      {/* Reset Confirmation Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Confirm Total Database Reset"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <span>
              This will permanently delete all {totalRecords} records from this browser. To confirm, type <strong>RESET</strong> in uppercase below.
            </span>
          </div>

          <div>
            <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
              Type "RESET" to confirm:
            </label>
            <input
              type="text"
              value={resetConfirmationText}
              onChange={(e) => setResetConfirmationText(e.target.value)}
              placeholder="RESET"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white font-mono"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={resetConfirmationText !== 'RESET'}
              onClick={handleConfirmReset}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold rounded-lg shadow-sm"
            >
              Permanently Reset Database
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
