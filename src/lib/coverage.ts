import type { Cover, ID, Lesson, SchoolData } from '../types';
import { className, lessonTeacherId, subjectName, teacherName } from './model';
import { hijri, uid, weekdayLabel, weekdayOf } from './utils';

export interface Candidate {
  id: ID;
  name: string;
  reason: string;
  score: number;
}

export interface CoverageResult {
  covers: Cover[];
  unassigned: { lesson: Lesson; className: string; period: number }[];
}

export function absentLessons(data: SchoolData, date: string): Lesson[] {
  const day = weekdayOf(date);
  const absent = new Set(data.absences.filter((a) => a.date === date).map((a) => a.teacherId));
  return data.lessons
    .filter((l) => l.day === day)
    .filter((l) => absent.has(lessonTeacherId(data, l)))
    .sort((a, b) => a.period - b.period);
}

function teacherBusy(data: SchoolData, date: string, teacherId: ID, period: number): boolean {
  const day = weekdayOf(date);
  const hasLesson = data.lessons.some((l) => {
    if (l.day !== day || l.period !== period) return false;
    return lessonTeacherId(data, l) === teacherId;
  });
  if (hasLesson) return true;
  return data.covers.some((c) => {
    if (c.date !== date || c.teacherId !== teacherId) return false;
    const lesson = data.lessons.find((l) => l.id === c.lessonId);
    return lesson?.period === period;
  });
}

export function candidatesFor(data: SchoolData, lesson: Lesson, date: string): Candidate[] {
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
  return data.teachers
    .filter((t) => !absent.has(t.id))
    .filter((t) => !teacherBusy(data, date, t.id, lesson.period))
    .map((t) => {
      const specialist = t.subject === assignment.subjectId || t.additionalSubjects.includes(assignment.subjectId);
      const load = weekly.get(t.id) ?? 0;
      const overload = Math.max(0, load - t.max);
      const score = (specialist ? 100 : 0) - load * 2 - overload * 40;
      return {
        id: t.id,
        name: t.name,
        reason: specialist ? 'تخصص المادة' : overload > 0 ? 'نصاب مرتفع' : 'الأخف نصابًا',
        score,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function autoCover(data: SchoolData, date: string): CoverageResult {
  const lessons = absentLessons(data, date);
  const covers: Cover[] = [];
  const unassigned: CoverageResult['unassigned'] = [];
  const working: SchoolData = { ...data, covers: [] };
  const pending = lessons.map((lesson) => ({
    lesson,
    candidates: candidatesFor(working, lesson, date).length,
  }));
  pending.sort((a, b) => a.candidates - b.candidates);
  for (const { lesson } of pending) {
    const used = new Set(covers.map((c) => c.teacherId));
    const candidate = candidatesFor({ ...working, covers }, lesson, date).find((c) => !used.has(c.id));
    if (candidate) {
      covers.push({ id: uid('cv'), date, lessonId: lesson.id, teacherId: candidate.id });
    } else {
      unassigned.push({
        lesson,
        className: className(data, data.assignments.find((a) => a.id === lesson.assignmentId)!.classId),
        period: lesson.period + 1,
      });
    }
  }
  return { covers, unassigned };
}

export function coverageMessage(data: SchoolData, date: string, covers: Cover[]): string {
  const lines: string[] = [];
  lines.push(data.school);
  lines.push(`توزيع حصص الانتظار ليوم ${weekdayLabel(date)} — ${hijri(date)}`);
  lines.push('');
  const byTeacher = new Map<ID, Cover[]>();
  for (const cover of covers) {
    const lesson = data.lessons.find((l) => l.id === cover.lessonId);
    const assignment = lesson ? data.assignments.find((a) => a.id === lesson.assignmentId) : undefined;
    if (!assignment) continue;
    const arr = byTeacher.get(lessonTeacherId(data, lesson!)) ?? [];
    arr.push(cover);
    byTeacher.set(assignment.teacherId, arr);
  }
  for (const [teacherId, list] of byTeacher) {
    lines.push(`*المعلم الغائب: ${teacherName(data, teacherId)}*`);
    list.sort((a, b) => {
      const la = data.lessons.find((l) => l.id === a.lessonId)!;
      const lb = data.lessons.find((l) => l.id === b.lessonId)!;
      return la.period - lb.period;
    });
    for (const cover of list) {
      const lesson = data.lessons.find((l) => l.id === cover.lessonId)!;
      const assignment = data.assignments.find((a) => a.id === lesson.assignmentId)!;
      lines.push(`الحصة: ${lesson.period + 1}`);
      lines.push(`المعلم المنتظر: ${teacherName(data, cover.teacherId)}`);
      lines.push(`الفصل: ${className(data, assignment.classId)}`);
      lines.push(`المادة: ${subjectName(data, assignment.subjectId)}`);
      lines.push('---------------------------');
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}


