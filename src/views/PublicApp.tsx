import { useEffect, useMemo, useState } from 'react';
import type { Lesson, SchoolClass, SchoolData } from '../types';
import { loadData } from '../lib/storage';
import { DAY_NAMES, classPeriodTimes, lessonTeacherId, subjectName, teacherName } from '../lib/model';
import { periodTimes, sha256 } from '../lib/utils';
import { Icon } from '../components/Icon';
import { LiveBoard } from './LiveView';

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function Shell({
  data,
  title,
  subtitle,
  landscape,
  children,
}: {
  data: SchoolData;
  title: string;
  subtitle?: string;
  landscape?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto max-w-4xl px-3 py-6 ${landscape ? 'print-landscape' : ''}`}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[11px] font-bold text-[var(--brand)]">جدولي · {data.school}</p>
          <h1 className="m-0 text-xl font-extrabold">{title}</h1>
          {subtitle && <p className="m-0 mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <a className="btn btn-sm no-print" href="#/live">
            الجدول لايف
          </a>
          <a className="btn btn-sm no-print" href="#/classes">
            كل الفصول
          </a>
        </div>
      </header>
      {children}
      <footer className="mt-6 text-center text-[11px] text-[var(--muted)]">هذه صفحة عرض للقراءة فقط — {data.term}</footer>
    </div>
  );
}

function ScheduleTable({
  data,
  filter,
  cls,
}: {
  data: SchoolData;
  filter: (lesson: Lesson) => boolean;
  cls?: SchoolClass;
}) {
  const times = cls ? classPeriodTimes(data, cls) : periodTimes(data.start, data.duration, data.periods);
  const cell = (day: number, period: number) => {
    const lesson = data.lessons.find((l) => l.day === day && l.period === period && filter(l));
    if (!lesson) return null;
    return data.assignments.find((a) => a.id === lesson.assignmentId) ?? null;
  };
  return (
    <div className="card overflow-hidden p-2">
      <div className="scroll-x">
        <div
          className="schedule-grid"
          style={{ gridTemplateColumns: `88px repeat(${data.periods}, minmax(0, 1fr))` }}
        >
          <div className="schedule-corner">الحصة</div>
          {Array.from({ length: data.periods }, (_, period) => (
            <div key={period} className="schedule-period-head">
              <span className="text-[13px] font-extrabold">{period + 1}</span>
              <span className="text-[9.5px] text-[var(--muted)]">{cls ? times[period] : ''}</span>
            </div>
          ))}
          {DAY_NAMES.slice(0, data.days).map((day, dayIndex) => (
            <div key={day} className="contents">
              <div className="schedule-day">{day}</div>
              {Array.from({ length: data.periods }, (_, period) => {
                const assignment = cell(dayIndex, period);
                const lessonClass = assignment ? data.classes.find((c) => c.id === assignment.classId) : undefined;
                const lessonTime = !cls && lessonClass ? classPeriodTimes(data, lessonClass)[period] : '';
                return (
                  <div key={period} className="schedule-cell" data-empty={!assignment}>
                    {assignment ? (
                      <>
                        <div className="lesson-subject">{subjectName(data, assignment.subjectId)}</div>
                        <div className="lesson-meta">{teacherName(data, assignment.teacherId)}</div>
                        {!cls && <div className="lesson-time">{lessonTime}</div>}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PublicApp() {
  const hash = useHash();
  const route = hash.replace(/^#\/?/, '');
  const data = useMemo(() => loadData(), []);
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ id: string; error?: string } | null>(null);

  const activeClass = useMemo(() => {
    if (!route.startsWith('class/')) return null;
    const id = decodeURIComponent(route.slice('class/'.length));
    return data.classes.find((c) => c.id === id) ?? null;
  }, [route, data]);

  if (route === 'live') {
    return (
      <Shell data={data} title="الجدول لايف" subtitle="الحصة الجارية الآن — يُحدَّث تلقائيًا">
        <LiveBoard data={data} />
      </Shell>
    );
  }

  if (route === 'lookup') {
    const submit = async () => {
      if (!code.trim()) return;
      const value = await sha256(code);
      const teacher = data.teachers.find((t) => t.codeHash === value);
      setResult(teacher ? { id: teacher.id } : { id: '', error: 'الرمز غير صحيح أو غير مفعّل. راجع إدارة المدرسة.' });
    };
    return (
      <Shell data={data} title="استعلام المعلم" subtitle="أدخل سجلك المدني (أو رمزك) لعرض جدولك الأسبوعي فقط">
        <div className="card p-4">
          <label className="label">السجل المدني / رمز الاستعلام</label>
          <div className="flex gap-2">
            <input
              className="input text-center font-mono text-lg tracking-[0.25em]"
              inputMode="numeric"
              maxLength={14}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setResult(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              placeholder="••••••"
            />
            <button className="btn btn-primary" onClick={() => void submit()}>
              <Icon name="search" size={16} /> عرض
            </button>
          </div>
          {result?.error && <p className="m-0 mt-3 rounded-lg bg-red-50 p-2 text-[12.5px] text-red-700">{result.error}</p>}
        </div>
        {result?.id && (
          <div className="mt-4">
            <h2 className="mb-2 text-[15px] font-extrabold">جدول {teacherName(data, result.id)}</h2>
            <ScheduleTable
              data={data}
              filter={(lesson) => lessonTeacherId(data, lesson) === result.id}
            />
          </div>
        )}
      </Shell>
    );
  }

  if (activeClass) {
    return (
      <Shell
        data={data}
        title={`جدول ${activeClass.name}`}
        subtitle={`${data.term}${activeClass.room && activeClass.room !== activeClass.name ? ` · ${activeClass.room}` : ''}`}
        landscape
      >
        <button className="btn btn-sm no-print mb-2" onClick={() => window.print()}>
          <Icon name="printer" size={15} /> طباعة
        </button>
        <ScheduleTable
          data={data}
          cls={activeClass}
          filter={(lesson) => data.assignments.find((a) => a.id === lesson.assignmentId)?.classId === activeClass.id}
        />
      </Shell>
    );
  }

  return (
    <Shell data={data} title="جداول الفصول" subtitle="اختر الفصل لعرض جدوله الأسبوعي">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.classes.map((cls) => (
          <a
            key={cls.id}
            href={`#/class/${encodeURIComponent(cls.id)}`}
            className="card flex items-center justify-between p-3 transition hover:border-[#b9dcd6]"
          >
            <span>
              <span className="block text-[13.5px] font-extrabold">{cls.name}</span>
              {cls.room && cls.room !== cls.name && (
                <span className="block text-[11px] text-[var(--muted)]">{cls.room}</span>
              )}
            </span>
            <Icon name="calendar" size={18} />
          </a>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
        للاستعلام عن جدول معلم: <a className="font-bold text-[var(--brand)]" href="#/lookup">صفحة المعلم</a>
        {' · '}
        {data.classes.length} فصلًا
      </p>
    </Shell>
  );
}


