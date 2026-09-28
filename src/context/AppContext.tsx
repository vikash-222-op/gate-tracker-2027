import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  AppDatabaseState,
  DailyProgressItem,
  StudySession,
  TopicMasterItem,
  LectureItem,
  PYQItem,
  RevisionItem,
  WeeklyQuizItem,
  TestItem,
  PlanningItem,
  CustomSheet,
  AppSettings,
  LectureStatus,
  ResetSectionKey
} from '../types';
import {
  loadFullDatabaseState,
  putItem,
  putItems,
  deleteItem as dbDeleteItem,
  deleteItems as dbDeleteItems,
  clearStore,
  replaceStoreItems,
  saveSettings as dbSaveSettings,
  resetAllData as dbResetAllData,
  DEFAULT_SETTINGS
} from '../services/db';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  logOut,
  syncSectionToCloud,
  uploadFullStateToCloud,
  downloadFullStateFromCloud,
  listenToCloudUpdates,
  updateUserDisplayNameInCloud,
  SyncSectionName
} from '../services/firebase';

export interface ActiveTimerState {
  isRunning: boolean;
  elapsedSeconds: number;
  sessionType: 'Lecture' | 'PYQ' | 'Revision' | 'Quiz' | 'Test' | 'Other';
  subject: string;
  module: string;
  topic?: string;
  remarks: string;
  startTime: string; // e.g. "09:30 AM"
  lastUpdatedTimestamp?: number;
}

interface AppContextType {
  state: AppDatabaseState;
  loading: boolean;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  setDailyTargetForDate: (date: string, hours: number) => Promise<void>;
  
  // Cloud Sync & Google Auth
  user: User | null;
  authLoading: boolean;
  cloudSyncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastCloudSyncTime: string | null;
  loginWithGoogle: () => Promise<void>;
  logoutUser: () => Promise<void>;
  manualCloudSync: () => Promise<void>;
  isNameModalOpen: boolean;
  setIsNameModalOpen: (open: boolean) => void;
  openUserNameModal: () => void;
  saveUserName: (name: string) => Promise<void>;
  effectiveUserName: string;
  
  // Timer State & Controls
  activeTimer: ActiveTimerState;
  startTimer: (
    sessionType?: ActiveTimerState['sessionType'],
    subject?: string,
    module?: string,
    topic?: string,
    remarks?: string
  ) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => Promise<StudySession | null>;
  resetTimer: () => void;

  // Study Sessions
  addStudySession: (session: Omit<StudySession, 'id'>) => Promise<void>;
  updateStudySession: (session: StudySession) => Promise<void>;
  deleteStudySession: (id: string) => Promise<void>;
  bulkDeleteStudySessions: (ids: string[]) => Promise<void>;

  // Topic Master CRUD
  addTopicMaster: (item: Omit<TopicMasterItem, 'id'>) => Promise<void>;
  updateTopicMaster: (item: TopicMasterItem) => Promise<void>;
  deleteTopicMaster: (id: string) => Promise<void>;

  // Daily Progress CRUD
  addDailyProgress: (item: Omit<DailyProgressItem, 'id'>) => Promise<void>;
  updateDailyProgress: (item: DailyProgressItem) => Promise<void>;
  deleteDailyProgress: (id: string) => Promise<void>;
  bulkDeleteDailyProgress: (ids: string[]) => Promise<void>;

  // Lecture Tracker CRUD
  addLecture: (item: Omit<LectureItem, 'id'>) => Promise<void>;
  updateLecture: (item: LectureItem) => Promise<void>;
  deleteLecture: (id: string) => Promise<void>;
  bulkDeleteLectures: (ids: string[]) => Promise<void>;
  setLectureStatus: (id: string, status: LectureStatus) => Promise<void>;
  toggleLectureNotes: (id: string) => Promise<void>;

  // PYQ Tracker CRUD
  addPYQ: (item: Omit<PYQItem, 'id'>) => Promise<void>;
  updatePYQ: (item: PYQItem) => Promise<{ success: boolean; message?: string }>;
  deletePYQ: (id: string) => Promise<void>;
  bulkDeletePYQs: (ids: string[]) => Promise<void>;
  togglePYQComplete: (id: string) => Promise<void>;

  // Revision Tracker CRUD
  addRevision: (item: Omit<RevisionItem, 'id'>) => Promise<void>;
  updateRevision: (item: RevisionItem) => Promise<void>;
  deleteRevision: (id: string) => Promise<void>;
  bulkDeleteRevisions: (ids: string[]) => Promise<void>;

  // Weekly Quiz CRUD
  addWeeklyQuiz: (item: Omit<WeeklyQuizItem, 'id'>) => Promise<void>;
  updateWeeklyQuiz: (item: WeeklyQuizItem) => Promise<void>;
  deleteWeeklyQuiz: (id: string) => Promise<void>;
  bulkDeleteWeeklyQuizzes: (ids: string[]) => Promise<void>;

  // Test Tracker CRUD
  addTest: (item: Omit<TestItem, 'id'>) => Promise<void>;
  updateTest: (item: TestItem) => Promise<void>;
  deleteTest: (id: string) => Promise<void>;
  bulkDeleteTests: (ids: string[]) => Promise<void>;

  // Planning CRUD
  addPlanning: (item: Omit<PlanningItem, 'id'>) => Promise<void>;
  updatePlanning: (item: PlanningItem) => Promise<void>;
  deletePlanning: (id: string) => Promise<void>;
  bulkDeletePlanning: (ids: string[]) => Promise<void>;
  togglePlanningComplete: (id: string) => Promise<void>;

  // Section-wise Reset Data
  resetSection: (sectionKey: ResetSectionKey) => Promise<void>;

  // Global Undo / Redo
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;

  // Custom Sheets CRUD
  addOrUpdateCustomSheet: (sheet: CustomSheet) => Promise<void>;
  deleteCustomSheet: (id: string) => Promise<void>;

  // Bulk Import
  importBulkData: (
    data: {
      dailyProgress?: DailyProgressItem[];
      studySessions?: StudySession[];
      lectureTracker?: LectureItem[];
      pyqTracker?: PYQItem[];
      revisionTracker?: RevisionItem[];
      weeklyQuiz?: WeeklyQuizItem[];
      testTracker?: TestItem[];
      planning?: PlanningItem[];
      customSheets?: CustomSheet[];
    },
    conflictResolution?: 'add' | 'update' | 'skip'
  ) => Promise<{ importedCount: number }>;

