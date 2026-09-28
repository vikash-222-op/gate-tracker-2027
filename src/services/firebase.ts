import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppDatabaseState } from '../types';

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore (with specific databaseId if configured)
export const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

// Recursively sanitize all data for Cloud Firestore by stripping undefined values.
// Firestore rejects documents or arrays containing `undefined`.
export function sanitizeForFirestore(val: any): any {
  if (val === undefined) return null;
  if (val === null || typeof val !== 'object') return val;
  if (Array.isArray(val)) {
    return val.map(item => sanitizeForFirestore(item));
  }
  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirestore(value);
    }
  }
  return cleanObj;
}

// Google Sign-In
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Create or update user profile doc
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(
      userDocRef,
      sanitizeForFirestore({
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastActiveAt: new Date().toISOString()
      }),
      { merge: true }
    );

    return user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    throw error;
  }
}

// Sign Out
export async function logOut(): Promise<void> {
  await signOut(auth);
}

// Update user display name in Cloud Firestore
export async function updateUserDisplayNameInCloud(userId: string, displayName: string): Promise<void> {
  if (!userId) return;
  try {
    const userDocRef = doc(db, 'users', userId);
    await setDoc(
      userDocRef,
      sanitizeForFirestore({
        displayName,
        lastActiveAt: new Date().toISOString()
      }),
      { merge: true }
    );
  } catch (err) {
    console.error('Failed to update displayName in cloud:', err);
  }
}

// Sections list for sync
export const SYNC_SECTIONS = [
  'lecture_tracker',
  'pyq_tracker',
  'revision_tracker',
  'weekly_quiz',
  'test_tracker',
  'planning',
  'daily_progress',
  'study_sessions',
  'topic_master',
  'custom_sheets',
  'settings'
] as const;

export type SyncSectionName = typeof SYNC_SECTIONS[number];

// Sync a single section to Firestore
export async function syncSectionToCloud(
  userId: string,
  sectionName: SyncSectionName,
  data: any
): Promise<void> {
  if (!userId) return;
  try {
    const docRef = doc(db, 'users', userId, 'sections', sectionName);
    const sanitized = sanitizeForFirestore(data);
    await setDoc(
      docRef,
      {
        sectionKey: sectionName,
        data: sanitized,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`Failed to sync ${sectionName} to cloud:`, err);
    throw err;
  }
}

// Upload full database state to Cloud
export async function uploadFullStateToCloud(
  userId: string,
  state: AppDatabaseState
): Promise<void> {
  if (!userId) return;
  try {
    const batch = writeBatch(db);

    const sectionData: Record<SyncSectionName, any> = {
      lecture_tracker: state.lectureTracker,
      pyq_tracker: state.pyqTracker,
      revision_tracker: state.revisionTracker,
      weekly_quiz: state.weeklyQuiz,
      test_tracker: state.testTracker,
      planning: state.planning,
      daily_progress: state.dailyProgress,
      study_sessions: state.studySessions,
      topic_master: state.topicMaster,
      custom_sheets: state.customSheets,
      settings: state.settings
    };

    SYNC_SECTIONS.forEach(sec => {
      const ref = doc(db, 'users', userId, 'sections', sec);
      const rawData = sectionData[sec] || [];
      const sanitized = sanitizeForFirestore(rawData);
      batch.set(ref, {
        sectionKey: sec,
        data: sanitized,
        updatedAt: new Date().toISOString()
      });
    });

    // Also update user profile lastSyncedAt
    const userRef = doc(db, 'users', userId);
    batch.set(
      userRef,
      sanitizeForFirestore({ lastSyncedAt: new Date().toISOString() }),
      { merge: true }
    );

    await batch.commit();
  } catch (err) {
    console.error('Failed to upload full state to cloud:', err);
    throw err;
  }
}

// Download full database state from Cloud
export async function downloadFullStateFromCloud(
  userId: string
): Promise<Partial<AppDatabaseState> | null> {
  if (!userId) return null;
  try {
    const partial: Partial<AppDatabaseState> = {};
    let hasAnyData = false;

    for (const sec of SYNC_SECTIONS) {
      const ref = doc(db, 'users', userId, 'sections', sec);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        hasAnyData = true;
        const val = snap.data()?.data;
        if (sec === 'lecture_tracker') partial.lectureTracker = val || [];
        else if (sec === 'pyq_tracker') partial.pyqTracker = val || [];
        else if (sec === 'revision_tracker') partial.revisionTracker = val || [];
        else if (sec === 'weekly_quiz') partial.weeklyQuiz = val || [];
        else if (sec === 'test_tracker') partial.testTracker = val || [];
        else if (sec === 'planning') partial.planning = val || [];
        else if (sec === 'daily_progress') partial.dailyProgress = val || [];
        else if (sec === 'study_sessions') partial.studySessions = val || [];
        else if (sec === 'topic_master') partial.topicMaster = val || [];
        else if (sec === 'custom_sheets') partial.customSheets = val || [];
        else if (sec === 'settings') partial.settings = val;
      }
    }

    return hasAnyData ? partial : null;
  } catch (err) {
    console.error('Failed to download state from cloud:', err);
    return null;
  }
}

// Real-time listener for remote changes from another device
export function listenToCloudUpdates(
  userId: string,
  onRemoteChange: (section: SyncSectionName, data: any) => void
): () => void {
  if (!userId) return () => {};

  const colRef = collection(db, 'users', userId, 'sections');
  const unsubscribe = onSnapshot(
    colRef,
    snapshot => {
      snapshot.docChanges().forEach(change => {
        // If metadata change originates from server / another client
        if (!change.doc.metadata.hasPendingWrites) {
          const docData = change.doc.data();
          const sec = docData?.sectionKey as SyncSectionName;
          if (sec && docData?.data !== undefined) {
            onRemoteChange(sec, docData.data);
          }
        }
      });
    },
    error => {
      console.warn('Cloud sync listener error:', error);
    }
  );

  return unsubscribe;
}
