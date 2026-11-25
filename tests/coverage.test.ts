import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type SchoolData } from '../src/types';
import { normalizeData } from '../src/lib/model';
import { autoCover, candidatesFor, coverageMessage } from '../src/lib/coverage';

const base = normalizeData(raw as unknown as SchoolData);
const date = '2026-09-27'; // الأحد

function fixture(): SchoolData {
  return {
    ...base,
    school: 'مدرسة اختبار',
    term: 'الفصل الدراسي الأول · ١٤٤٨ هـ',
    periods: 7,
    days: 5,
    subjects: [{ id: 's1', name: 'الرياضيات', color: 0 }],
    teachers: [
      { id: 'absent', name: 'الغائب', subject: 's1', additionalSubjects: [], max: 24, off: [] },
      { id: 'other2', name: 'معلم الثاني', subject: 's1', additionalSubjects: [], max: 24, off: [] },
      { id: 'other3', name: 'معلم الثالث', subject: 's1', additionalSubjects: [], max: 24, off: [] },
      { id: 'same', name: 'معلم الأول', subject: 's1', additionalSubjects: [], max: 24, off: [] },
    ],
    classes: [
      { id: 'c1', name: 'الأول متوسط / 1', room: 'r1' },
      { id: 'c2', name: 'الثاني متوسط / 1', room: 'r2' },
      { id: 'c3', name: 'الثالث متوسط / 1', room: 'r3' },
    ],
    assignments: [
      { id: 'aAbs', classId: 'c1', subjectId: 's1', teacherId: 'absent', count: 1 },
      { id: 'a2', classId: 'c2', subjectId: 's1', teacherId: 'other2', count: 1 },
      { id: 'a3', classId: 'c3', subjectId: 's1', teacherId: 'other3', count: 1 },
      { id: 'a4', classId: 'c1', subjectId: 's1', teacherId: 'same', count: 1 },
    ],
    lessons: [
      { id: 'lAbs', assignmentId: 'aAbs', day: 0, period: 0 },
      { id: 'l2', assignmentId: 'a2', day: 0, period: 5 },
      { id: 'l3', assignmentId: 'a3', day: 0, period: 5 },
      { id: 'l4', assignmentId: 'a4', day: 0, period: 2 },
    ],
    absences: [{ date, teacherId: 'absent' }],
    covers: [],
    admins: [],
    exams: { periodic: [], official: [] },
    options: { ...DEFAULT_OPTIONS },
  };
}

describe('الانتظار: الترشيح والرسالة والإداريون', () => {
  it('يفضّل معلمًا يدرّس نفس صف الحصة', () => {
    const school = fixture();
    const lesson = school.lessons.find((l) => l.id === 'lAbs')!;
    const candidates = candidatesFor(school, lesson, date);
    expect(candidates[0].id).toBe('same');
  });

  it('يضيف الإداريين كبدلاء ويحترم عدد حصصهم', () => {
    const school = fixture();
    school.admins = [{ id: 'adm', name: 'مدير المدرسة', periods: 1 }];
    const lesson = school.lessons.find((l) => l.id === 'lAbs')!;
    expect(candidatesFor(school, lesson, date).some((c) => c.id === 'adm')).toBe(true);
    expect(candidatesFor(school, lesson, date, new Map([['adm', 1]])).some((c) => c.id === 'adm')).toBe(false);
  });

  it('يوزّع على الإداري عند غياب كل المعلمين ضمن عدده', () => {
    const school = fixture();
    school.admins = [{ id: 'adm', name: 'مدير المدرسة', periods: 2 }];
    school.absences = school.teachers.map((t) => ({ date, teacherId: t.id }));
    const result = autoCover({ ...school, covers: [] }, date);
    expect(result.covers.length).toBeGreaterThan(0);
    expect(result.covers.every((c) => c.teacherId === 'adm')).toBe(true);
    expect(result.covers.length).toBeLessThanOrEqual(2);
  });

  it('يعطي الإداري حصصه المحددة حتى مع وجود المعلمين', () => {
    const school = fixture();
    school.admins = [{ id: 'adm', name: 'مدير المدرسة', periods: 1 }];
    school.absences = [
      { date, teacherId: 'absent' },
      { date, teacherId: 'other2' },
    ];
    const result = autoCover({ ...school, covers: [] }, date);
    expect(result.covers).toHaveLength(2);
    expect(result.covers.filter((c) => c.teacherId === 'adm')).toHaveLength(1);
  });

  it('يقلب ترتيب الصف والفصل في سطر الرسالة', () => {
    const school = fixture();
    school.classes = [{ id: 'c8', name: 'الأول متوسط / 8', room: 'r8' }];
    school.assignments = [{ id: 'a8', classId: 'c8', subjectId: 's1', teacherId: 'absent', count: 1 }];
    school.lessons = [{ id: 'l8', assignmentId: 'a8', day: 0, period: 3 }];
    school.absences = [{ date, teacherId: 'absent' }];
    const covers = [{ id: 'cv8', date, lessonId: 'l8', teacherId: 'same' }];
    const message = coverageMessage(school, date, covers);
    expect(message).toContain('معلم الأول - 1 / 8');
  });

  it('يبني الرسالة بالتنسيق المطلوب', () => {
    const school = fixture();
    const lesson = school.lessons.find((l) => l.id === 'lAbs')!;
    const covers = [{ id: 'cv1', date, lessonId: lesson.id, teacherId: 'same' }];
    const message = coverageMessage(school, date, covers);
    const lines = message.split('\n');
    expect(lines[0]).toBe('المعلمين الغائبين لليوم');
    expect(lines[1]).toContain('هـ');
    expect(lines[1]).toContain('الأحد');
    expect(lines[2]).toBe('1- الغائب');
    expect(message).toContain('توزيع الانتظار');
    expect(message).toContain('الحصة الأولى:');
    expect(message).toContain('معلم الأول - 1 / 1');
    expect(message).toContain('---------------------');
  });
});
