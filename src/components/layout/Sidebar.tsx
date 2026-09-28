import React from 'react';
import {
  LayoutDashboard,
  Clock,
  BookOpen,
  CheckSquare,
  RotateCcw,
  Award,
  FileText,
  ListTodo,
  TrendingUp,
  Upload,
  Settings,
  Layers,
  ChevronRight,
  GraduationCap,
  Edit2,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  Cloud
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface SidebarProps {
  currentView: string;
  onSelectView: (view: string) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpen,
  onCloseMobile
}) => {
  const {
    state,
    user,
    effectiveUserName,
    openUserNameModal,
    loginWithGoogle,
    logoutUser,
    cloudSyncStatus
  } = useApp();
  const customSheetsCount = state.customSheets.length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null },
    { id: 'daily_progress', label: 'Daily Progress', icon: Clock, badge: `${state.dailyProgress.length}` },
    { id: 'lecture_tracker', label: 'Lecture Tracker', icon: BookOpen, badge: `${state.lectureTracker.length}` },
    { id: 'pyq_tracker', label: 'PYQ Tracker', icon: CheckSquare, badge: `${state.pyqTracker.length}` },
    { id: 'revision_tracker', label: 'Revision Tracker', icon: RotateCcw, badge: `${state.revisionTracker.length}` },
    { id: 'weekly_quiz', label: 'Weekly Quiz', icon: Award, badge: `${state.weeklyQuiz.length}` },
    { id: 'test_tracker', label: 'Test Tracker', icon: FileText, badge: `${state.testTracker.length}` },
    { id: 'planning', label: 'Planning', icon: ListTodo, badge: `${state.planning.length}` },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, badge: null },
    ...(customSheetsCount > 0 ? [{ id: 'custom_sheets', label: 'Custom Sheets', icon: Layers, badge: `${customSheetsCount}` }] : []),
    { id: 'import_export', label: 'Import / Export', icon: Upload, badge: null },
    { id: 'settings', label: 'Settings', icon: Settings, badge: null }
  ];

  const handleItemClick = (id: string) => {
    onSelectView(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">GATE GPMS</h1>
              <p className="text-[10px] text-indigo-400 font-medium">Preparation System 2027</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white lg:hidden"
          >
            ✕
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.badge && item.badge !== '0' && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        isActive
                          ? 'bg-indigo-800 text-indigo-100'
                          : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
                </div>
              </button>
            );
          })}
        </nav>

        {/* User / Storage Footer */}
        <div className="p-3 border-t border-slate-800 text-xs">
          {user ? (
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70 space-y-2">
              <div className="flex items-center gap-2.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={effectiveUserName}
                    className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-indigo-500/50"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                    {(effectiveUserName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="overflow-hidden flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-xs font-bold text-white truncate block"
                      title={effectiveUserName}
                    >
                      {effectiveUserName}
                    </span>
                  </div>
                  <span
                    className="text-[10px] text-slate-400 font-mono truncate block"
                    title={user.email || ''}
                  >
                    {user.email}
                  </span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={openUserNameModal}
                    title="Change / Edit Display Name"
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={logoutUser}
                    title="Sign Out"
                    className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-750 flex items-center justify-between text-[10px]">
                <span className="text-emerald-400 flex items-center gap-1 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                  {cloudSyncStatus === 'syncing' ? 'Syncing...' : 'Cloud Synced'}
                </span>
                <button
                  onClick={openUserNameModal}
                  className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  Edit Name
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-750 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300 truncate">
                    {effectiveUserName}
                  </span>
                </div>
                <button
                  onClick={openUserNameModal}
                  title="Set Name"
                  className="text-slate-400 hover:text-slate-200"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>

              <button
                onClick={loginWithGoogle}
                className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center gap-1.5 font-semibold text-xs shadow-xs transition-colors cursor-pointer"
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
                <span>Google Sign In</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
