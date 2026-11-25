import type {
  Assignment,
  BreakSettings,
  GradeBreak,
  ID,
  Lesson,
  SchoolClass,
  SchoolData,
  Season,
  Teacher,
  Violation,
} from '../types';
import { DEFAULT_OPTIONS } from '../types';
import { formatTime12 } from './time';

export const DEFAULT_BREAKS: BreakSettings = { first: 25, second: 25 };

/** الافتراضي: الأول والثاني بعد الحصة الثالثة، والثالث بعد الثانية. */
export const DEFAULT_GRADE_BREAK: GradeBreak = { 1: 3, 2: 3, 3: 2 };

export function seasonStart(season: Season): string {
  return season === 'winter' ? '07:30' : '07:00';
}

/** الفسحة الافتراضية للفصل حسب مرحلته. */
export function defaultBreakAfter(cls: SchoolClass): number {
  const grade = gradeOf(cls.name) ?? 1;
  return DEFAULT_GRADE_BREAK[grade];
}

/** مواضع الفسح لهذا الفصل (فسحة واحدة بعد الثانية أو الثالثة). */
export function classBreakPositions(data: SchoolData, cls: SchoolClass): number[] {
  const grade = gradeOf(cls.name);
  const after = (grade ? data.gradeBreak?.[grade] : undefined) ?? defaultBreakAfter(cls);
  return [after];
}

function breakDuration(data: SchoolData, position: number): number {
  const breaks = data.breaks ?? DEFAULT_BREAKS;
  return position === 2 ? breaks.first : breaks.second;
}

/** بداية كل حصة بالدقائق من بداية الدوام (0 = أول دقيقة). */
export function periodStartMinutes(data: SchoolData, cls: SchoolClass): number[] {
  const positions = classBreakPositions(data, cls);
  return Array.from({ length: data.periods }, (_, index) => {
    const period = index + 1;
    let offset = (period - 1) * data.duration;
    for (const position of positions) {
      if (position < period) offset += breakDuration(data, position);
    }
    return offset;
  });
}

/** أوقات الحصص لهذا الفصل بنظام 12 ساعة: «7:00 ص–7:45 ص». */
export function classPeriodTimes(data: SchoolData, cls: SchoolClass): string[] {
  const [h, m] = data.start.split(':').map(Number);
  const base = (h || 0) * 60 + (m || 0);
  return periodStartMinutes(data, cls).map((start) => {
    return `${formatTime12(base + start)}–${formatTime12(base + start + data.duration)}`;
  });
}

export interface Interval {
  start: number;
  end: number;
}

/** فترة الحصة الزمنية (بالدقائق من بداية الدوام). */
export function lessonInterval(data: SchoolData, cls: SchoolClass, period: number): Interval {
  const start = periodStartMinutes(data, cls)[period] ?? 0;
  return { start, end: start + data.duration };
}

/** هل تتقاطع حصتان من فصلين مختلفين زمنيًا بسبب اختلاف مواعيد الفسح؟ */
export function lessonsOverlap(
  data: SchoolData,
  classA: SchoolClass,
  periodA: number,
  classB: SchoolClass,
  periodB: number,
): boolean {
  const a = lessonInterval(data, classA, periodA);
  const b = lessonInterval(data, classB, periodB);
  return a.start < b.end && b.start < a.end;
}

export const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
export const DAY_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس'];

export function isPE(name: string): boolean {
  const clean = name.replace(/[\u064B-\u0652]/g, '');
  // «الرياضيات» ليست تربية بدنية، رغم اشتراك الجذر.
  return /(^|\s)(ال)?(تربية )?بدنية/.test(clean) || /بدني/.test(clean) || (/رياضة/.test(clean) && !/رياضيات/.test(clean));
}

export function isArt(name: string): boolean {
  const clean = name.replace(/[\u064B-\u0652]/g, '');
  return /فني|رسم/.test(clean);
}

/** صف الفصل من اسمه: 1 = الأول، 2 = الثاني، 3 = الثالث، null = غير معروف. */
export function gradeOf(className: string): 1 | 2 | 3 | null {
  if (/الثالث|ثالث/.test(className)) return 3;
  if (/الثاني|ثاني/.test(className)) return 2;
  if (/الأول|الاول|أول|اول/.test(className)) return 1;
  return null;
}

