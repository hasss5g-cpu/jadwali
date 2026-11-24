import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import type { SchoolData } from '../src/types';
import { lessonTeacherId, normalizeData } from '../src/lib/model';
import { masterRows, shortClassName, shortSubjectName, teacherNameLines } from '../src/components/MasterTable';

const data = normalizeData(raw as unknown as SchoolData);

describe('الجدول العام', () => {
  it('يعرض صفًا لكل معلم لديه حصص', () => {
    const rows = masterRows(data, 'teacher');
    const teachersWithLessons = new Set(data.lessons.map((lesson) => lessonTeacherId(data, lesson)));
    expect(rows).toHaveLength(teachersWithLessons.size);
    const cells = rows.reduce((total, row) => total + row.cells.size, 0);
    expect(cells).toBe(data.lessons.length);
  });

  it('يعرض صفًا لكل فصل', () => {
    const rows = masterRows(data, 'class');
    expect(rows).toHaveLength(data.classes.length);
    const cells = rows.reduce((total, row) => total + row.cells.size, 0);
    expect(cells).toBe(data.lessons.length);
  });

  it('يفلتر بالبحث', () => {
    const name = data.teachers[0].name;
    const rows = masterRows(data, 'teacher', name);
    expect(rows.every((row) => row.name.includes(name))).toBe(true);
  });

  it('الخلايا تحمل المادة وبيانات الجهة الأخرى', () => {
    const rows = masterRows(data, 'class');
    const cell = [...rows[0].cells.values()][0];
    expect(cell.subject.length).toBeGreaterThan(0);
    expect(cell.meta.length).toBeGreaterThan(0);
  });

  it('يختصر أسماء الفصول إلى رقم الفصل/الصف', () => {
    expect(shortClassName('الأول متوسط / 1')).toBe('1/1');
    expect(shortClassName('الثالث متوسط / 1')).toBe('1/3');
    expect(shortClassName('الثاني متوسط / 8')).toBe('8/2');
  });

  it('يقسم اسم المعلم إلى سطرين', () => {
    expect(teacherNameLines('إبراهيم الأحمدي')).toEqual(['إبراهيم', 'الأحمدي']);
    expect(teacherNameLines('عبدالله فيصل الصاعدي')).toEqual(['عبدالله', 'فيصل الصاعدي']);
  });

  it('يختصر أسماء المواد للجدول العام', () => {
    expect(shortSubjectName('الدراسات الإسلامية')).toBe('إسلامية');
    expect(shortSubjectName('الدراسات الاجتماعية')).toBe('اجتماعيات');
    expect(shortSubjectName('اللغة الإنجليزية')).toBe('إنجليزي');
    expect(shortSubjectName('لغتي الخالدة')).toBe('لغتي');
    expect(shortSubjectName('المهارات الرقمية')).toBe('رقمي');
    expect(shortSubjectName('المهارات الحياتية')).toBe('حياتية');
    expect(shortSubjectName('التربية الفنية')).toBe('فنية');
    expect(shortSubjectName('التربية البدنية')).toBe('بدنية');
    expect(shortSubjectName('الرياضيات')).toBe('رياضيات');
    expect(shortSubjectName('العلوم')).toBe('علوم');
    expect(shortSubjectName('التفكير الناقد')).toBe('تفكير');
    expect(shortSubjectName('النشاط')).toBe('نشاط');
  });
});
