import type { Lesson, SchoolData, Violation } from '../types';
import { lessonTeacherId, validate } from './model';

export interface MoveTarget {
  day: number;
  period: number;
}

export interface MovePlan {
  ok: boolean;
  noop: boolean;
  source: Lesson;
  target: MoveTarget;
  /** الحصة التي ستحل مكان المنقولة داخل الفصل نفسه (إن كان الموعد مشغولًا). */
  displaced: Lesson | null;
  /** حصة للمعلم نفسه في الموعد الهدف — تمنع النقل. */
  teacherBusy: Lesson | null;
  /** الحصص بعد النقل. */
  lessons: Lesson[];
  newIssues: Violation[];
}

export function classOfLesson(data: SchoolData, lesson: Lesson): string {
  return data.assignments.find((a) => a.id === lesson.assignmentId)?.classId ?? '';
}

/**
 * يخطّط نقل حصة داخل جدول معلمها إلى موعد جديد.
 * الفصول ممتلئة، لذا يُتبادل موعد الحصة المنقولة مع حصة الفصل نفسها في الموعد الهدف
 * (إن وُجدت)، ويُفحص أثر ذلك على المعلم الثاني والقيود.
 */
export function planMove(data: SchoolData, source: Lesson, day: number, period: number): MovePlan {
  const classId = classOfLesson(data, source);
  const teacherId = lessonTeacherId(data, source);
  const noop = source.day === day && source.period === period;

  const teacherBusy =
    data.lessons.find(
      (lesson) =>
        lesson.id !== source.id &&
        lessonTeacherId(data, lesson) === teacherId &&
        lesson.day === day &&
        lesson.period === period,
    ) ?? null;

  const displaced =
    data.lessons.find(
      (lesson) =>
        lesson.id !== source.id &&
        classOfLesson(data, lesson) === classId &&
        lesson.day === day &&
        lesson.period === period,
    ) ?? null;

  const lessons = data.lessons.map((lesson) => {
    if (lesson.id === source.id) return { ...lesson, day, period };
    if (displaced && lesson.id === displaced.id) return { ...lesson, day: source.day, period: source.period };
    return lesson;
  });

  if (noop) {
    return { ok: false, noop: true, source, target: { day, period }, displaced, teacherBusy, lessons: data.lessons, newIssues: [] };
  }
  if (teacherBusy) {
    return { ok: false, noop: false, source, target: { day, period }, displaced, teacherBusy, lessons: data.lessons, newIssues: [] };
  }

  const before = new Set(validate(data).map((violation) => violation.kind + '|' + violation.message));
  const newIssues = validate({ ...data, lessons }).filter(
    (violation) => !before.has(violation.kind + '|' + violation.message),
  );

  return {
    ok: newIssues.length === 0,
    noop: false,
    source,
    target: { day, period },
    displaced,
    teacherBusy,
    lessons,
    newIssues,
  };
}
