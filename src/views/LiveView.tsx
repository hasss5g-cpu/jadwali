import { useEffect, useMemo, useState } from 'react';
import type { SchoolClass, SchoolData } from '../types';
import { DAY_NAMES, classPeriodTimes, gradeOf, lessonTeacherId, periodStartMinutes, subjectName, teacherName } from '../lib/model';
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


const GRADE_LABELS = ['الأول', 'الثاني', 'الثالث'];

function LiveRow({ item, label }: { item: LiveClass; label?: string }) {
  const tone =
    item.state === 'lesson'
      ? 'border-emerald-200 bg-emerald-50/50'
      : item.state === 'break'
        ? 'border-amber-200 bg-amber-50/60'
        : 'border-[var(--line)] bg-white';
  return (
    <div className={`mb-1.5 rounded-xl border px-2.5 py-2 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 truncate text-[12.5px] font-extrabold">{label ?? item.cls.name}</p>
        {item.state === 'lesson' ? (
          <span className="badge shrink-0">ح {item.period}</span>
        ) : item.state === 'break' ? (
          <span className="badge shrink-0 bg-amber-100 text-amber-800">فسحة</span>
        ) : (
          <span className="badge shrink-0 bg-[#f1f5f9] text-[#64748b]">—</span>
        )}
      </div>
      {item.state === 'lesson' ? (
        <>
          <p className="m-0 mt-0.5 truncate text-[12.5px] font-bold text-[var(--brand)]">{item.subject}</p>
          <p className="m-0 truncate text-[11.5px] text-[var(--ink-600)]">{item.teacher}</p>
          <p className="m-0 text-[10.5px] text-[var(--muted)]">{item.time}</p>
        </>
      ) : (
        <p className="m-0 mt-0.5 text-[11px] text-[var(--muted)]">
          {item.state === 'break'
            ? `فسحة ${item.time}`
            : item.state === 'before'
              ? 'لم يبدأ الدوام'
              : 'انتهى الدوام'}
        </p>
      )}
    </div>
  );
}

export function LiveBoard({ data }: { data: SchoolData }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const snapshot = useMemo(() => liveSnapshot(data, now), [data, now]);

  if (!data.lessons.length) {
    return (
      <Card title="الجدول لايف" subtitle="لا توجد حصص موزعة بعد">
        <p className="m-0 text-[13px] text-[var(--muted)]">ولّد الجدول أولًا من تبويب «توليد الجداول».</p>
      </Card>
    );
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

  const groups = [1, 2, 3].map((grade) => {
    const classes = snapshot.classes
      .filter((item) => gradeOf(item.cls.name) === grade)
      .sort((a, b) => a.cls.name.localeCompare(b.cls.name, 'ar'));
    const lessons = classes.filter((item) => item.state === 'lesson');
    const breaks = classes.filter((item) => item.state === 'break');
    return { grade, classes, lessons, breaks };
  });
  const others = snapshot.classes.filter((item) => gradeOf(item.cls.name) === null);

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
          {snapshot.nextTime && !snapshot.afterSchool && !snapshot.weekend && (
            <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">الجرس القادم: {snapshot.nextTime}</p>
          )}
        </div>
        <div className="card p-4">
          <p className="m-0 text-[11.5px] font-bold text-[var(--muted)]">فصول في حصة الآن</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">
            {snapshot.lessons.length}{' '}
            <span className="text-sm font-bold text-[var(--muted)]">/ {data.classes.length}</span>
          </p>
          <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">وفي فسحة: {snapshot.breaks.length}</p>
        </div>
        <div className="card p-4">
          <p className="m-0 text-[11.5px] font-bold text-[var(--muted)]">معلمون مشغولون الآن</p>
          <p className="m-0 mt-1 text-2xl font-extrabold">{snapshot.busyTeachers}</p>
          <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">من أصل {data.teachers.length} معلمًا</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((group) => (
          <Card
            key={group.grade}
            title={`الصف ${GRADE_LABELS[group.grade - 1]}`}
            subtitle={`${group.classes.length} فصلًا · ${group.lessons.length} في حصة${group.breaks.length ? ` · ${group.breaks.length} فسحة` : ''}`}
            padded={false}
          >
            <div className="p-2">
              {group.classes.length === 0 ? (
                <p className="m-0 p-2 text-[12px] text-[var(--muted)]">لا فصول لهذه المرحلة.</p>
              ) : (
                group.classes.map((item) => {
                  const number = item.cls.name.match(/(\d+)\s*$/)?.[1];
                  return (
                    <LiveRow
                      key={item.cls.id}
                      item={item}
                      label={number ? `فصل ${number}` : undefined}
                    />
                  );
                })
              )}
            </div>
          </Card>
        ))}
      </div>

      {others.length > 0 && (
        <Card title="فصول أخرى" subtitle={`${others.length} فصلًا`} padded={false}>
          <div className="p-2">
            {others.map((item) => (
              <LiveRow key={item.cls.id} item={item} />
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

