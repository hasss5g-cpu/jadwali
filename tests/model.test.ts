import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import type { SchoolData } from '../src/types';
import { isPE, normalizeData, validate } from '../src/lib/model';
import { solve } from '../src/lib/solver';

const data = normalizeData(raw as unknown as SchoolData);

describe('نموذج البيانات والتحقق', () => {
  it('يميّز التربية البدنية عن الرياضيات', () => {
    expect(isPE('التربية البدنية')).toBe(true);
    expect(isPE('البدنية')).toBe(true);
    expect(isPE('الرياضيات')).toBe(false);
    expect(isPE('اللغة الإنجليزية')).toBe(false);
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
