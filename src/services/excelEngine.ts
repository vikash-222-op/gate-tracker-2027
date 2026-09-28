import * as XLSX from 'xlsx';
import {
  DailyProgressItem,
  TopicMasterItem,
  LectureItem,
  PYQItem,
  RevisionItem,
  WeeklyQuizItem,
  TestItem,
  PlanningItem,
  CustomSheet,
  HyperlinkValue,
  LinkField,
  AppDatabaseState
} from '../types';

export interface SheetDetectionResult {
  sheetName: string;
  matchedTarget: 
    | 'daily_progress' 
    | 'topic_master' 
    | 'lecture_tracker' 
    | 'pyq_tracker' 
    | 'revision_tracker' 
    | 'weekly_quiz' 
    | 'test_tracker' 
    | 'planning' 
    | 'settings' 
    | 'custom';
  confidence: 'high' | 'medium' | 'low';
  rowCount: number;
  columnCount: number;
  headers: string[];
  rawRows: Record<string, any>[];
  unmappedColumns: string[];
}

export interface WorkbookInspection {
  fileName: string;
  sheets: SheetDetectionResult[];
  totalRows: number;
}

// Extract clean text and hyperlink if present
export function extractCellLinkAndValue(cell: any): { value: any; link?: HyperlinkValue } {
  if (!cell) return { value: '' };

  let link: HyperlinkValue | undefined;
  
  // SheetJS hyperlink property
  if (cell.l && cell.l.Target) {
    link = {
      text: String(cell.w || cell.v || 'Link').trim(),
      url: cell.l.Target
    };
  } else if (cell.f && typeof cell.f === 'string' && cell.f.toUpperCase().includes('HYPERLINK(')) {
    // Formula e.g. HYPERLINK("https://...", "Label")
    const match = cell.f.match(/HYPERLINK\(\s*["']([^"']+)["']\s*(?:,\s*["']([^"']+)["'])?\s*\)/i);
    if (match) {
      link = {
        url: match[1],
        text: match[2] || String(cell.v || cell.w || match[1]).trim()
      };
    }
  } else if (typeof cell.v === 'string' && /^https?:\/\//i.test(cell.v.trim())) {
    link = {
      text: (cell.w || cell.v).trim(),
      url: cell.v.trim()
    };
  }

  const rawVal = cell.w !== undefined ? cell.w : cell.v;
  return { value: rawVal, link };
}

// Clean string for header normalization check
export function normalizeHeader(h: string): string {
  return String(h || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

// Detect which application store a sheet name matches
export function detectSheetTarget(sheetName: string): SheetDetectionResult['matchedTarget'] {
  const norm = sheetName.toLowerCase().trim();

  if (norm.includes('lecture')) return 'lecture_tracker';
  if (norm.includes('pyq')) return 'pyq_tracker';
  if (norm.includes('weekly') || norm.includes('quiz')) return 'weekly_quiz';
  if (norm.includes('revision')) return 'revision_tracker';
  if (norm.includes('daily') || norm.includes('study hour')) return 'daily_progress';
  if (norm.includes('mock') || norm.includes('test series') || norm.includes('subject test') || (norm.includes('test') && !norm.includes('quiz'))) return 'test_tracker';
  if (norm.includes('plan') || norm.includes('task')) return 'planning';
  if (norm.includes('setting')) return 'settings';

  return 'custom';
}

// Parse an Excel / CSV File
export async function inspectExcelFile(file: File): Promise<WorkbookInspection> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    cellFormula: true,
    cellStyles: true
  });

  const sheets: SheetDetectionResult[] = [];
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet || !worksheet['!ref']) {
      continue;
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    if (range.e.r < 0 || range.e.c < 0) continue;

    // Detect header row (first non-empty row)
    let headerRowIdx = 0;
    const headers: string[] = [];

    // Find headers
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellAddress = XLSX.utils.encode_cell({ r: headerRowIdx, c });
      const cell = worksheet[cellAddress];
      const val = cell ? String(cell.w || cell.v || '').trim() : '';
      headers.push(val || `Column_${c + 1}`);
    }

    // Read rows preserving cell links
    const rawRows: Record<string, any>[] = [];
    for (let r = headerRowIdx + 1; r <= range.e.r; r++) {
      const rowObj: Record<string, any> = {};
      let hasData = false;

      for (let c = range.s.c; c <= range.e.c; c++) {
        const header = headers[c - range.s.c];
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = worksheet[cellAddress];
        const { value, link } = extractCellLinkAndValue(cell);

        if (value !== undefined && value !== null && String(value).trim() !== '') {
          hasData = true;
        }

        if (link) {
          rowObj[header] = link;
        } else {
          rowObj[header] = value !== undefined ? value : '';
        }
      }

      if (hasData) {
        rawRows.push(rowObj);
      }
    }

    const matchedTarget = detectSheetTarget(sheetName);
    totalRows += rawRows.length;

    sheets.push({
      sheetName,
      matchedTarget,
      confidence: matchedTarget === 'custom' ? 'low' : 'high',
      rowCount: rawRows.length,
      columnCount: headers.length,
      headers,
      rawRows,
      unmappedColumns: []
    });
  }

  return {
    fileName: file.name,
    sheets,
    totalRows
  };
}

// Convert cell to boolean safely (supports 'done', 'yes', 'true', 1, 'completed', checkmarks)
export function toBoolean(val: any): boolean {
  if (val === true || val === 1) return true;
  if (!val) return false;
  const s = String(val).trim().toLowerCase();
  return ['true', 'yes', '1', 'done', 'completed', 'complete', 'y', '✓', 'check'].includes(s);
}

// Convert cell to number safely
export function toNumber(val: any, fallback = 0): number {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? fallback : n;
}

// Convert cell to optional number safely without generating fake zeros
export function toOptionalNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  const s = String(val).trim();
  if (s === '' || s === '-' || s === '—') return undefined;
  const cleaned = s.replace(/[^0-9.-]/g, '');
  if (!cleaned) return undefined;
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

// Convert cell to optional string safely without generating fake defaults
export function toOptionalString(val: any): string | undefined {
  if (val === undefined || val === null) return undefined;
  const s = String(val).trim();
  return s.length > 0 && s !== '-' && s !== '—' ? s : undefined;
}

// Format date string to YYYY-MM-DD
export function toDateString(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  // Check if it's already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  
  // Try parsing
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    try {
      return d.toISOString().split('T')[0];
    } catch {
      return s;
    }
  }
  return s;
}

// Helper to find value from row by candidate column names
function getRowValue(row: Record<string, any>, candidates: string[]): any {
  const normCandidates = candidates.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    const normKey = normalizeHeader(key);
    if (normCandidates.includes(normKey)) {
      return row[key];
    }
  }
  return undefined;
}

// Collect unrecognized columns into _customFields
function collectCustomFields(row: Record<string, any>, knownKeys: string[][]): Record<string, any> {
  const allKnownNorms = new Set(knownKeys.flat().map(normalizeHeader));
  const custom: Record<string, any> = {};

  for (const [k, v] of Object.entries(row)) {
    if (!allKnownNorms.has(normalizeHeader(k)) && v !== undefined && v !== '') {
      custom[k] = v;
    }
  }
  return Object.keys(custom).length > 0 ? custom : undefined as any;
}

