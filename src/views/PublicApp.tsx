import { useEffect, useMemo, useState } from 'react';
import { seedData } from '../lib/storage';
import { DAY_NAMES, subjectName, teacherName } from '../lib/model';
import { periodTimes, sha256 } from '../lib/utils';
import { Icon } from '../components/Icon';

function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-3 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="m-0 text-[11px] font-bold text-[var(--brand)]">جدولي · {seedData.school}</p>
          <h1 className="m-0 text-xl font-extrabold">{title}</h1>
          {subtitle && <p className="m-0 mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p>}
        </div>
        <a className="btn btn-sm" href="#/classes">
          كل الفصول
        </a>
      </header>
      {children}
      <footer className="mt-6 text-center text-[11px] text-[var(--muted)]">
        هذه صفحة عرض للقراءة فقط — {seedData.term}
      </footer>
    </div>
  );
}

function ScheduleTable({ filter }: { filter: (assignmentId: string) => boolean }) {
  const times = periodTimes(seedData.start, seedData.duration, seedData.periods);
  const cell = (day: number, period: number) => {
    const lesson = seedData.lessons.find((l) => l.day === day && l.period === period && filter(l.assignmentId));
    if (!lesson) return null;
    return seedData.assignments.find((a) => a.id === lesson.assignmentId) ?? null;
  };
  return (
    <div className="card overflow-hidden p-2">
      <div className="scroll-x">
        <div className="schedule-grid">
          <div />
          {DAY_NAMES.slice(0, seedData.days).map((day) => (
            <div key={day} className="pb-1 text-center text-[12.5px] font-extrabold text-[var(--muted)]">
              {day}
            </div>
          ))}
          {Array.from({ length: seedData.periods }, (_, period) => (
            <div key={period} className="contents">
              <div className="flex flex-col items-center justify-center rounded-lg bg-[#f3f7f5] px-1 py-2 text-center">
                <span className="text-[13px] font-extrabold">{period + 1}</span>
                <span className="text-[9.5px] text-[var(--muted)]">{times[period]}</span>
              </div>
              {DAY_NAMES.slice(0, seedData.days).map((_, day) => {
                const assignment = cell(day, period);
                return (
                  <div key={day} className="schedule-cell" data-empty={!assignment}>
                    {assignment ? (
                      <>
                        <div className="lesson-subject">{subjectName(seedData, assignment.subjectId)}</div>
                        <div className="lesson-meta">{teacherName(seedData, assignment.teacherId)}</div>
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
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ id: string; error?: string } | null>(null);

  const activeClass = useMemo(() => {
    if (!route.startsWith('class/')) return null;
    const id = decodeURIComponent(route.slice('class/'.length));
    return seedData.classes.find((c) => c.id === id) ?? null;
  }, [route]);

  if (route === 'lookup') {
    const submit = async () => {
      if (!code.trim()) return;
      const hashValue = await sha256(code);
      const teacher = seedData.teachers.find((t) => t.codeHash === hashValue);
      setResult(teacher ? { id: teacher.id } : { id: '', error: 'الرمز غير صحيح أو غير مفعّل. راجع إدارة المدرسة.' });
    };
    return (
      <Shell title="استعلام المعلم" subtitle="أدخل رمزك لعرض جدولك الأسبوعي فقط">
        <div className="card p-4">
          <label className="label">رمز الاستعلام</label>
          <div className="flex gap-2">
            <input
              className="input text-center font-mono text-lg tracking-[0.3em]"
              inputMode="numeric"
              maxLength={12}
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
            <h2 className="mb-2 text-[15px] font-extrabold">جدول {teacherName(seedData, result.id)}</h2>
            <ScheduleTable filter={(assignmentId) => seedData.assignments.find((a) => a.id === assignmentId)?.teacherId === result.id} />
          </div>
        )}
      </Shell>
    );
  }

  if (activeClass) {
    return (
      <Shell title={`جدول ${activeClass.name}`} subtitle={`${seedData.term} · ${activeClass.room}`}>
        <button className="btn btn-sm mb-2" onClick={() => window.print()}>
          <Icon name="printer" size={15} /> طباعة
        </button>
        <ScheduleTable filter={(assignmentId) => seedData.assignments.find((a) => a.id === assignmentId)?.classId === activeClass.id} />
      </Shell>
    );
  }

  return (
    <Shell title="جداول الفصول" subtitle="اختر الفصل لعرض جدوله الأسبوعي">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {seedData.classes.map((cls) => (
          <a
            key={cls.id}
            href={`#/class/${encodeURIComponent(cls.id)}`}
            className="card flex items-center justify-between p-3 transition hover:border-[#b9dcd6]"
          >
            <span>
              <span className="block text-[13.5px] font-extrabold">{cls.name}</span>
              <span className="block text-[11px] text-[var(--muted)]">{cls.room}</span>
            </span>
            <Icon name="calendar" size={18} />
          </a>
        ))}
      </div>
      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
        للاستعلام عن جدول معلم: <a className="font-bold text-[var(--brand)]" href="#/lookup">صفحة المعلم</a>
        {' · '}
        {seedData.classes.length} فصلًا
      </p>
    </Shell>
  );
}
