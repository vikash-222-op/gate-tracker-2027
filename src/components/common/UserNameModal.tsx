import React, { useState, useEffect } from 'react';
import { User, Sparkles, Check, X, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const UserNameModal: React.FC = () => {
  const { user, state, isNameModalOpen, setIsNameModalOpen, saveUserName, effectiveUserName } = useApp();

  const [nameInput, setNameInput] = useState('');

  // Pre-fill input when modal opens
  useEffect(() => {
    if (isNameModalOpen) {
      // Priority for default input:
      // 1. If user previously had a non-aspirant name, use that
      // 2. Or Google displayName
      // 3. Or email username
      const emailPrefix = user?.email ? user.email.split('@')[0] : '';
      const emailFormatted = emailPrefix
        ? emailPrefix.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : '';
      const defaultCandidate =
        state.settings.userName && state.settings.userName.toLowerCase() !== 'aspirant'
          ? state.settings.userName
          : user?.displayName || emailFormatted || 'GATE Aspirant';

      setNameInput(defaultCandidate);
    }
  }, [isNameModalOpen, state.settings.userName, user]);

  if (!isNameModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName =
      nameInput.trim() ||
      user?.displayName ||
      (user?.email ? user.email.split('@')[0] : '') ||
      'GATE Aspirant';
    await saveUserName(finalName);
  };

  const handleUseSuggestion = (suggestion: string) => {
    setNameInput(suggestion);
  };

  const emailPrefix = user?.email ? user.email.split('@')[0] : '';
  const emailFormatted = emailPrefix
    ? emailPrefix.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          onClick={() => setIsNameModalOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>What is your name?</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Apna Name enter karein jo bottom-left corner & dashboard par show hoga.
            </p>
          </div>
        </div>

        {/* Google Account Banner if logged in */}
        {user ? (
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl flex items-center gap-3 text-xs text-indigo-950 dark:text-indigo-200">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'Google User'}
                className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-indigo-500/40"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                {(user.displayName || user.email || 'G').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="overflow-hidden flex-1">
              <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>Google Account Authenticated</span>
              </div>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {user.displayName || 'Google User'}
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                {user.email}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300">
            Set your display name for offline & local storage tracking.
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Enter Your Display Name *
            </label>
            <input
              type="text"
              autoFocus
              required
              placeholder="e.g. Vikash Kumar Singh"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500 transition-all"
            />

            {/* Quick Suggestion Chips */}
            {(user?.displayName || emailFormatted) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Quick select:</span>
                {user?.displayName && user.displayName !== nameInput && (
                  <button
                    type="button"
                    onClick={() => handleUseSuggestion(user.displayName!)}
                    className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {user.displayName}
                  </button>
                )}
                {emailFormatted && emailFormatted !== nameInput && emailFormatted !== user?.displayName && (
                  <button
                    type="button"
                    onClick={() => handleUseSuggestion(emailFormatted)}
                    className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {emailFormatted}
                  </button>
                )}
              </div>
            )}

            <p className="text-[11px] text-slate-400 mt-2">
              This name will be displayed in the bottom-left profile, daily study tracker, and synced across all your devices.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsNameModalOpen(false)}
              className="px-4 py-2 text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Save Name
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
