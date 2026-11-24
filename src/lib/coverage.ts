import type { Admin, Cover, ID, Lesson, SchoolData } from '../types';
import { className, compactClassName, gradeOf, lessonTeacherId, personName } from './model';
import { hijri, uid, weekdayOf } from './utils';

export interface Candidate {
  id: ID;
  name: string;
  reason: string;
  score: number;
  kind: 'teacher' | 'admin';
  remaining?: number;
}

export interface CoverageResult {
  covers: Cover[];
  unassigned: { lesson: Lesson; className: string; period: number }[];
}

const PERIOD_NAMES = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة'];

export function absentLessons(data: SchoolData, date: string): Lesson[] {
  const day = weekdayOf(date);
  const absent = new Set(data.absences.filter((a) => a.date === date).map((a) => a.teacherId));
  return data.lessons
    .filter((l) => l.day === day)
    .filter((l) => absent.has(lessonTeacherId(data, l)))
    .sort((a, b) => a.period - b.period);
}

function teacherBusy(data: SchoolData, date: string, personId: ID, period: number): boolean {
  const day = weekdayOf(date);
  const hasLesson = data.lessons.some((l) => {
    if (l.day !== day || l.period !== period) return false;
    return lessonTeacherId(data, l) === personId;
  });
  if (hasLesson) return true;
  return data.covers.some((c) => {
    if (c.date !== date || c.teacherId !== personId) return false;
    const lesson = data.lessons.find((l) => l.id === c.lessonId);
    return lesson?.period === period;
  });
}

/** هل يدرّس المعلم فصلًا في المرحلة نفسها (أول/ثاني/ثالث)؟ */
function teachesSameGrade(data: SchoolData, teacherId: ID, targetClassId: string): boolean {
  const targetClass = data.classes.find((c) => c.id === targetClassId);
  const grade = targetClass ? gradeOf(targetClass.name) : null;
  if (grade === null) return false;
  return data.assignments.some((assignment) => {
    if (assignment.teacherId !== teacherId) return false;
    const cls = data.classes.find((c) => c.id === assignment.classId);
    return cls ? gradeOf(cls.name) === grade : false;
  });
}

export function candidatesFor(
  data: SchoolData,
  lesson: Lesson,
  date: string,
  adminUsage: Map<ID, number> = new Map(),
): Candidate[] {
  const assignment = data.assignments.find((a) => a.id === lesson.assignmentId);
  if (!assignment) return [];
  const absent = new Set(data.absences.filter((a) => a.date === date).map((a) => a.teacherId));
  const weekly = new Map<ID, number>();
  for (const l of data.lessons) {
    const teacher = lessonTeacherId(data, l);
    if (teacher) weekly.set(teacher, (weekly.get(teacher) ?? 0) + 1);
  }
  for (const c of data.covers) {
    if (c.date === date) weekly.set(c.teacherId, (weekly.get(c.teacherId) ?? 0) + 1);
  }

  const teachers: Candidate[] = data.teachers
    .filter((t) => !absent.has(t.id))
    .filter((t) => !teacherBusy(data, date, t.id, lesson.period))
    .map((t) => {
      const specialist = t.subject === assignment.subjectId || t.additionalSubjects.includes(assignment.subjectId);
      const sameGrade = teachesSameGrade(data, t.id, assignment.classId);
      const load = weekly.get(t.id) ?? 0;
      const overload = Math.max(0, load - t.max);
      const score =
        (specialist ? 100 : 0) + (sameGrade ? 45 : 0) - load * 2 - overload * 40;
      return {
        id: t.id,
        name: t.name,
        reason: specialist
          ? 'تخصص المادة'
          : sameGrade
            ? 'يدرّس نفس الصف'
            : overload > 0
              ? 'نصاب مرتفع'
              : 'الأخف نصابًا',
        score,
        kind: 'teacher' as const,
      };
    });

  const admins: Candidate[] = (data.admins ?? [])
    .map((admin: Admin) => {
      const used = adminUsage.get(admin.id) ?? 0;
      const remaining = Math.max(0, admin.periods - used);
      return {
        id: admin.id,
        name: admin.name,
        reason: `إداري · متبقٍ ${remaining}`,
        // الإداري بديل أخير: يُستخدم بعد المعلمين.
        score: 25 + remaining,
        kind: 'admin' as const,
        remaining,
      };
    })
    .filter((candidate) => (candidate.remaining ?? 0) > 0)
    .filter((candidate) => !teacherBusy(data, date, candidate.id, lesson.period));

  return [...teachers, ...admins].sort((a, b) => b.score - a.score);
}

