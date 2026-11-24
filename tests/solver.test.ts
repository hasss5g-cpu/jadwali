import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type SchoolData } from '../src/types';
import { solve } from '../src/lib/solver';
import { gradeOf, isPE, normalizeData, validate } from '../src/lib/model';

const data = normalizeData(raw as unknown as SchoolData);

describe('محرك التوزيع على بيانات المدرسة الحقيقية', () => {
  it('يوزّع 875 حصة دون تعارض مع تجاور الفنية وقيود البدنية', () => {
    const result = solve(data, { ...DEFAULT_OPTIONS, artPairs: true, spread: true }, { budgetMs: 5000, seed: 7 });
    const report = result.report;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      ok: result.ok,
      lessons: result.lessons.length,
      score: report.score,
      conflicts: report.conflicts,
      art: `${report.artPairsIntact}/${report.artPairs}`,
      holes: report.holes,
      longRuns: report.longRuns,
      repeats: report.dailyRepeats,
      seventh: report.seventh,
      missingDays: report.missingDays,
      ms: report.ms,
      iters: report.iterations,
    }));
    expect(result.lessons).toHaveLength(875);
    expect(report.placed).toBe(875);
    expect(report.conflicts).toBe(0);
    expect(report.artPairsIntact).toBe(report.artPairs);
    // كل معلم يكفيه نصابه يعمل في كل أيام الأسبوع.
    expect(report.missingDays).toBe(0);
    for (const teacher of report.teachers) {
      if (teacher.quota >= 5) expect(teacher.activeDays).toBe(5);
    }
    expect(validate({ ...data, lessons: result.lessons })).toEqual([]);

    // قيود البدنية: لا أكثر من السقف، ولا اختلاط للثالث المتوسط مع غيره.
    const assignmentById = new Map(data.assignments.map((a) => [a.id, a]));
    const peSubjects = new Set(data.subjects.filter((s) => isPE(s.name)).map((s) => s.id));
    const slots = new Map<string, { count: number; third: number; other: number }>();
    for (const lesson of result.lessons) {
      const assignment = assignmentById.get(lesson.assignmentId);
      if (!assignment || !peSubjects.has(assignment.subjectId)) continue;
      const key = `${lesson.day}:${lesson.period}`;
      const entry = slots.get(key) ?? { count: 0, third: 0, other: 0 };
      entry.count++;
      const grade = gradeOf(data.classes.find((c) => c.id === assignment.classId)!.name);
      if (grade === 3) entry.third++;
      else entry.other++;
      slots.set(key, entry);
    }
    const capacity = data.options.peCapacity;
    expect(Math.max(...[...slots.values()].map((s) => s.count))).toBeLessThanOrEqual(capacity);
    expect([...slots.values()].filter((s) => s.count >= 3 && s.third > 0)).toHaveLength(0);
  });
});
