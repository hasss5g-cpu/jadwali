import type { Assignment, ID, Lesson, SchoolData, Teacher, Violation } from '../types';
import { DEFAULT_OPTIONS } from '../types';

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

export function assignmentOf(data: SchoolData, id: ID): Assignment | undefined {
  return data.assignments.find((a) => a.id === id);
}

export function teacherOf(data: SchoolData, id: ID): Teacher | undefined {
  return data.teachers.find((t) => t.id === id);
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

/** يستكمل الحقول الناقصة في أي ملف بيانات (ملفات المدرسة القديمة مثلًا). */
export function normalizeData(input: SchoolData): SchoolData {
  return {
    ...input,
    days: input.days ?? 5,
    periods: input.periods ?? 7,
    subjects: input.subjects ?? [],
    teachers: input.teachers ?? [],
    classes: input.classes ?? [],
    assignments: input.assignments ?? [],
    lessons: input.lessons ?? [],
    absences: input.absences ?? [],
    covers: input.covers ?? [],
    exams: input.exams ?? { periodic: [], official: [] },
    options: { ...DEFAULT_OPTIONS, ...(input.options ?? {}) },
  };
}

/** كل قيود التعارض الصارمة في الجدول الحالي. */
export function validate(data: SchoolData, lessons: Lesson[] = data.lessons): Violation[] {
  const out: Violation[] = [];
  const slots = new Map<string, Lesson>();
  const teacherSlots = new Set<string>();
  const peSlots = new Map<string, number>();
  const assignmentById = new Map(data.assignments.map((a) => [a.id, a]));
  const teacherById = new Map(data.teachers.map((t) => [t.id, t]));

  for (const lesson of lessons) {
    const a = assignmentById.get(lesson.assignmentId);
    if (!a) {
      out.push({ kind: 'out-of-range', message: `حصة بلا إسناد: ${lesson.id}` });
      continue;
    }
    if (
      lesson.day < 0 || lesson.day >= data.days ||
      lesson.period < 0 || lesson.period >= data.periods
    ) {
      out.push({ kind: 'out-of-range', message: `موعد خارج الأسبوع: ${lesson.id}` });
      continue;
    }
    const key = slotKey(lesson.day, lesson.period);
    const classKey = `${a.classId}|${key}`;
    if (slots.has(classKey)) {
      out.push({ kind: 'class-clash', message: `${className(data, a.classId)}: حصتان في ${DAY_NAMES[lesson.day]} — ${lesson.period + 1}` });
    }
    slots.set(classKey, lesson);

    const tKey = `${a.teacherId}|${key}`;
    if (teacherSlots.has(tKey)) {
      out.push({ kind: 'teacher-clash', message: `${teacherName(data, a.teacherId)}: حصتان في ${DAY_NAMES[lesson.day]} — ${lesson.period + 1}` });
    }
    teacherSlots.add(tKey);

    const teacher = teacherById.get(a.teacherId);
    if (teacher?.off.includes(lesson.day)) {
      out.push({ kind: 'off-day', message: `${teacher.name}: حصة في يوم راحته (${DAY_NAMES[lesson.day]})` });
    }
    const subject = data.subjects.find((s) => s.id === a.subjectId);
    if (subject && isPE(subject.name)) {      const n = (peSlots.get(key) ?? 0) + 1;
      peSlots.set(key, n);
      if (n > 2) {
        out.push({ kind: 'pe-cap', message: `التربية البدنية: أكثر من فصلين في ${DAY_NAMES[lesson.day]} — ${lesson.period + 1}` });
      }
    }
  }

  // سعة القاعة: لا يجتمع فصلان في القاعة نفسها في الموعد نفسه.
  const roomSlots = new Set<string>();
  for (const lesson of lessons) {
    const a = assignmentById.get(lesson.assignmentId);
    if (!a) continue;
    const room = data.classes.find((c) => c.id === a.classId)?.room;
    if (!room) continue;
    const key = `${room}|${slotKey(lesson.day, lesson.period)}`;
    if (roomSlots.has(key)) {
      out.push({ kind: 'room-clash', message: `القاعة ${room}: فصلان في الموعد نفسه` });
    }
    roomSlots.add(key);
  }

  // اكتمال الإسنادات: كل إسناد بعدد حصصه.
  const counts = new Map<ID, number>();
  for (const lesson of lessons) counts.set(lesson.assignmentId, (counts.get(lesson.assignmentId) ?? 0) + 1);
  for (const a of data.assignments) {
    const got = counts.get(a.id) ?? 0;
    if (got !== a.count) {
      out.push({
        kind: 'out-of-range',
        message: `${className(data, a.classId)} — ${subjectName(data, a.subjectId)}: ${got} من ${a.count} حصة`,
      });
    }
  }
  return out;
}
