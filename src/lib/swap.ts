import type { Lesson, SchoolData, Violation } from '../types';
import { lessonTeacherId, validate } from './model';

export interface SwapCheck {
  ok: boolean;
  newIssues: Violation[];
  sameTeacher: boolean;
  subjects: { a: string; b: string; differ: boolean };
}

export interface LessonInfo {
  lesson: Lesson;
  teacherId: string;
  teacherName: string;
  className: string;
  subjectName: string;
  day: string;
  period: number;
}

/**
 * تبادل المعلمين لحصتين: كل معلم يدرّس حصة الآخر في موعدها.
 * المواعيد والفصول لا تتغيّر، فيبقى الجدول صالحًا من ناحية الفصل،
 * ويُفحص تعارض المعلم ويوم الراحة وقيود البدنية بعد التبديل.
 */
export function swappedLessons(data: SchoolData, a: Lesson, b: Lesson): Lesson[] {
  const teacherA = lessonTeacherId(data, a);
  const teacherB = lessonTeacherId(data, b);
  return data.lessons.map((lesson) => {
    if (lesson.id === a.id) return { ...lesson, teacherId: teacherB };
    if (lesson.id === b.id) return { ...lesson, teacherId: teacherA };
    return lesson;
  });
}

export function checkSwap(data: SchoolData, a: Lesson, b: Lesson): SwapCheck {
  const teacherA = lessonTeacherId(data, a);
  const teacherB = lessonTeacherId(data, b);
  const assignmentA = data.assignments.find((x) => x.id === a.assignmentId);
  const assignmentB = data.assignments.find((x) => x.id === b.assignmentId);
  const subjectA = data.subjects.find((s) => s.id === assignmentA?.subjectId)?.name ?? '';
  const subjectB = data.subjects.find((s) => s.id === assignmentB?.subjectId)?.name ?? '';
  const sameTeacher = teacherA === teacherB || a.id === b.id;

  if (sameTeacher) {
    return { ok: false, newIssues: [], sameTeacher: true, subjects: { a: subjectA, b: subjectB, differ: subjectA !== subjectB } };
  }

  const before = new Set(validate(data).map((violation) => violation.kind + '|' + violation.message));
  const after = validate({ ...data, lessons: swappedLessons(data, a, b) });
  const newIssues = after.filter((violation) => !before.has(violation.kind + '|' + violation.message));
  return {
    ok: newIssues.length === 0,
    newIssues,
    sameTeacher: false,
    subjects: { a: subjectA, b: subjectB, differ: subjectA !== subjectB },
  };
}
