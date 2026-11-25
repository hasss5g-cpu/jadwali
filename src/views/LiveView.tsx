import { useEffect, useMemo, useState } from 'react';
import type { SchoolClass, SchoolData } from '../types';
import { DAY_NAMES, classPeriodTimes, lessonTeacherId, periodStartMinutes, subjectName, teacherName } from '../lib/model';
import { formatTime12 } from '../lib/time';
import { hijri } from '../lib/utils';
import { Card } from '../components/ui';
import { useStore } from '../store';

export type LiveState = 'lesson' | 'break' | 'before' | 'after';

export interface LiveClass {
  cls: SchoolClass;
  state: LiveState;
  period?: number;
  time?: string;
  subject?: string;
  teacher?: string;
}

export interface LiveSnapshot {
  dayIndex: number;
  weekday: string | null;
  weekend: boolean;
  nowLabel: string;
  beforeSchool: boolean;
  afterSchool: boolean;
  classes: LiveClass[];
  lessons: LiveClass[];
  breaks: LiveClass[];
  periods: number[];
  busyTeachers: number;
  nextTime?: string;
}

function startMinutes(start: string): number {
  const [h, m] = start.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** حالة الجدول في لحظة معينة: الحصة الجارية لكل فصل مع المادة والمعلم. */
export function liveSnapshot(data: SchoolData, when: Date = new Date()): LiveSnapshot {
  const dayIndex = when.getDay();
  const weekend = dayIndex >= data.days || dayIndex > 4;
  const base = startMinutes(data.start);
  const nowMinutes = when.getHours() * 60 + when.getMinutes();
  const nowRel = nowMinutes - base;
  const assignmentById = new Map(data.assignments.map((a) => [a.id, a]));

  const classes: LiveClass[] = data.classes.map((cls) => {
    const starts = periodStartMinutes(data, cls);
    const times = classPeriodTimes(data, cls);
    if (weekend) return { cls, state: 'before' };
    if (nowRel < 0) return { cls, state: 'before' };
    const lastEnd = (starts[starts.length - 1] ?? 0) + data.duration;
    if (nowRel >= lastEnd) return { cls, state: 'after' };

    for (let index = 0; index < starts.length; index++) {
      const from = starts[index];
      const to = from + data.duration;
      if (nowRel >= from && nowRel < to) {
        const lesson = data.lessons.find((item) => {
          const assignment = assignmentById.get(item.assignmentId);
          return assignment?.classId === cls.id && item.day === dayIndex && item.period === index;
        });
        const assignment = lesson ? assignmentById.get(lesson.assignmentId) : undefined;
        return {
          cls,
          state: 'lesson',
          period: index + 1,
          time: times[index],
          subject: assignment ? subjectName(data, assignment.subjectId) : '—',
          teacher: lesson ? teacherName(data, lessonTeacherId(data, lesson)) : '—',
        };
      }
      const nextStart = starts[index + 1];
      if (nextStart !== undefined && nowRel >= to && nowRel < nextStart) {
        return {
          cls,
          state: 'break',
          period: index + 1,
          time: `${formatTime12(base + to)}–${formatTime12(base + nextStart)}`,
        };
      }
    }
    return { cls, state: 'after' };
  });

  const lessons = classes.filter((item) => item.state === 'lesson');
  const breaks = classes.filter((item) => item.state === 'break');
  const periods = [...new Set(lessons.map((item) => item.period!))].sort((a, b) => a - b);
  const busiest = new Set(lessons.map((item) => item.teacher));
  const upcoming = classes
    .flatMap((item) => {
      const starts = periodStartMinutes(data, item.cls);
      return starts.filter((start) => start > nowRel);
    })
    .sort((a, b) => a - b)[0];

  return {
    dayIndex,
    weekday: weekend ? null : DAY_NAMES[dayIndex] ?? null,
    weekend,
    nowLabel: formatTime12(nowMinutes),
    beforeSchool: !weekend && nowRel < 0,
    afterSchool: !weekend && classes.every((item) => item.state === 'after'),
    classes,
    lessons,
    breaks,
    periods,
    busyTeachers: busiest.size,
    nextTime: upcoming !== undefined ? formatTime12(base + upcoming) : undefined,
  };
}

function periodLabel(periods: number[]): string {
  if (!periods.length) return '—';
  if (periods.length === 1) return `الحصة ${periods[0]}`;
  return `الحصص ${periods.join('، ')}`;
}

export function LiveBoard({ data }: { data: SchoolData }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const snapshot = useMemo(() => liveSnapshot(data, now), [data, now]);

  if (!data.lessons.length) {
    return <Card title="الجدول لايف" subtitle="لا توجد حصص موزعة بعد"><p className="m-0 text-[13px] text-[var(--muted)]">ولّد الجدول أولًا من تبويب «توليد الجداول».</p></Card>;
  }

  const statusText = snapshot.weekend
    ? 'لا دراسة اليوم (نهاية الأسبوع)'
    : snapshot.beforeSchool
      ? `لم يبدأ الدوام بعد — يبدأ ${formatTime12(startMinutes(data.start))}`
      : snapshot.afterSchool
        ? 'انتهى الدوام اليوم'
        : snapshot.lessons.length
          ? periodLabel(snapshot.periods)
          : 'فسحة الآن';

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="m-0 text-[11.5px] font-bold text-[var(--muted)]">الساعة الآن</p>
          <p className="m-0 mt-1 text-2xl font-extrabold text-[var(--brand)]">{snapshot.nowLabel}</p>
          <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">
            {snapshot.weekend ? 'نهاية الأسبوع' : `${snapshot.weekday} · ${hijri(now)}`}
          </p>
        </div>
        <div className="card p-4">
          <p className="m-0 text-[11.5px] font-bold text-[var(--muted)]">الحصة الحالية</p>
          <p className="m-0 mt-1 text-xl font-extrabold">{statusText}</p>
          {snapshot.lessons[0]?.time && snapshot.periods.length === 1 && (
            <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">{snapshot.lessons[0].time}</p>
          )}
          {snapshot.nextTime && !snapshot.afterSchool && !snapshot.weekend && (
            <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">الجرس القادم: {snapshot.nextTime}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="m-0 text-[11.5px] font-bold text-[var(--muted)]">فصول في حصة الآن</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">
            {snapshot.lessons.length} <span className="text-sm font-bold text-[var(--muted)]">/ {data.classes.length}</span>
          </p>
          <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">وفي فسحة: {snapshot.breaks.length}</p>
        </div>
        <div className="card p-4">
          <p className="m-0 text-[11.5px] font-bold text-[var(--muted)]">معلمون مشغولون الآن</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{snapshot.busyTeachers}</p>
          <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">من أصل {data.teachers.length} معلمًا</p>
        </div>
      </div>

      <Card
        title="الحصص الجارية الآن"
        subtitle="يُحدَّث تلقائيًا كل ثانية — الفصل والمادة والمعلم"
        actions={
          <span className="badge">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> مباشر
          </span>
        }
        padded={false}
      >
        {snapshot.lessons.length === 0 ? (
          <div className="p-4">
            <p className="m-0 text-[13px] text-[var(--muted)]">
              {snapshot.weekend
                ? 'لا دراسة اليوم.'
                : snapshot.beforeSchool
                  ? `لم يبدأ الدوام بعد — يبدأ ${formatTime12(startMinutes(data.start))}.`
                  : snapshot.afterSchool
                    ? 'انتهى الدوام اليوم.'
                    : `فسحة الآن — الجرس القادم ${snapshot.nextTime ?? '—'}.`}
            </p>
          </div>
        ) : (
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>الفصل</th>
                  <th>الحصة</th>
                  <th>الوقت</th>
                  <th>المادة</th>
                  <th>المعلم</th>
                </tr>
              </thead>
              <tbody>
                {[...snapshot.lessons]
                  .sort((a, b) => a.cls.name.localeCompare(b.cls.name, 'ar'))
                  .map((item) => (
                    <tr key={item.cls.id}>
                      <td className="font-bold">{item.cls.name}</td>
                      <td>{item.period}</td>
                      <td className="text-[12px] text-[var(--muted)]">{item.time}</td>
                      <td>{item.subject}</td>
                      <td>{item.teacher}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {snapshot.breaks.length > 0 && (
        <Card title="فصول في فسحة الآن" subtitle={`${snapshot.breaks.length} فصلًا`}>
          <div className="flex flex-wrap gap-1.5">
            {snapshot.breaks.map((item) => (
              <span key={item.cls.id} className="badge bg-[#fff7ed] text-[#9a3412]">
                {item.cls.name} · {item.time}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function LiveView() {
  const { data } = useStore();
  return <LiveBoard data={data} />;
}
