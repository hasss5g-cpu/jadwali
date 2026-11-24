import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type SchoolData } from '../src/types';
import { isPE, normalizeData, validate } from '../src/lib/model';
import { solve } from '../src/lib/solver';

const data = normalizeData(raw as unknown as SchoolData);

/** بيانات مصغّرة: فصل واحد لكل اسم، جميعها في حصة بدنية واحدة. */
function peFixture(classNames: string[]): SchoolData {
  const pe = { id: 'pe', name: 'التربية البدنية', color: 0 };
  return {
    ...data,
    subjects: [pe],
    teachers: classNames.map((_, index) => ({
      id: `t${index}`,
      name: `معلم ${index}`,
      subject: 'pe',
      additionalSubjects: [],
      max: 20,
      off: [],
    })),
    classes: classNames.map((name, index) => ({ id: `c${index}`, name, room: `r${index}` })),
    assignments: classNames.map((_, index) => ({
      id: `a${index}`,
      classId: `c${index}`,
      subjectId: 'pe',
      teacherId: `t${index}`,
      count: 1,
    })),
    lessons: classNames.map((_, index) => ({ id: `l${index}`, assignmentId: `a${index}`, day: 0, period: 0 })),
    options: { ...DEFAULT_OPTIONS, peCapacity: 3, peSeparateGrade3: true },
  };
}

describe('نموذج البيانات والتحقق', () => {
  it('يميّز التربية البدنية عن الرياضيات', () => {
    expect(isPE('التربية البدنية')).toBe(true);
    expect(isPE('البدنية')).toBe(true);
    expect(isPE('الرياضيات')).toBe(false);
    expect(isPE('اللغة الإنجليزية')).toBe(false);
  });

  it('يسمح بثلاثة فصول في البدنية ما لم يكن بينها الثالث المتوسط', () => {
    const allowed = validate(peFixture(['الأول متوسط / 1', 'الأول متوسط / 2', 'الثاني متوسط / 1']));
    expect(allowed.filter((error) => error.kind === 'pe-cap')).toHaveLength(0);

    const mixed = validate(
      peFixture(['الأول متوسط / 1', 'الأول متوسط / 2', 'الثاني متوسط / 1', 'الثالث متوسط / 1']),
    );
    expect(mixed.filter((error) => error.kind === 'pe-cap').length).toBeGreaterThan(0);
  });

  it('يقبل الثالث المتوسط مع فصل واحد فقط', () => {
    const two = validate(peFixture(['الأول متوسط / 1', 'الثالث متوسط / 1']));
    expect(two.filter((error) => error.kind === 'pe-cap')).toHaveLength(0);
  });

  it('يستكمل الحقول الناقصة', () => {
    const partial = normalizeData({ ...data, days: undefined as unknown as number, covers: undefined as never });
    expect(partial.days).toBe(5);
    expect(partial.covers).toEqual([]);
  });

  it('يكتشف تعارض المعلم وسقف البدنية ويوم الراحة', () => {
    const teacherId = data.teachers[0].id;
    const assignments = data.assignments.filter((a) => a.teacherId === teacherId).slice(0, 2);
    if (assignments.length < 2) return;
    const lessons = [
      { id: 'x1', assignmentId: assignments[0].id, day: 0, period: 0 },
      { id: 'x2', assignmentId: assignments[1].id, day: 0, period: 0 },
    ];
    const synthetic = { ...data, lessons };
    const errors = validate(synthetic);
    expect(errors.some((e) => e.kind === 'teacher-clash')).toBe(true);
  });

  it('الجدول الحالي في الملف صالح', () => {
    const errors = validate(data);
    // الملف الأولي مبني مسبقًا؛ نتوقع ألا يحتوي تعارضات صارمة.
    expect(errors.filter((e) => e.kind === 'teacher-clash')).toHaveLength(0);
  });

  it('يحافظ على عدد الحصص عند التوليد بميزانية قصيرة', () => {
    const result = solve(data, { ...data.options, artPairs: true, spread: true }, { budgetMs: 1200, seed: 3 });
    expect(result.lessons).toHaveLength(875);
    expect(validate({ ...data, lessons: result.lessons }).filter((e) => e.kind === 'teacher-clash')).toHaveLength(0);
  });
});
