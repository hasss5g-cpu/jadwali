import type { Cover, SchoolData } from '../types';
import { DAY_NAMES, className, subjectName, teacherMetrics, teacherName, validate } from '../lib/model';
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

/** تقرير النصاب والتوزيع: حصص كل معلم وفراغاته وتتابعه وأيام عمله. */
export function TeachersLoadSheet({ data }: { data: SchoolData }) {
  const rows = teacherMetrics(data)
    .filter((row) => row.quota > 0 || row.lessons > 0)
    .sort((a, b) => b.quota - a.quota || a.name.localeCompare(b.name, 'ar'));
  const total = rows.reduce(
    (acc, row) => ({
      lessons: acc.lessons + row.lessons,
      quota: acc.quota + row.quota,
      holes: acc.holes + row.holes,
      longRuns: acc.longRuns + row.longRuns,
      seventh: acc.seventh + row.seventh,
      overflow: acc.overflow + row.overflow,
    }),
    { lessons: 0, quota: 0, holes: 0, longRuns: 0, seventh: 0, overflow: 0 },
  );
  return (
    <div>
      <SheetHead
        title="تقرير النصاب والتوزيع"
        subtitle={`${data.school} · ${data.term} · ${numberAr(rows.length)} معلمًا`}
      />
      <table>
        <thead>
          <tr>
            <th style={{ width: 26 }}>#</th>
            <th>المعلم</th>
            <th>المادة</th>
            <th>الحصص</th>
            <th>النصاب</th>
            <th>الحد</th>
            <th>الزيادة</th>
            <th>الفراغات</th>
            <th>التتابع</th>
            <th>أطول تتابع</th>
            <th>أيام العمل</th>
            <th>الحصة ٧</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id}>
              <td>{index + 1}</td>
              <td style={{ textAlign: 'right', fontWeight: 700 }}>{row.name}</td>
              <td style={{ textAlign: 'right', fontSize: 10 }}>{row.subject}</td>
              <td>{row.lessons}</td>
              <td>{row.quota}</td>
              <td>{row.max}</td>
              <td style={{ fontWeight: row.overflow ? 700 : 400, color: row.overflow ? '#b91c1c' : undefined }}>
                {row.overflow || '—'}
              </td>
              <td>{row.holes}</td>
              <td>{row.longRuns}</td>
              <td>{row.maxRun}</td>
              <td>{row.activeDays}</td>
              <td>{row.seventh}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th colSpan={3}>الإجمالي</th>
            <th>{total.lessons}</th>
            <th>{total.quota}</th>
            <th>—</th>
            <th>{total.overflow}</th>
            <th>{total.holes}</th>
            <th>{total.longRuns}</th>
            <th>—</th>
            <th>—</th>
            <th>{total.seventh}</th>
          </tr>
        </tfoot>
      </table>
      <p className="print-totals">
        الزيادة = إسنادات تتجاوز حد المعلم · التتابع = عدد المرات التي زادت فيها حصص المعلم المتتالية على ثلاث ·
        الفراغات = فجوات في يوم المعلم.
      </p>
    </div>
  );
}