// Map raw rows to DailyProgressItem[]
export function mapToDailyProgress(rows: Record<string, any>[]): DailyProgressItem[] {
  const candidateKeys = [
    ['date', 'studydate', 'day'],
    ['studyhours', 'hours', 'totalhours'],
    ['lecturehours', 'lectures'],
    ['pyqhours', 'pyq'],
    ['revisionhours', 'revision'],
    ['testquizhours', 'testquiz', 'testhours', 'quizhours'],
    ['otherstudy', 'other', 'others'],
    ['totalstudyhours', 'totalhours', 'totstudy'],
    ['remarks', 'notes', 'comment', 'comments']
  ];

  return rows.map((r, i) => {
    const dateVal = getRowValue(r, candidateKeys[0]) || new Date().toISOString().split('T')[0];
    const lectureHours = toNumber(getRowValue(r, candidateKeys[2]), 0);
    const pyqHours = toNumber(getRowValue(r, candidateKeys[3]), 0);
    const revisionHours = toNumber(getRowValue(r, candidateKeys[4]), 0);
    const testQuizHours = toNumber(getRowValue(r, candidateKeys[5]), 0);
    const otherStudy = toNumber(getRowValue(r, candidateKeys[6]), 0);

    const calcTotal = lectureHours + pyqHours + revisionHours + testQuizHours + otherStudy;
    const providedTotal = toNumber(getRowValue(r, candidateKeys[7]), calcTotal);
    const totalStudyHours = providedTotal > 0 ? providedTotal : calcTotal;

    const studyHours = toNumber(getRowValue(r, candidateKeys[1]), totalStudyHours);

    return {
      id: `dp_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      date: toDateString(dateVal),
      studyHours: studyHours || totalStudyHours,
      lectureHours,
      pyqHours,
      revisionHours,
      testQuizHours,
      otherStudy,
      totalStudyHours,
      remarks: String(getRowValue(r, candidateKeys[8]) || '').trim(),
      _customFields: collectCustomFields(r, candidateKeys)
    };
  });
}

// Map raw rows to TopicMasterItem[]
export function mapToTopicMaster(rows: Record<string, any>[]): TopicMasterItem[] {
  const candidateKeys = [
    ['subject', 'subj'],
    ['module', 'mod'],
    ['topic', 'topictitle', 'name'],
    ['priority', 'prio'],
    ['gateyear', 'year', 'gateyears'],
    ['resource', 'resourcelink', 'link', 'source'],
    ['notes', 'remarks', 'comment']
  ];

  return rows.map((r, i) => {
    const rawResource = getRowValue(r, candidateKeys[5]);
    let resource: LinkField | undefined;
    if (rawResource && typeof rawResource === 'object' && rawResource.url) {
      resource = rawResource;
    } else if (rawResource) {
      resource = String(rawResource).trim();
    }

    return {
      id: `tm_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      subject: String(getRowValue(r, candidateKeys[0]) || 'General').trim(),
      module: String(getRowValue(r, candidateKeys[1]) || 'Module 1').trim(),
      topic: String(getRowValue(r, candidateKeys[2]) || `Topic ${i + 1}`).trim(),
      priority: (getRowValue(r, candidateKeys[3]) || 'Medium'),
      gateYear: String(getRowValue(r, candidateKeys[4]) || '').trim(),
      resource,
      notes: String(getRowValue(r, candidateKeys[6]) || '').trim(),
      _customFields: collectCustomFields(r, candidateKeys)
    };
  });
}

export const STANDARD_GATE_SUBJECTS = [
  'Operating Systems',
  'DBMS',
  'Computer Networks',
  'Theory of Computation',
  'Compiler Design',
  'Computer Organization and Architecture',
  'Digital Logic',
  'Algorithms',
  'Programming and Data Structures',
  'C Programming',
  'Discrete Mathematics',
  'Engineering Mathematics',
  'General Aptitude'
];

export function detectSubjectFromCode(code: string): string | undefined {
  if (!code) return undefined;
  const match = code.trim().match(/^([A-Za-z]+)[-_0-9]/);
  if (!match) return undefined;
  const prefix = match[1].toUpperCase();
  const map: Record<string, string> = {
    DM: 'Discrete Mathematics',
    CO: 'Computer Organization and Architecture',
    COA: 'Computer Organization and Architecture',
    OS: 'Operating Systems',
    CN: 'Computer Networks',
    DBMS: 'DBMS',
    DB: 'DBMS',
    TOC: 'Theory of Computation',
    CD: 'Compiler Design',
    DS: 'Data Structures',
    DSA: 'Data Structures & Algorithms',
    PDS: 'Programming and Data Structures',
    CP: 'C Programming',
    ALGO: 'Algorithms',
    ALG: 'Algorithms',
    EM: 'Engineering Mathematics',
    MATH: 'Engineering Mathematics',
    GA: 'General Aptitude',
    APT: 'General Aptitude',
    DL: 'Digital Logic',
    DLD: 'Digital Logic'
  };
  return map[prefix];
}

