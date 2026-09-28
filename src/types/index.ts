export type Priority = 'High' | 'Medium' | 'Low';

export type LectureStatus = 'Not Started' | 'Completed' | 'Skipped';

export type TestType = 'Topic Test' | 'Weekly Test' | 'Subject Test' | 'Mixed Test' | 'Full Mock Test';

export type MistakePattern = 
  | 'Conceptual' 
  | 'Silly Mistake' 
  | 'Formula' 
  | 'Calculation' 
  | 'Question Misread' 
  | 'Time Pressure' 
  | 'Guess' 
  | 'Other';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Hard';

export interface HyperlinkValue {
  text: string;
  url: string;
}

export type LinkField = string | HyperlinkValue;

export interface StudySession {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM:SS or string
  endTime: string; // HH:MM:SS or string
  durationMinutes: number;
  subject?: string;
  module?: string;
  topic?: string;
  sessionType: 'Lecture' | 'PYQ' | 'Revision' | 'Quiz' | 'Test' | 'Other';
  remarks?: string;
  isSample?: boolean;
}

export interface DailyProgressItem {
  id: string;
  date: string; // YYYY-MM-DD
  studyHours: number;
  lectureHours: number;
  pyqHours: number;
  revisionHours: number;
  testQuizHours: number;
  otherStudy: number;
  totalStudyHours: number; // Auto-calculated
  remarks?: string;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface TopicMasterItem {
  id: string;
  subject: string;
  module: string;
  topic: string;
  priority?: Priority | string;
  gateYear?: string;
  resource?: LinkField;
  notes?: string;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface LectureItem {
  id: string;
  subject?: string;
  lectureNo?: string | number;
  module: string;
  lectureTitle: string;
  type?: string;
  duration?: string;
  notes?: boolean; // CHECKBOX: completed notes
  done: LectureStatus | boolean | string;
  doneDate?: string;
  remarks?: string;
  lectureLink?: LinkField;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface PYQItem {
  id: string;
  completed: boolean; // Checkbox (strikes through row)
  subject: string;
  module: string;
  topic: string;
  totalPYQs: number;
  solved: number; // Never exceeds totalPYQs
  remaining: number; // MAX(totalPYQs - solved, 0)
  remarks?: string;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface RevisionItem {
  id: string;
  subject: string;
  module: string;
  topic?: string; // Topic-level revision
  revision1Date?: string; // 1st Revision Date
  revision2Date?: string; // 2nd Revision Date
  revision3Date?: string; // 3rd Revision Date
  // Backward compatibility fields
  revision1?: string;
  revision2?: string;
  revision3?: string;
  lastRevision?: string;
  completed?: boolean;
  remarks?: string;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface WeeklyQuizItem {
  id: string;
  complete: boolean; // Checkbox
  quizName: string;
  subject?: string;
  topicCovered?: string;
  quizLink?: LinkField;
  testDate?: string;
  totalQuestions?: number;
  attempted?: number;
  correct?: number;
  wrong?: number;
  skipped?: number;
  fullMarks?: number;
  netMarks?: number;
  accuracy?: number; // %
  timeTaken?: string;
  remarks?: string;
  weakAreas?: string;
  mistakePattern?: MistakePattern | string;
  // Personal optional fields
  confidence?: number; // 1-5
  difficulty?: DifficultyLevel | string;
  revisionScheduled?: string;
  revisionCompleted?: boolean | string;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface TestItem {
  id: string;
  completed: boolean; // Checkbox
  testType?: TestType | string;
  testName: string;
  topicCovered?: string; // Same as Weekly Quiz
  subject?: string;
  topicModule?: string;
  testLink?: LinkField;
  testDate?: string;
  totalQuestions?: number;
  attempted?: number;
  correct?: number;
  wrong?: number;
  skipped?: number;
  fullMarks?: number;
  marksObtained?: number; // netMarks
  netMarks?: number;
  accuracy?: number; // %
  timeTaken?: string;
  remarks?: string;
  weakAreas?: string;
  weakArea?: string;
  mistakePattern?: MistakePattern | string;
  confidence?: number; // 1-5
  difficulty?: DifficultyLevel | string;
  revisionScheduled?: string;
  revisionCompleted?: boolean | string;
  source?: string;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface PlanningItem {
  id: string;
  task: string;
  date: string;
  subject?: string;
  module?: string;
  type?: 'Lecture' | 'PYQ' | 'Revision' | 'Quiz' | 'Test' | 'Other' | string;
  priority: Priority;
  target?: string;
  completed: boolean;
  remarks?: string;
  _customFields?: Record<string, any>;
  isSample?: boolean;
}

export interface CustomSheet {
  id: string;
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  importedAt: string;
}

export interface AppSettings {
  examDate: string; // Default '2027-02-06'
  targetExam: string; // 'GATE CS / DA 2027'
  theme: 'light' | 'dark';
  userName?: string;
  dailyGoalHours?: number; // Default 10 hours
  dailyTargetsByDate?: Record<string, number>; // Stored target hours by date e.g. { '2026-09-28': 10 }
}

export interface AppDatabaseState {
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
  settings: AppSettings;
}

export type ResetSectionKey = 
  | 'lecture_tracker'
  | 'pyq_tracker'
  | 'revision_tracker'
  | 'weekly_quiz'
  | 'test_tracker'
  | 'planning'
  | 'daily_progress';