/** تقرير التدقيق: المخالفات الصارمة، تجاوزات النصاب، وسعة الأسبوع. */
export function AuditSheet({ data }: { data: SchoolData }) {
  const violations = validate(data);
  const metrics = teacherMetrics(data);
  const over = metrics.filter((row) => row.overflow > 0 && row.quota > 0);
  const holes = metrics.reduce((n, row) => n + row.holes, 0);
  const longRuns = metrics.reduce((n, row) => n + row.longRuns, 0);
  const capacity = data.days * data.periods;
  const classRows = data.classes.map((cls) => ({
    name: cls.name,
    demand: data.assignments.filter((a) => a.classId === cls.id).reduce((n, a) => n + a.count, 0),
  }));
  const peIds = new Set(
    data.subjects
      .filter((subject) => /بدني|البدنية|رياضة/.test(subject.name) && !/رياضيات/.test(subject.name))
      .map((subject) => subject.id),
  );
  const peLessons = data.lessons.filter((lesson) => {
    const assignment = data.assignments.find((a) => a.id === lesson.assignmentId);
    return assignment && peIds.has(assignment.subjectId);
  }).length;
  const peCapacity = capacity * 2;

  return (
    <div>
      <SheetHead title="تقرير التدقيق والجودة" subtitle={`${data.school} · ${data.term}`} />
      <h2 style={{ fontSize: 13, margin: '10px 0 4px' }}>ملخص عام</h2>
      <table>
        <tbody>
          <tr>
            <th>الفصول</th>
            <td>{numberAr(data.classes.length)}</td>
            <th>المعلمون</th>
            <td>{numberAr(data.teachers.length)}</td>
            <th>المواد</th>
            <td>{numberAr(data.subjects.length)}</td>
          </tr>
          <tr>
            <th>الإسنادات</th>
            <td>{numberAr(data.assignments.length)}</td>
            <th>الحصص الموزعة</th>
            <td>{numberAr(data.lessons.length)}</td>
            <th>المخالفات</th>
            <td style={{ fontWeight: 700, color: violations.length ? '#b91c1c' : '#047857' }}>
              {numberAr(violations.length)}
            </td>
          </tr>
          <tr>
            <th>فراغات المعلمين</th>
            <td>{numberAr(holes)}</td>
            <th>تتابع &gt; ٣</th>
            <td>{numberAr(longRuns)}</td>
            <th>سعة الفصل الأسبوعية</th>
            <td>{numberAr(capacity)} موعداً</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 13, margin: '12px 0 4px' }}>المخالفات الصارمة</h2>
      {violations.length ? (
        <table>
          <thead>
            <tr>
              <th style={{ width: 30 }}>#</th>
              <th>النوع</th>
              <th>التفصيل</th>
            </tr>
          </thead>
          <tbody>
            {violations.slice(0, 40).map((violation, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{{ 'teacher-clash': 'تعارض معلم', 'class-clash': 'تعارض فصل', 'room-clash': 'تعارض قاعة', 'pe-cap': 'سقف البدنية', 'off-day': 'يوم راحة', 'out-of-range': 'خارج النطاق' }[violation.kind]}</td>
                <td style={{ textAlign: 'right' }}>{violation.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="print-totals">لا توجد مخالفات صارمة — الجدول صالح.</p>
      )}

      <h2 style={{ fontSize: 13, margin: '12px 0 4px' }}>تجاوزات النصاب</h2>
      {over.length ? (
        <table>
          <thead>
            <tr>
              <th>المعلم</th>
              <th>الإسنادات</th>
              <th>الحد</th>
              <th>الزيادة</th>
            </tr>
          </thead>
          <tbody>
            {over.map((row) => (
              <tr key={row.id}>
                <td style={{ textAlign: 'right' }}>{row.name}</td>
                <td>{row.quota}</td>
                <td>{row.max}</td>
                <td style={{ fontWeight: 700 }}>{row.overflow}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="print-totals">كل المعلمين داخل حدود النصاب.</p>
      )}

      <h2 style={{ fontSize: 13, margin: '12px 0 4px' }}>سعة الفصول وحصص البدنية</h2>
      <table>
        <thead>
          <tr>
            <th>الفصل</th>
            <th>الإسنادات</th>
            <th>السعة</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {classRows.map((row) => (
            <tr key={row.name}>
              <td style={{ textAlign: 'right' }}>{row.name}</td>
              <td>{row.demand}</td>
              <td>{capacity}</td>
              <td style={{ color: row.demand > capacity ? '#b91c1c' : '#047857', fontWeight: 700 }}>
                {row.demand > capacity ? 'تجاوز' : row.demand === capacity ? 'مكتمل' : 'متاح'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="print-totals">
        حصص التربية البدنية: {numberAr(peLessons)} من سقف {numberAr(peCapacity)} حصة أسبوعيًا (فصلان في الحصة).
      </p>
    </div>
  );
}

/** جدول الحصص ليوم واحد: الفصول × الحصص. */
export function DailySheet({ data, day }: { data: SchoolData; day: number }) {
  const cell = (classId: string, period: number) => {
    const lesson = data.lessons.find((l) => l.day === day && l.period === period);
    if (!lesson) return null;
    const assignment = data.assignments.find((a) => a.id === lesson.assignmentId);
    if (!assignment || assignment.classId !== classId) return null;
    return assignment;
  };
  return (
    <div>
      <SheetHead
        title={`جدول الحصص اليومي — ${DAY_NAMES[day]}`}
        subtitle={`${data.school} · ${data.term}`}
      />
      <table>
        <thead>
          <tr>
            <th style={{ width: 110 }}>الفصل</th>
            {Array.from({ length: data.periods }, (_, period) => (
              <th key={period}>{period + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.classes.map((cls) => (
            <tr key={cls.id}>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{cls.name}</th>
              {Array.from({ length: data.periods }, (_, period) => {
                const assignment = cell(cls.id, period);
                return (
                  <td key={period} style={{ fontSize: 9.5 }}>
                    {assignment ? (
                      <>
                        <div style={{ fontWeight: 700 }}>{subjectName(data, assignment.subjectId)}</div>
                        <div style={{ color: '#475569' }}>{teacherName(data, assignment.teacherId)}</div>
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

/** كل جداول الفصول في مستند واحد، كل فصل في صفحة. */
export function AllClassesSheet({ data }: { data: SchoolData }) {
  return (
    <>
      {data.classes.map((cls, index) => (
        <section key={cls.id} className={index ? 'print-break' : undefined}>
          <ClassSheet data={data} classId={cls.id} />
        </section>
      ))}
    </>
  );
}

/** كل جداول المعلمين في مستند واحد. */
export function AllTeachersSheet({ data }: { data: SchoolData }) {
  return (
    <>
      {data.teachers.map((teacher, index) => (
        <section key={teacher.id} className={index ? 'print-break' : undefined}>
          <TeacherSheet data={data} teacherId={teacher.id} />
        </section>
      ))}
    </>
  );
}