/** اختصار الفصل للرسائل: «الثالث متوسط / 1» ← «3 / 1» (الصف / الفصل). */
export function compactClassName(className: string): string {
  const grade = gradeOf(className);
  const number = className.match(/(\d+)\s*$/)?.[1];
  if (grade === null || !number) return className;
  return `${grade} / ${number}`;
}

export function assignmentOf(data: SchoolData, id: ID): Assignment | undefined {
  return data.assignments.find((a) => a.id === id);
}

export function teacherOf(data: SchoolData, id: ID): Teacher | undefined {
  return data.teachers.find((t) => t.id === id);
}

/** معلم الحصة الفعلي: التبديل اليدوي إن وجد، وإلا معلم الإسناد. */
export function lessonTeacherId(data: SchoolData, lesson: Lesson): ID {
  if (lesson.teacherId) return lesson.teacherId;
  return data.assignments.find((a) => a.id === lesson.assignmentId)?.teacherId ?? '';
}

export function subjectName(data: SchoolData, id: ID): string {
  return data.subjects.find((s) => s.id === id)?.name ?? '—';
}

export function className(data: SchoolData, id: ID): string {
  return data.classes.find((c) => c.id === id)?.name ?? '—';
}

export function teacherName(data: SchoolData, id: ID): string {
  return data.teachers.find((t) => t.id === id)?.name ?? '—';
}

/** اسم أي شخص قد يغطي حصة انتظار: معلم أو إداري. */
export function personName(data: SchoolData, id: ID): string {
  const teacher = data.teachers.find((t) => t.id === id);
  if (teacher) return teacher.name;
  return data.admins?.find((a) => a.id === id)?.name ?? '—';
}

export function subjectColor(data: SchoolData, id: ID): string {
  const color = data.subjects.find((s) => s.id === id)?.color ?? 0;
  const palette = [
    '#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c',
    '#16a34a', '#ca8a04', '#0d9488', '#4f46e5', '#be123c',
    '#65a30d', '#9333ea',
  ];
  return palette[color % palette.length];
}

export function slotKey(day: number, period: number): string {
  return `${day}:${period}`;
}

export interface TeacherMetric {
  id: ID;
  name: string;
  subject: string;
  lessons: number;
  quota: number;
  max: number;
  overflow: number;
  holes: number;
  longRuns: number;
  maxRun: number;
  activeDays: number;
  seventh: number;
  goldenDays: number;
}

/** مقاييس توزيع كل معلم: النصاب، الفراغات، التتابع، أيام العمل، الحصة السابعة. */
export function teacherMetrics(data: SchoolData): TeacherMetric[] {
  const quota = new Map<ID, number>();
  for (const a of data.assignments) quota.set(a.teacherId, (quota.get(a.teacherId) ?? 0) + a.count);

  const byTeacherDay = new Map<string, number[]>();
  const lessons = new Map<ID, number>();
  for (const lesson of data.lessons) {
    const teacher = lessonTeacherId(data, lesson);
    if (!teacher) continue;
    lessons.set(teacher, (lessons.get(teacher) ?? 0) + 1);
    const key = `${teacher}:${lesson.day}`;
    const list = byTeacherDay.get(key) ?? [];
    list.push(lesson.period);
    byTeacherDay.set(key, list);
  }

  const subjectNameOf = (id: ID) => data.subjects.find((s) => s.id === id)?.name ?? '';

  return data.teachers.map((teacher) => {
    let holes = 0;
    let longRuns = 0;
    let maxRun = 0;
    let activeDays = 0;
    let seventh = 0;
    let goldenDays = 0;
    for (let day = 0; day < data.days; day++) {
      const periods = (byTeacherDay.get(`${teacher.id}:${day}`) ?? []).sort((a, b) => a - b);
      if (!periods.length) continue;
      activeDays++;
      holes += periods[periods.length - 1] - periods[0] + 1 - periods.length;
      seventh += periods.filter((p) => p === data.periods - 1).length;
      if (periods[periods.length - 1] <= 2 && periods.length <= 3) goldenDays++;
      let run = 1;
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] === periods[i - 1] + 1) run++;
        else {
          maxRun = Math.max(maxRun, run);
          if (run > 3) longRuns++;
          run = 1;
        }
      }
      maxRun = Math.max(maxRun, run);
      if (run > 3) longRuns++;
    }
    const demand = quota.get(teacher.id) ?? 0;
    return {
      id: teacher.id,
      name: teacher.name,
      subject: subjectNameOf(teacher.subject),
      lessons: lessons.get(teacher.id) ?? 0,
      quota: demand,
      max: teacher.max,
      overflow: Math.max(0, demand - teacher.max),
      holes,
      longRuns,
      maxRun,
      activeDays,
      seventh,
      goldenDays,
    };
  });
}

