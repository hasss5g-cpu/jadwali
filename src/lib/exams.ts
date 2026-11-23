import type { ExamSlot, ID, SchoolData } from '../types';

const CORE = [/لغتي/, /رياضيات/, /علوم/, /إنجليزي/, /إسلام/, /اجتماع/];

export type ExamKind = 'periodic' | 'official';

/**
 * يولّد جدول اختبارات: لكل فصل مادة واحدة لكل اختبار، بحد أقصى اختبارين في اليوم،
 * وبلا تعارض للمعلم (لا يشرف على اختبارين في الموعد نفسه).
 */
export function generateExams(data: SchoolData, kind: ExamKind): ExamSlot[] {
  const perDay = 2;
  const slots = data.periods >= 2 ? [0, 1] : [0];
  const teacherBusy = new Map<string, ID>();
  const usedClassSlot = new Set<string>();
  const classDay = new Map<string, number>();
  const dayLoad = new Map<number, number>();
  const out: ExamSlot[] = [];

  const subjectOf = (id: string) => data.subjects.find((s) => s.id === id);
  const isCore = (id: string) => {
    const name = subjectOf(id)?.name ?? '';
    return CORE.some((re) => re.test(name));
  };

  const classes = [...data.classes].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  for (const cls of classes) {
    const subjects = [...new Set(
      data.assignments.filter((a) => a.classId === cls.id).map((a) => a.subjectId),
    )].filter((id) => (kind === 'official' ? isCore(id) : true));
    subjects.sort((a, b) => (subjectOf(a)?.name ?? '').localeCompare(subjectOf(b)?.name ?? '', 'ar'));
    for (const subjectId of subjects) {
      const assignment = data.assignments.find((a) => a.classId === cls.id && a.subjectId === subjectId);
      if (!assignment) continue;
      let placed: ExamSlot | null = null;
      let bestCost = Infinity;
      for (let day = 0; day < data.days; day++) {
        const dayKey = `${cls.id}:${day}`;
        if ((classDay.get(dayKey) ?? 0) >= perDay) continue;
        for (const period of slots) {
          if (usedClassSlot.has(`${cls.id}:${day}:${period}`)) continue;
          if (teacherBusy.has(`${assignment.teacherId}:${day}:${period}`)) continue;
          const cost =
            (classDay.get(dayKey) ?? 0) * 20 +
            (dayLoad.get(day) ?? 0) * 2 +
            day * 0.5 +
            period;
          if (cost < bestCost) {
            bestCost = cost;
            placed = { classId: cls.id, subjectId, day, period };
          }
        }
      }
      if (placed) {
        out.push(placed);
        usedClassSlot.add(`${cls.id}:${placed.day}:${placed.period}`);
        classDay.set(`${cls.id}:${placed.day}`, (classDay.get(`${cls.id}:${placed.day}`) ?? 0) + 1);
        dayLoad.set(placed.day, (dayLoad.get(placed.day) ?? 0) + 1);
        teacherBusy.set(`${assignment.teacherId}:${placed.day}:${placed.period}`, cls.id);
      }
    }
  }
  return out.sort((a, b) => a.day - b.day || a.period - b.period || a.classId.localeCompare(b.classId));
}

/** فحص تعارضات جدول الاختبارات. */
export function validateExams(data: SchoolData, exams: ExamSlot[]): string[] {
  const errors: string[] = [];
  const byClass = new Map<string, ExamSlot>();
  const byTeacher = new Map<string, ExamSlot>();
  const classDay = new Map<string, number>();
  for (const exam of exams) {
    const assignment = data.assignments.find((a) => a.classId === exam.classId && a.subjectId === exam.subjectId);
    if (!assignment) {
      errors.push(`اختبار بلا إسناد: ${exam.classId}`);
      continue;
    }
    const key = `${exam.classId}:${exam.day}:${exam.period}`;
    if (byClass.has(key)) errors.push(`اختباران لنفس الفصل في الموعد نفسه (${exam.day + 1}/${exam.period + 1})`);
    byClass.set(key, exam);
    const teacherKey = `${assignment.teacherId}:${exam.day}:${exam.period}`;
    if (byTeacher.has(teacherKey)) {
      const t = data.teachers.find((x) => x.id === assignment.teacherId)?.name;
      errors.push(`${t}: إشراف على اختبارين في الموعد نفسه`);
    }
    byTeacher.set(teacherKey, exam);
    const dk = `${exam.classId}:${exam.day}`;
    const n = (classDay.get(dk) ?? 0) + 1;
    classDay.set(dk, n);
    if (n > 2) errors.push(`أكثر من اختبارين في يوم واحد للفصل ${exam.classId}`);
  }
  return [...new Set(errors)];
}