function looksLikeLectureNo(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  if (!s || s === '—' || s === '-') return false;
  // Pure numbers: "01", "1", "2.1", "10", "#1"
  if (/^#?\d+(?:\.\d+)?$/.test(s)) return true;
  // Code prefixes: "DM-01", "OS-01", "CN_02", "Lec 1", "Lec-01", "Lecture 1", "#1"
  if (/^(?:[A-Za-z]{1,6}[-_ ]?\d+|\#\d+|lec(?:ture)?[-_ ]*\d+)$/i.test(s)) return true;
  return false;
}

function looksLikeDuration(val: any): boolean {
  if (val === undefined || val === null) return false;
  const s = String(val).trim();
  return /^\d+\s*(?:min|mins|minutes|m|h|hr|hrs|hours|s|sec)$/i.test(s) || /^\d+:\d{2}/.test(s);
}

function isKnownSubject(val: string): boolean {
  if (!val) return false;
  const s = val.trim();
  const patterns = [
    /^operating\s*systems?$/i, /^os$/i,
    /^dbms$/i, /^database(?:s|\s*management\s*systems?)?$/i,
    /^computer\s*networks?$/i, /^cn$/i,
    /^theory\s*of\s*computation$/i, /^toc$/i,
    /^compiler\s*design$/i, /^cd$/i,
    /^computer\s*organization(?:\s*(?:&|and)\s*architecture)?$/i, /^coa?$/i,
    /^digital\s*logic(?:\s*design)?$/i, /^dl[d]?$/i,
    /^algorithms?$/i, /^algo$/i,
    /^programming\s*(?:&|and)\s*data\s*structures?$/i, /^pds$/i,
    /^data\s*structures?(?:\s*(?:&|and)\s*algorithms?)?$/i, /^ds[a]?$/i,
    /^c\s*programming$/i,
    /^discrete\s*mathematics?$/i, /^dm$/i,
    /^engineering\s*mathematics?$/i, /^em$/i, /^math(?:s)?$/i,
    /^general\s*aptitude$/i, /^ga$/i, /^aptitude$/i
  ];
  return patterns.some(p => p.test(s));
}

// Map raw rows to LectureItem[]
export function mapToLectureTracker(rows: Record<string, any>[]): LectureItem[] {
  if (!rows || rows.length === 0) return [];

  const candidateKeys = [
    ['lectureno', 'lecture', 'lecno', 'no', 'srno', '#', 'code', 'leccode', 'classno', 'lecturen'], // 0
    ['module', 'mod', 'chapter', 'section', 'unit'], // 1
    ['lecturetitle', 'title', 'lecturename', 'topic', 'name'], // 2
    ['type', 'lectype', 'class', 'mode'], // 3
    ['duration', 'time', 'length', 'mins', 'minutes'], // 4
    ['notes', 'notesdone', 'notescheckbox', 'pdf', 'slide', 'slides'], // 5
    ['done', 'completed', 'status', 'watchstatus'], // 6
    ['donedate', 'completeddate', 'date', 'watchdate'], // 7
    ['remarks', 'notestext', 'comment', 'comments', 'desc'], // 8
    ['subject', 'subj', 'course', 'subjectname', 'gatesubject'], // 9
    ['lecturelink', 'link', 'video', 'url', 'videolink'] // 10
  ];

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const allCandidateNormalized = candidateKeys.flat().map(normalizeHeader);
  const hasMatchedNamedHeaders = keys.some(k => {
    const norm = normalizeHeader(k);
    return !/^column\s*\d+$/i.test(norm) && allCandidateNormalized.includes(norm);
  });

  return rows.map((r, i) => {
    let rawSubject: any = undefined;
    let rawLectureNo: any = undefined;
    let rawModule: any = undefined;
    let rawTitle: any = undefined;
    let rawType: any = undefined;
    let rawDuration: any = undefined;
    let rawNotes: any = undefined;
    let rawDone: any = undefined;
    let rawDoneDate: any = undefined;
    let rawRemarks: any = undefined;
    let rawLink: any = undefined;

    if (hasMatchedNamedHeaders) {
      rawSubject = getRowValue(r, candidateKeys[9]);
      rawLectureNo = getRowValue(r, candidateKeys[0]);
      rawModule = getRowValue(r, candidateKeys[1]);
      rawTitle = getRowValue(r, candidateKeys[2]);
      rawType = getRowValue(r, candidateKeys[3]);
      rawDuration = getRowValue(r, candidateKeys[4]);
      rawNotes = getRowValue(r, candidateKeys[5]);
      rawDone = getRowValue(r, candidateKeys[6]);
      rawDoneDate = getRowValue(r, candidateKeys[7]);
      rawRemarks = getRowValue(r, candidateKeys[8]);
      rawLink = getRowValue(r, candidateKeys[10]);
    } else {
      // Positional / Pattern mapping for headerless data (e.g. Column 1, Column 2, ...)
      const colValues = keys.map(k => r[k]);
      const numCols = colValues.length;

      const c0 = colValues[0] !== undefined && colValues[0] !== null ? String(colValues[0]).trim() : '';
      const c1 = colValues[1] !== undefined && colValues[1] !== null ? String(colValues[1]).trim() : '';

      // Determine if Column 0 represents Subject:
      // 1. Column 1 looks like a lecture number/code and Column 0 does not
      // 2. OR Column 0 is a known GATE CSE subject name
      // 3. OR numCols >= 4, Column 0 has no digits and Column 1 is numeric/code
      const hasSubjectInCol0 =
        (looksLikeLectureNo(c1) && !looksLikeLectureNo(c0)) ||
        isKnownSubject(c0) ||
        (numCols >= 4 && !/\d/.test(c0) && looksLikeLectureNo(c1));

      if (hasSubjectInCol0) {
        rawSubject = colValues[0];
        rawLectureNo = colValues[1];
        rawModule = colValues[2];
        rawTitle = colValues[3];

        if (numCols >= 11) {
          rawType = colValues[4];
          rawDuration = colValues[5];
          rawNotes = colValues[6];
          rawDone = colValues[7];
          rawDoneDate = colValues[8];
          rawRemarks = colValues[9];
          rawLink = colValues[10];
        } else if (numCols === 10) {
          rawType = colValues[4];
          rawDuration = colValues[5];
          rawNotes = colValues[6];
          rawDone = colValues[7];
          rawDoneDate = colValues[8];
          rawRemarks = colValues[9];
        } else if (numCols === 9) {
          rawType = colValues[4];
          rawDuration = colValues[5];
          rawNotes = colValues[6];
          rawDone = colValues[7];
          rawRemarks = colValues[8];
        } else if (numCols === 8) {
          rawType = colValues[4];
          rawDuration = colValues[5];
          rawNotes = colValues[6];
          rawDone = colValues[7];
        } else if (numCols === 7) {
          rawType = colValues[4];
          rawDuration = colValues[5];
          rawNotes = colValues[6];
        } else if (numCols === 6) {
          // Standard 6-col with subject: Subject | Lecture No. | Module | Lecture Title | Type | Duration
          rawType = colValues[4];
          rawDuration = colValues[5];
        } else if (numCols === 5) {
          // Subject | Lecture No. | Module | Lecture Title | Duration or Type
          if (looksLikeDuration(colValues[4])) {
            rawDuration = colValues[4];
          } else {
            rawType = colValues[4];
          }
        }
      } else {
        // No subject column in position 0:
        if (numCols >= 10) {
          rawSubject = colValues[0];
          rawLectureNo = colValues[1];
          rawModule = colValues[2];
          rawTitle = colValues[3];
          rawType = colValues[4];
          rawDuration = colValues[5];
          rawNotes = colValues[6];
          rawDone = colValues[7];
          rawDoneDate = colValues[8];
          rawRemarks = colValues[9];
        } else if (numCols === 9) {
          rawSubject = colValues[0];
          rawLectureNo = colValues[1];
          rawModule = colValues[2];
          rawTitle = colValues[3];
          rawType = colValues[4];
          rawDuration = colValues[5];
          rawNotes = colValues[6];
          rawDone = colValues[7];
          rawRemarks = colValues[8];
        } else if (numCols === 8) {
          rawLectureNo = colValues[0];
          rawModule = colValues[1];
          rawTitle = colValues[2];
          rawType = colValues[3];
          rawDuration = colValues[4];
          rawNotes = colValues[5];
          rawDone = colValues[6];
          rawRemarks = colValues[7];
        } else if (numCols === 7) {
          // Exact GO Classes Layout:
          // Col 0: DM-01 (Lecture Code / No)
          // Col 1: Propositional Logic (Module)
          // Col 2: Propositional Logic Class 1 (Title)
          // Col 3: Video (Type)
          // Col 4: 155 min (Duration)
          // Col 5: FALSE (Notes)
          // Col 6: — (Remarks / Link)
          rawLectureNo = colValues[0];
          rawModule = colValues[1];
          rawTitle = colValues[2];
          rawType = colValues[3];
          rawDuration = colValues[4];
          rawNotes = colValues[5];
          rawRemarks = colValues[6];
        } else if (numCols === 6) {
          rawLectureNo = colValues[0];
          rawModule = colValues[1];
          rawTitle = colValues[2];
          rawType = colValues[3];
          rawDuration = colValues[4];
          rawNotes = colValues[5];
        } else if (numCols === 5) {
          rawLectureNo = colValues[0];
          rawModule = colValues[1];
          rawTitle = colValues[2];
          rawType = colValues[3];
          rawDuration = colValues[4];
        } else if (numCols === 4) {
          rawLectureNo = colValues[0];
          rawModule = colValues[1];
          rawTitle = colValues[2];
          rawDuration = colValues[3];
        } else if (numCols === 3) {
          rawLectureNo = colValues[0];
          rawModule = colValues[1];
          rawTitle = colValues[2];
        } else if (numCols === 2) {
          rawLectureNo = colValues[0];
          rawTitle = colValues[1];
        } else {
          rawTitle = colValues[0];
        }
      }
    }

    // Subject preservation and derivation:
    // 1. If rawSubject was provided, PRESERVE IT EXACTLY (trimmed). NEVER overwrite or force to DM!
    let subject: string | undefined = undefined;
    if (rawSubject !== undefined && rawSubject !== null) {
      const s = String(rawSubject).trim();
      if (s && s !== '—' && s !== '-') {
        subject = s;
      }
    }

    // 2. If subject is still undefined, check if lectureNo has a recognized code prefix (e.g. DM-01 -> Discrete Mathematics, OS-01 -> Operating Systems)
    const lecNoStr = rawLectureNo !== undefined && rawLectureNo !== null ? String(rawLectureNo).trim() : '';
    if (!subject && lecNoStr) {
      subject = detectSubjectFromCode(lecNoStr);
    }

    // 3. DO NOT USE DM AS A DEFAULT FALLBACK!
    // If subject is missing, leave it as undefined (blank). Do not force to DM.

    // Status parsing
    let status: 'Not Started' | 'Completed' | 'Skipped' = 'Not Started';
    if (rawDone !== undefined && rawDone !== null && String(rawDone).trim() !== '' && String(rawDone).trim() !== '—') {
      const s = String(rawDone).trim().toLowerCase();
      if (s === 'completed' || s === 'done' || s === 'true' || s === '1' || s === 'yes') {
        status = 'Completed';
      } else if (s === 'skipped' || s === 'skip') {
        status = 'Skipped';
      }
    }

    // Clean strings without fabricating fake defaults!
    // NEVER invent Subject, Module, Lecture Title, Type or Duration values!
    const cleanString = (val: any): string => {
      if (val === undefined || val === null) return '';
      const s = String(val).trim();
      return s === '-' || s === '—' ? '' : s;
    };

    const cleanTitle = cleanString(rawTitle);
    const cleanModule = cleanString(rawModule);
    const cleanType = cleanString(rawType);
    const cleanDuration = cleanString(rawDuration);
    const cleanRemarks = cleanString(rawRemarks);

    return {
      id: `lec_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      subject: subject || undefined,
      lectureNo: lecNoStr || undefined,
      module: cleanModule,
      lectureTitle: cleanTitle,
      type: cleanType || undefined,
      duration: cleanDuration || undefined,
      notes: toBoolean(rawNotes),
      done: status,
      doneDate: toDateString(rawDoneDate),
      remarks: cleanRemarks,
      lectureLink: rawLink,
      _customFields: hasMatchedNamedHeaders ? collectCustomFields(r, candidateKeys) : undefined
    };
  });
}

// Map raw rows to PYQItem[]
export function mapToPYQTracker(rows: Record<string, any>[]): PYQItem[] {
  if (!rows || rows.length === 0) return [];

  const candidateKeys = [
    ['checkbox', 'done', 'completed', 'status'], // 0
    ['subject', 'subj'], // 1
    ['module', 'mod', 'chapter'], // 2
    ['topic', 'topictitle', 'group'], // 3
    ['totalpyqs', 'total', 'pyqs', 'pyqcount', 'totalquestions'], // 4
    ['solved', 'donepyqs', 'solvedpyqs', 'attempted'], // 5
    ['remaining', 'rem', 'pending'], // 6
    ['remarks', 'notes', 'comment'] // 7
  ];

  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  const allCandidateNormalized = candidateKeys.flat().map(normalizeHeader);
  const hasMatchedNamedHeaders = keys.some(k => {
    const norm = normalizeHeader(k);
    return !/^column\s*\d+$/i.test(norm) && allCandidateNormalized.includes(norm);
  });

  return rows.map((r, i) => {
    let rawComplete: any = undefined;
    let rawSubject: any = undefined;
    let rawModule: any = undefined;
    let rawTopic: any = undefined;
    let rawTotal: any = undefined;
    let rawSolved: any = undefined;
    let rawRemaining: any = undefined;
    let rawRemarks: any = undefined;

    if (hasMatchedNamedHeaders) {
      rawComplete = getRowValue(r, candidateKeys[0]);
      rawSubject = getRowValue(r, candidateKeys[1]);
      rawModule = getRowValue(r, candidateKeys[2]);
      rawTopic = getRowValue(r, candidateKeys[3]);
      rawTotal = getRowValue(r, candidateKeys[4]);
      rawSolved = getRowValue(r, candidateKeys[5]);
      rawRemaining = getRowValue(r, candidateKeys[6]);
      rawRemarks = getRowValue(r, candidateKeys[7]);
    } else {
      const colValues = keys.map(k => r[k]);
      const numCols = colValues.length;

      if (numCols >= 8) {
        rawComplete = colValues[0];
        rawSubject = colValues[1];
        rawModule = colValues[2];
        rawTopic = colValues[3];
        rawTotal = colValues[4];
        rawSolved = colValues[5];
        rawRemaining = colValues[6];
        rawRemarks = colValues[7];
      } else if (numCols === 7) {
        rawSubject = colValues[0];
        rawModule = colValues[1];
        rawTopic = colValues[2];
        rawTotal = colValues[3];
        rawSolved = colValues[4];
        rawRemaining = colValues[5];
        rawRemarks = colValues[6];
      } else if (numCols === 6) {
        rawSubject = colValues[0];
        rawModule = colValues[1];
        rawTopic = colValues[2];
        rawTotal = colValues[3];
        rawSolved = colValues[4];
        rawRemaining = colValues[5];
      } else if (numCols === 5) {
        rawSubject = colValues[0];
        rawModule = colValues[1];
        rawTopic = colValues[2];
        rawTotal = colValues[3];
        rawSolved = colValues[4];
      } else if (numCols === 4) {
        rawModule = colValues[0];
        rawTopic = colValues[1];
        rawTotal = colValues[2];
        rawSolved = colValues[3];
      } else if (numCols === 3) {
        rawTopic = colValues[0];
        rawTotal = colValues[1];
        rawSolved = colValues[2];
      }
    }

    const totalPYQs = Math.max(0, toNumber(rawTotal, 0));
    const rawSolvedNum = toNumber(rawSolved, 0);
    // Solved must NEVER exceed Total PYQs
    const solved = Math.min(totalPYQs, Math.max(0, rawSolvedNum));
    const remaining = Math.max(0, totalPYQs - solved);
    const completed = rawComplete !== undefined 
      ? toBoolean(rawComplete) 
      : (totalPYQs > 0 && solved >= totalPYQs);

    const cleanString = (val: any): string => {
      if (val === undefined || val === null) return '';
      const s = String(val).trim();
      return s === '-' || s === '—' ? '' : s;
    };

    return {
      id: `pyq_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      completed,
      subject: cleanString(rawSubject),
      module: cleanString(rawModule),
      topic: cleanString(rawTopic),
      totalPYQs,
      solved,
      remaining,
      remarks: cleanString(rawRemarks),
      _customFields: hasMatchedNamedHeaders ? collectCustomFields(r, candidateKeys) : undefined
    };
  });
}

// Map raw rows to RevisionItem[] (Topic-Level: Subject | Module | Topic | 1st Revision Date | 2nd Revision Date | 3rd Revision Date)
export function mapToRevisionTracker(rows: Record<string, any>[]): RevisionItem[] {
  const candidateKeys = [
    ['checkbox', 'done', 'completed', 'status'],
    ['subject', 'subj'],
    ['module', 'mod'],
    ['topic', 'topictitle', 'topicname', 'name'],
    ['1strevisiondate', 'revision1date', '1strevision', 'revision1', 'rev1', 'rev1date'],
    ['2ndrevisiondate', 'revision2date', '2ndrevision', 'revision2', 'rev2', 'rev2date'],
    ['3rdrevisiondate', 'revision3date', '3rdrevision', 'revision3', 'rev3', 'rev3date'],
    ['remarks', 'notes', 'comment']
  ];

  const seenMap = new Map<string, RevisionItem>();

  rows.forEach((r, i) => {
    const subject = String(getRowValue(r, candidateKeys[1]) || 'General').trim();
    const module = String(getRowValue(r, candidateKeys[2]) || 'Module 1').trim();
    const topic = String(getRowValue(r, candidateKeys[3]) || `Topic ${i + 1}`).trim();
    const key = `${subject.toLowerCase()}:::${module.toLowerCase()}:::${topic.toLowerCase()}`;

    const r1 = toDateString(getRowValue(r, candidateKeys[4]));
    const r2 = toDateString(getRowValue(r, candidateKeys[5]));
    const r3 = toDateString(getRowValue(r, candidateKeys[6]));

    const item: RevisionItem = {
      id: `rev_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      subject,
      module,
      topic,
      revision1Date: r1,
      revision2Date: r2,
      revision3Date: r3,
      completed: toBoolean(getRowValue(r, candidateKeys[0])) || Boolean(r3),
      remarks: String(getRowValue(r, candidateKeys[7]) || '').trim(),
      _customFields: collectCustomFields(r, candidateKeys)
    };

    if (!seenMap.has(key)) {
      seenMap.set(key, item);
    } else {
      const existing = seenMap.get(key)!;
      if (r1 && !existing.revision1Date) existing.revision1Date = r1;
      if (r2 && !existing.revision2Date) existing.revision2Date = r2;
      if (r3 && !existing.revision3Date) existing.revision3Date = r3;
      if (item.completed) existing.completed = true;
    }
  });

  return Array.from(seenMap.values());
}

// Map raw rows to WeeklyQuizItem[]
export function mapToWeeklyQuiz(rows: Record<string, any>[]): WeeklyQuizItem[] {
  const candidateKeys = [
    ['complete', 'done', 'completed', 'status', 'finished', 'checkbox'], // 0
    ['quizname', 'quiz', 'testname', 'name', 'quiztitle', 'title'], // 1
    ['topiccovered', 'topics', 'topic', 'syllabus', 'chapter', 'module'], // 2
    ['quizlink', 'link', 'url', 'quizurl', 'start', 'testlink'], // 3
    ['testdate', 'date', 'quizdate', 'attemptdate'], // 4
    ['totalquestion', 'totalquestions', 'totalq', 'totalques', 'questions', 'numquestions'], // 5
    ['correct', 'correctquestions', 'correctanswers', 'correctq', 'right', 'rightanswers'], // 6
    ['wrong', 'wrongquestions', 'incorrect', 'incorrectquestions', 'wronganswers', 'negative'], // 7
    ['skipped', 'skippedquestions', 'unattempted', 'unattemptedquestions', 'notattempted', 'blank'], // 8
    ['fullmarks', 'totalmarks', 'maxmarks', 'maximummarks'], // 9
    ['netmarks', 'marksobtained', 'marks', 'score', 'netscore'], // 10
    ['accuracy', 'accuracy%', 'acc', 'acc%'], // 11
    ['timetaken', 'time', 'duration', 'timespent'], // 12
    ['remarks', 'remark', 'notes', 'comment', 'comments'], // 13
    ['weakareas', 'weakarea', 'weakness', 'weaknesses', 'topicsforreview'], // 14
    ['mistakepattern', 'mistake', 'mistaketype', 'pattern', 'errorpattern'], // 15
    ['subject', 'subj'] // 16
  ];

  const KNOWN_GATE_SUBJECTS = [
    'discrete mathematics', 'algorithms', 'data structures', 'operating systems',
    'dbms', 'database management', 'computer networks', 'theory of computation',
    'compiler design', 'coa', 'computer organization', 'engineering mathematics',
    'general aptitude', 'digital logic'
  ];

  return rows.map((r, i) => {
    let complete = getRowValue(r, candidateKeys[0]) !== undefined
      ? toBoolean(getRowValue(r, candidateKeys[0]))
      : false;
    let quizName = toOptionalString(getRowValue(r, candidateKeys[1]));
    let topicCovered = toOptionalString(getRowValue(r, candidateKeys[2]));
    let quizLink = getRowValue(r, candidateKeys[3]);
    let testDate = toDateString(getRowValue(r, candidateKeys[4]));
    let subject = toOptionalString(getRowValue(r, candidateKeys[16]));

    // Intelligent GO Classes fallback if row was pasted without standard column headers
    const rowValues = Object.values(r).map(v => typeof v === 'object' && v?.text ? v.text : String(v || '').trim());
    if (!quizName) {
      const qVal = rowValues.find(v => /quiz\s*\d+|weekly\s*quiz/i.test(v));
      if (qVal) quizName = qVal;
    }
    if (!quizLink) {
      const lVal = rowValues.find(v => typeof v === 'string' && (/^https?:\/\//i.test(v) || /^start$/i.test(v)));
      if (lVal) quizLink = lVal;
    }
    if (!subject) {
      const sVal = rowValues.find(v => KNOWN_GATE_SUBJECTS.some(sub => v.toLowerCase().includes(sub)));
      if (sVal) subject = sVal;
    }
    if (!topicCovered && rowValues.length >= 3) {
      const tVal = rowValues.find(v => 
        v && v !== quizName && v !== subject && v !== quizLink &&
        !v.toLowerCase().includes('go classes') && !/^start$/i.test(v)
      );
      if (tVal) topicCovered = tVal;
    }

    if (!quizName) {
      quizName = `Weekly Quiz ${i + 1}`;
    }

    const totalQuestions = toOptionalNumber(getRowValue(r, candidateKeys[5]));
    const correct = toOptionalNumber(getRowValue(r, candidateKeys[6]));
    const wrong = toOptionalNumber(getRowValue(r, candidateKeys[7]));
    const skipped = toOptionalNumber(getRowValue(r, candidateKeys[8]));
    const fullMarks = toOptionalNumber(getRowValue(r, candidateKeys[9]));
    const netMarks = toOptionalNumber(getRowValue(r, candidateKeys[10]));
    let accuracy = toOptionalNumber(getRowValue(r, candidateKeys[11]));

    if (accuracy === undefined && correct !== undefined && (correct + (wrong || 0)) > 0) {
      accuracy = Math.round((correct / (correct + (wrong || 0))) * 100);
    }

    const timeTaken = toOptionalString(getRowValue(r, candidateKeys[12])) || '';
    const remarks = toOptionalString(getRowValue(r, candidateKeys[13])) || '';
    const weakAreas = toOptionalString(getRowValue(r, candidateKeys[14])) || '';
    const mistakePattern = toOptionalString(getRowValue(r, candidateKeys[15]));

    return {
      id: `quiz_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      complete,
      quizName,
      subject,
      topicCovered,
      quizLink,
      testDate: testDate || undefined,
      totalQuestions,
      correct,
      wrong,
      skipped,
      fullMarks,
      netMarks,
      accuracy,
      timeTaken,
      remarks,
      weakAreas,
      mistakePattern,
      _customFields: collectCustomFields(r, candidateKeys)
    };
  });
}

// Map raw rows to TestItem[]
export function mapToTestTracker(rows: Record<string, any>[]): TestItem[] {
  const candidateKeys = [
    ['complete', 'done', 'completed', 'status', 'finished', 'checkbox'], // 0
    ['testtype', 'type', 'category'], // 1
    ['testname', 'name', 'title', 'test'], // 2
    ['testlink', 'link', 'url', 'testurl', 'start'], // 3
    ['subject', 'subj'], // 4
    ['testdate', 'date', 'attemptdate'], // 5
    ['fullmarks', 'totalmarks', 'maxmarks', 'maximummarks'], // 6
    ['marks', 'netmarks', 'marksobtained', 'score', 'netscore'], // 7
    ['correct', 'correctquestions', 'correctanswers', 'correctq', 'right'], // 8
    ['wrong', 'wrongquestions', 'incorrect', 'incorrectquestions', 'negative'], // 9
    ['blank', 'skipped', 'skippedquestions', 'unattempted', 'unattemptedquestions', 'notattempted'], // 10
    ['accuracy', 'accuracy%', 'acc', 'acc%'], // 11
    ['timetaken', 'time', 'duration', 'timespent'], // 12
    ['remarks', 'remark', 'notes', 'comment', 'comments'], // 13
    ['weakareas', 'weakarea', 'weakness', 'weaknesses'], // 14
    ['mistakepattern', 'mistake', 'mistaketype', 'errorpattern'], // 15
    ['topicmodule', 'module', 'topic', 'topics', 'syllabus'], // 16
    ['source', 'testseries', 'platform'], // 17
    ['totalquestions', 'totalquestion', 'questions', 'totalq'] // 18
  ];

  return rows.map((r, i) => {
    const complete = getRowValue(r, candidateKeys[0]) !== undefined
      ? toBoolean(getRowValue(r, candidateKeys[0]))
      : false;
    const testType = toOptionalString(getRowValue(r, candidateKeys[1])) || 'Topic Test';
    const testName = toOptionalString(getRowValue(r, candidateKeys[2])) || `Test ${i + 1}`;
    const testLink = getRowValue(r, candidateKeys[3]);
    const subject = toOptionalString(getRowValue(r, candidateKeys[4]));
    const testDate = toDateString(getRowValue(r, candidateKeys[5]));
    const fullMarks = toOptionalNumber(getRowValue(r, candidateKeys[6]));
    const marksObtained = toOptionalNumber(getRowValue(r, candidateKeys[7]));
    const correct = toOptionalNumber(getRowValue(r, candidateKeys[8]));
    const wrong = toOptionalNumber(getRowValue(r, candidateKeys[9]));
    const skipped = toOptionalNumber(getRowValue(r, candidateKeys[10]));
    let accuracy = toOptionalNumber(getRowValue(r, candidateKeys[11]));

    if (accuracy === undefined && correct !== undefined && (correct + (wrong || 0)) > 0) {
      accuracy = Math.round((correct / (correct + (wrong || 0))) * 100);
    }

    const timeTaken = toOptionalString(getRowValue(r, candidateKeys[12])) || '';
    const remarks = toOptionalString(getRowValue(r, candidateKeys[13])) || '';
    const weakArea = toOptionalString(getRowValue(r, candidateKeys[14])) || '';
    const mistakePattern = toOptionalString(getRowValue(r, candidateKeys[15]));
    const topicModule = toOptionalString(getRowValue(r, candidateKeys[16]));
    const source = toOptionalString(getRowValue(r, candidateKeys[17])) || 'Test Series';
    const totalQuestions = toOptionalNumber(getRowValue(r, candidateKeys[18]));

    return {
      id: `test_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      completed: complete,
      testType,
      testName,
      testLink,
      subject,
      topicModule,
      testDate: testDate || undefined,
      fullMarks,
      marksObtained,
      netMarks: marksObtained,
      correct,
      wrong,
      skipped,
      totalQuestions,
      accuracy,
      timeTaken,
      remarks,
      weakArea,
      weakAreas: weakArea,
      mistakePattern,
      source,
      _customFields: collectCustomFields(r, candidateKeys)
    };
  });
}

// Map raw rows to PlanningItem[]
export function mapToPlanning(rows: Record<string, any>[]): PlanningItem[] {
  const candidateKeys = [
    ['date', 'plandate', 'targetdate'],
    ['task', 'tasktitle', 'title', 'description'],
    ['subject', 'subj'],
    ['module', 'mod'],
    ['type', 'tasktype'],
    ['priority', 'prio'],
    ['target', 'goal'],
    ['completed', 'done', 'status'],
    ['remarks', 'notes', 'comment']
  ];

  return rows.map((r, i) => {
    return {
      id: `plan_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
      date: toDateString(getRowValue(r, candidateKeys[0])) || new Date().toISOString().split('T')[0],
      task: String(getRowValue(r, candidateKeys[1]) || `Task ${i + 1}`).trim(),
      subject: String(getRowValue(r, candidateKeys[2]) || '').trim() || undefined,
      module: String(getRowValue(r, candidateKeys[3]) || '').trim() || undefined,
      type: String(getRowValue(r, candidateKeys[4]) || 'Other').trim(),
      priority: (getRowValue(r, candidateKeys[5]) || 'Medium'),
      target: String(getRowValue(r, candidateKeys[6]) || '').trim(),
      completed: toBoolean(getRowValue(r, candidateKeys[7])),
      remarks: String(getRowValue(r, candidateKeys[8]) || '').trim(),
      _customFields: collectCustomFields(r, candidateKeys)
    };
  });
}

// Parse pasted data from Excel/Google Sheets/GO Classes
export function parsePastedSpreadsheet(text: string): {
  headers: string[];
  rows: Record<string, string>[];
  detectedSeparator: 'tab' | 'comma' | 'pipe';
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { headers: [], rows: [], detectedSeparator: 'tab' };
  }

  const lines = trimmed.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) {
    return { headers: [], rows: [], detectedSeparator: 'tab' };
  }

  // Detect delimiter
  const firstLine = lines[0];
  let sep = '\t';
  let detectedSeparator: 'tab' | 'comma' | 'pipe' = 'tab';
  if (firstLine.includes('\t')) {
    sep = '\t';
    detectedSeparator = 'tab';
  } else if (firstLine.includes(',') && !firstLine.includes('|')) {
    sep = ',';
    detectedSeparator = 'comma';
  } else if (firstLine.includes('|')) {
    sep = '|';
    detectedSeparator = 'pipe';
  }

  // Parse lines
  const rawMatrix = lines.map(line => {
    if (sep === ',') {
      // Basic CSV split
      return line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
    }
    return line.split(sep).map(c => c.trim());
  });

  // Check if first line looks like header or data
  const firstRowCols = rawMatrix[0];

  const isHeaderCellCandidate = (cell: string): boolean => {
    const c = cell.trim().toLowerCase();
    if (!c) return false;
    // Values that clearly indicate data rows, NOT headers:
    // Pure numbers: "01", "1", "2"
    if (/^\d+(?:\.\d+)?$/.test(c)) return false;
    // Duration strings: "120 min", "1h 15m"
    if (/^\d+\s*(?:min|mins|minutes|m|h|hr|hrs|hours|s|sec)$/i.test(c)) return false;
    // Booleans or markers
    if (/^(?:true|false|yes|no|—|-)$/i.test(c)) return false;
    // Dates
    if (/^\d{4}[-/]\d{2}/.test(c)) return false;
    // Lecture data names with digits at end, e.g. "Lecture 1", "Class 2", "Quiz 1", "Test 5"
    if (/^(?:lecture|class|quiz|test|module|chapter|session|part)\s*[-_#]?\s*\d+$/i.test(c)) return false;

    // Canonical header patterns
    const headerPatterns = [
      /^(?:subject|subj|course|gate\s*subject|full\s*subject\s*name)$/i,
      /^(?:lecture\s*no\.?|lec\s*no\.?|sr\s*no\.?|s\.?no\.?|#|no\.?|code|lec\s*code|lecture\s*code|lecture\s*#|class\s*#)$/i,
      /^(?:module|mod|chapter|unit|section)$/i,
      /^(?:lecture\s*title|lecture\s*name|title|topic|class\s*name)$/i,
      /^(?:type|class|mode|lectype)$/i,
      /^(?:duration|time|length|minutes|mins)$/i,
      /^(?:notes|notes\s*done|notes\s*checkbox|pdf|slides?)$/i,
      /^(?:done|completed|status|watch\s*status)$/i,
      /^(?:done\s*date|completed\s*date|date|watch\s*date)$/i,
      /^(?:remarks|comments?|notes\s*text|desc|description)$/i,
      /^(?:link|url|video|video\s*link|lecture\s*link)$/i,
      /^(?:quiz\s*name|test\s*name|test\s*type|quiz\s*link|test\s*link)$/i,
      /^(?:total\s*questions|correct|wrong|incorrect|blank|unattempted|skipped)$/i,
      /^(?:full\s*marks|total\s*marks|net\s*marks|marks|score|accuracy|accuracy\s*%)$/i,
      /^(?:total\s*pyqs?|solved|remaining|target\s*date)$/i,
      /^(?:study\s*hours|lecture\s*hours|pyq\s*hours|revision\s*hours)$/i
    ];

    return headerPatterns.some(pat => pat.test(c));
  };

  const matchingHeaderCount = firstRowCols.filter(isHeaderCellCandidate).length;
  const hasObviousDataCell = firstRowCols.some(c => {
    const trimmedVal = c.trim();
    return (
      /^\d+$/.test(trimmedVal) ||
      /^\d+\s*(?:min|mins|minutes|m|h|hrs|hours)$/i.test(trimmedVal) ||
      /^(?:lecture|class|quiz|test)\s*[-_#]?\s*\d+$/i.test(trimmedVal)
    );
  });

  const isHeaderRow =
    !hasObviousDataCell &&
    matchingHeaderCount >= (firstRowCols.length === 1 ? 1 : 2) &&
    rawMatrix.length > 1;

  let headers: string[] = [];
  let dataRows: string[][] = [];

  if (isHeaderRow) {
    headers = firstRowCols.map((h, i) => h || `Column ${i + 1}`);
    dataRows = rawMatrix.slice(1);
  } else {
    // Generate headers
    headers = firstRowCols.map((_, i) => `Column ${i + 1}`);
    dataRows = rawMatrix;
  }

  const rows: Record<string, string>[] = dataRows.map(rowCols => {
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = rowCols[idx] !== undefined ? rowCols[idx] : '';
    });
    return rowObj;
  });

  return { headers, rows, detectedSeparator };
}

// Export single table or all to Excel / CSV
export function exportTableToSpreadsheet(data: any[], fileName: string, format: 'xlsx' | 'csv' = 'xlsx') {
  if (data.length === 0) {
    alert('No data to export.');
    return;
  }

  // Format link fields and remove internal id / _customFields if needed or flatten them
  const cleanedData = data.map(item => {
    const row: Record<string, any> = {};
    for (const [k, v] of Object.entries(item)) {
      if (k === 'id') continue;
      if (k === '_customFields' && v && typeof v === 'object') {
        for (const [ck, cv] of Object.entries(v)) {
          row[ck] = typeof cv === 'object' && cv && (cv as any).url ? (cv as any).url : cv;
        }
        continue;
      }
      if (v && typeof v === 'object' && (v as any).url) {
        row[k] = (v as any).url;
      } else {
        row[k] = v;
      }
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(cleanedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

  if (format === 'csv') {
    XLSX.writeFile(workbook, `${fileName}.csv`, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, `${fileName}.xlsx`, { bookType: 'xlsx' });
  }
}

// Export complete state to multi-sheet Excel workbook
export function exportEntireDatabaseToWorkbook(state: AppDatabaseState, fileName = 'GATE_2027_Preparation_Workbook') {
  const wb = XLSX.utils.book_new();

  // Helper to add sheet
  const addSheet = (data: any[], name: string) => {
    if (data && data.length > 0) {
      const flattened = data.map(item => {
        const row: Record<string, any> = {};
        for (const [k, v] of Object.entries(item)) {
          if (k === 'id') continue;
          if (k === '_customFields' && v && typeof v === 'object') {
            for (const [ck, cv] of Object.entries(v)) {
              row[ck] = typeof cv === 'object' && cv && (cv as any).url ? (cv as any).url : cv;
            }
            continue;
          }
          if (v && typeof v === 'object' && (v as any).url) {
            row[k] = (v as any).url;
          } else {
            row[k] = v;
          }
        }
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(flattened);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // Sheet name max 31 chars
    }
  };

  addSheet(state.dailyProgress, 'Daily Progress');
  addSheet(state.topicMaster, 'Topic Master');
  addSheet(state.lectureTracker, 'Lecture Tracker');
  addSheet(state.pyqTracker, 'PYQ Tracker');
  addSheet(state.revisionTracker, 'Revision Tracker');
  addSheet(state.weeklyQuiz, 'Weekly Quiz Tracker');
  addSheet(state.testTracker, 'Test Series Tracker');
  addSheet(state.planning, 'Planning');

  // Add custom sheets if any
  state.customSheets.forEach(cs => {
    addSheet(cs.rows, cs.name);
  });

  XLSX.writeFile(wb, `${fileName}.xlsx`, { bookType: 'xlsx' });
}

// Generate the sample reference workbook matching user's exact specification
export function generateSampleGateWorkbook(): void {
  const wb = XLSX.utils.book_new();

  // 1. Daily Progress
  const dailyData = [
    {
      'Date': '2026-09-20',
      'Study Hours': 6.5,
      'Lecture Hours': 3.0,
      'PYQ Hours': 2.0,
      'Revision Hours': 1.0,
      'Test/Quiz Hours': 0.5,
      'Other Study': 0.0,
      'Total Study Hours': 6.5,
      'Remarks': 'Completed Discrete Mathematics Graph Theory & PYQs'
    },
    {
      'Date': '2026-09-21',
      'Study Hours': 7.0,
      'Lecture Hours': 3.5,
      'PYQ Hours': 2.0,
      'Revision Hours': 1.0,
      'Test/Quiz Hours': 0.5,
      'Other Study': 0.0,
      'Total Study Hours': 7.0,
      'Remarks': 'Tree Traversals & DBMS SQL Queries'
    },
    {
      'Date': '2026-09-22',
      'Study Hours': 5.5,
      'Lecture Hours': 2.5,
      'PYQ Hours': 2.0,
      'Revision Hours': 1.0,
      'Test/Quiz Hours': 0.0,
      'Other Study': 0.0,
      'Total Study Hours': 5.5,
      'Remarks': 'OS CPU Scheduling algorithms'
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailyData), 'Daily Progress');

  // 2. Topic Master
  const topicData = [
    {
      'Subject': 'Discrete Mathematics',
      'Module': 'Mathematical Logic',
      'Topic': 'Propositional and First-Order Logic',
      'Priority': 'High',
      'GATE Year': '2015-2026',
      'Resource': 'GO Classes',
      'Notes': 'Crucial base topic, always 1-2 questions'
    },
    {
      'Subject': 'Discrete Mathematics',
      'Module': 'Combinatorics & Graph Theory',
      'Topic': 'Graph Connectivity and Planarity',
      'Priority': 'High',
      'GATE Year': '2018-2026',
      'Resource': 'Standard Books & GO Classes',
      'Notes': 'Eulerian, Hamiltonian, Planar graphs'
    },
    {
      'Subject': 'DBMS',
      'Module': 'Transactions & Concurrency',
      'Topic': 'Conflict Serializability & 2PL',
      'Priority': 'High',
      'GATE Year': '2016-2026',
      'Resource': 'GO Classes',
      'Notes': 'High weightage numericals'
    },
    {
      'Subject': 'Operating Systems',
      'Module': 'Process Management',
      'Topic': 'CPU Scheduling & Synchronization (Semaphores)',
      'Priority': 'High',
      'GATE Year': '2017-2026',
      'Resource': 'GO Classes',
      'Notes': 'Classical IPC problems'
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topicData), 'Topic Master');

  // 3. Lecture Tracker (Exact user columns)
  const lectureData = [
    {
      'Lecture No.': 1,
      'Module': 'Propositional Logic',
      'Lecture Title': 'Introduction to Propositions and Truth Values',
      'Type': 'Theory',
      'Duration': '1h 15m',
      'Notes': 'Done',
      'Done': 'Done',
      'Done Date': '2026-09-10',
      'Remarks': 'Crystal clear fundamentals'
    },
    {
      'Lecture No.': 2,
      'Module': 'Propositional Logic',
      'Lecture Title': 'Logical Connectives, Equivalence & Tautology',
      'Type': 'Theory + Problems',
      'Duration': '1h 30m',
      'Notes': 'Done',
      'Done': 'Done',
      'Done Date': '2026-09-11',
      'Remarks': 'Remember De Morgan laws and absorption laws'
    },
    {
      'Lecture No.': 3,
      'Module': 'Propositional Logic',
      'Lecture Title': 'First Order Predicate Logic & Quantifiers',
      'Type': 'Theory',
      'Duration': '1h 45m',
      'Notes': 'Done',
      'Done': 'Done',
      'Done Date': '2026-09-12',
      'Remarks': 'Practice quantifier negation examples'
    },
    {
      'Lecture No.': 4,
      'Module': 'Graph Theory',
      'Lecture Title': 'Graph Representation & Degree Sum Formula',
      'Type': 'Theory',
      'Duration': '1h 20m',
      'Notes': 'Pending',
      'Done': 'In Progress',
      'Done Date': '',
      'Remarks': 'Half video watched'
    },
    {
      'Lecture No.': 5,
      'Module': 'Graph Theory',
      'Lecture Title': 'Eulerian and Hamiltonian Graphs',
      'Type': 'Problems',
      'Duration': '1h 50m',
      'Notes': '',
      'Done': 'Not Started',
      'Done Date': '',
      'Remarks': ''
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lectureData), 'Lecture Tracker');

  // 4. PYQ Tracker (Exact user columns)
  const pyqData = [
    {
      'Checkbox': 'Done',
      'Subject': 'Discrete Mathematics',
      'Module': 'Propositional Logic',
      'Topic': 'Propositional Equivalences & Truth Tables',
      'Total PYQs': 35,
      'Solved': 35,
      'Remaining': 0,
      'Remarks': 'All GATE 1990-2026 solved'
    },
    {
      'Checkbox': '',
      'Subject': 'Discrete Mathematics',
      'Module': 'Predicate Logic',
      'Topic': 'First Order Logic & Scope of Quantifiers',
      'Total PYQs': 40,
      'Solved': 28,
      'Remaining': 12,
      'Remarks': 'Remaining 12 are multi-variable quantifiers'
    },
    {
      'Checkbox': '',
      'Subject': 'Discrete Mathematics',
      'Module': 'Graph Theory',
      'Topic': 'Graph Isomorphism & Planar Graphs',
      'Total PYQs': 50,
      'Solved': 22,
      'Remaining': 28,
      'Remarks': 'In progress'
    },
    {
      'Checkbox': '',
      'Subject': 'DBMS',
      'Module': 'Transactions',
      'Topic': 'Conflict Serializability & View Serializability',
      'Total PYQs': 45,
      'Solved': 30,
      'Remaining': 15,
      'Remarks': 'Precedence graph problems done'
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pyqData), 'PYQ Tracker');

  // 5. Revision Tracker (Subject | Module | Topic | 1st Revision Date | 2nd Revision Date | 3rd Revision Date)
  const revisionData = [
    {
      'Subject': 'Discrete Mathematics',
      'Module': 'Mathematical Logic',
      'Topic': 'Propositional Equivalences & Rules of Inference',
      '1st Revision Date': '2026-09-14',
      '2nd Revision Date': '2026-09-22',
      '3rd Revision Date': '',
      'Remarks': 'Formulas memorized'
    },
    {
      'Subject': 'Discrete Mathematics',
      'Module': 'Combinatorics & Graph Theory',
      'Topic': 'Graph Connectivity and Planarity',
      '1st Revision Date': '2026-09-25',
      '2nd Revision Date': '',
      '3rd Revision Date': '',
      'Remarks': 'Need to re-check Kuratowski theorem'
    },
    {
      'Subject': 'DBMS',
      'Module': 'Transactions & Concurrency',
      'Topic': 'Conflict Serializability & 2PL',
      '1st Revision Date': '2026-09-18',
      '2nd Revision Date': '',
      '3rd Revision Date': '',
      'Remarks': 'Review Thomas Write Rule'
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revisionData), 'Revision Tracker');

  // 6. Weekly Quiz Tracker (Exact user columns)
  const quizData = [
    {
      'Complete': 'Complete',
      'Quiz Name': 'GO Classes GATE CS/DA | DM | Propositional Logic | Weekly Quiz 1',
      'Topic Covered': 'Propositional Logic & Tautologies',
      'Quiz Link': 'https://goclasses.in/quiz/1',
      'Test Date': '2026-09-15',
      'Total Question': 15,
      'Correct': 13,
      'Wrong': 2,
      'Skipped': 0,
      'Full Marks': 30,
      'Net Marks': 24.67,
      'Accuracy %': 87,
      'Time Taken': '42 mins',
      'Remarks': 'Great speed',
      'Weak Areas': 'Negation of conditional statements'
    },
    {
      'Complete': 'Complete',
      'Quiz Name': 'GO Classes GATE CS/DA | DM | Predicate Logic | Weekly Quiz 2',
      'Topic Covered': 'First Order Predicate Logic',
      'Quiz Link': 'https://goclasses.in/quiz/2',
      'Test Date': '2026-09-23',
      'Total Question': 15,
      'Correct': 12,
      'Wrong': 1,
      'Skipped': 2,
      'Full Marks': 30,
      'Net Marks': 23.33,
      'Accuracy %': 92,
      'Time Taken': '45 mins',
      'Remarks': 'Skipped 2 tricky questions intentionally',
      'Weak Areas': 'Nested quantifier domain boundaries'
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(quizData), 'Weekly Quiz Tracker');

  // 7. Test Series Tracker
  const testData = [
    {
      'Checkbox': 'Done',
      'Test Type': 'Topic Test',
      'Test Name': 'DM - Mathematical Logic Topic Test 1',
      'Subject': 'Discrete Mathematics',
      'Topic/Module': 'Propositional & Predicate Logic',
      'Test Link': 'https://testseries.gate/dm1',
      'Test Date': '2026-09-17',
      'Total Questions': 20,
      'Attempted': 18,
      'Correct': 15,
      'Wrong': 3,
      'Skipped': 2,
      'Full Marks': 33,
      'Marks Obtained': 24.0,
      'Accuracy %': 83,
      'Time Taken': '45 mins',
      'Confidence': 4,
      'Difficulty': 'Medium',
      'Weak Area': 'Quantifier Equivalence',
      'Mistake Pattern': 'Silly Mistake',
      'Revision Scheduled': '2026-09-24',
      'Revision Completed': 'Yes',
      'Remarks': 'Calculated correctly, marked wrong option',
      'Source': 'GO Classes'
    },
    {
      'Checkbox': 'Done',
      'Test Type': 'Subject Test',
      'Test Name': 'DBMS - Full Subject Test 1',
      'Subject': 'DBMS',
      'Topic/Module': 'Full Subject',
      'Test Link': 'https://testseries.gate/dbms1',
      'Test Date': '2026-09-25',
      'Total Questions': 33,
      'Attempted': 30,
      'Correct': 24,
      'Wrong': 6,
      'Skipped': 3,
      'Full Marks': 50,
      'Marks Obtained': 36.67,
      'Accuracy %': 80,
      'Time Taken': '90 mins',
      'Confidence': 4,
      'Difficulty': 'Hard',
      'Weak Area': 'B+ Tree splitting numerical',
      'Mistake Pattern': 'Calculation',
      'Revision Scheduled': '2026-10-02',
      'Revision Completed': 'No',
      'Remarks': 'Need fast arithmetic for indexing calculations',
      'Source': 'Test Series'
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(testData), 'Test Series Tracker');

  // 8. Planning
  const planData = [
    {
      'Date': '2026-09-27',
      'Task': 'Complete Graph Theory Planar Graphs Lectures 6 & 7',
      'Subject': 'Discrete Mathematics',
      'Module': 'Graph Theory',
      'Type': 'Lecture',
      'Priority': 'High',
      'Target': '2 Lectures + Notes',
      'Completed': 'No',
      'Remarks': 'Target before 5 PM'
    },
    {
      'Date': '2026-09-27',
      'Task': 'Solve 15 PYQs of Planarity and Euler formula',
      'Subject': 'Discrete Mathematics',
      'Module': 'Graph Theory',
      'Type': 'PYQ',
      'Priority': 'High',
      'Target': '15 PYQs',
      'Completed': 'No',
      'Remarks': ''
    },
    {
      'Date': '2026-09-28',
      'Task': 'Weekly Quiz 3 on Graph Theory',
      'Subject': 'Discrete Mathematics',
      'Module': 'Graph Theory',
      'Type': 'Quiz',
      'Priority': 'High',
      'Target': 'Attempt & Analysis',
      'Completed': 'No',
      'Remarks': 'Timed environment'
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planData), 'Planning');

  // 9. Lookup Tables (Unrecognized/Custom sheet - proves custom sheet support!)
  const lookupData = [
    { 'Subject Code': 'DM', 'Full Subject Name': 'Discrete Mathematics', 'Weightage': '8-10%', 'Target Marks': '8+' },
    { 'Subject Code': 'DBMS', 'Full Subject Name': 'Database Management Systems', 'Weightage': '7-9%', 'Target Marks': '7+' },
    { 'Subject Code': 'OS', 'Full Subject Name': 'Operating Systems', 'Weightage': '8-10%', 'Target Marks': '8+' },
    { 'Subject Code': 'COA', 'Full Subject Name': 'Computer Organization & Architecture', 'Weightage': '7-9%', 'Target Marks': '7+' }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lookupData), 'Lookup Tables');

  XLSX.writeFile(wb, 'GATE 2027 Preparation Management System(1).xlsx', { bookType: 'xlsx' });
}