  // Restore Backup & Reset
  restoreBackup: (backupState: AppDatabaseState) => Promise<void>;
  resetDatabase: () => Promise<void>;
  refreshData: () => Promise<void>;
}

interface StateSnapshot {
  dailyProgress: DailyProgressItem[];
  studySessions: StudySession[];
  topicMaster: TopicMasterItem[];
  lectureTracker: LectureItem[];
  pyqTracker: PYQItem[];
  revisionTracker: RevisionItem[];
  weeklyQuiz: WeeklyQuizItem[];
  testTracker: TestItem[];
  planning: PlanningItem[];
  customSheets: CustomSheet[];
}

function extractDataSnapshot(s: AppDatabaseState): StateSnapshot {
  return {
    dailyProgress: [...s.dailyProgress],
    studySessions: [...s.studySessions],
    topicMaster: [...s.topicMaster],
    lectureTracker: [...s.lectureTracker],
    pyqTracker: [...s.pyqTracker],
    revisionTracker: [...s.revisionTracker],
    weeklyQuiz: [...s.weeklyQuiz],
    testTracker: [...s.testTracker],
    planning: [...s.planning],
    customSheets: s.customSheets.map(cs => ({ ...cs, rows: [...cs.rows] }))
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to resolve the best human-readable username from Firebase User & settings
export function resolveBestUserName(firebaseUser: User | null, configuredName?: string): string {
  const isPlaceholder =
    !configuredName ||
    configuredName.trim().toLowerCase() === 'aspirant' ||
    configuredName.trim().toLowerCase() === 'gate aspirant';

  // If user has a real custom name (not a placeholder), use it
  if (!isPlaceholder && configuredName && configuredName.trim()) {
    return configuredName.trim();
  }
  // If user is authenticated with Google, prefer Google displayName
  if (firebaseUser?.displayName && firebaseUser.displayName.trim()) {
    return firebaseUser.displayName.trim();
  }
  // If authenticated with Google, format from email (e.g. vikashkumarsingh -> Vikash Kumar Singh)
  if (firebaseUser?.email) {
    const rawLocal = firebaseUser.email.split('@')[0];
    const cleaned = rawLocal.replace(/[._-]+/g, ' ').trim();
    if (cleaned) {
      return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return rawLocal;
  }
  if (configuredName && configuredName.trim()) {
    return configuredName.trim();
  }
  return 'GATE Aspirant';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppDatabaseState>({
    dailyProgress: [],
    studySessions: [],
    topicMaster: [],
    lectureTracker: [],
    pyqTracker: [],
    revisionTracker: [],
    weeklyQuiz: [],
    testTracker: [],
    planning: [],
    customSheets: [],
    settings: DEFAULT_SETTINGS
  });
  const [loading, setLoading] = useState<boolean>(true);

  // Undo / Redo stacks (stores up to 50 snapshots)
  const [undoStack, setUndoStack] = useState<StateSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<StateSnapshot[]>([]);

  // Ref to always capture latest state synchronously
  const stateRef = useRef<AppDatabaseState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const recordUndoSnapshot = useCallback(() => {
    const snap = extractDataSnapshot(stateRef.current);
    setUndoStack(prev => [...prev.slice(-49), snap]);
    setRedoStack([]); // New action clears redo history
  }, []);

  const undo = useCallback(async () => {
    if (undoStack.length === 0) return;
    const previousSnapshot = undoStack[undoStack.length - 1];
    const currentSnapshot = extractDataSnapshot(stateRef.current);

    setUndoStack(prev => prev.slice(0, prev.length - 1));
    setRedoStack(prev => [...prev.slice(-49), currentSnapshot]);

    // Restore IndexedDB collections
    await replaceStoreItems('daily_progress', previousSnapshot.dailyProgress);
    await replaceStoreItems('study_sessions', previousSnapshot.studySessions);
    await replaceStoreItems('topic_master', previousSnapshot.topicMaster);
    await replaceStoreItems('lecture_tracker', previousSnapshot.lectureTracker);
    await replaceStoreItems('pyq_tracker', previousSnapshot.pyqTracker);
    await replaceStoreItems('revision_tracker', previousSnapshot.revisionTracker);
    await replaceStoreItems('weekly_quiz', previousSnapshot.weeklyQuiz);
    await replaceStoreItems('test_tracker', previousSnapshot.testTracker);
    await replaceStoreItems('planning', previousSnapshot.planning);
    await replaceStoreItems('custom_sheets', previousSnapshot.customSheets);

    setState(prev => {
      const next = {
        ...prev,
        ...previousSnapshot
      };
      stateRef.current = next;
      return next;
    });
    if (userRef.current) {
      uploadFullStateToCloud(userRef.current.uid, stateRef.current).catch(console.error);
    }
  }, [undoStack]);

  const redo = useCallback(async () => {
    if (redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot = extractDataSnapshot(stateRef.current);

    setRedoStack(prev => prev.slice(0, prev.length - 1));
    setUndoStack(prev => [...prev.slice(-49), currentSnapshot]);

    // Restore IndexedDB collections
    await replaceStoreItems('daily_progress', nextSnapshot.dailyProgress);
    await replaceStoreItems('study_sessions', nextSnapshot.studySessions);
    await replaceStoreItems('topic_master', nextSnapshot.topicMaster);
    await replaceStoreItems('lecture_tracker', nextSnapshot.lectureTracker);
    await replaceStoreItems('pyq_tracker', nextSnapshot.pyqTracker);
    await replaceStoreItems('revision_tracker', nextSnapshot.revisionTracker);
    await replaceStoreItems('weekly_quiz', nextSnapshot.weeklyQuiz);
    await replaceStoreItems('test_tracker', nextSnapshot.testTracker);
    await replaceStoreItems('planning', nextSnapshot.planning);
    await replaceStoreItems('custom_sheets', nextSnapshot.customSheets);

    setState(prev => {
      const next = {
        ...prev,
        ...nextSnapshot
      };
      stateRef.current = next;
      return next;
    });
    if (userRef.current) {
      uploadFullStateToCloud(userRef.current.uid, stateRef.current).catch(console.error);
    }
  }, [redoStack]);

  // Keyboard shortcuts: Ctrl+Z / Cmd+Z (Undo), Ctrl+Y / Cmd+Y or Ctrl+Shift+Z (Redo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          if (redoStack.length > 0) {
            e.preventDefault();
            redo();
          }
        } else {
          if (undoStack.length > 0) {
            e.preventDefault();
            undo();
          }
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        if (redoStack.length > 0) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, undoStack.length, redoStack.length]);

  // Firebase Auth & Cloud Sync State
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastCloudSyncTime, setLastCloudSyncTime] = useState<string | null>(null);
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);

  const userRef = useRef<User | null>(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const triggerCloudSync = useCallback((section: SyncSectionName, data: any) => {
    if (userRef.current) {
      setCloudSyncStatus('syncing');
      syncSectionToCloud(userRef.current.uid, section, data)
        .then(() => {
          setCloudSyncStatus('synced');
          setLastCloudSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        })
        .catch(err => {
          console.error(`Failed to sync ${section}:`, err);
          setCloudSyncStatus('error');
        });
    }
  }, []);

  const openUserNameModal = useCallback(() => {
    setIsNameModalOpen(true);
  }, []);

  const effectiveUserName = useMemo(() => {
    return resolveBestUserName(user, state.settings.userName);
  }, [user, state.settings.userName]);

  const saveUserName = useCallback(async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    recordUndoSnapshot();
    const updatedSettings: AppSettings = {
      ...stateRef.current.settings,
      userName: trimmed
    };
    setState(prev => ({ ...prev, settings: updatedSettings }));
    await dbSaveSettings(updatedSettings);

    if (userRef.current) {
      try {
        localStorage.setItem(`gate_name_prompted_${userRef.current.uid}`, 'true');
        await updateUserDisplayNameInCloud(userRef.current.uid, trimmed);
        await syncSectionToCloud(userRef.current.uid, 'settings', updatedSettings);
      } catch (err) {
        console.error('Failed to sync updated user name to cloud:', err);
      }
    }
    setIsNameModalOpen(false);
  }, [recordUndoSnapshot]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser) {
        setCloudSyncStatus('syncing');
        try {
          const cloudData = await downloadFullStateFromCloud(firebaseUser.uid);
          const initialCandidate = cloudData?.settings?.userName || stateRef.current.settings.userName;
          const bestName = resolveBestUserName(firebaseUser, initialCandidate);

          if (cloudData && Object.keys(cloudData).length > 0) {
            // Apply cloud data to state and local IndexedDB
            setState(prev => {
              const merged: AppDatabaseState = {
                ...prev,
                ...cloudData
              };
              // If no custom name or still placeholder 'Aspirant', use Google account name
              if (!merged.settings.userName || merged.settings.userName.toLowerCase() === 'aspirant') {
                merged.settings.userName = bestName;
              }
              stateRef.current = merged;
              return merged;
            });

            if (cloudData.dailyProgress) await replaceStoreItems('daily_progress', cloudData.dailyProgress);
            if (cloudData.studySessions) await replaceStoreItems('study_sessions', cloudData.studySessions);
            if (cloudData.topicMaster) await replaceStoreItems('topic_master', cloudData.topicMaster);
            if (cloudData.lectureTracker) await replaceStoreItems('lecture_tracker', cloudData.lectureTracker);
            if (cloudData.pyqTracker) await replaceStoreItems('pyq_tracker', cloudData.pyqTracker);
            if (cloudData.revisionTracker) await replaceStoreItems('revision_tracker', cloudData.revisionTracker);
            if (cloudData.weeklyQuiz) await replaceStoreItems('weekly_quiz', cloudData.weeklyQuiz);
            if (cloudData.testTracker) await replaceStoreItems('test_tracker', cloudData.testTracker);
            if (cloudData.planning) await replaceStoreItems('planning', cloudData.planning);
            if (cloudData.customSheets) await replaceStoreItems('custom_sheets', cloudData.customSheets);
            if (cloudData.settings) {
              const settingsToSave = { ...cloudData.settings };
              if (!settingsToSave.userName || settingsToSave.userName.toLowerCase() === 'aspirant') {
                settingsToSave.userName = bestName;
              }
              await dbSaveSettings(settingsToSave);
            }
          } else {
            // Cloud is empty for this user: use bestName and auto-upload
            setState(prev => {
              const next = {
                ...prev,
                settings: { ...prev.settings, userName: bestName }
              };
              stateRef.current = next;
              return next;
            });
            await uploadFullStateToCloud(firebaseUser.uid, stateRef.current);
          }

          // Check if name has been prompted for this user
          const hasPrompted = localStorage.getItem(`gate_name_prompted_${firebaseUser.uid}`);
          if (!hasPrompted) {
            setIsNameModalOpen(true);
          }

          setCloudSyncStatus('synced');
          setLastCloudSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        } catch (err) {
          console.error('Initial cloud sync error:', err);
          setCloudSyncStatus('error');
        }
      } else {
        setCloudSyncStatus('idle');
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to real-time remote updates from other devices
  useEffect(() => {
    if (!user) return;
    const unsubscribeSync = listenToCloudUpdates(user.uid, async (section, data) => {
      setState(prev => {
        const next = { ...prev };
        if (section === 'lecture_tracker') next.lectureTracker = data;
        else if (section === 'pyq_tracker') next.pyqTracker = data;
        else if (section === 'revision_tracker') next.revisionTracker = data;
        else if (section === 'weekly_quiz') next.weeklyQuiz = data;
        else if (section === 'test_tracker') next.testTracker = data;
        else if (section === 'planning') next.planning = data;
        else if (section === 'daily_progress') next.dailyProgress = data;
        else if (section === 'study_sessions') next.studySessions = data;
        else if (section === 'topic_master') next.topicMaster = data;
        else if (section === 'custom_sheets') next.customSheets = data;
        else if (section === 'settings') next.settings = data;
        stateRef.current = next;
        return next;
      });

      if (section === 'settings') await dbSaveSettings(data);
      else await replaceStoreItems(section as any, data);

      setCloudSyncStatus('synced');
      setLastCloudSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });

    return () => unsubscribeSync();
  }, [user]);

  const loginWithGoogle = useCallback(async () => {
    try {
      setCloudSyncStatus('syncing');
      const loggedUser = await signInWithGoogle();
      setUser(loggedUser);
      // Immediately set the best name from the Google account if current is default
      const bestName = resolveBestUserName(loggedUser, stateRef.current.settings.userName);
      if (!stateRef.current.settings.userName || stateRef.current.settings.userName.toLowerCase() === 'aspirant') {
        const nextSettings: AppSettings = {
          ...stateRef.current.settings,
          userName: bestName
        };
        setState(prev => ({ ...prev, settings: nextSettings }));
        await dbSaveSettings(nextSettings);
      }
      // Immediately open name prompt modal so the user can verify or customize their name!
      setIsNameModalOpen(true);
    } catch (err: any) {
      console.error('Login error:', err);
      setCloudSyncStatus('error');
    }
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await logOut();
      setUser(null);
      setCloudSyncStatus('idle');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  const manualCloudSync = useCallback(async () => {
    if (!userRef.current) {
      await loginWithGoogle();
      return;
    }
    setCloudSyncStatus('syncing');
    try {
      await uploadFullStateToCloud(userRef.current.uid, stateRef.current);
      setCloudSyncStatus('synced');
      setLastCloudSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Manual sync failed:', err);
      setCloudSyncStatus('error');
    }
  }, [loginWithGoogle]);

  // Active Timer state (persists across page refresh)
  const [activeTimer, setActiveTimer] = useState<ActiveTimerState>(() => {
    try {
      const saved = localStorage.getItem('gate_active_timer_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.elapsedSeconds === 'number') {
          if (parsed.isRunning && parsed.lastUpdatedTimestamp) {
            const deltaSec = Math.floor((Date.now() - parsed.lastUpdatedTimestamp) / 1000);
            return {
              ...parsed,
              elapsedSeconds: parsed.elapsedSeconds + Math.max(0, deltaSec),
              lastUpdatedTimestamp: Date.now()
            };
          }
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return {
      isRunning: false,
      elapsedSeconds: 0,
      sessionType: 'Lecture',
      subject: '',
      module: '',
      topic: '',
      remarks: '',
      startTime: ''
    };
  });

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync active timer to localStorage on any state change
  useEffect(() => {
    try {
      localStorage.setItem('gate_active_timer_state', JSON.stringify({
        ...activeTimer,
        lastUpdatedTimestamp: Date.now()
      }));
    } catch {
      // ignore
    }
  }, [activeTimer]);

  // Load from IndexedDB on startup
  const refreshData = useCallback(async () => {
    try {
      const fullState = await loadFullDatabaseState();
      setState(fullState);
    } catch (err) {
      console.error('Failed to load database state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Apply theme to document element AND body
  useEffect(() => {
    const root = document.documentElement;
    const isDark = state.settings.theme === 'dark';
    if (isDark) {
      root.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [state.settings.theme]);

  // Study timer tick
  useEffect(() => {
    if (activeTimer.isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setActiveTimer(prev => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1
        }));
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeTimer.isRunning]);

  const setTheme = useCallback(async (newTheme: 'light' | 'dark') => {
    const updated = { ...state.settings, theme: newTheme };
    setState(prev => ({ ...prev, settings: updated }));
    await dbSaveSettings(updated);
  }, [state.settings]);

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const updated: AppSettings = { ...state.settings, ...partial };
    setState(prev => ({ ...prev, settings: updated }));
    await dbSaveSettings(updated);
  }, [state.settings]);

  const setDailyTargetForDate = useCallback(async (date: string, hours: number) => {
    recordUndoSnapshot();
    const updatedTargets = {
      ...(state.settings.dailyTargetsByDate || {}),
      [date]: hours
    };
    const updatedSettings: AppSettings = {
      ...state.settings,
      dailyTargetsByDate: updatedTargets
    };
    setState(prev => ({ ...prev, settings: updatedSettings }));
    await dbSaveSettings(updatedSettings);
  }, [state.settings, recordUndoSnapshot]);

  // Timer controls
  const startTimer = useCallback((
    sessionType: ActiveTimerState['sessionType'] = 'Lecture',
    subject = '',
    module = '',
    topic = '',
    remarks = ''
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setActiveTimer({
      isRunning: true,
      elapsedSeconds: 0,
      sessionType,
      subject,
      module,
      topic,
      remarks,
      startTime: timeStr,
      lastUpdatedTimestamp: Date.now()
    });
  }, []);

  const pauseTimer = useCallback(() => {
    setActiveTimer(prev => ({ ...prev, isRunning: false, lastUpdatedTimestamp: Date.now() }));
  }, []);

  const resumeTimer = useCallback(() => {
    setActiveTimer(prev => ({ ...prev, isRunning: true, lastUpdatedTimestamp: Date.now() }));
  }, []);

  const resetTimer = useCallback(() => {
    try {
      localStorage.removeItem('gate_active_timer_state');
    } catch {
      // ignore
    }
    setActiveTimer({
      isRunning: false,
      elapsedSeconds: 0,
      sessionType: 'Lecture',
      subject: '',
      module: '',
      topic: '',
      remarks: '',
      startTime: ''
    });
  }, []);

  // Stop Timer: creates StudySession and updates DailyProgress
  const stopTimer = useCallback(async (): Promise<StudySession | null> => {
    if (activeTimer.elapsedSeconds < 5) {
      resetTimer();
      return null;
    }

    try {
      localStorage.removeItem('gate_active_timer_state');
    } catch {
      // ignore
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const endNow = new Date();
    const endTimeStr = endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const durationMinutes = Math.max(1, Math.round(activeTimer.elapsedSeconds / 60));
    const durationHours = parseFloat((activeTimer.elapsedSeconds / 3600).toFixed(2));

    const newSession: StudySession = {
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      date: todayStr,
      startTime: activeTimer.startTime || 'Now',
      endTime: endTimeStr,
      durationMinutes,
      subject: activeTimer.subject.trim() || undefined,
      module: activeTimer.module.trim() || undefined,
      topic: activeTimer.topic?.trim() || undefined,
      sessionType: activeTimer.sessionType,
      remarks: activeTimer.remarks.trim() || undefined
    };

    // Save session
    await putItem('study_sessions', newSession);

    // Update today's daily progress rollup
    const existingIndex = state.dailyProgress.findIndex(d => d.date === todayStr);
    let updatedDailyProgress = [...state.dailyProgress];

    if (existingIndex >= 0) {
      const current = { ...updatedDailyProgress[existingIndex] };
      if (activeTimer.sessionType === 'Lecture') current.lectureHours += durationHours;
      else if (activeTimer.sessionType === 'PYQ') current.pyqHours += durationHours;
      else if (activeTimer.sessionType === 'Revision') current.revisionHours += durationHours;
      else if (activeTimer.sessionType === 'Quiz' || activeTimer.sessionType === 'Test') current.testQuizHours += durationHours;
      else current.otherStudy += durationHours;

      current.totalStudyHours = parseFloat((current.lectureHours + current.pyqHours + current.revisionHours + current.testQuizHours + current.otherStudy).toFixed(2));
      current.studyHours = current.totalStudyHours;
      updatedDailyProgress[existingIndex] = current;
      await putItem('daily_progress', current);
    } else {
      const newDaily: DailyProgressItem = {
        id: `dp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        date: todayStr,
        studyHours: durationHours,
        lectureHours: activeTimer.sessionType === 'Lecture' ? durationHours : 0,
        pyqHours: activeTimer.sessionType === 'PYQ' ? durationHours : 0,
        revisionHours: activeTimer.sessionType === 'Revision' ? durationHours : 0,
        testQuizHours: (activeTimer.sessionType === 'Quiz' || activeTimer.sessionType === 'Test') ? durationHours : 0,
        otherStudy: activeTimer.sessionType === 'Other' ? durationHours : 0,
        totalStudyHours: durationHours,
        remarks: `Logged study sessions on ${todayStr}`
      };
      updatedDailyProgress = [newDaily, ...updatedDailyProgress];
      await putItem('daily_progress', newDaily);
    }

    setState(prev => ({
      ...prev,
      studySessions: [newSession, ...prev.studySessions],
      dailyProgress: updatedDailyProgress
    }));

    resetTimer();
    return newSession;
  }, [activeTimer, resetTimer, state.dailyProgress]);

  // Add / Delete / Update study sessions
  const addStudySession = useCallback(async (session: Omit<StudySession, 'id'>) => {
    recordUndoSnapshot();
    const newSession: StudySession = {
      ...session,
      id: `sess_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('study_sessions', newSession);
    setState(prev => ({
      ...prev,
      studySessions: [newSession, ...prev.studySessions]
    }));
  }, [recordUndoSnapshot]);

  const updateStudySession = useCallback(async (session: StudySession) => {
    recordUndoSnapshot();
    await putItem('study_sessions', session);
    setState(prev => ({
      ...prev,
      studySessions: prev.studySessions.map(s => s.id === session.id ? session : s)
    }));
  }, [recordUndoSnapshot]);

  const deleteStudySession = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('study_sessions', id);
    setState(prev => ({
      ...prev,
      studySessions: prev.studySessions.filter(s => s.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeleteStudySessions = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('study_sessions', ids);
    setState(prev => ({
      ...prev,
      studySessions: prev.studySessions.filter(s => !idSet.has(s.id))
    }));
  }, [recordUndoSnapshot]);

  // Topic Master CRUD
  const addTopicMaster = useCallback(async (item: Omit<TopicMasterItem, 'id'>) => {
    recordUndoSnapshot();
    const newItem: TopicMasterItem = {
      ...item,
      id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('topic_master', newItem);
    setState(prev => ({ ...prev, topicMaster: [...prev.topicMaster, newItem] }));
  }, [recordUndoSnapshot]);

  const updateTopicMaster = useCallback(async (item: TopicMasterItem) => {
    recordUndoSnapshot();
    await putItem('topic_master', item);
    setState(prev => ({
      ...prev,
      topicMaster: prev.topicMaster.map(i => i.id === item.id ? item : i)
    }));
  }, [recordUndoSnapshot]);

  const deleteTopicMaster = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('topic_master', id);
    setState(prev => ({
      ...prev,
      topicMaster: prev.topicMaster.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  // Daily Progress CRUD
  const addDailyProgress = useCallback(async (item: Omit<DailyProgressItem, 'id'>) => {
    recordUndoSnapshot();
    const newItem: DailyProgressItem = {
      ...item,
      id: `dp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('daily_progress', newItem);
    setState(prev => ({ ...prev, dailyProgress: [newItem, ...prev.dailyProgress] }));
  }, [recordUndoSnapshot]);

  const updateDailyProgress = useCallback(async (item: DailyProgressItem) => {
    recordUndoSnapshot();
    await putItem('daily_progress', item);
    setState(prev => ({
      ...prev,
      dailyProgress: prev.dailyProgress.map(i => i.id === item.id ? item : i)
    }));
  }, [recordUndoSnapshot]);

  const deleteDailyProgress = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('daily_progress', id);
    setState(prev => ({
      ...prev,
      dailyProgress: prev.dailyProgress.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeleteDailyProgress = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('daily_progress', ids);
    setState(prev => ({
      ...prev,
      dailyProgress: prev.dailyProgress.filter(i => !idSet.has(i.id))
    }));
  }, [recordUndoSnapshot]);

  // Lecture Tracker CRUD
  const addLecture = useCallback(async (item: Omit<LectureItem, 'id'>) => {
    recordUndoSnapshot();
    const newItem: LectureItem = {
      ...item,
      id: `lec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('lecture_tracker', newItem);
    setState(prev => ({ ...prev, lectureTracker: [...prev.lectureTracker, newItem] }));
  }, [recordUndoSnapshot]);

  const updateLecture = useCallback(async (item: LectureItem) => {
    recordUndoSnapshot();
    await putItem('lecture_tracker', item);
    setState(prev => ({
      ...prev,
      lectureTracker: prev.lectureTracker.map(i => i.id === item.id ? item : i)
    }));
  }, [recordUndoSnapshot]);

  const deleteLecture = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('lecture_tracker', id);
    setState(prev => ({
      ...prev,
      lectureTracker: prev.lectureTracker.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeleteLectures = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('lecture_tracker', ids);
    setState(prev => ({
      ...prev,
      lectureTracker: prev.lectureTracker.filter(i => !idSet.has(i.id))
    }));
  }, [recordUndoSnapshot]);

  const setLectureStatus = useCallback(async (id: string, status: LectureStatus) => {
    recordUndoSnapshot();
    setState(prev => {
      const item = prev.lectureTracker.find(l => l.id === id);
      if (!item) return prev;
      const today = new Date().toISOString().split('T')[0];
      const updatedItem: LectureItem = {
        ...item,
        done: status,
        doneDate: status === 'Completed' ? (item.doneDate || today) : item.doneDate
      };
      putItem('lecture_tracker', updatedItem);
      return {
        ...prev,
        lectureTracker: prev.lectureTracker.map(l => l.id === id ? updatedItem : l)
      };
    });
  }, [recordUndoSnapshot]);

  const toggleLectureNotes = useCallback(async (id: string) => {
    recordUndoSnapshot();
    setState(prev => {
      const item = prev.lectureTracker.find(l => l.id === id);
      if (!item) return prev;
      const isNotesDone = Boolean(item.notes);
      const updatedItem: LectureItem = {
        ...item,
        notes: !isNotesDone
      };
      putItem('lecture_tracker', updatedItem);
      return {
        ...prev,
        lectureTracker: prev.lectureTracker.map(l => l.id === id ? updatedItem : l)
      };
    });
  }, [recordUndoSnapshot]);

  // PYQ Tracker CRUD with Strict Solved <= Total Limit
  const addPYQ = useCallback(async (item: Omit<PYQItem, 'id'>) => {
    recordUndoSnapshot();
    const total = Math.max(0, item.totalPYQs);
    const solved = Math.min(total, Math.max(0, item.solved));
    const remaining = Math.max(0, total - solved);
    const newItem: PYQItem = {
      ...item,
      totalPYQs: total,
      solved,
      remaining,
      completed: item.completed || (total > 0 && solved >= total),
      id: `pyq_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('pyq_tracker', newItem);
    setState(prev => ({ ...prev, pyqTracker: [...prev.pyqTracker, newItem] }));
  }, [recordUndoSnapshot]);

  const updatePYQ = useCallback(async (item: PYQItem): Promise<{ success: boolean; message?: string }> => {
    const total = Math.max(0, item.totalPYQs);
    if (item.solved > total) {
      return { success: false, message: 'All available PYQs have been solved.' };
    }
    recordUndoSnapshot();
    const solved = Math.min(total, Math.max(0, item.solved));
    const remaining = Math.max(0, total - solved);
    const completed = typeof item.completed === 'boolean' ? item.completed : (total > 0 && solved >= total);
    const updated: PYQItem = {
      ...item,
      totalPYQs: total,
      solved,
      remaining,
      completed
    };
    await putItem('pyq_tracker', updated);
    setState(prev => ({
      ...prev,
      pyqTracker: prev.pyqTracker.map(i => i.id === item.id ? updated : i)
    }));
    return { success: true };
  }, [recordUndoSnapshot]);

  const deletePYQ = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('pyq_tracker', id);
    setState(prev => ({
      ...prev,
      pyqTracker: prev.pyqTracker.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeletePYQs = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('pyq_tracker', ids);
    setState(prev => ({
      ...prev,
      pyqTracker: prev.pyqTracker.filter(i => !idSet.has(i.id))
    }));
  }, [recordUndoSnapshot]);

  const togglePYQComplete = useCallback(async (id: string) => {
    recordUndoSnapshot();
    setState(prev => {
      const item = prev.pyqTracker.find(p => p.id === id);
      if (!item) return prev;
      const updated: PYQItem = {
        ...item,
        completed: !item.completed
      };
      putItem('pyq_tracker', updated);
      return {
        ...prev,
        pyqTracker: prev.pyqTracker.map(p => p.id === id ? updated : p)
      };
    });
  }, [recordUndoSnapshot]);

  // Revision Tracker CRUD
  const addRevision = useCallback(async (item: Omit<RevisionItem, 'id'>) => {
    recordUndoSnapshot();
    const newItem: RevisionItem = {
      ...item,
      id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('revision_tracker', newItem);
    setState(prev => ({ ...prev, revisionTracker: [...prev.revisionTracker, newItem] }));
  }, [recordUndoSnapshot]);

  const updateRevision = useCallback(async (item: RevisionItem) => {
    recordUndoSnapshot();
    await putItem('revision_tracker', item);
    setState(prev => ({
      ...prev,
      revisionTracker: prev.revisionTracker.map(i => i.id === item.id ? item : i)
    }));
  }, [recordUndoSnapshot]);

  const deleteRevision = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('revision_tracker', id);
    setState(prev => ({
      ...prev,
      revisionTracker: prev.revisionTracker.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeleteRevisions = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('revision_tracker', ids);
    setState(prev => ({
      ...prev,
      revisionTracker: prev.revisionTracker.filter(i => !idSet.has(i.id))
    }));
  }, [recordUndoSnapshot]);

  // Weekly Quiz CRUD
  const addWeeklyQuiz = useCallback(async (item: Omit<WeeklyQuizItem, 'id'>) => {
    recordUndoSnapshot();
    const newItem: WeeklyQuizItem = {
      ...item,
      id: `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('weekly_quiz', newItem);
    setState(prev => ({ ...prev, weeklyQuiz: [newItem, ...prev.weeklyQuiz] }));
  }, [recordUndoSnapshot]);

  const updateWeeklyQuiz = useCallback(async (item: WeeklyQuizItem) => {
    recordUndoSnapshot();
    await putItem('weekly_quiz', item);
    setState(prev => ({
      ...prev,
      weeklyQuiz: prev.weeklyQuiz.map(i => i.id === item.id ? item : i)
    }));
  }, [recordUndoSnapshot]);

  const deleteWeeklyQuiz = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('weekly_quiz', id);
    setState(prev => ({
      ...prev,
      weeklyQuiz: prev.weeklyQuiz.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeleteWeeklyQuizzes = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('weekly_quiz', ids);
    setState(prev => ({
      ...prev,
      weeklyQuiz: prev.weeklyQuiz.filter(i => !idSet.has(i.id))
    }));
  }, [recordUndoSnapshot]);

  // Test Tracker CRUD
  const addTest = useCallback(async (item: Omit<TestItem, 'id'>) => {
    recordUndoSnapshot();
    const newItem: TestItem = {
      ...item,
      id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('test_tracker', newItem);
    setState(prev => ({ ...prev, testTracker: [newItem, ...prev.testTracker] }));
  }, [recordUndoSnapshot]);

  const updateTest = useCallback(async (item: TestItem) => {
    recordUndoSnapshot();
    await putItem('test_tracker', item);
    setState(prev => ({
      ...prev,
      testTracker: prev.testTracker.map(i => i.id === item.id ? item : i)
    }));
  }, [recordUndoSnapshot]);

  const deleteTest = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('test_tracker', id);
    setState(prev => ({
      ...prev,
      testTracker: prev.testTracker.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeleteTests = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('test_tracker', ids);
    setState(prev => ({
      ...prev,
      testTracker: prev.testTracker.filter(i => !idSet.has(i.id))
    }));
  }, [recordUndoSnapshot]);

  // Planning CRUD & Shared Synchronization
  const addPlanning = useCallback(async (item: Omit<PlanningItem, 'id'>) => {
    recordUndoSnapshot();
    const newItem: PlanningItem = {
      ...item,
      id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    };
    await putItem('planning', newItem);
    setState(prev => ({ ...prev, planning: [newItem, ...prev.planning] }));
  }, [recordUndoSnapshot]);

  const updatePlanning = useCallback(async (item: PlanningItem) => {
    recordUndoSnapshot();
    await putItem('planning', item);
    setState(prev => ({
      ...prev,
      planning: prev.planning.map(i => i.id === item.id ? item : i)
    }));
  }, [recordUndoSnapshot]);

  const togglePlanningComplete = useCallback(async (id: string) => {
    recordUndoSnapshot();
    setState(prev => {
      const task = prev.planning.find(p => p.id === id);
      if (!task) return prev;
      const updated: PlanningItem = {
        ...task,
        completed: !task.completed
      };
      putItem('planning', updated);
      return {
        ...prev,
        planning: prev.planning.map(p => p.id === id ? updated : p)
      };
    });
  }, [recordUndoSnapshot]);

  const deletePlanning = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('planning', id);
    setState(prev => ({
      ...prev,
      planning: prev.planning.filter(i => i.id !== id)
    }));
  }, [recordUndoSnapshot]);

  const bulkDeletePlanning = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    recordUndoSnapshot();
    const idSet = new Set(ids);
    await dbDeleteItems('planning', ids);
    setState(prev => ({
      ...prev,
      planning: prev.planning.filter(i => !idSet.has(i.id))
    }));
  }, [recordUndoSnapshot]);

  // Section-wise Reset Data
  const resetSection = useCallback(async (section: ResetSectionKey) => {
    recordUndoSnapshot();
    switch (section) {
      case 'lecture_tracker':
        await clearStore('lecture_tracker');
        setState(prev => ({ ...prev, lectureTracker: [] }));
        break;
      case 'pyq_tracker':
        await clearStore('pyq_tracker');
        setState(prev => ({ ...prev, pyqTracker: [] }));
        break;
      case 'revision_tracker':
        await clearStore('revision_tracker');
        setState(prev => ({ ...prev, revisionTracker: [] }));
        break;
      case 'weekly_quiz':
        await clearStore('weekly_quiz');
        setState(prev => ({ ...prev, weeklyQuiz: [] }));
        break;
      case 'test_tracker':
        await clearStore('test_tracker');
        setState(prev => ({ ...prev, testTracker: [] }));
        break;
      case 'planning':
        await clearStore('planning');
        setState(prev => ({ ...prev, planning: [] }));
        break;
      case 'daily_progress':
        await clearStore('daily_progress');
        await clearStore('study_sessions');
        setState(prev => ({ ...prev, dailyProgress: [], studySessions: [] }));
        break;
    }
  }, [recordUndoSnapshot]);

  // Custom Sheets
  const addOrUpdateCustomSheet = useCallback(async (sheet: CustomSheet) => {
    recordUndoSnapshot();
    await putItem('custom_sheets', sheet);
    setState(prev => {
      const idx = prev.customSheets.findIndex(s => s.id === sheet.id);
      if (idx >= 0) {
        const copy = [...prev.customSheets];
        copy[idx] = sheet;
        return { ...prev, customSheets: copy };
      }
      return { ...prev, customSheets: [...prev.customSheets, sheet] };
    });
  }, [recordUndoSnapshot]);

  const deleteCustomSheet = useCallback(async (id: string) => {
    recordUndoSnapshot();
    await dbDeleteItem('custom_sheets', id);
    setState(prev => ({
      ...prev,
      customSheets: prev.customSheets.filter(s => s.id !== id)
    }));
  }, [recordUndoSnapshot]);

  // Bulk Import
  const importBulkData = useCallback(async (
    data: {
      dailyProgress?: DailyProgressItem[];
      studySessions?: StudySession[];
      lectureTracker?: LectureItem[];
      pyqTracker?: PYQItem[];
      revisionTracker?: RevisionItem[];
      weeklyQuiz?: WeeklyQuizItem[];
      testTracker?: TestItem[];
      planning?: PlanningItem[];
      customSheets?: CustomSheet[];
    },
    conflictResolution: 'add' | 'update' | 'skip' = 'update'
  ) => {
    recordUndoSnapshot();
    let count = 0;

    const mergeArrays = <T extends { id: string }>(
      existing: T[],
      incoming: T[] | undefined,
      keyFn: (item: T) => string
    ): T[] => {
      if (!incoming || incoming.length === 0) return existing;
      count += incoming.length;

      if (conflictResolution === 'add') {
        const fresh = incoming.map(i => ({
          ...i,
          id: `${i.id}_${Math.random().toString(36).substr(2, 4)}`
        }));
        return [...existing, ...fresh];
      }

      const map = new Map<string, T>();
      existing.forEach(item => map.set(keyFn(item), item));

      incoming.forEach(item => {
        const k = keyFn(item);
        if (map.has(k)) {
          if (conflictResolution === 'update') {
            map.set(k, { ...map.get(k)!, ...item });
          }
        } else {
          map.set(k, item);
        }
      });

      return Array.from(map.values());
    };

    const newDaily = mergeArrays(state.dailyProgress, data.dailyProgress, i => i.date);
    const newSessions = mergeArrays(state.studySessions, data.studySessions, i => `${i.date}:::${i.startTime}`);
    const newLecture = mergeArrays(state.lectureTracker, data.lectureTracker, i => `${(i.subject || '').toLowerCase()}:::${(i.module || '').toLowerCase()}:::${String(i.lectureNo || '').toLowerCase()}:::${(i.lectureTitle || '').toLowerCase()}`);
    const newPYQ = mergeArrays(state.pyqTracker, data.pyqTracker, i => `${(i.subject || '').toLowerCase()}:::${(i.module || '').toLowerCase()}:::${(i.topic || '').toLowerCase()}`);
    const newRevision = mergeArrays(state.revisionTracker, data.revisionTracker, i => `${(i.subject || '').toLowerCase()}:::${(i.module || '').toLowerCase()}:::${(i.topic || i.module || '').toLowerCase()}`);
    const newQuiz = mergeArrays(state.weeklyQuiz, data.weeklyQuiz, i => `${(i.quizName || '').toLowerCase()}:::${i.testDate || ''}`);
    const newTest = mergeArrays(state.testTracker, data.testTracker, i => `${(i.testName || '').toLowerCase()}:::${i.testDate || ''}`);
    const newPlan = mergeArrays(state.planning, data.planning, i => `${i.date || ''}:::${(i.task || '').toLowerCase()}`);

    if (data.dailyProgress) await putItems('daily_progress', newDaily);
    if (data.studySessions) await putItems('study_sessions', newSessions);
    if (data.lectureTracker) await putItems('lecture_tracker', newLecture);
    if (data.pyqTracker) await putItems('pyq_tracker', newPYQ);
    if (data.revisionTracker) await putItems('revision_tracker', newRevision);
    if (data.weeklyQuiz) await putItems('weekly_quiz', newQuiz);
    if (data.testTracker) await putItems('test_tracker', newTest);
    if (data.planning) await putItems('planning', newPlan);

    let updatedCustomSheets = [...state.customSheets];
    if (data.customSheets && data.customSheets.length > 0) {
      for (const cs of data.customSheets) {
        await putItem('custom_sheets', cs);
        const idx = updatedCustomSheets.findIndex(s => s.id === cs.id || s.name === cs.name);
        if (idx >= 0) updatedCustomSheets[idx] = cs;
        else updatedCustomSheets.push(cs);
        count += cs.rows.length;
      }
    }

    setState(prev => ({
      ...prev,
      dailyProgress: newDaily,
      studySessions: newSessions,
      lectureTracker: newLecture,
      pyqTracker: newPYQ,
      revisionTracker: newRevision,
      weeklyQuiz: newQuiz,
      testTracker: newTest,
      planning: newPlan,
      customSheets: updatedCustomSheets
    }));

    return { importedCount: count };
  }, [state]);

  // Restore Backup
  const restoreBackup = useCallback(async (backup: AppDatabaseState) => {
    await dbResetAllData();
    if (backup.dailyProgress?.length) await putItems('daily_progress', backup.dailyProgress);
    if (backup.studySessions?.length) await putItems('study_sessions', backup.studySessions);
    if (backup.lectureTracker?.length) await putItems('lecture_tracker', backup.lectureTracker);
    if (backup.pyqTracker?.length) await putItems('pyq_tracker', backup.pyqTracker);
    if (backup.revisionTracker?.length) await putItems('revision_tracker', backup.revisionTracker);
    if (backup.weeklyQuiz?.length) await putItems('weekly_quiz', backup.weeklyQuiz);
    if (backup.testTracker?.length) await putItems('test_tracker', backup.testTracker);
    if (backup.planning?.length) await putItems('planning', backup.planning);
    if (backup.customSheets?.length) await putItems('custom_sheets', backup.customSheets);
    if (backup.settings) await dbSaveSettings(backup.settings);

    setState(backup);
  }, []);

  // Reset
  const resetDatabase = useCallback(async () => {
    await dbResetAllData();
    setState({
      dailyProgress: [],
      studySessions: [],
      topicMaster: [],
      lectureTracker: [],
      pyqTracker: [],
      revisionTracker: [],
      weeklyQuiz: [],
      testTracker: [],
      planning: [],
      customSheets: [],
      settings: DEFAULT_SETTINGS
    });
  }, []);

  const value = useMemo(() => ({
    state,
    loading,
    theme: state.settings.theme,
    setTheme,
    updateSettings,
    setDailyTargetForDate,
    user,
    authLoading,
    cloudSyncStatus,
    lastCloudSyncTime,
    loginWithGoogle,
    logoutUser,
    manualCloudSync,
    isNameModalOpen,
    setIsNameModalOpen,
    openUserNameModal,
    saveUserName,
    effectiveUserName,
    activeTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
    addStudySession,
    updateStudySession,
    deleteStudySession,
    bulkDeleteStudySessions,
    addTopicMaster,
    updateTopicMaster,
    deleteTopicMaster,
    addDailyProgress,
    updateDailyProgress,
    deleteDailyProgress,
    bulkDeleteDailyProgress,
    addLecture,
    updateLecture,
    deleteLecture,
    bulkDeleteLectures,
    setLectureStatus,
    toggleLectureNotes,
    addPYQ,
    updatePYQ,
    deletePYQ,
    bulkDeletePYQs,
    togglePYQComplete,
    addRevision,
    updateRevision,
    deleteRevision,
    bulkDeleteRevisions,
    addWeeklyQuiz,
    updateWeeklyQuiz,
    deleteWeeklyQuiz,
    bulkDeleteWeeklyQuizzes,
    addTest,
    updateTest,
    deleteTest,
    bulkDeleteTests,
    addPlanning,
    updatePlanning,
    deletePlanning,
    bulkDeletePlanning,
    togglePlanningComplete,
    resetSection,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoCount: undoStack.length,
    redoCount: redoStack.length,
    addOrUpdateCustomSheet,
    deleteCustomSheet,
    importBulkData,
    restoreBackup,
    resetDatabase,
    refreshData
  }), [
    state,
    loading,
    setTheme,
    updateSettings,
    setDailyTargetForDate,
    user,
    authLoading,
    cloudSyncStatus,
    lastCloudSyncTime,
    loginWithGoogle,
    logoutUser,
    manualCloudSync,
    isNameModalOpen,
    setIsNameModalOpen,
    openUserNameModal,
    saveUserName,
    effectiveUserName,
    activeTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    resetTimer,
    addStudySession,
    updateStudySession,
    deleteStudySession,
    bulkDeleteStudySessions,
    addTopicMaster,
    updateTopicMaster,
    deleteTopicMaster,
    addDailyProgress,
    updateDailyProgress,
    deleteDailyProgress,
    bulkDeleteDailyProgress,
    addLecture,
    updateLecture,
    deleteLecture,
    bulkDeleteLectures,
    setLectureStatus,
    toggleLectureNotes,
    addPYQ,
    updatePYQ,
    deletePYQ,
    bulkDeletePYQs,
    togglePYQComplete,
    addRevision,
    updateRevision,
    deleteRevision,
    bulkDeleteRevisions,
    addWeeklyQuiz,
    updateWeeklyQuiz,
    deleteWeeklyQuiz,
    bulkDeleteWeeklyQuizzes,
    addTest,
    updateTest,
    deleteTest,
    bulkDeleteTests,
    addPlanning,
    updatePlanning,
    deletePlanning,
    bulkDeletePlanning,
    togglePlanningComplete,
    resetSection,
    undo,
    redo,
    undoStack.length,
    redoStack.length,
    addOrUpdateCustomSheet,
    deleteCustomSheet,
    importBulkData,
    restoreBackup,
    resetDatabase,
    refreshData
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
