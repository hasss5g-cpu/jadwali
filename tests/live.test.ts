import { describe, expect, it } from 'vitest';
import raw from '../src/data/school.json';
import { DEFAULT_OPTIONS, type SchoolData } from '../src/types';
import { normalizeData } from '../src/lib/model';
import { liveSnapshot } from '../src/views/LiveView';

const real = normalizeData(raw as unknown as SchoolData);

function fixture(): SchoolData {
  return {
    ...real,
    periods: 4,
    days: 5,
    duration: 45,
    season: 'summer',
    start: '07:00',
    breaks: { first: 25, second: 25 },
    gradeBreak: { 1: 3, 2: 3, 3: 2 },
    subjects: [{ id: 's1', name: 'الرياضيات', color: 0 }],
    teachers: [
      { id: 't1', name: 'معلم أول', subject: 's1', additionalSubjects: [], max: 24, off: [] },
      { id: 't2', name: 'معلم ثالث', subject: 's1', additionalSubjects: [], max: 24, off: [] },
    ],
    classes: [
      { id: 'c1', name: 'الأول متوسط / 1', room: 'r1' },
      { id: 'c3', name: 'الثالث متوسط / 1', room: 'r3' },
    ],
    assignments: [
      { id: 'a1', classId: 'c1', subjectId: 's1', teacherId: 't1', count: 1 },
      { id: 'a2', classId: 'c3', subjectId: 's1', teacherId: 't2', count: 1 },
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
  };
}

const sunday = (h: number, m: number) => new Date(2026, 8, 27, h, m, 0);

describe('الجدول لايف', () => {
  it('يعرض الحصة الجارية والمادة والمعلم', () => {
    const snapshot = liveSnapshot(fixture(), sunday(9, 0));
    expect(snapshot.weekend).toBe(false);
    expect(snapshot.periods).toEqual([3]);
    expect(snapshot.lessons).toHaveLength(2);
    const first = snapshot.lessons.find((item) => item.cls.id === 'c1')!;
    expect(first.subject).toBe('الرياضيات');
    expect(first.teacher).toBe('معلم أول');
    expect(first.time).toBe('8:30 ص–9:15 ص');
    expect(snapshot.busyTeachers).toBe(2);
  });

  it('يميّز الفسحة باختلاف موعد فسحة الصف', () => {
    const snapshot = liveSnapshot(fixture(), sunday(8, 35));
    const third = snapshot.classes.find((item) => item.cls.id === 'c3')!;
    expect(third.state).toBe('break');
    expect(snapshot.breaks).toHaveLength(1);
    expect(snapshot.breaks[0].cls.id).toBe('c3');
    expect(snapshot.lessons).toHaveLength(1);
  });

  it('يميّز المعلم الغائب ويعرض البديل', () => {
    const school = fixture();
    school.absences = [{ date: '2026-09-27', teacherId: 't1' }];
    school.covers = [{ id: 'cv1', date: '2026-09-27', lessonId: 'l1', teacherId: 't2' }];
    const snapshot = liveSnapshot(school, sunday(9, 0));
    const first = snapshot.lessons.find((item) => item.cls.id === 'c1')!;
    expect(first.absent).toBe(true);
    expect(first.substitute).toBe('معلم ثالث');
    const other = snapshot.lessons.find((item) => item.cls.id === 'c3')!;
    expect(other.absent).toBe(false);
  });

  it('يعرض «لم يُغطَّ بعد» عند غياب بلا بديل', () => {
    const school = fixture();
    school.absences = [{ date: '2026-09-27', teacherId: 't1' }];
    const snapshot = liveSnapshot(school, sunday(9, 0));
    const first = snapshot.lessons.find((item) => item.cls.id === 'c1')!;
    expect(first.absent).toBe(true);
    expect(first.substitute).toBeNull();
  });

  it('يحسب عدّاد بداية الحصة ونهايتها', () => {
    const snapshot = liveSnapshot(fixture(), sunday(9, 0));
    expect(snapshot.elapsedMinutes).toBe(30);
    expect(snapshot.remainingMinutes).toBe(15);
    expect(snapshot.elapsedMinutes! + snapshot.remainingMinutes!).toBe(45);
    const duringBreak = liveSnapshot(fixture(), sunday(8, 35));
    expect(duringBreak.elapsedMinutes).toBe(5);
    expect(duringBreak.remainingMinutes).toBe(40);
  });

  it('يعرض نهاية الأسبوع وبعد الدوام', () => {
    const weekend = liveSnapshot(fixture(), new Date(2026, 8, 26, 9, 0, 0));
    expect(weekend.weekend).toBe(true);
    const after = liveSnapshot(fixture(), sunday(14, 0));
    expect(after.afterSchool).toBe(true);
    expect(after.lessons).toHaveLength(0);
  });
});
