import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type SchoolData } from '../src/types';
import { normalizeData } from '../src/lib/model';

const real = normalizeData(raw as unknown as SchoolData);

describe('خطة حصص المواد بحسب المرحلة', () => {
  it('يهيئ الخطة تلقائيًا من الإسنادات الحالية', () => {
    expect(real.subjects.every((subject) => subject.stages !== undefined)).toBe(true);
    for (const subject of real.subjects) {
      expect(typeof subject.stages?.[1]).toBe('number');
      expect(typeof subject.stages?.[2]).toBe('number');
      expect(typeof subject.stages?.[3]).toBe('number');
    }
  });

  it('يشتق عدد الحصص لكل مرحلة من إسناداتها', () => {
    const data = normalizeData({
      ...real,
      classes: [
        { id: 'c1', name: 'الأول متوسط / 1', room: 'r1' },
        { id: 'c3', name: 'الثالث متوسط / 1', room: 'r3' },
      ],
      subjects: [{ id: 's1', name: 'الرياضيات', color: 0 }],
      assignments: [
        { id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', count: 4 },
        { id: 'a2', classId: 'c3', subjectId: 's1', teacherId: 't1', count: 6 },
      ],
      lessons: [],
      options: { ...DEFAULT_OPTIONS },
    });
    expect(data.subjects[0].stages).toEqual({ 1: 4, 2: 0, 3: 6 });
  });

  it('يحافظ على الخطة إذا حُددت يدويًا', () => {
    const data = normalizeData({
      ...real,
      subjects: real.subjects.map((subject, index) =>
        index === 0 ? { ...subject, stages: { 1: 9, 2: 8, 3: 7 } } : subject,
      ),
    });
    expect(data.subjects[0].stages).toEqual({ 1: 9, 2: 8, 3: 7 });
  });
});
