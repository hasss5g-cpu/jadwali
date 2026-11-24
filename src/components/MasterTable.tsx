import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { SchoolData } from '../types';
import { DAY_NAMES, gradeOf, lessonTeacherId } from '../lib/model';

export type MasterMode = 'teacher' | 'class';

interface Cell {
  subject: string;
  meta: string;
}

interface Row {
  id: string;
  name: string;
  cells: Map<string, Cell>;
}

/** يبني صفوف الجدول العام: معلمون أو فصول، وخلايا كل موعد. */
export function masterRows(data: SchoolData, mode: MasterMode, query = ''): Row[] {
  const assignmentById = new Map(data.assignments.map((a) => [a.id, a]));
  const subjectById = new Map(data.subjects.map((s) => [s.id, s.name]));
  const classById = new Map(data.classes.map((c) => [c.id, c.name]));
  const teacherById = new Map(data.teachers.map((t) => [t.id, t.name]));

  const rows: Row[] = [];
  if (mode === 'teacher') {
    const owners = data.teachers
      .filter((teacher) => data.lessons.some((lesson) => lessonTeacherId(data, lesson) === teacher.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    for (const teacher of owners) {
      if (query && !teacher.name.includes(query)) continue;
      rows.push({ id: teacher.id, name: teacher.name, cells: new Map() });
    }
  } else {
    const classes = [...data.classes].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    for (const cls of classes) {
      if (query && !cls.name.includes(query)) continue;
      rows.push({ id: cls.id, name: cls.name, cells: new Map() });
    }
  }

  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const lesson of data.lessons) {
    const assignment = assignmentById.get(lesson.assignmentId);
    if (!assignment) continue;
    const owner = mode === 'teacher' ? lessonTeacherId(data, lesson) : assignment.classId;
    const row = byId.get(owner);
    if (!row) continue;
    const subject = subjectById.get(assignment.subjectId) ?? '—';
    const meta = mode === 'teacher'
      ? classById.get(assignment.classId) ?? ''
      : teacherById.get(lessonTeacherId(data, lesson)) ?? '';
    row.cells.set(`${lesson.day}:${lesson.period}`, { subject, meta });
  }
  return rows;
}

/** اسم الفصل المختصر: «الثالث متوسط / 1» ← «1/3» (رقم الفصل / رقم الصف). */
export function shortClassName(name: string): string {
  const grade = gradeOf(name);
  const number = name.match(/(\d+)\s*$/)?.[1];
  if (grade === null || !number) return name;
  return `${number}/${grade}`;
}

/** اسم المعلم في سطرين: الاسم الأول، ثم بقية الاسم. */
export function teacherNameLines(name: string): [string, string] {
  const [first, ...rest] = name.trim().split(/\s+/);
  return [first ?? '', rest.join(' ')];
}

export function MasterTable({
  data,
  mode,
  query = '',
  print = false,
}: {
  data: SchoolData;
  mode: MasterMode;
  query?: string;
  print?: boolean;
}) {
  const rows = masterRows(data, mode, query);
  const periods = Array.from({ length: data.periods }, (_, index) => index);
  const label = mode === 'teacher' ? 'المعلم' : 'الفصل';

  return (
    <div className={print ? 'master-print' : 'master-scroll'}>
      <table className={`master-table master--${mode}`}>
        <thead>
          <tr>
            <th rowSpan={2} className="name-col">
              {label}
            </th>
            {DAY_NAMES.slice(0, data.days).map((day) => (
              <th key={day} colSpan={data.periods} className="day-head">
                {day}
              </th>
            ))}
          </tr>
          <tr>
            {DAY_NAMES.slice(0, data.days).flatMap((day) =>
              periods.map((period) => (
                <th key={`${day}-${period}`} className="period-head">
                  {period + 1}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th className="name-col" title={row.name}>
                {mode === 'class' ? (
                  shortClassName(row.name)
                ) : (
                  <>
                    <span className="name-line">{teacherNameLines(row.name)[0]}</span>
                    <span className="name-line">{teacherNameLines(row.name)[1]}</span>
                  </>
                )}
              </th>
              {DAY_NAMES.slice(0, data.days).flatMap((day, dayIndex) =>
                periods.map((period) => {
                  const cell = row.cells.get(`${dayIndex}:${period}`);
                  return (
                    <td key={`${day}-${period}`} data-empty={!cell}>
                      {cell ? (
                        <>
                          <span className="master-subject">{cell.subject}</span>
                          <span className="master-meta">{cell.meta}</span>
                        </>
                      ) : (
                        ''
                      )}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-4 text-center text-[12px] text-[var(--muted)]">لا نتائج مطابقة.</p>}
    </div>
  );
}

export function masterTitle(mode: MasterMode): string {
  return mode === 'teacher' ? 'الجدول العام — ترتيب المعلمين' : 'الجدول العام — ترتيب الفصول';
}

export function masterSubtitle(data: SchoolData, mode: MasterMode): string {
  const count = mode === 'teacher' ? data.teachers.length : data.classes.length;
  return `${data.school} · ${data.term} · ${mode === 'teacher' ? 'المعلمون' : 'الفصول'}: ${count} · ${data.lessons.length} حصة`;
}

/**
 * يصغّر المحتوى تلقائيًا ليدخل في صفحة واحدة بمقاس A3 (طولية أو عرضية)
 * بهوامش 4مم، عبر ضبط zoom حسب القياس الفعلي للجدول.
 */
export function FitToPage({ orientation, children }: { orientation: 'portrait' | 'landscape'; children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const toPx = (mm: number) => (mm * 96) / 25.4;
    const [pageWidth, pageHeight] = orientation === 'portrait' ? [297, 420] : [420, 297];
    const availableWidth = toPx(pageWidth - 8);
    const availableHeight = toPx(pageHeight - 8);

    // قياس المحتوى بحجمه الطبيعي (بدون تكبير) لتفادي التغذية الراجعة.
    const previousZoom = outer.style.zoom;
    outer.style.zoom = '1';
    const naturalWidth = inner.scrollWidth || inner.getBoundingClientRect().width;
    const naturalHeight = inner.scrollHeight || inner.getBoundingClientRect().height;
    outer.style.zoom = previousZoom || '1';

    if (!naturalWidth || !naturalHeight) return;
    const next = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1);
    const rounded = Number(next.toFixed(4));
    if (Math.abs(rounded - zoom) > 0.001) setZoom(rounded);
  }, [orientation, zoom, children]);

  return (
    <div ref={outerRef} style={{ zoom }}>
      <div ref={innerRef} style={{ width: 'max-content' }}>
        {children}
      </div>
    </div>
  );
}
