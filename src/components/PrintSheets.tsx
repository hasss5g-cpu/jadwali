import type { Cover, SchoolData } from '../types';
import { DAY_NAMES, className, subjectName, teacherName } from '../lib/model';
import { hijri, numberAr, periodTimes, today } from '../lib/utils';

export function SheetHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{ textAlign: 'center', marginBottom: 10 }}>
      <h1 style={{ margin: 0, fontSize: 18 }}>{title}</h1>
      {subtitle && <p style={{ margin: '2px 0 0', fontSize: 11, color: '#475569' }}>{subtitle}</p>}
      <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748b' }}>{hijri(today())}</p>
    </header>
  );
}

function times(data: SchoolData): string[] {
  return periodTimes(data.start, data.duration, data.periods);
}

export function ClassSheet({ data, classId }: { data: SchoolData; classId: string }) {
  const lessons = data.lessons.filter((l) => {
    const a = data.assignments.find((x) => x.id === l.assignmentId);
    return a?.classId === classId;
  });
  const find = (day: number, period: number) => {
    const lesson = lessons.find((l) => l.day === day && l.period === period);
    if (!lesson) return null;
    const a = data.assignments.find((x) => x.id === lesson.assignmentId)!;
    return { subject: subjectName(data, a.subjectId), teacher: teacherName(data, a.teacherId) };
  };
  return (
    <div>
      <SheetHead title={`جدول الفصل — ${className(data, classId)}`} subtitle={`${data.school} · ${data.term}`} />
      <table>
        <thead>
          <tr>
            <th style={{ width: 72 }}>الحصة</th>
            {DAY_NAMES.slice(0, data.days).map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: data.periods }, (_, p) => (
            <tr key={p}>
              <th>
                {p + 1}
                <div style={{ fontSize: 9, color: '#64748b' }}>{times(data)[p]}</div>
              </th>
              {DAY_NAMES.slice(0, data.days).map((_, d) => {
                const cell = find(d, p);
                return (
                  <td key={d}>
                    {cell ? (
                      <>
                        <div style={{ fontWeight: 700 }}>{cell.subject}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{cell.teacher}</div>
                      </>
                    ) : (
                      <span style={{ color: '#cbd5d1' }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TeacherSheet({ data, teacherId }: { data: SchoolData; teacherId: string }) {
  const lessons = data.lessons.filter((l) => {
    const a = data.assignments.find((x) => x.id === l.assignmentId);
    return a?.teacherId === teacherId;
  });
  const find = (day: number, period: number) => {
    const lesson = lessons.find((l) => l.day === day && l.period === period);
    if (!lesson) return null;
    const a = data.assignments.find((x) => x.id === lesson.assignmentId)!;
    return { subject: subjectName(data, a.subjectId), cls: className(data, a.classId) };
  };
  return (
    <div>
      <SheetHead
        title={`جدول المعلم — ${teacherName(data, teacherId)}`}
        subtitle={`${data.school} · ${data.term} · النصاب ${numberAr(lessons.length)} حصة`}
      />
      <table>
        <thead>
          <tr>
            <th style={{ width: 72 }}>الحصة</th>
            {DAY_NAMES.slice(0, data.days).map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: data.periods }, (_, p) => (
            <tr key={p}>
              <th>
                {p + 1}
                <div style={{ fontSize: 9, color: '#64748b' }}>{times(data)[p]}</div>
              </th>
              {DAY_NAMES.slice(0, data.days).map((_, d) => {
                const cell = find(d, p);
                return (
                  <td key={d}>
                    {cell ? (
                      <>
                        <div style={{ fontWeight: 700 }}>{cell.subject}</div>
                        <div style={{ fontSize: 10, color: '#475569' }}>{cell.cls}</div>
                      </>
                    ) : (
                      <span style={{ color: '#cbd5d1' }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AssignmentsSheet({ data }: { data: SchoolData }) {
  const rows = data.teachers
    .map((teacher) => {
      const own = data.assignments.filter((a) => a.teacherId === teacher.id);
      return { teacher, own, quota: own.reduce((n, a) => n + a.count, 0) };
    })
    .filter((row) => row.own.length);
  return (
    <div>
      <SheetHead title="بيان إسناد الحصص" subtitle={`${data.school} · ${data.term}`} />
      <table>
        <thead>
          <tr>
            <th style={{ width: 34 }}>#</th>
            <th>المعلم</th>
            <th>المادة والفصل</th>
            <th style={{ width: 58 }}>الحصص</th>
            <th style={{ width: 70 }}>النصاب</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.teacher.id}>
              <td>{index + 1}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.teacher.name}</td>
              <td style={{ textAlign: 'right', fontSize: 10.5 }}>
                {row.own.map((a, i) => (
                  <div key={a.id}>
                    {i + 1}. {subjectName(data, a.subjectId)} — {className(data, a.classId)} ({a.count})
                  </div>
                ))}
              </td>
              <td>{row.quota}</td>
              <td style={{ fontWeight: 700 }}>{row.teacher.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ExamsSheet({ data, kind }: { data: SchoolData; kind: 'periodic' | 'official' }) {
  const exams = kind === 'periodic' ? data.exams.periodic : data.exams.official;
  return (
    <div>
      <SheetHead
        title={kind === 'periodic' ? 'جدول الاختبارات الفترية' : 'جدول الاختبارات الرسمية'}
        subtitle={`${data.school} · ${data.term}`}
      />
      <table>
        <thead>
          <tr>
            <th>الفصل</th>
            {DAY_NAMES.slice(0, data.days).map((d) => (
              <th key={d}>{d}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.classes.map((cls) => (
            <tr key={cls.id}>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{cls.name}</th>
              {DAY_NAMES.slice(0, data.days).map((_, day) => {
                const list = exams
                  .filter((e) => e.classId === cls.id && e.day === day)
                  .sort((a, b) => a.period - b.period);
                return (
                  <td key={day} style={{ fontSize: 10 }}>
                    {list.length
                      ? list.map((e) => (
                          <div key={`${e.period}-${e.subjectId}`}>
                            {subjectName(data, e.subjectId)} <span style={{ color: '#64748b' }}>({e.period + 1})</span>
                          </div>
                        ))
                      : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoverageSheet({
  data,
  date,
  covers,
}: {
  data: SchoolData;
  date: string;
  covers: Cover[];
}) {
  return (
    <div>
      <SheetHead title="بيان حصص الانتظار" subtitle={`${data.school} · ${data.term} · ${hijri(date)}`} />
      <table>
        <thead>
          <tr>
            <th style={{ width: 40 }}>الحصة</th>
            <th>الفصل</th>
            <th>المادة</th>
            <th>المعلم الغائب</th>
            <th>المعلم المنتظر</th>
          </tr>
        </thead>
        <tbody>
          {[...covers]
            .sort((a, b) => {
              const la = data.lessons.find((l) => l.id === a.lessonId)!;
              const lb = data.lessons.find((l) => l.id === b.lessonId)!;
              return la.period - lb.period;
            })
            .map((cover) => {
              const lesson = data.lessons.find((l) => l.id === cover.lessonId)!;
              const assignment = data.assignments.find((a) => a.id === lesson.assignmentId)!;
              return (
                <tr key={cover.id}>
                  <td>{lesson.period + 1}</td>
                  <td>{className(data, assignment.classId)}</td>
                  <td>{subjectName(data, assignment.subjectId)}</td>
                  <td>{teacherName(data, assignment.teacherId)}</td>
                  <td style={{ fontWeight: 700 }}>{teacherName(data, cover.teacherId)}</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
