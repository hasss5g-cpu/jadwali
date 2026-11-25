import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type SchoolData } from '../src/types';
import {
  classBreakPositions,
  classPeriodTimes,
  defaultBreakAfter,
  gradeOf,
  lessonsOverlap,
  normalizeData,
  periodStartMinutes,
  seasonStart,
  validate,
} from '../src/lib/model';

const real = normalizeData(raw as unknown as SchoolData);

function mini(overrides: Partial<SchoolData> = {}): SchoolData {
  return {
    ...real,
    school: 'مدرسة اختبار',
    periods: 4,
    days: 5,
    duration: 45,
    season: 'summer',
    start: '07:00',
    breaks: { first: 25, second: 25 },
    gradeBreak: { 1: 2, 2: 3, 3: 3 },
    subjects: [{ id: 's1', name: 'الرياضيات', color: 0 }],
    teachers: [{ id: 't1', name: 'معلم واحد', subject: 's1', additionalSubjects: [], max: 24, off: [] }],
    classes: [
      { id: 'cA', name: 'الأول متوسط / 1', room: 'r1' },
      { id: 'cB', name: 'الثاني متوسط / 1', room: 'r2' },
    ],
    assignments: [
      { id: 'a1', classId: 'cA', subjectId: 's1', teacherId: 't1', count: 1 },
      { id: 'a2', classId: 'cB', subjectId: 's1', teacherId: 't1', count: 1 },
    ],
    lessons: [
      { id: 'l1', assignmentId: 'a1', day: 0, period: 2 },
      { id: 'l2', assignmentId: 'a2', day: 0, period: 2 },
    ],
    absences: [],
    covers: [],
    admins: [],
    exams: { periodic: [], official: [] },
    options: { ...DEFAULT_OPTIONS },
    ...overrides,
  };
}

describe('الفسح والدوام', () => {
  it('الافتراضي: الأول والثاني بعد الثالثة، والثالث بعد الثانية', () => {
    expect(real.breaks).toEqual({ first: 25, second: 25 });
    expect(real.gradeBreak).toEqual({ 1: 3, 2: 3, 3: 2 });
    expect(real.season).toBe('summer');
    expect(real.start).toBe('07:00');
  });

  it('الدوام الشتوي يبدأ 7:30 والصيفي 7:00', () => {
    expect(seasonStart('winter')).toBe('07:30');
    expect(seasonStart('summer')).toBe('07:00');
    expect(normalizeData({ ...real, season: 'winter' }).start).toBe('07:30');
  });

  it('فسحة واحدة لكل فصل حسب صفه', () => {
    for (const cls of real.classes) {
      const grade = gradeOf(cls.name) ?? 1;
      expect(classBreakPositions(real, cls)).toEqual([grade === 3 ? 2 : 3]);
    }
    expect(defaultBreakAfter({ id: 'x', name: 'الثالث متوسط / 1', room: '' })).toBe(2);
    expect(defaultBreakAfter({ id: 'y', name: 'الأول متوسط / 1', room: '' })).toBe(3);
  });

  it('يحسب أوقات الحصص حسب فسحة الصف', () => {
    const school = mini();
    expect(periodStartMinutes(school, school.classes[0])).toEqual([0, 45, 115, 160]);
    expect(classPeriodTimes(school, school.classes[0])).toEqual([
      '7:00 ص–7:45 ص',
      '7:45 ص–8:30 ص',
      '8:55 ص–9:40 ص',
      '9:40 ص–10:25 ص',
    ]);
    expect(periodStartMinutes(school, school.classes[1])).toEqual([0, 45, 90, 160]);
  });

  it('يكشف تقاطع حصتين لمعلم واحد بسبب اختلاف الفسح', () => {
    const school = mini();
    expect(lessonsOverlap(school, school.classes[0], 2, school.classes[1], 2)).toBe(true);
    const violations = validate(school, school.lessons);
    expect(violations.some((violation) => violation.kind === 'teacher-clash')).toBe(true);
    expect(violations.find((violation) => violation.kind === 'teacher-clash')?.message).toContain('متداخلتان');
  });
});

