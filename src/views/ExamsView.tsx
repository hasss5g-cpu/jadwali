import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { generateExams, validateExams, type ExamKind } from '../lib/exams';
import { DAY_NAMES, className, subjectName, teacherName } from '../lib/model';
import { numberAr } from '../lib/utils';
import { Card, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { ExamsSheet } from '../components/PrintSheets';

export function ExamsView() {
  const { data, update, toast, print } = useStore();
  const [kind, setKind] = useState<ExamKind>('periodic');
  const exams = kind === 'periodic' ? data.exams.periodic : data.exams.official;
  const errors = useMemo(() => validateExams(data, exams), [data, exams]);

  const generate = () => {
    const next = generateExams(data, kind);
    update((prev) => ({
      ...prev,
      exams: { ...prev.exams, [kind]: next },
    }));
    const problems = validateExams(data, next);
    if (problems.length) toast(`وُلد الجدول مع ${problems.length} ملاحظة — راجع التنبيهات.`, 'warn');
    else toast(`وُلد جدول ${kind === 'periodic' ? 'الاختبارات الفترية' : 'الاختبارات الرسمية'} (${next.length} اختبارًا).`, 'ok');
  };

  return (
    <div className="grid gap-4">
      <Card
        title="جدول الاختبارات"
        subtitle="اختباران كحد أقصى في اليوم للفصل، وبلا تعارض في إشراف المعلمين"
        actions={
          <>
            <div className="tabs">
              <button className="tab" data-active={kind === 'periodic'} onClick={() => setKind('periodic')}>
                الفترية
              </button>
              <button className="tab" data-active={kind === 'official'} onClick={() => setKind('official')}>
                الرسمية
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={generate}>
              <Icon name="sparkles" size={15} /> توليد
            </button>
            <button
              className="btn btn-sm"
              disabled={!exams.length}
              onClick={() => print(kind === 'periodic' ? 'جدول الاختبارات الفترية' : 'جدول الاختبارات الرسمية', <ExamsSheet data={data} kind={kind} />)}
            >
              <Icon name="printer" size={15} /> طباعة
            </button>
          </>
        }
      >
        {!exams.length ? (
          <Empty
            title="لا يوجد جدول اختبارات بعد"
            hint={kind === 'periodic' ? 'اضغط «توليد» لبناء جدول الفترية لكل الفصول.' : 'الرسمية تشمل المواد الأساسية فقط.'}
          />
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>الفصل</th>
                  {DAY_NAMES.slice(0, data.days).map((day) => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.classes.map((cls) => (
                  <tr key={cls.id}>
                    <td className="whitespace-nowrap font-bold">{cls.name}</td>
                    {DAY_NAMES.slice(0, data.days).map((_, day) => {
                      const list = exams
                        .filter((e) => e.classId === cls.id && e.day === day)
                        .sort((a, b) => a.period - b.period);
                      return (
                        <td key={day} className="text-[11.5px]">
                          {list.length
                            ? list.map((exam) => {
                                const assignment = data.assignments.find(
                                  (a) => a.classId === cls.id && a.subjectId === exam.subjectId,
                                );
                                return (
                                  <div key={`${exam.subjectId}-${exam.period}`} className="mb-1 last:mb-0">
                                    <div className="font-semibold">{subjectName(data, exam.subjectId)}</div>
                                    <div className="text-[10px] text-[var(--muted)]">
                                      الحصة {exam.period + 1}
                                      {assignment ? ` · ${teacherName(data, assignment.teacherId)}` : ''}
                                    </div>
                                  </div>
                                );
                              })
                            : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {errors.length > 0 && (
        <Card title="ملاحظات على الجدول" subtitle={`${numberAr(errors.length)} ملاحظة`}>
          <ul className="m-0 grid list-disc gap-1 ps-5 text-[12.5px] text-[var(--warn)]">
            {errors.slice(0, 10).map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="توزيع الاختبارات" subtitle="ملخص سريع">
        <div className="flex flex-wrap gap-2">
          <span className="badge">{numberAr(exams.length)} اختبارًا</span>
          <span className="badge">{numberAr(data.classes.length)} فصلًا</span>
          {kind === 'periodic' ? (
            <span className="badge">
              {numberAr(new Set(exams.map((e) => e.subjectId)).size)} مادة
            </span>
          ) : (
            <span className="badge">المواد الأساسية</span>
          )}
          <span className="badge">
            {numberAr(exams.filter((e) => e.period === 0).length)} في الحصة الأولى
          </span>
        </div>
        <p className="m-0 mt-2 text-[12px] text-[var(--muted)]">
          أمثلة: {[...new Set(exams.map((e) => className(data, e.classId)))].slice(0, 3).join('، ')} — الجدول مبني على أيام
          الأسبوع الحالية، ويُطبع مباشرة على A4.
        </p>
      </Card>
    </div>
  );
}
