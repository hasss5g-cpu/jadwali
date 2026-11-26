import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { SchoolData } from '../types';
import { DAY_NAMES, gradeOf, lessonTeacherId } from '../lib/model';

export type MasterMode = 'teacher' | 'class';

interface Cell {
  subject: string;
  meta: string;
  metaFull?: string;
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
    const classFull = classById.get(assignment.classId) ?? '';
    const teacherFull = teacherById.get(lessonTeacherId(data, lesson)) ?? '';
    const meta =
      mode === 'teacher'
        ? shortStageName(classFull)
        : shortTeacherName(teacherFull);
    row.cells.set(`${lesson.day}:${lesson.period}`, {
      subject,
      meta,
      metaFull: mode === 'teacher' ? classFull : teacherFull,
    });
  }
  return rows;
}

/** اسم المادة المختصر للجدول العام: «الدراسات الإسلامية» ← «إسلامية». */
export function shortSubjectName(name: string): string {
  const rules: [RegExp, string][] = [
    [/إسلام|اسلام/, 'إسلامية'],
    [/اجتماع/, 'اجتماعيات'],
    [/إنجليز|انجليز/, 'إنجليزي'],
    [/لغتي/, 'لغتي'],
    [/رقمي/, 'رقمي'],
    [/حيات/, 'حياتية'],
    [/فني/, 'فنية'],
    [/بدني/, 'بدنية'],
    [/ناقد/, 'تفكير'],
    [/رياض/, 'رياضيات'],
    [/علوم/, 'علوم'],
    [/نشاط/, 'نشاط'],
  ];
  const clean = name.replace(/[\u064B-\u0652]/g, '').trim();
  for (const [pattern, short] of rules) if (pattern.test(clean)) return short;
  // احتياط: إزالة البادئات الشائعة واللاحقات الطويلة.
  return clean
    .replace(/^(الدراسات|اللغة|التربية|المهارات)\s+/, '')
    .replace(/\s+الخالدة$/, '')
    .trim();
}

/** اسم المرحلة والفصل بلا «متوسط»: «الثاني متوسط / 6» ← «ثاني / 6». */
export function shortStageName(name: string): string {
  const grade = gradeOf(name);
  const number = name.match(/(\d+)\s*$/)?.[1];
  const label = grade === 1 ? 'أول' : grade === 2 ? 'ثاني' : grade === 3 ? 'ثالث' : '';
  if (!number || !label) return name.replace(/متوسط/g, '').replace(/\s+/g, ' ').trim();
  return `${label} / ${number}`;
}

/** اسم الفصل المختصر: «الثالث متوسط / 1» ← «1/3» (رقم الفصل / رقم الصف). */
export function shortClassName(name: string): string {
  const grade = gradeOf(name);
  const number = name.match(/(\d+)\s*$/)?.[1];
  if (grade === null || !number) return name;
  return `${number}/${grade}`;
}

/** اسم المعلم المختصر للجدول العام: «عبدالله فيصل الصاعدي» ← «عبدالله الصاعدي». */
export function shortTeacherName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return `${parts[0]} ${parts[parts.length - 1]}`;
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
                          <span className="master-subject" title={cell.subject}>
                            {shortSubjectName(cell.subject)}
                          </span>
                          <span className="master-meta" title={cell.metaFull ?? cell.meta}>
                            {cell.meta}
                          </span>
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
/** هوامش صفحة الجدول العام بالمليمتر (تطابق CSS @page). */
export const MASTER_MARGINS = { top: 12, right: 6, bottom: 12, left: 6 };

export function FitToPage({ orientation, children }: { orientation: 'portrait' | 'landscape'; children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ zoom: 1, width: 0, rowHeight: 0 });

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const table = inner.querySelector('table');
    const toPx = (mm: number) => (mm * 96) / 25.4;
    const [pageWidth, pageHeight] = orientation === 'portrait' ? [297, 420] : [420, 297];
    // هامش أمان 4مم رأسيًا و1مم أفقيًا لتفادي كسر الصفحة بسبب التقريب.
    const availableWidth = toPx(pageWidth - MASTER_MARGINS.left - MASTER_MARGINS.right - 1);
    const availableHeight = toPx(pageHeight - MASTER_MARGINS.top - MASTER_MARGINS.bottom - 4);

    // قياس المحتوى بعرضه الطبيعي (بدون تمديد) ثم حساب التصغير والتمديد.
    const previousZoom = outer.style.zoom;
    const previousWidth = inner.style.width;
    const previousTableWidth = table?.style.width ?? '';
    outer.style.zoom = '1';
    inner.style.width = 'max-content';
    outer.style.removeProperty('--master-row-px');
    if (table) table.style.width = 'max-content';
    const naturalWidth = inner.getBoundingClientRect().width;
    const bodyRows = Array.from(inner.querySelectorAll('tbody tr'));
    const rows = bodyRows.length;
    const bodyHeight =
      bodyRows.reduce((total, row) => total + row.getBoundingClientRect().height, 0) || 0;
    const fixedHeight = Math.max(0, inner.getBoundingClientRect().height - bodyHeight);
    if (table) table.style.width = previousTableWidth;
    inner.style.width = previousWidth;
    outer.style.zoom = previousZoom || '1';
    if (!naturalWidth || !rows || naturalWidth > 100000) return;

    const scale = Math.max(0.1, Math.min(availableWidth / naturalWidth, 1));
    const innerWidth = Math.round(availableWidth / scale);
    const rowHeight = Math.max(0, Math.floor(((availableHeight / scale - fixedHeight) / rows) * 100) / 100);
    const roundedZoom = Number(scale.toFixed(4));
    if (
      Math.abs(roundedZoom - fit.zoom) > 0.001 ||
      Math.abs(innerWidth - fit.width) > 1 ||
      Math.abs(rowHeight - fit.rowHeight) > 0.5
    ) {
      setFit({ zoom: roundedZoom, width: innerWidth, rowHeight });
    }
  }, [orientation, fit]);

  // تثبيت ارتفاع الصفوف على العنصر الأب (متغيّر CSS) بعد كل حساب.
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    if (fit.rowHeight > 0) outer.style.setProperty('--master-row-px', `${fit.rowHeight}px`);
  }, [fit.rowHeight]);

  return (
    <div ref={outerRef} style={{ zoom: fit.zoom }}>
      <div ref={innerRef} style={{ width: fit.width ? `${fit.width}px` : 'max-content' }}>
        {children}
      </div>
    </div>
  );
}

