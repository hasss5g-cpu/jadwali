import { useEffect, useMemo, useState } from 'react';
import type { SchoolClass, SchoolData } from '../types';
import { DAY_NAMES, classPeriodTimes, gradeOf, lessonTeacherId, periodStartMinutes, personName, subjectName, teacherName } from '../lib/model';
import { formatTime12 } from '../lib/time';
import { hijri, numberAr } from '../lib/utils';
import { Card } from '../components/ui';
import { shortClassName } from '../components/MasterTable';
import { useStore } from '../store';

export type LiveState = 'lesson' | 'break' | 'before' | 'after';

export interface LiveClass {
  cls: SchoolClass;
  state: LiveState;
  period?: number;
  time?: string;
  subject?: string;
  teacher?: string;
  /** المعلم غائب اليوم. */
  absent?: boolean;
  /** اسم البديل إن وُجد انتظار مسجّل لهذه الحصة. */
  substitute?: string | null;
  /** بداية ونهاية الحصة بالدقائق من بداية الدوام (لحساب العدّاد). */
  startRel?: number;
  endRel?: number;
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
  /** دقائق مضت من الحصة الجارية (لأكثر الحصص شيوعًا). */
  elapsedMinutes: number | null;
  /** دقائق متبقية على انتهاء الحصة الجارية. */
  remainingMinutes: number | null;
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
  const isoDate = new Date(when.getTime() - when.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const absentToday = new Set(
    data.absences.filter((absence) => absence.date === isoDate).map((absence) => absence.teacherId),
  );
  const coverByLesson = new Map(
    data.covers.filter((cover) => cover.date === isoDate).map((cover) => [cover.lessonId, cover.teacherId]),
  );

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
        const lessonTeacher = lesson ? lessonTeacherId(data, lesson) : '';
        const isAbsent = Boolean(lesson && absentToday.has(lessonTeacher));
        const substituteId = lesson ? coverByLesson.get(lesson.id) : undefined;
        return {
          cls,
          state: 'lesson',
          period: index + 1,
          time: times[index],
          subject: assignment ? subjectName(data, assignment.subjectId) : '—',
          teacher: lesson ? teacherName(data, lessonTeacher) : '—',
          absent: isAbsent,
          substitute: isAbsent ? (substituteId ? personName(data, substituteId) : null) : undefined,
          startRel: from,
          endRel: to,
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

  // أكثر حصة جارية شيوعًا (لأن بعض المراحل تتأخر فسحتها).
  const periodCount = new Map<number, number>();
  for (const item of lessons) periodCount.set(item.period!, (periodCount.get(item.period!) ?? 0) + 1);
  const dominantPeriod = [...periodCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const representative = lessons.find((item) => item.period === dominantPeriod) ?? lessons[0];
  const elapsedMinutes = representative
    ? Math.max(0, Math.floor(nowRel - (representative.startRel ?? nowRel)))
    : null;
  const remainingMinutes = representative
    ? Math.max(0, Math.ceil((representative.endRel ?? nowRel) - nowRel))
    : null;

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
    elapsedMinutes,
    remainingMinutes,
  };
}

function periodLabel(periods: number[]): string {
  if (!periods.length) return '—';
  if (periods.length === 1) return `الحصة ${periods[0]}`;
  return `الحصص ${periods.join('، ')}`;
}


const GRADE_LABELS = ['الأول', 'الثاني', 'الثالث'];

function LiveRow({ item, code }: { item: LiveClass; code: string }) {
  const tone =
    item.state === 'lesson'
      ? 'bg-emerald-50/60'
      : item.state === 'break'
        ? 'bg-amber-50/70'
        : 'bg-transparent';
  return (
    <div className={`flex items-center gap-2 border-b border-[var(--line)] px-1.5 py-1 text-[12px] last:border-0 ${tone}`}>
      <span className="w-11 shrink-0 font-extrabold text-[var(--ink)]">{code}</span>
      {item.state === 'lesson' ? (
        <>
          <span className="min-w-0 flex-1 truncate">
            <span className={`font-bold ${item.absent ? 'text-[var(--danger)]' : 'text-[var(--brand)]'}`}>
              {item.teacher}
            </span>
            {item.absent && (
              <span className="mx-1 rounded bg-red-50 px-1 py-0.5 text-[9.5px] font-bold text-[var(--danger)]">غائب</span>
            )}
            {item.absent && (
              <span className="mx-1 text-[11px] text-[var(--ink-600)]">
                البديل: {item.substitute ?? 'لم يُغطَّ بعد'}
              </span>
            )}
            {!item.absent && <span className="text-[var(--muted)]"> - {item.subject}</span>}
          </span>
          <span className="shrink-0 text-[10.5px] text-[var(--muted)]">{item.time}</span>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--muted)]">
          {item.state === 'break'
            ? `فسحة ${item.time}`
            : item.state === 'before'
              ? 'لم يبدأ الدوام'
              : 'انتهى الدوام'}
        </span>
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
    <div className="grid gap-3">
      <div className="card flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-[12.5px]">
        <span className="text-[11.5px] text-[var(--muted)]">الساعة الآن</span>
        <b className="text-[15px] text-[var(--brand)]">{snapshot.nowLabel}</b>
        <span className="text-[11.5px] text-[var(--muted)]">{snapshot.weekend ? 'نهاية الأسبوع' : `${snapshot.weekday} · ${hijri(now)}`}</span>
        <span className="h-4 w-px bg-[var(--line)]" />
        <span className="text-[11.5px] text-[var(--muted)]">الحصة الحالية</span>
        <b>{statusText}</b>
        {snapshot.nextTime && !snapshot.afterSchool && !snapshot.weekend && (
          <span className="text-[11.5px] text-[var(--muted)]">الجرس القادم {snapshot.nextTime}</span>
        )}
        <span className="h-4 w-px bg-[var(--line)]" />
        <span className="text-[11.5px] text-[var(--muted)]">في حصة</span>
        <b>{snapshot.lessons.length} / {data.classes.length}</b>
        <span className="text-[11.5px] text-[var(--muted)]">فسحة {snapshot.breaks.length}</span>
        <span className="h-4 w-px bg-[var(--line)]" />
        <span className="text-[11.5px] text-[var(--muted)]">معلمون مشغولون</span>
        <b>{snapshot.busyTeachers}</b>
        <span className="ms-auto text-[11px] text-[var(--muted)]">تحديث مباشر كل ثانية</span>
      </div>

      {snapshot.lessons.length > 0 && snapshot.elapsedMinutes !== null && snapshot.remainingMinutes !== null && (
        <div className="card grid gap-3 p-4 sm:grid-cols-2">
          <div className="rounded-xl bg-[var(--brand-soft)] px-4 py-3 text-center">
            <p className="m-0 text-[12.5px] font-bold text-[var(--muted)]">بدأت الحصة منذ</p>
            <p className="m-0 mt-1 text-3xl font-extrabold text-[var(--brand)]">
              {numberAr(snapshot.elapsedMinutes)} <span className="text-lg font-bold">دقيقة</span>
            </p>
          </div>
          <div className="rounded-xl bg-[#fff7ed] px-4 py-3 text-center">
            <p className="m-0 text-[12.5px] font-bold text-[var(--muted)]">باقي على انتهاء الحصة</p>
            <p className="m-0 mt-1 text-3xl font-extrabold text-[#b45309]">
              {numberAr(snapshot.remainingMinutes)} <span className="text-lg font-bold">دقيقة</span>
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#e8efec] sm:col-span-2">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all duration-500"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (snapshot.elapsedMinutes / Math.max(1, snapshot.elapsedMinutes + snapshot.remainingMinutes)) * 100,
                  ),
                )}%`,
              }}
            />
          </div>
        </div>
      )}

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
                group.classes.map((item) => (
                  <LiveRow key={item.cls.id} item={item} code={shortClassName(item.cls.name)} />
                ))
              )}
            </div>
          </Card>
        ))}
      </div>

      {others.length > 0 && (
        <Card title="فصول أخرى" subtitle={`${others.length} فصلًا`} padded={false}>
          <div className="p-2">
            {others.map((item) => (
              <LiveRow key={item.cls.id} item={item} code={shortClassName(item.cls.name)} />
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




