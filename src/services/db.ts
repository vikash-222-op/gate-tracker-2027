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
  AppSettings
} from '../types';

const DB_NAME = 'GATE_GPMS_DATABASE_V2';
const DB_VERSION = 2;

export const DEFAULT_SETTINGS: AppSettings = {
  examDate: '2027-02-06',
  targetExam: 'GATE CS / DA 2027',
  theme: 'light',
  userName: 'Aspirant',
  dailyGoalHours: 10
};

const STORES = [
  'daily_progress',
  'study_sessions',
  'topic_master',
  'lecture_tracker',
  'pyq_tracker',
  'revision_tracker',
  'weekly_quiz',
  'test_tracker',
  'planning',
  'custom_sheets',
  'settings'
] as const;

type StoreName = typeof STORES[number];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      STORES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          if (storeName === 'settings') {
            db.createObjectStore(storeName, { keyPath: 'key' });
          } else {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Fallback memory & local storage cache
const LOCAL_STORAGE_KEY_PREFIX = 'GATE_GPMS_V2_STORE_';

function saveToLocalStorage<T>(key: string, data: T) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function getFromLocalStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Generic store operations
export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const results = req.result as T[];
        saveToLocalStorage(storeName, results);
        resolve(results);
      };
      req.onerror = () => {
        resolve(getFromLocalStorage<T[]>(storeName, []));
      };
    });
  } catch (err) {
    console.warn(`IndexedDB error on ${storeName}, falling back to localStorage:`, err);
    return getFromLocalStorage<T[]>(storeName, []);
  }
}

export async function putItem<T extends { id: string }>(storeName: StoreName, item: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`putItem IndexedDB fallback for ${storeName}:`, err);
  }

  // Also update local storage cache
  const current = getFromLocalStorage<T[]>(storeName, []);
  const index = current.findIndex(i => i.id === item.id);
  if (index >= 0) {
    current[index] = item;
  } else {
    current.push(item);
  }
  saveToLocalStorage(storeName, current);
}

export async function putItems<T extends { id: string }>(storeName: StoreName, items: T[]): Promise<void> {
  if (items.length === 0) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`putItems IndexedDB fallback for ${storeName}:`, err);
  }

  // Update local storage
  const current = getFromLocalStorage<T[]>(storeName, []);
  const itemMap = new Map(current.map(i => [i.id, i]));
  items.forEach(i => itemMap.set(i.id, i));
  saveToLocalStorage(storeName, Array.from(itemMap.values()));
}

export async function deleteItem(storeName: StoreName, id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`deleteItem fallback for ${storeName}:`, err);
  }

  const current = getFromLocalStorage<{ id: string }[]>(storeName, []);
  const filtered = current.filter(i => i.id !== id);
  saveToLocalStorage(storeName, filtered);
}

export async function deleteItems(storeName: StoreName, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const idSet = new Set(ids);
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      ids.forEach(id => store.delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`deleteItems fallback for ${storeName}:`, err);
  }

  const current = getFromLocalStorage<{ id: string }[]>(storeName, []);
  const filtered = current.filter(i => !idSet.has(i.id));
  saveToLocalStorage(storeName, filtered);
}

export async function replaceStoreItems<T extends { id: string }>(storeName: StoreName, items: T[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`replaceStoreItems fallback for ${storeName}:`, err);
  }
  saveToLocalStorage(storeName, items);
}

export async function clearStore(storeName: StoreName): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn(`clearStore fallback for ${storeName}:`, err);
  }
  saveToLocalStorage(storeName, []);
}

// Settings
export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const req = store.get('app_settings');
      req.onsuccess = () => {
        if (req.result && req.result.value) {
          saveToLocalStorage('app_settings', req.result.value);
          resolve(req.result.value);
        } else {
          const fromLocal = getFromLocalStorage('app_settings', DEFAULT_SETTINGS);
          resolve(fromLocal);
        }
      };
      req.onerror = () => {
        resolve(getFromLocalStorage('app_settings', DEFAULT_SETTINGS));
      };
    });
  } catch {
    return getFromLocalStorage('app_settings', DEFAULT_SETTINGS);
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.put({ key: 'app_settings', value: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('saveSettings fallback:', err);
  }
  saveToLocalStorage('app_settings', settings);
}

// Load entire state with safe migrations
export async function loadFullDatabaseState(): Promise<AppDatabaseState> {
  const [
    dailyProgress,
    studySessions,
    topicMaster,
    lectureTracker,
    pyqTracker,
    rawRevisions,
    weeklyQuiz,
    testTracker,
    planning,
    customSheets,
    settings
  ] = await Promise.all([
    getAllFromStore<DailyProgressItem>('daily_progress'),
    getAllFromStore<StudySession>('study_sessions'),
    getAllFromStore<TopicMasterItem>('topic_master'),
    getAllFromStore<LectureItem>('lecture_tracker'),
    getAllFromStore<PYQItem>('pyq_tracker'),
    getAllFromStore<RevisionItem>('revision_tracker'),
    getAllFromStore<WeeklyQuizItem>('weekly_quiz'),
    getAllFromStore<TestItem>('test_tracker'),
    getAllFromStore<PlanningItem>('planning'),
    getAllFromStore<CustomSheet>('custom_sheets'),
    getSettings()
  ]);

  // Safe migration for revision items to ensure topic and dates are mapped
  const revisionTracker: RevisionItem[] = rawRevisions.map(r => ({
    ...r,
    topic: r.topic || (r as any).module || 'General Topic',
    revision1Date: r.revision1Date || r.revision1 || '',
    revision2Date: r.revision2Date || r.revision2 || '',
    revision3Date: r.revision3Date || r.revision3 || ''
  }));

  return {
    dailyProgress,
    studySessions,
    topicMaster,
    lectureTracker,
    pyqTracker,
    revisionTracker,
    weeklyQuiz,
    testTracker,
    planning,
    customSheets,
    settings: {
      ...DEFAULT_SETTINGS,
      ...settings
    }
  };
}

// Reset Entire Database
export async function resetAllData(): Promise<void> {
  for (const store of STORES) {
    if (store !== 'settings') {
      await clearStore(store);
    }
  }
  await saveSettings(DEFAULT_SETTINGS);
}
