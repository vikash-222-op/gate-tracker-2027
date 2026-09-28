import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/views/DashboardView';
import { DailyProgressView } from './components/views/DailyProgressView';
import { LectureTrackerView } from './components/views/LectureTrackerView';
import { PYQTrackerView } from './components/views/PYQTrackerView';
import { RevisionTrackerView } from './components/views/RevisionTrackerView';
import { WeeklyQuizView } from './components/views/WeeklyQuizView';
import { TestTrackerView } from './components/views/TestTrackerView';
import { PlanningView } from './components/views/PlanningView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { CustomSheetsView } from './components/views/CustomSheetsView';
import { ImportExportView } from './components/views/ImportExportView';
import { SettingsView } from './components/views/SettingsView';
import { UserNameModal } from './components/common/UserNameModal';

const MainLayout: React.FC = () => {
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { loading } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium font-mono">
            Loading GATE 2027 Preparation Database...
          </p>
        </div>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
      case 'daily_progress':
        return <DailyProgressView />;
      case 'lecture_tracker':
        return <LectureTrackerView />;
      case 'pyq_tracker':
        return <PYQTrackerView />;
      case 'revision_tracker':
        return <RevisionTrackerView />;
      case 'weekly_quiz':
        return <WeeklyQuizView />;
      case 'test_tracker':
        return <TestTrackerView />;
      case 'planning':
        return <PlanningView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'custom_sheets':
        return <CustomSheetsView />;
      case 'import_export':
        return <ImportExportView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView onNavigate={(view) => setCurrentView(view)} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        isOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        <Navbar
          currentView={currentView}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onNavigate={(v) => setCurrentView(v)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {renderView()}
        </main>
      </div>

      {/* Global Username Dialog */}
      <UserNameModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
