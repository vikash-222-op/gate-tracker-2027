import React, { useState, useRef, useEffect } from 'react';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  LogOut,
  LogIn,
  User as UserIcon,
  ChevronDown
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const CloudSyncButton: React.FC = () => {
  const {
    user,
    authLoading,
    cloudSyncStatus,
    lastCloudSyncTime,
    loginWithGoogle,
    logoutUser,
    manualCloudSync,
    effectiveUserName,
    openUserNameModal
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (authLoading) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">Connecting...</span>
      </div>
    );
  }

  // Not logged in: Show "Sign in with Google" button
  if (!user) {
    return (
      <button
        onClick={loginWithGoogle}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors cursor-pointer"
        title="Sign in with Google to auto-sync your data across devices"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
          />
        </svg>
        <span className="hidden sm:inline">Google Sync</span>
      </button>
    );
  }

  // Logged in: Show Avatar + Sync Status + Dropdown
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer text-xs"
        title={`Logged in as ${user.email} (${cloudSyncStatus})`}
      >
        {/* User photo or avatar */}
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName || 'User'}
            className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
            {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
          </div>
        )}

        {/* Sync Icon Status */}
        <span className="hidden sm:flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
          {cloudSyncStatus === 'syncing' ? (
            <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
          ) : cloudSyncStatus === 'synced' ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
          ) : cloudSyncStatus === 'error' ? (
            <AlertCircle className="w-3 h-3 text-rose-500" />
          ) : (
            <Cloud className="w-3 h-3 text-slate-400" />
          )}
          <span className="text-[11px] font-mono capitalize">
            {cloudSyncStatus === 'syncing'
              ? 'Syncing'
              : cloudSyncStatus === 'synced'
              ? 'Synced'
              : cloudSyncStatus === 'error'
              ? 'Error'
              : 'Cloud'}
          </span>
        </span>

        <ChevronDown className="w-3 h-3 text-slate-400 hidden sm:block" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 p-3 text-xs space-y-3">
          {/* User info */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={effectiveUserName}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {(effectiveUserName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="overflow-hidden">
                <div className="font-semibold text-slate-900 dark:text-white truncate">
                  {effectiveUserName}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user.email}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setIsOpen(false);
                openUserNameModal();
              }}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 font-medium px-1 cursor-pointer"
            >
              Edit
            </button>
          </div>

          {/* Sync status info */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg flex items-center justify-between text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Cloud className="w-3.5 h-3.5 text-indigo-500" />
              Cloud Auto-Sync:
            </span>
            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
              Active (Firebase)
            </span>
          </div>
          {lastCloudSyncTime && (
            <div className="text-[10px] text-slate-400 font-mono text-right">
              Last synced: {lastCloudSyncTime}
            </div>
          )}

          {/* Actions */}
          <div className="pt-1 flex flex-col gap-1.5">
            <button
              onClick={async () => {
                await manualCloudSync();
              }}
              disabled={cloudSyncStatus === 'syncing'}
              className="w-full py-1.5 px-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`}
              />
              Sync Now
            </button>

            <button
              onClick={async () => {
                setIsOpen(false);
                await logoutUser();
              }}
              className="w-full py-1.5 px-2.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
