import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type SchoolData } from '../src/types';
import {
  classPeriodTimes,
  defaultBreakAfter,
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
    subjects: [{ id: 's1', name: 'الرياضيات', color: 0 }],
    teachers: [{ id: 't1', name: 'معلم واحد', subject: 's1', additionalSubjects: [], max: 24, off: [] }],
    classes: [
      { id: 'cA', name: 'الأول متوسط / 1', room: 'r1', breakAfter: 1, breakAfter2: 2 },
      { id: 'cB', name: 'الثاني متوسط / 1', room: 'r2', breakAfter: 2, breakAfter2: 3 },
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
  it('الافتراضي فسحتان 25 دقيقة لكل منهما', () => {
    expect(real.breaks).toEqual({ count: 2, first: 25, second: 25 });
    expect(real.season).toBe('summer');
    expect(real.start).toBe('07:00');
  });

  it('الدوام الشتوي يبدأ 7:30 والصيفي 7:00', () => {
    expect(seasonStart('winter')).toBe('07:30');
    expect(seasonStart('summer')).toBe('07:00');
    expect(normalizeData({ ...real, season: 'winter' }).start).toBe('07:30');
  });

  it('المرحلة الثالثة تبدأ فسحتها بعد الحصة الثانية وبقية المراحل بعد الثالثة', () => {
    expect(defaultBreakAfter({ id: 'x', name: 'الثالث متوسط / 1', room: '' })).toBe(2);
    expect(defaultBreakAfter({ id: 'y', name: 'الأول متوسط / 1', room: '' })).toBe(3);
    expect(real.classes.every((cls) => cls.breakAfter === defaultBreakAfter(cls))).toBe(true);
  });

  it('يحسب أوقات الحصص مع الفسح', () => {
    const school = mini({ season: 'summer', start: '07:00' });
    expect(periodStartMinutes(school, school.classes[0])).toEqual([0, 70, 140, 185]);
    expect(classPeriodTimes(school, school.classes[0])).toEqual([
      '07:00–07:45',
      '08:10–08:55',
      '09:20–10:05',
      '10:05–10:50',
    ]);
  });

  it('يكشف تقاطع حصتين لمعلم واحد بسبب اختلاف الفسح', () => {
    const school = mini();
    expect(lessonsOverlap(school, school.classes[0], 2, school.classes[1], 2)).toBe(true);
    const violations = validate(school, school.lessons);
    expect(violations.some((violation) => violation.kind === 'teacher-clash')).toBe(true);
    expect(violations.find((violation) => violation.kind === 'teacher-clash')?.message).toContain('متداخلتان');
  });
});
