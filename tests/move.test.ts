import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { type SchoolData } from '../src/types';
import { lessonTeacherId, normalizeData, validate } from '../src/lib/model';
import { planMove } from '../src/lib/move';

const data = normalizeData(raw as unknown as SchoolData);

describe('نقل حصة داخل جدول المعلم', () => {
  it('ينقل الحصة ويبادل موعدها مع حصة الفصل نفسها', () => {
    const source = data.lessons[0];
    const teacherId = lessonTeacherId(data, source);
    const freeSlot = (() => {
      for (let day = 0; day < data.days; day++) {
        for (let period = 0; period < data.periods; period++) {
          const busy = data.lessons.some(
            (lesson) => lessonTeacherId(data, lesson) === teacherId && lesson.day === day && lesson.period === period,
          );
          if (!busy) return { day, period };
        }
      }
      return null;
    })();

    if (!freeSlot) return;
    const plan = planMove(data, source, freeSlot.day, freeSlot.period);
    expect(plan.noop).toBe(false);
    expect(plan.teacherBusy).toBeNull();
    expect(plan.lessons).toHaveLength(data.lessons.length);
    const moved = plan.lessons.find((lesson) => lesson.id === source.id)!;
    expect(moved.day).toBe(freeSlot.day);
    expect(moved.period).toBe(freeSlot.period);
    if (plan.ok) {
      const before = new Set(validate(data).map((issue) => issue.kind + '|' + issue.message));
      const added = validate({ ...data, lessons: plan.lessons }).filter(
        (issue) => !before.has(issue.kind + '|' + issue.message),
      );
      expect(added).toHaveLength(0);
    }
  });

  it('يمنع النقل إلى موعد يشغله المعلم نفسه', () => {
    const source = data.lessons[0];
    const other = data.lessons.find(
      (lesson) => lessonTeacherId(data, lesson) === lessonTeacherId(data, source) && lesson.id !== source.id,
    )!;
    const plan = planMove(data, source, other.day, other.period);
    expect(plan.ok).toBe(false);
    expect(plan.teacherBusy?.id).toBe(other.id);
  });

  it('يمنع النقل إلى نفس الموعد', () => {
    const source = data.lessons[0];
    const plan = planMove(data, source, source.day, source.period);
    expect(plan.noop).toBe(true);
    expect(plan.ok).toBe(false);
  });

  it('يُبقي عدد الحصص والفصول دون تعارض بعد النقل', () => {
    const source = data.lessons[0];
    const teacherId = lessonTeacherId(data, source);
    const slot = (() => {
      for (let day = 0; day < data.days; day++) {
        for (let period = 0; period < data.periods; period++) {
          const busy = data.lessons.some(
            (lesson) => lessonTeacherId(data, lesson) === teacherId && lesson.day === day && lesson.period === period,
          );
          if (!busy) return { day, period };
        }
      }
      return null;
    })();
    if (!slot) return;
    const plan = planMove(data, source, slot.day, slot.period);
    const byClass = new Map<string, Set<string>>();
    for (const lesson of plan.lessons) {
      const assignment = data.assignments.find((a) => a.id === lesson.assignmentId)!;
      const key = `${lesson.day}:${lesson.period}`;
      const set = byClass.get(assignment.classId) ?? new Set<string>();
      expect(set.has(key)).toBe(false);
      set.add(key);
      byClass.set(assignment.classId, set);
    }
    expect(plan.newIssues.filter((issue) => issue.kind === 'class-clash')).toHaveLength(0);
  });
});
