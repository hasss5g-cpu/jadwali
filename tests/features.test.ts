import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import type { SchoolData } from '../src/types';
import { normalizeData } from '../src/lib/model';
import { absentLessons, autoCover, candidatesFor, coverageMessage } from '../src/lib/coverage';
import { generateExams, validateExams } from '../src/lib/exams';

const data = normalizeData(raw as unknown as SchoolData);
const date = '2026-09-27'; // الأحد

describe('الانتظار والغطاء', () => {
  it('يجد حصص الغائبين في اليوم نفسه', () => {
    const absent = data.teachers.slice(0, 3).map((t) => t.id);
    const working = { ...data, absences: absent.map((teacherId) => ({ date, teacherId })), covers: [] };
    const lessons = absentLessons(working, date);
    expect(lessons.length).toBeGreaterThan(0);
    expect(lessons.every((l) => l.day === 0)).toBe(true);
  });

  it('يوزّع البدلاء دون مضاعفة معلم في الحصة نفسها', () => {
    const absent = data.teachers.slice(0, 5).map((t) => t.id);
    const working = { ...data, absences: absent.map((teacherId) => ({ date, teacherId })), covers: [] };
    const result = autoCover(working, date);
    expect(result.covers.length).toBeGreaterThan(0);
    const keys = result.covers.map((c) => c.teacherId + ':' + c.lessonId);
    expect(new Set(keys).size).toBe(keys.length);
    const periodByTeacher = new Map<string, Set<number>>();
    for (const cover of result.covers) {
      const lesson = working.lessons.find((l) => l.id === cover.lessonId)!;
      const set = periodByTeacher.get(cover.teacherId) ?? new Set<number>();
      expect(set.has(lesson.period)).toBe(false);
      set.add(lesson.period);
      periodByTeacher.set(cover.teacherId, set);
    }
  });

  it('لا يرشح معلمًا غائبًا أو مشغولًا', () => {
    const absentTeacher = data.teachers[0].id;
    const working = { ...data, absences: [{ date, teacherId: absentTeacher }], covers: [] };
    const lesson = working.lessons.find((l) => {
      const a = working.assignments.find((x) => x.id === l.assignmentId);
      return a?.teacherId === absentTeacher && l.day === 0;
    });
    if (!lesson) return;
    const names = candidatesFor(working, lesson, date).map((c) => c.id);
    expect(names).not.toContain(absentTeacher);
  });

  it('يبني رسالة واتساب مجمّعة حسب المعلم الغائب', () => {
    const absent = data.teachers.slice(0, 2).map((t) => t.id);
    const working = { ...data, absences: absent.map((teacherId) => ({ date, teacherId })), covers: [] };
    const result = autoCover(working, date);
    const message = coverageMessage(working, date, result.covers);
    expect(message).toContain('المعلم الغائب');
    expect(message).toContain('المعلم المنتظر');
    expect(message.split('\n')[0]).toBe(data.school);
  });
});

describe('جدول الاختبارات', () => {
  it('يولّد فترية بلا تعارض', () => {
    const exams = generateExams(data, 'periodic');
    expect(exams.length).toBeGreaterThan(data.classes.length);
    expect(validateExams(data, exams)).toEqual([]);
  });

  it('الرسمية للمواد الأساسية فقط', () => {
    const exams = generateExams(data, 'official');
    expect(exams.length).toBeGreaterThan(0);
    expect(validateExams(data, exams)).toEqual([]);
    const subjects = new Set(exams.map((e) => e.subjectId));
    const names = [...subjects].map((id) => data.subjects.find((s) => s.id === id)?.name ?? '');
    expect(names.every((n) => /لغتي|رياضيات|علوم|إنجليزي|إسلام|اجتماع/.test(n))).toBe(true);
  });
});
