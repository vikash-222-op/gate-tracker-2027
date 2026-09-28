import {
  DailyProgressItem,
  StudySession,
  LectureItem,
  PYQItem,
  RevisionItem,
  WeeklyQuizItem,
  TestItem,
  PlanningItem
} from '../types';

export const SAMPLE_DAILY_PROGRESS: DailyProgressItem[] = [
  {
    id: 'sample_dp_1',
    date: '2026-09-26',
    studyHours: 7.5,
    lectureHours: 3.5,
    pyqHours: 2.0,
    revisionHours: 1.0,
    testQuizHours: 1.0,
    otherStudy: 0.0,
    totalStudyHours: 7.5,
    remarks: 'Covered Propositional Logic & 25 PYQs',
    isSample: true
  }
];

export const SAMPLE_STUDY_SESSIONS: StudySession[] = [
  {
    id: 'sample_sess_1',
    date: '2026-09-26',
    startTime: '09:00 AM',
    endTime: '11:30 AM',
    durationMinutes: 150,
    subject: 'Discrete Mathematics',
    module: 'Propositional Logic',
    sessionType: 'Lecture',
    remarks: 'Truth tables and equivalence laws',
    isSample: true
  },
  {
    id: 'sample_sess_2',
    date: '2026-09-26',
    startTime: '02:00 PM',
    endTime: '04:00 PM',
    durationMinutes: 120,
    subject: 'Discrete Mathematics',
    module: 'Propositional Logic',
    sessionType: 'PYQ',
    remarks: 'Solved GATE 2018-2024 questions',
    isSample: true
  }
];

export const SAMPLE_LECTURES: LectureItem[] = [
  {
    id: 'sample_lec_1',
    subject: 'Discrete Mathematics',
    lectureNo: 1,
    module: 'Propositional Logic',
    lectureTitle: 'Introduction to Propositions and Truth Values',
    type: 'Theory',
    duration: '1h 15m',
    notes: true,
    done: 'Completed',
    doneDate: '2026-09-20',
    remarks: 'Important base concepts',
    lectureLink: { text: 'Watch', url: 'https://goclasses.in' },
    isSample: true
  },
  {
    id: 'sample_lec_2',
    subject: 'Discrete Mathematics',
    lectureNo: 2,
    module: 'Propositional Logic',
    lectureTitle: 'Logical Connectives and Truth Tables',
    type: 'Theory + Problems',
    duration: '1h 30m',
    notes: false,
    done: 'Not Started',
    doneDate: '',
    remarks: 'Revise De Morgan laws',
    lectureLink: { text: 'Watch', url: 'https://goclasses.in' },
    isSample: true
  }
];

export const SAMPLE_PYQS: PYQItem[] = [
  {
    id: 'sample_pyq_1',
    completed: true,
    subject: 'Discrete Mathematics',
    module: 'Propositional Logic',
    topic: 'Equivalences & Tautologies',
    totalPYQs: 35,
    solved: 35,
    remaining: 0,
    remarks: 'All 1990-2026 PYQs solved',
    isSample: true
  },
  {
    id: 'sample_pyq_2',
    completed: false,
    subject: 'Discrete Mathematics',
    module: 'Predicate Logic',
    topic: 'Quantifiers & Nested Predicates',
    totalPYQs: 40,
    solved: 25,
    remaining: 15,
    remarks: 'Remaining 15 are tough MSQs',
    isSample: true
  }
];

export const SAMPLE_REVISIONS: RevisionItem[] = [
  {
    id: 'sample_rev_1',
    subject: 'Discrete Mathematics',
    module: 'Mathematical Logic',
    topic: 'Propositional Equivalences & Rules of Inference',
    revision1Date: '2026-09-22',
    revision2Date: '2026-09-26',
    revision3Date: '',
    remarks: 'Formulas memorized',
    isSample: true
  },
  {
    id: 'sample_rev_2',
    subject: 'DBMS',
    module: 'Transactions',
    topic: 'Conflict Serializability & View Serializability',
    revision1Date: '2026-09-24',
    revision2Date: '',
    revision3Date: '',
    remarks: 'Precedence graph methods reviewed',
    isSample: true
  }
];

export const SAMPLE_WEEKLY_QUIZZES: WeeklyQuizItem[] = [
  {
    id: 'sample_quiz_1',
    complete: true,
    quizName: 'GO Classes GATE CS/DA | DM | Propositional Logic | Weekly Quiz 1',
    topicCovered: 'Propositional Logic & Tautologies',
    quizLink: { text: 'Start', url: 'https://goclasses.in/quiz/1' },
    testDate: '2026-09-24',
    totalQuestions: 15,
    attempted: 15,
    correct: 13,
    wrong: 2,
    skipped: 0,
    fullMarks: 30,
    netMarks: 24.67,
    accuracy: 87,
    timeTaken: '40 mins',
    remarks: 'Good time management',
    weakAreas: 'Conditional Negation',
    mistakePattern: 'Silly Mistake',
    confidence: 4,
    difficulty: 'Medium',
    isSample: true
  }
];

export const SAMPLE_TESTS: TestItem[] = [
  {
    id: 'sample_test_1',
    completed: true,
    testType: 'Subject Test',
    testName: 'DM - Full Subject Test 1',
    topicCovered: 'Full Subject',
    subject: 'Discrete Mathematics',
    topicModule: 'Full Subject',
    testLink: { text: 'Test', url: 'https://testseries.gate/dm1' },
    testDate: '2026-09-25',
    totalQuestions: 33,
    attempted: 30,
    correct: 24,
    wrong: 6,
    skipped: 3,
    fullMarks: 50,
    marksObtained: 36.67,
    netMarks: 36.67,
    accuracy: 80,
    timeTaken: '90 mins',
    remarks: 'Section B numericals need fast arithmetic',
    weakAreas: 'Planar Graph Face Calculation',
    mistakePattern: 'Calculation',
    confidence: 4,
    difficulty: 'Hard',
    source: 'Test Series',
    isSample: true
  }
];

export const SAMPLE_PLANNING: PlanningItem[] = [
  {
    id: 'sample_plan_1',
    task: 'Solve 15 PYQs of Predicate Logic quantifiers',
    date: new Date().toISOString().split('T')[0],
    subject: 'Discrete Mathematics',
    module: 'Predicate Logic',
    type: 'PYQ',
    priority: 'High',
    target: '15 PYQs',
    completed: false,
    remarks: 'Mark difficult ones for revision',
    isSample: true
  },
  {
    id: 'sample_plan_2',
    task: 'Watch Lecture 3: First Order Logic & Quantifiers',
    date: new Date().toISOString().split('T')[0],
    subject: 'Discrete Mathematics',
    module: 'Propositional Logic',
    type: 'Lecture',
    priority: 'Medium',
    target: '1 Lecture + Notes',
    completed: true,
    remarks: 'Done in morning session',
    isSample: true
  }
];

export function getWithSampleFallback<T>(realItems: T[], sampleItems: T[]): { items: T[]; isSampleState: boolean } {
  if (realItems && realItems.length > 0) {
    return { items: realItems, isSampleState: false };
  }
  return { items: sampleItems, isSampleState: true };
}