/** يستكمل الحقول الناقصة في أي ملف بيانات (ملفات المدرسة القديمة مثلًا). */
export function normalizeData(input: SchoolData): SchoolData {
  const season: Season = input.season ?? 'summer';
  const breaks: BreakSettings = { ...DEFAULT_BREAKS, ...(input.breaks ?? {}) };
  const gradeBreak: GradeBreak = { ...DEFAULT_GRADE_BREAK, ...(input.gradeBreak ?? {}) };
  return {
    ...input,
    season,
    breaks,
    gradeBreak,
    start: seasonStart(season),
    days: input.days ?? 5,
    periods: input.periods ?? 7,
    subjects: input.subjects ?? [],
    teachers: input.teachers ?? [],
    classes: input.classes ?? [],
    assignments: input.assignments ?? [],
    lessons: input.lessons ?? [],
    absences: input.absences ?? [],
    covers: input.covers ?? [],
    admins: input.admins ?? [],
    exams: input.exams ?? { periodic: [], official: [] },
    options: { ...DEFAULT_OPTIONS, ...(input.options ?? {}) },
  };
}

/** كل قيود التعارض الصارمة في الجدول الحالي (تراعي اختلاف مواعيد الفسح). */
export function validate(data: SchoolData, lessons: Lesson[] = data.lessons): Violation[] {
  const out: Violation[] = [];
  const classSlots = new Set<string>();
  const peCapacity = Math.max(2, data.options?.peCapacity ?? 3);
  const separateGrade3 = data.options?.peSeparateGrade3 ?? true;
  const assignmentById = new Map(data.assignments.map((a) => [a.id, a]));
  const classById = new Map(data.classes.map((c) => [c.id, c]));
  const teacherById = new Map(data.teachers.map((t) => [t.id, t]));

  interface Entry {
    lesson: Lesson;
    assignment: Assignment;
    cls: SchoolClass;
    teacherId: ID;
    start: number;
    end: number;
    pe: boolean;
  }
  const entries: Entry[] = [];

  for (const lesson of lessons) {
    const assignment = assignmentById.get(lesson.assignmentId);
    if (!assignment) {
      out.push({ kind: 'out-of-range', message: `حصة بلا إسناد: ${lesson.id}` });
      continue;
    }
    if (lesson.day < 0 || lesson.day >= data.days || lesson.period < 0 || lesson.period >= data.periods) {
      out.push({ kind: 'out-of-range', message: `موعد خارج الأسبوع: ${lesson.id}` });
      continue;
    }
    const cls = classById.get(assignment.classId);
    if (!cls) continue;
    const classKey = `${assignment.classId}|${lesson.day}|${lesson.period}`;
    if (classSlots.has(classKey)) {
      out.push({
        kind: 'class-clash',
        message: `${className(data, assignment.classId)}: حصتان في ${DAY_NAMES[lesson.day]} — ${lesson.period + 1}`,
      });
    }
    classSlots.add(classKey);

    const teacherId = lesson.teacherId ?? assignment.teacherId;
    const teacher = teacherById.get(teacherId);
    if (teacher?.off.includes(lesson.day)) {
      out.push({ kind: 'off-day', message: `${teacher.name}: حصة في يوم راحته (${DAY_NAMES[lesson.day]})` });
    }

    const subject = data.subjects.find((s) => s.id === assignment.subjectId);
    const pe = subject ? isPE(subject.name) : false;
    if (pe && lesson.period === data.periods - 1) {
      out.push({
        kind: 'pe-last',
        message: `التربية البدنية في الحصة السابعة (${DAY_NAMES[lesson.day]}): ${className(data, assignment.classId)}`,
      });
    }

    const interval = lessonInterval(data, cls, lesson.period);
    entries.push({
      lesson,
      assignment,
      cls,
      teacherId,
      start: interval.start,
      end: interval.end,
      pe,
    });
  }

  const overlaps = (a: Entry, b: Entry) => a.start < b.end && b.start < a.end;

  // تعارض المعلم: أي تقاطع زمني بين حصتيه (لا يشترط تطابق رقم الحصة).
  const byTeacherDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = `${entry.teacherId}|${entry.lesson.day}`;
    const list = byTeacherDay.get(key) ?? [];
    list.push(entry);
    byTeacherDay.set(key, list);
  }
  for (const list of byTeacherDay.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!overlaps(list[i], list[j])) continue;
        out.push({
          kind: 'teacher-clash',
          message: `${teacherName(data, list[i].teacherId)}: حصتان متداخلتان في ${DAY_NAMES[list[i].lesson.day]} (حصة ${list[i].lesson.period + 1} و${list[j].lesson.period + 1})`,
        });
      }
    }
  }

  // تعارض القاعة: أي تقاطع زمني بين فصلين في القاعة نفسها.
  const byRoomDay = new Map<string, Entry[]>();
  for (const entry of entries) {
    if (!entry.cls.room) continue;
    const key = `${entry.cls.room}|${entry.lesson.day}`;
    const list = byRoomDay.get(key) ?? [];
    list.push(entry);
    byRoomDay.set(key, list);
  }
  for (const [key, list] of byRoomDay) {
    const room = key.split('|')[0];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (!overlaps(list[i], list[j])) continue;
        out.push({ kind: 'room-clash', message: `القاعة ${room}: فصلان في وقت واحد (${DAY_NAMES[list[i].lesson.day]})` });
      }
    }
  }

  // التربية البدنية: السقف والفصل بين المراحل تُحسب زمنيًا.
  const clock = (minute: number) => {
    const [h, m] = data.start.split(':').map(Number);
    const total = (h || 0) * 60 + (m || 0) + minute;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  };
  const peByDay = new Map<number, Entry[]>();
  for (const entry of entries) {
    if (!entry.pe) continue;
    const list = peByDay.get(entry.lesson.day) ?? [];
    list.push(entry);
    peByDay.set(entry.lesson.day, list);
  }
  for (const [day, list] of peByDay) {
    const points = [...new Set(list.flatMap((entry) => [entry.start, entry.end]))].sort((a, b) => a - b);
    for (let index = 0; index + 1 < points.length; index++) {
      const from = points[index];
      const to = points[index + 1];
      if (to <= from) continue;
      const active = list.filter((entry) => entry.start < to && entry.end > from);
      if (active.length > peCapacity) {
        out.push({
          kind: 'pe-cap',
          message: `التربية البدنية: ${active.length} فصول في وقت واحد (${DAY_NAMES[day]} ${clock(from)})`,
        });
      }
      if (separateGrade3 && active.length >= 3) {
        const hasThird = active.some((entry) => gradeOf(entry.cls.name) === 3);
        if (hasThird) {
          out.push({
            kind: 'pe-cap',
            message: `التربية البدنية: الثالث المتوسط ضمن أكثر من فصلين (${DAY_NAMES[day]} ${clock(from)})`,
          });
        }
      }
    }
  }

  // اكتمال الإسنادات: كل إسناد بعدد حصصه.
  const counts = new Map<ID, number>();
  for (const lesson of lessons) counts.set(lesson.assignmentId, (counts.get(lesson.assignmentId) ?? 0) + 1);
  for (const assignment of data.assignments) {
    const got = counts.get(assignment.id) ?? 0;
    if (got !== assignment.count) {
      out.push({
        kind: 'out-of-range',
        message: `${className(data, assignment.classId)} — ${subjectName(data, assignment.subjectId)}: ${got} من ${assignment.count} حصة`,
      });
    }
  }

  return [...new Map(out.map((violation) => [violation.kind + '|' + violation.message, violation])).values()];
}




