import { describe, expect, it } from 'vitest';
import { upsertAssignments } from '../src/lib/assign';
import type { Assignment } from '../src/types';

const base: Assignment[] = [
  { id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', count: 3 },
  { id: 'a2', classId: 'c2', subjectId: 's2', teacherId: 't2', count: 2 },
];

describe('الإسنادات', () => {
  it('يضيف إسنادات جديدة لعدة فصول', () => {
    const next = upsertAssignments(base, [
      { classId: 'c3', subjectId: 's1', teacherId: 't3', count: 2 },
      { classId: 'c4', subjectId: 's1', teacherId: 't3', count: 1 },
    ]);
    expect(next).toHaveLength(4);
    expect(next.filter((a) => a.teacherId === 't3')).toHaveLength(2);
  });

  it('ينقل إسناد الفصل والمادة إلى المعلم الجديد مع تحديث العدد', () => {
    const next = upsertAssignments(base, [{ classId: 'c1', subjectId: 's1', teacherId: 't9', count: 4 }]);
    expect(next).toHaveLength(2);
    const updated = next.find((a) => a.id === 'a1')!;
    expect(updated.teacherId).toBe('t9');
    expect(updated.count).toBe(4);
  });

  it('لا يسمح بعدد سالب', () => {
    const next = upsertAssignments(base, [{ classId: 'c1', subjectId: 's1', teacherId: 't1', count: -2 }]);
    expect(next[0].count).toBe(0);
  });
});
