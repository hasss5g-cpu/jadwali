import { useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Lesson, SchoolData } from '../types';
import { DAY_NAMES, className, lessonTeacherId, subjectName, teacherName } from '../lib/model';
import { planMove } from '../lib/move';
import { numberAr, periodTimes } from '../lib/utils';
import { Card, Empty } from '../components/ui';
import { Icon } from '../components/Icon';

interface Slot {
  day: number;
  period: number;
}

function TeacherGrid({
  data,
  lessons,
  highlight,
  target,
  onPick,
  selectable,
  periodLabels,
}: {
  data: SchoolData;
  lessons: Lesson[];
  highlight?: string;
  target?: Slot | null;
  onPick?: (slot: Slot, lesson: Lesson | null) => void;
  selectable?: boolean;
  periodLabels: string[];
}) {
  const cellAt = (day: number, period: number) => lessons.find((l) => l.day === day && l.period === period) ?? null;
  return (
    <div className="scroll-x">
      <div className="schedule-grid" style={{ gridTemplateColumns: `72px repeat(${data.periods}, minmax(0,1fr))` }}>
        <div className="schedule-corner">الحصة</div>
        {periodLabels.map((label, period) => (
          <div key={period} className="schedule-period-head">
            <span className="text-[12px] font-extrabold">{period + 1}</span>
            <span className="text-[8.5px] text-[var(--muted)]">{label}</span>
          </div>
        ))}
        {DAY_NAMES.slice(0, data.days).map((day, dayIndex) => (
          <div key={day} className="contents">
            <div className="schedule-day">{day}</div>
            {Array.from({ length: data.periods }, (_, period) => {
              const lesson = cellAt(dayIndex, period);
              const assignment = lesson ? data.assignments.find((a) => a.id === lesson.assignmentId) : null;
              const isSource = lesson && lesson.id === highlight;
              const isTarget = target && target.day === dayIndex && target.period === period;
              const clickable = Boolean(onPick) && (selectable || (!lesson && highlight));
              return (
                <button
                  key={period}
                  type="button"
                  disabled={!clickable}
                  onClick={() => onPick?.({ day: dayIndex, period }, lesson)}
                  className={`schedule-cell text-right transition ${
                    isSource
                      ? 'border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]'
                      : isTarget
                        ? 'border-amber-400 bg-amber-50 ring-2 ring-amber-300'
                        : lesson
                          ? 'bg-white'
                          : 'border-dashed bg-[#fafbfa]'
                  } ${clickable ? 'cursor-pointer hover:border-[#8fd0c4]' : 'cursor-default'}`}
                >
                  {lesson && assignment ? (
                    <>
                      <div className="lesson-subject">{subjectName(data, assignment.subjectId)}</div>
                      <div className="lesson-meta">{className(data, assignment.classId)}</div>
                    </>
                  ) : (
                    <span className="text-[10.5px] text-[var(--muted)]">{onPick && highlight ? 'متاح — انقل هنا' : '—'}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SwapView() {
  const { data, update, toast } = useStore();
  const withLessons = data.teachers.find((teacher) =>
    data.lessons.some((lesson) => lessonTeacherId(data, lesson) === teacher.id),
  );
  const [teacherId, setTeacherId] = useState(withLessons?.id ?? data.teachers[0]?.id ?? '');
  const [sourceId, setSourceId] = useState('');
  const [target, setTarget] = useState<Slot | null>(null);
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);

  const times = useMemo(() => periodTimes(data.start, data.duration, data.periods), [data.start, data.duration, data.periods]);
  const lessons = useMemo(
    () => data.lessons.filter((lesson) => lessonTeacherId(data, lesson) === teacherId),
    [data, teacherId],
  );
  const source = lessons.find((lesson) => lesson.id === sourceId) ?? null;
  const plan = source && target ? planMove(data, source, target.day, target.period) : null;
  const afterLessons = plan?.ok ? plan.lessons.filter((lesson) => lessonTeacherId(data, lesson) === teacherId) : null;

  const describe = (lesson: Lesson | null) => {
    if (!lesson) return null;
    const assignment = data.assignments.find((a) => a.id === lesson.assignmentId);
    if (!assignment) return null;
    return {
      subject: subjectName(data, assignment.subjectId),
      cls: className(data, assignment.classId),
      teacher: teacherName(data, lessonTeacherId(data, lesson)),
      day: DAY_NAMES[lesson.day],
      period: lesson.period + 1,
    };
  };

  const pick = (slot: Slot, lesson: Lesson | null) => {
    if (lesson) {
      if (lesson.id === sourceId) {
        setSourceId('');
        setTarget(null);
      } else {
        setSourceId(lesson.id);
        setTarget(null);
      }
      return;
    }
    if (source) setTarget(slot);
  };

  const approve = () => {
    if (!plan?.ok || !source) return;
    update((prev) => ({ ...prev, lessons: plan.lessons }));
    const from = `${DAY_NAMES[source.day]} ح${source.period + 1}`;
    const to = `${DAY_NAMES[plan.target.day]} ح${plan.target.period + 1}`;
    setLog((prev) => [
      {
        id: Date.now(),
        text: `نُقلت ${describe(source)?.subject} (${describe(source)?.cls}) من ${from} إلى ${to}${
          plan.displaced ? ` — وانتقلت ${describe(plan.displaced)?.subject} (${describe(plan.displaced)?.cls}) عكسيًا` : ''
        }`,
      },
      ...prev,
    ]);
    setSourceId('');
    setTarget(null);
    toast('اعتُمد النقل وحُفظ الجدول. يمكنك التراجع من الشريط العلوي.', 'ok');
  };

  if (!data.teachers.length) return <Empty title="لا يوجد معلمون" hint="استورد بيانات المدرسة أولًا." />;

  return (
    <div className="grid gap-4">
      <Card
        title="نقل حصص المعلم"
        subtitle="اختر المعلم، اضغط الحصة المراد نقلها، ثم اضغط الموعد الجديد. تُعرض الحصص المتأثرة قبل الاعتماد."
        actions={
          <label className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-[var(--muted)]">المعلم</span>
            <select
              className="select w-56"
              value={teacherId}
              onChange={(e) => {
                setTeacherId(e.target.value);
                setSourceId('');
                setTarget(null);
              }}
            >
              {data.teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
        }
      >
        {!lessons.length ? (
          <Empty title="لا حصص لهذا المعلم" hint="اختر معلمًا آخر أو ولّد الجدول." />
        ) : (
          <>
            <p className="m-0 mb-2 text-[11.5px] text-[var(--muted)]">
              {source
                ? 'اختر الآن الموعد الجديد من الخلايا الفارغة في جدول المعلم، أو اضغط الحصة نفسها للإلغاء.'
                : 'اضغط على الحصة التي تريد نقلها.'}
            </p>
            <TeacherGrid
              data={data}
              lessons={lessons}
              highlight={sourceId || undefined}
              target={target}
              onPick={pick}
              selectable
              periodLabels={times}
            />
          </>
        )}
      </Card>

      {plan && source && (
        <Card title="معاينة التغيير" subtitle="لن يُطبَّق شيء حتى تضغط «اعتماد النقل»">
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-[var(--line)] p-3">
                <p className="m-0 text-[11px] text-[var(--muted)]">الحصة المنقولة</p>
                <p className="m-0 text-[13px] font-extrabold">
                  {describe(source)?.subject} — {describe(source)?.cls}
                </p>
                <p className="m-0 text-[12px] text-[var(--ink-600)]">
                  من {describe(source)?.day} ح{describe(source)?.period} إلى {DAY_NAMES[plan.target.day]} ح
                  {plan.target.period + 1}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--line)] p-3">
                <p className="m-0 text-[11px] text-[var(--muted)]">الحصة المتأثرة</p>
                {plan.displaced ? (
                  <>
                    <p className="m-0 text-[13px] font-extrabold">
                      {describe(plan.displaced)?.subject} — {describe(plan.displaced)?.cls}
                    </p>
                    <p className="m-0 text-[12px] text-[var(--ink-600)]">
                      تنتقل عكسيًا إلى {describe(source)?.day} ح{describe(source)?.period} · معلمها{' '}
                      {describe(plan.displaced)?.teacher}
                    </p>
                  </>
                ) : (
                  <p className="m-0 text-[12.5px] text-[var(--ink-600)]">لا توجد حصة متأثرة — الموعد الهدف متاح للفصل.</p>
                )}
              </div>
            </div>

            {plan.teacherBusy && (
              <p className="m-0 rounded-lg bg-[#fff7ed] p-2 text-[12.5px] text-[var(--warn)]">
                لا يمكن النقل: لدى المعلم حصة أخرى في هذا الموعد ({describe(plan.teacherBusy)?.subject} —{' '}
                {describe(plan.teacherBusy)?.cls}).
              </p>
            )}

            {plan.newIssues.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="m-0 text-[12.5px] font-extrabold text-red-800">
                  النقل يسبب {numberAr(plan.newIssues.length)} مخالفة — لن يُطبَّق
                </p>
                <ul className="m-0 mt-1 grid list-disc gap-0.5 ps-5 text-[12px] text-red-700">
                  {plan.newIssues.slice(0, 6).map((issue, index) => (
                    <li key={index}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {plan.ok && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                <span className="badge">
                  <Icon name="check" size={13} /> النقل آمن
                </span>
                <span className="text-[12px] text-emerald-800">لا يضيف أي مخالفة للجدول.</span>
              </div>
            )}

            <div>
              <p className="m-0 mb-1 text-[12px] font-extrabold">جدول المعلم بعد النقل</p>
              {afterLessons ? (
                <TeacherGrid
                  data={data}
                  lessons={afterLessons}
                  highlight={source.id}
                  periodLabels={times}
                />
              ) : (
                <p className="m-0 text-[12px] text-[var(--muted)]">المعاينة متاحة بعد أن يصبح النقل آمنًا.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={!plan.ok} onClick={approve}>
                <Icon name="check" size={16} /> اعتماد النقل
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSourceId('');
                  setTarget(null);
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Card>
      )}

      {log.length > 0 && (
        <Card title="عمليات النقل في هذه الجلسة">
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
