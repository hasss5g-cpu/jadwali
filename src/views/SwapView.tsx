import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Lesson } from '../types';
import { DAY_NAMES, className, lessonTeacherId, subjectName, teacherName } from '../lib/model';
import { checkSwap, swappedLessons } from '../lib/swap';
import { numberAr } from '../lib/utils';
import { Card, Empty } from '../components/ui';
import { Icon } from '../components/Icon';

export function SwapView() {
  const { data, update, toast } = useStore();
  const [teacherA, setTeacherA] = useState(data.teachers[0]?.id ?? '');
  const [teacherB, setTeacherB] = useState(data.teachers[1]?.id ?? '');
  const [lessonAId, setLessonAId] = useState('');
  const [lessonBId, setLessonBId] = useState('');
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);

  const assignmentOf = (lesson: Lesson) => data.assignments.find((a) => a.id === lesson.assignmentId);

  const lessonsOf = (teacherId: string) =>
    data.lessons
      .filter((lesson) => lessonTeacherId(data, lesson) === teacherId)
      .sort((a, b) => a.day - b.day || a.period - b.period);

  const lessonA = data.lessons.find((l) => l.id === lessonAId) ?? null;
  const lessonB = data.lessons.find((l) => l.id === lessonBId) ?? null;

  const check = useMemo(
    () => (lessonA && lessonB ? checkSwap(data, lessonA, lessonB) : null),
    [data, lessonA, lessonB],
  );

  const describe = (lesson: Lesson | null) => {
    if (!lesson) return null;
    const assignment = assignmentOf(lesson);
    if (!assignment) return null;
    return {
      day: DAY_NAMES[lesson.day],
      period: lesson.period + 1,
      subject: subjectName(data, assignment.subjectId),
      cls: className(data, assignment.classId),
      teacher: teacherName(data, lessonTeacherId(data, lesson)),
    };
  };

  const a = describe(lessonA);
  const b = describe(lessonB);

  const apply = () => {
    if (!lessonA || !lessonB || !check?.ok) return;
    const movedIds = new Set([lessonA.id, lessonB.id]);
    update((prev) => ({
      ...prev,
      lessons: swappedLessons(prev, lessonA, lessonB),
      // التغطية المسجلة على الحصتين لم تعد صالحة بعد تغيّر معلمهما.
      covers: prev.covers.filter((cover) => !movedIds.has(cover.lessonId)),
    }));
    setLog((prev) => [
      {
        id: Date.now(),
        text: `تبادل: ${a?.teacher} يدرّس ${b?.subject} (${b?.cls}) ${b?.day} ح${b?.period} ↔ ${b?.teacher} يدرّس ${a?.subject} (${a?.cls}) ${a?.day} ح${a?.period}`,
      },
      ...prev,
    ]);
    setLessonAId('');
    setLessonBId('');
    toast('تم تبادل معلمي الحصتين وحُفظ التغيير. يمكنك التراجع من الشريط العلوي.', 'ok');
  };

  const overrides = data.lessons.filter((lesson) => lesson.teacherId);

  const renderLessons = (teacherId: string, selected: string, onSelect: (id: string) => void) => {
    const list = lessonsOf(teacherId);
    if (!list.length) return <Empty title="لا حصص لهذا المعلم" hint="اختر معلمًا آخر أو ولّد الجدول أولًا." />;
    return (
      <div className="grid max-h-64 gap-1.5 overflow-auto pe-1">
        {list.map((lesson) => {
          const assignment = assignmentOf(lesson)!;
          const active = selected === lesson.id;
          return (
            <button
              key={lesson.id}
              onClick={() => onSelect(lesson.id)}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-right text-[12px] transition ${
                active
                  ? 'border-[var(--brand)] bg-[var(--brand-soft)] font-bold text-[var(--brand)]'
                  : 'border-[var(--line)] bg-white hover:border-[#b9dcd6]'
              }`}
            >
              <span>
                <span className="block font-semibold">{subjectName(data, assignment.subjectId)}</span>
                <span className="block text-[11px] text-[var(--muted)]">{className(data, assignment.classId)}</span>
              </span>
              <span className="shrink-0 rounded-md bg-[#f3f7f5] px-1.5 py-0.5 text-[10.5px] text-[var(--ink-600)]">
                {DAY_NAMES[lesson.day]} · ح{lesson.period + 1}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  if (!data.teachers.length) return <Empty title="لا يوجد معلمون" hint="استورد بيانات المدرسة أولًا." />;

  return (
    <div className="grid gap-4">
      <Card
        title="تبادل الحصص بين المعلمين"
        subtitle="اختر حصة من كل معلم: يدرّس كلٌّ منهما حصة الآخر في موعدها. المواعيد والفصول لا تتغيّر."
      >
        {data.lessons.length === 0 && <Empty title="لا يوجد جدول بعد" hint="ولّد الجدول من تبويب التوليد." />}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] p-3">
            <label className="label">المعلم الأول</label>
            <select
              className="select mb-2"
              value={teacherA}
              onChange={(e) => {
                setTeacherA(e.target.value);
                setLessonAId('');
              }}
            >
              {data.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            {renderLessons(teacherA, lessonAId, setLessonAId)}
          </div>

          <div className="rounded-xl border border-[var(--line)] p-3">
            <label className="label">المعلم الثاني</label>
            <select
              className="select mb-2"
              value={teacherB}
              onChange={(e) => {
                setTeacherB(e.target.value);
                setLessonBId('');
              }}
            >
              {data.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
            {renderLessons(teacherB, lessonBId, setLessonBId)}
          </div>
        </div>
      </Card>

      <Card title="النتيجة" subtitle="فحص تلقائي للتعارضات قبل التطبيق">
        {!a || !b ? (
          <Empty title="اختر حصتين" hint="اختر حصة من كل معلم لعرض أثر التبادل." />
        ) : (
          <div className="grid gap-3">
            <div className="grid items-center gap-2 sm:grid-cols-[1fr_auto_1fr]">
              <div className="rounded-xl bg-[#f6f9f8] p-3">
                <p className="m-0 text-[11px] text-[var(--muted)]">حصة {a.teacher}</p>
                <p className="m-0 text-[13px] font-extrabold">
                  {a.subject} — {a.cls}
                </p>
                <p className="m-0 text-[12px] text-[var(--ink-600)]">
                  {a.day} · الحصة {a.period}
                </p>
              </div>
              <span className="justify-self-center rounded-full bg-[var(--brand-soft)] p-2 text-[var(--brand)]">
                <Icon name="swap" size={18} />
              </span>
              <div className="rounded-xl bg-[#f6f9f8] p-3">
                <p className="m-0 text-[11px] text-[var(--muted)]">حصة {b.teacher}</p>
                <p className="m-0 text-[13px] font-extrabold">
                  {b.subject} — {b.cls}
                </p>
                <p className="m-0 text-[12px] text-[var(--ink-600)]">
                  {b.day} · الحصة {b.period}
                </p>
              </div>
            </div>

            <p className="m-0 rounded-xl bg-[#f4f8f6] p-3 text-[12px] leading-5 text-[var(--ink-600)]">
              بعد التبادل: يدرّس <strong>{a.teacher}</strong> «{b.subject} — {b.cls}» في {b.day} الحصة {b.period}،
              ويدرّس <strong>{b.teacher}</strong> «{a.subject} — {a.cls}» في {a.day} الحصة {a.period}.
              النصاب المسجّل في الإسنادات لا يتغيّر، لكن الحصص الفعلية لكل معلم تتغيّر حصة واحدة.
            </p>

            {check?.subjects.differ && (
              <p className="m-0 rounded-lg bg-[#fff7ed] p-2 text-[12px] text-[var(--warn)]">
                تنبيه: المادتان مختلفتان ({check.subjects.a} / {check.subjects.b}) — تأكد من تأهيل المعلمين للمادة.
              </p>
            )}

            {check?.sameTeacher && (
              <p className="m-0 rounded-lg bg-[#fff7ed] p-2 text-[12.5px] text-[var(--warn)]">
                الحصتان للمعلم نفسه — اختر حصتين لمعلمين مختلفين.
              </p>
            )}

            {check && !check.sameTeacher && check.ok && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <span className="badge">
                  <Icon name="check" size={13} /> التبادل آمن
                </span>
                <span className="text-[12px] text-emerald-800">لا يسبب أي مخالفة جديدة في الجدول.</span>
              </div>
            )}

            {check && check.newIssues.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="m-0 text-[12.5px] font-extrabold text-red-800">
                  التبادل يسبب {numberAr(check.newIssues.length)} مخالفة — لن يُطبَّق
                </p>
                <ul className="m-0 mt-1 grid list-disc gap-0.5 ps-5 text-[12px] text-red-700">
                  {check.newIssues.slice(0, 6).map((issue, index) => (
                    <li key={index}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <button className="btn btn-primary" disabled={!check?.ok} onClick={apply}>
                <Icon name="swap" size={16} /> تبديل المعلمين
              </button>
            </div>
          </div>
        )}
      </Card>

      {overrides.length > 0 && (
        <Card
          title="حصص بمعلم مُستبدل"
          subtitle={`${numberAr(overrides.length)} حصة — يمكن إرجاعها لمعلمها الأصلي`}
          padded={false}
        >
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>الفصل</th>
                  <th>المادة</th>
                  <th>الموعد</th>
                  <th>المعلم الحالي</th>
                  <th>الأصلي</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overrides.map((lesson) => {
                  const assignment = assignmentOf(lesson)!;
                  return (
                    <tr key={lesson.id}>
                      <td>{className(data, assignment.classId)}</td>
                      <td>{subjectName(data, assignment.subjectId)}</td>
                      <td>
                        {DAY_NAMES[lesson.day]} · ح{lesson.period + 1}
                      </td>
                      <td className="font-bold">{teacherName(data, lessonTeacherId(data, lesson))}</td>
                      <td>{teacherName(data, assignment.teacherId)}</td>
                      <td>
                        <button
                          className="btn btn-sm"
                          onClick={() =>
                            update((prev) => ({
                              ...prev,
                              lessons: prev.lessons.map((item) =>
                                item.id === lesson.id ? { ...item, teacherId: undefined } : item,
                              ),
                            }))
                          }
                        >
                          إرجاع
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {log.length > 0 && (
        <Card title="عمليات التبادل في هذه الجلسة">
          <ul className="m-0 grid list-disc gap-1 ps-5 text-[12.5px] text-[var(--ink-600)]">
            {log.map((entry) => (
              <li key={entry.id}>{entry.text}</li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
