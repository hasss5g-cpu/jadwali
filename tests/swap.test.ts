import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type Lesson, type SchoolData } from '../src/types';
import { lessonTeacherId, normalizeData, validate } from '../src/lib/model';
import { checkSwap, swappedLessons } from '../src/lib/swap';

const data = normalizeData(raw as unknown as SchoolData);

function mini(off: number[] = []): SchoolData {
  return {
    ...data,
    school: 'مدرسة اختبار',
    periods: 7,
    days: 5,
    subjects: [
      { id: 's1', name: 'الرياضيات', color: 0 },
      { id: 's2', name: 'العلوم', color: 1 },
    ],
    teachers: [
      { id: 't1', name: 'معلم أ', subject: 's1', additionalSubjects: [], max: 24, off },
      { id: 't2', name: 'معلم ب', subject: 's2', additionalSubjects: [], max: 24, off: [] },
    ],
    classes: [
      { id: 'c1', name: 'الأول متوسط / 1', room: 'r1' },
      { id: 'c2', name: 'الأول متوسط / 2', room: 'r2' },
    ],
    assignments: [
      { id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', count: 1 },
      { id: 'a2', classId: 'c2', subjectId: 's2', teacherId: 't2', count: 1 },
    ],
    lessons: [
      { id: 'l1', assignmentId: 'a1', day: 1, period: 0 },
      { id: 'l2', assignmentId: 'a2', day: 0, period: 0 },
    ],
    absences: [],
    covers: [],
    exams: { periodic: [], official: [] },
    options: { ...DEFAULT_OPTIONS },
  };
}

const byId = (lessons: Lesson[], id: string) => lessons.find((lesson) => lesson.id === id)!;

describe('تبادل الحصص بين المعلمين', () => {
  it('يتبادل المعلمين ويحفظ الحصص دون مخالفات جديدة', () => {
    const school = mini();
    const a = byId(school.lessons, 'l1');
    const b = byId(school.lessons, 'l2');
    const check = checkSwap(school, a, b);
    expect(check.ok).toBe(true);
    expect(check.sameTeacher).toBe(false);
    expect(check.subjects.differ).toBe(true);

    const swapped = swappedLessons(school, a, b);
    expect(swapped).toHaveLength(school.lessons.length);
    expect(lessonTeacherId({ ...school, lessons: swapped }, byId(swapped, 'l1'))).toBe('t2');
    expect(lessonTeacherId({ ...school, lessons: swapped }, byId(swapped, 'l2'))).toBe('t1');
    expect(validate({ ...school, lessons: swapped })).toEqual([]);
  });

  it('يرفض التبادل إذا أوقع معلمًا في يوم راحته', () => {
    const school = mini([0]);
    const check = checkSwap(school, byId(school.lessons, 'l1'), byId(school.lessons, 'l2'));
    expect(check.ok).toBe(false);
    expect(check.newIssues.some((issue) => issue.kind === 'off-day')).toBe(true);
  });

  it('لا يبدّل الحصة مع نفسها أو مع معلمها نفسه', () => {
    const school = mini();
    const same = checkSwap(school, byId(school.lessons, 'l1'), byId(school.lessons, 'l1'));
    expect(same.ok).toBe(false);
    expect(same.sameTeacher).toBe(true);
  });

  it('يعمل على بيانات المدرسة: التبديل المقبول ينتج معلمين مُستبدلين', () => {
    const first = data.lessons[0];
    const second = data.lessons.find(
      (lesson) => lessonTeacherId(data, lesson) !== lessonTeacherId(data, first),
    )!;
    const check = checkSwap(data, first, second);
    expect(check.sameTeacher).toBe(false);
    if (check.ok) {
      const swapped = swappedLessons(data, first, second);
      expect(swapped.filter((lesson) => lesson.teacherId)).toHaveLength(2);
    } else {
      expect(check.newIssues.length).toBeGreaterThan(0);
    }
  });
});
