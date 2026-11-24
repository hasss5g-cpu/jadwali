export type ID = string;

export interface Subject {
  id: ID;
  name: string;
  color: number;
}

export interface Teacher {
  id: ID;
  name: string;
  subject: ID;
  additionalSubjects: ID[];
  max: number;
  off: number[];
  /** SHA-256 of the teacher's lookup code (national id / staff code). Never the raw code. */
  codeHash?: string;
}

export interface SchoolClass {
  id: ID;
  name: string;
  room: string;
}

export interface Assignment {
  id: ID;
  classId: ID;
  subjectId: ID;
  teacherId: ID;
  count: number;
}

export interface Lesson {
  id: ID;
  assignmentId: ID;
  day: number;
  period: number;
}

export interface Absence {
  date: string;
  teacherId: ID;
}

export interface Cover {
  id: ID;
  date: string;
  lessonId: ID;
  teacherId: ID;
}

export interface ExamSlot {
  classId: ID;
  subjectId: ID;
  day: number;
  period: number;
}

export interface ExamPlan {
  periodic: ExamSlot[];
  official: ExamSlot[];
}

export interface GenerationOptions {
  /** حصص مفرقة: يوزّع حصص المعلم على أيام الأسبوع بدل تراكمها */
  spread: boolean;
  /** حصص متراصة: عكس التفريق */
  compact: boolean;
  /** حصتا التربية الفنية متجاورتان لنفس الفصل */
  artPairs: boolean;
  /** سقف الحصص المتتالية للمعلم (0 = بلا سقف) */
  maxRun: number;
  /** يفضّل أن ينتهي يوم المعلم مبكرًا */
  goldenDay: boolean;
  /** يوازن حصص الحصة الأخيرة بين المعلمين */
  balanceSeventh: boolean;
  /** يجعل كل معلم يعمل في كل أيام الأسبوع بلا يوم خالٍ */
  allDays: boolean;
  /** أقصى عدد فصول في حصة التربية البدنية الواحدة */
  peCapacity: number;
  /** يمنع اجتماع الثالث المتوسط مع الأول والثاني في حصة البدنية */
  peSeparateGrade3: boolean;
  /** يسمح بتجاوز نصاب المعلم عند الضرورة، مع تقرير */
  relaxLoad: boolean;
}

export const DEFAULT_OPTIONS: GenerationOptions = {
  spread: true,
  compact: false,
  artPairs: true,
  maxRun: 3,
  goldenDay: true,
  balanceSeventh: true,
  allDays: true,
  peCapacity: 3,
  peSeparateGrade3: true,
  relaxLoad: true,
};

export interface SchoolData {
  school: string;
  term: string;
  periods: number;
  days: number;
  start: string;
  duration: number;
  subjects: Subject[];
  teachers: Teacher[];
  classes: SchoolClass[];
  assignments: Assignment[];
  lessons: Lesson[];
  absences: Absence[];
  covers: Cover[];
  exams: ExamPlan;
  options: GenerationOptions;
  /** مفتاح توليد روابط المشاركة */
  shareToken?: string;
  source?: string;
}

export interface TeacherReport {
  id: ID;
  name: string;
  lessons: number;
  quota: number;
  overflow: number;
  holes: number;
  longRuns: number;
  maxRun: number;
  activeDays: number;
  /** أيام الأسبوع التي ليس للمعلم فيها حصة */
  missingDays: number;
  seventh: number;
  goldenDays: number;
}

export interface SolveReport {
  total: number;
  placed: number;
  conflicts: number;
  artPairs: number;
  artPairsIntact: number;
  dailyRepeats: number;
  holes: number;
  longRuns: number;
  seventh: number;
  /** عدد أيام المعلمين الخالية (المعلم موجود ولا حصة له في يوم) */
  missingDays: number;
  score: number;
  seed: number;
  ms: number;
  iterations: number;
  teachers: TeacherReport[];
  /** ملاحظات التوليد: نصاب مرتفع، أيام راحة متعذرة، إسنادات مهملة… */
  notes: string[];
}

export interface SolveResult {
  ok: boolean;
  lessons: Lesson[];
  report: SolveReport;
  error?: string;
}

export interface Violation {
  kind: 'teacher-clash' | 'class-clash' | 'room-clash' | 'pe-cap' | 'off-day' | 'out-of-range';
  message: string;
}