export function autoCover(data: SchoolData, date: string): CoverageResult {
  const lessons = absentLessons(data, date);
  const covers: Cover[] = [];
  const unassigned: CoverageResult['unassigned'] = [];
  const adminUsage = new Map<ID, number>();
  const working: SchoolData = { ...data, covers: [] };
  const remaining = new Map(lessons.map((lesson) => [lesson.id, lesson]));

  // 1) يُعطى كل إداري عدد الحصص المحدد له (حصة واحدة في كل موعد).
  for (const admin of data.admins ?? []) {
    for (let assigned = 0; assigned < admin.periods; assigned++) {
      const lesson = lessons.find(
        (candidate) =>
          remaining.has(candidate.id) &&
          !teacherBusy({ ...working, covers }, date, admin.id, candidate.period),
      );
      if (!lesson) break;
      covers.push({ id: uid('cv'), date, lessonId: lesson.id, teacherId: admin.id });
      remaining.delete(lesson.id);
      adminUsage.set(admin.id, (adminUsage.get(admin.id) ?? 0) + 1);
    }
  }

  // 2) تُغطى بقية الحصص بالمعلمين، الأصعب أولًا.
  const pending = [...remaining.values()].map((lesson) => ({
    lesson,
    candidates: candidatesFor({ ...working, covers }, lesson, date, adminUsage).length,
  }));
  pending.sort((a, b) => a.candidates - b.candidates);

  for (const { lesson } of pending) {
    const withCovers: SchoolData = { ...working, covers };
    const candidate = candidatesFor(withCovers, lesson, date, adminUsage)[0];
    if (candidate) {
      covers.push({ id: uid('cv'), date, lessonId: lesson.id, teacherId: candidate.id });
      remaining.delete(lesson.id);
      if (candidate.kind === 'admin') adminUsage.set(candidate.id, (adminUsage.get(candidate.id) ?? 0) + 1);
    } else {
      const assignment = data.assignments.find((a) => a.id === lesson.assignmentId)!;
      unassigned.push({
        lesson,
        className: className(data, assignment.classId),
        period: lesson.period + 1,
      });
    }
  }

  return { covers, unassigned };
}

/** رسالة واتساب: الغائبون مرقّمون، ثم توزيع الانتظار حسب الحصة. */
export function coverageMessage(data: SchoolData, date: string, covers: Cover[]): string {
  const lines: string[] = [];
  const absentIds = [...new Set(data.absences.filter((a) => a.date === date).map((a) => a.teacherId))];

  lines.push('المعلمين الغائبين لليوم');
  absentIds.forEach((id, index) => lines.push(`${index + 1}- ${personName(data, id)}`));
  lines.push('');
  lines.push('              توزيع الانتظار');

  const byPeriod = new Map<number, Cover[]>();
  for (const cover of covers) {
    const lesson = data.lessons.find((l) => l.id === cover.lessonId);
    if (!lesson) continue;
    const list = byPeriod.get(lesson.period) ?? [];
    list.push(cover);
    byPeriod.set(lesson.period, list);
  }

  for (const period of [...byPeriod.keys()].sort((a, b) => a - b)) {
    lines.push(`الحصة ${PERIOD_NAMES[period] ?? period + 1}:`);
    for (const cover of byPeriod.get(period) ?? []) {
      const lesson = data.lessons.find((l) => l.id === cover.lessonId)!;
      const assignment = data.assignments.find((a) => a.id === lesson.assignmentId)!;
      lines.push(`${personName(data, cover.teacherId)} - ${compactClassName(className(data, assignment.classId))}`);
    }
    lines.push('---------------------');
  }

  return lines.join('\n').trim();
}

/** ملخص تاريخ اليوم بصيغة هجرية للعرض. */
export function coverageDateLabel(date: string): string {
  return hijri(date);
}

