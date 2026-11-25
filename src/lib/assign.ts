import type { Assignment } from '../types';
import { uid } from './utils';

export interface AssignInput {
  classId: string;
  subjectId: string;
  teacherId: string;
  count: number;
}

/**
 * إضافة/تحديث إسنادات بشكل احترافي: لكل (فصل + مادة) إسناد واحد فقط،
 * فإذا وُجد إسناد سابق لمعلم آخر يُنقل إلى المعلم الجديد مع تحديث العدد.
 */
export function upsertAssignments(list: Assignment[], inputs: AssignInput[]): Assignment[] {
  const next = [...list];
  for (const input of inputs) {
    const count = Math.max(0, Math.round(input.count));
    const index = next.findIndex((a) => a.classId === input.classId && a.subjectId === input.subjectId);
    if (index >= 0) {
      next[index] = { ...next[index], teacherId: input.teacherId, count };
    } else {
      next.push({ id: uid('a'), classId: input.classId, subjectId: input.subjectId, teacherId: input.teacherId, count });
    }
  }
  return next;
}

/** إسنادات فصل ومادة معيّنين (للتحقق من وجود إسناد سابق). */
export function assignmentFor(list: Assignment[], classId: string, subjectId: string): Assignment | undefined {
  return list.find((a) => a.classId === classId && a.subjectId === subjectId);
}
