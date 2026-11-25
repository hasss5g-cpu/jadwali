import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import type { Admin, Cover } from '../types';
import { className, personName, subjectName } from '../lib/model';
import { absentLessons, autoCover, candidatesFor, coverageMessage } from '../lib/coverage';
import { copyText, addDays, hijriNumeric, numberAr, today, uid, weekdayLabel } from '../lib/utils';
import { Card, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { CoverageSheet } from '../components/PrintSheets';

export function CoverageView() {
  const { data, update, print, toast } = useStore();
  const [date, setDate] = useState(today());
  const [absentIds, setAbsentIds] = useState<string[]>([]);
  const [covers, setCovers] = useState<Cover[]>([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPeriods, setAdminPeriods] = useState(2);

  const admins = data.admins ?? [];

  const working = useMemo(
    () => ({
      ...data,
      absences: [...data.absences.filter((a) => a.date !== date), ...absentIds.map((id) => ({ date, teacherId: id }))],
      covers: [],
    }),
    [data, date, absentIds],
  );

  const lessons = useMemo(() => absentLessons(working, date), [working, date]);

  useEffect(() => {
    setCovers([]);
    setMessage('');
  }, [date, absentIds.length]);

  useEffect(() => {
    if (covers.length) setMessage(coverageMessage(working, date, covers));
  }, [covers, working, date]);

  const generate = () => {
    const result = autoCover(working, date);
    setCovers(result.covers);
    if (result.unassigned.length) toast(`تعذّر تغطية ${result.unassigned.length} حصة — راجع القائمة.`, 'warn');
    else toast(`وُزّعت ${result.covers.length} حصة انتظار تلقائيًا.`, 'ok');
  };

  const save = () => {
    update((prev) => ({
      ...prev,
      absences: [
        ...prev.absences.filter((a) => a.date !== date),
        ...absentIds.map((id) => ({ date, teacherId: id })),
      ],
      covers: [...prev.covers.filter((c) => c.date !== date), ...covers],
    }));
    toast('حُفظ غياب اليوم وتوزيع الانتظار.', 'ok');
  };

  const setCover = (lessonId: string, teacherId: string) => {
    setCovers((prev) => {
      const others = prev.filter((c) => c.lessonId !== lessonId);
      if (!teacherId) return others;
      return [...others, { id: `cv-${lessonId}`, date, lessonId, teacherId }];
    });
  };

  const live = useMemo(() => ({ ...working, covers }), [working, covers]);

  const adminUsage = useMemo(() => {
    const map = new Map<string, number>();
    for (const cover of covers) {
      if (admins.some((admin) => admin.id === cover.teacherId)) {
        map.set(cover.teacherId, (map.get(cover.teacherId) ?? 0) + 1);
      }
    }
    return map;
  }, [covers, admins]);

  const addAdmin = () => {
    const name = adminName.trim();
    if (!name) return;
    const admin: Admin = { id: uid('adm'), name, periods: Math.max(1, adminPeriods) };
    update((prev) => ({ ...prev, admins: [...(prev.admins ?? []), admin] }));
    setAdminName('');
    setAdminPeriods(2);
    toast('أُضيف الإداري إلى قائمة الانتظار.', 'ok');
  };

  const removeAdmin = (id: string) => {
    update((prev) => ({
      ...prev,
      admins: (prev.admins ?? []).filter((admin) => admin.id !== id),
      covers: prev.covers.filter((cover) => cover.teacherId !== id),
    }));
    setCovers((prev) => prev.filter((cover) => cover.teacherId !== id));
  };

  const covered = new Map(covers.map((c) => [c.lessonId, c.teacherId]));
  const teachers = data.teachers.filter((t) => !query.trim() || t.name.includes(query.trim()));

  if (!data.teachers.length) return <Empty title="لا يوجد معلمون" hint="استورد بيانات المدرسة أولًا." />;

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <div className="grid gap-4">
      <Card title="غياب اليوم" subtitle={`${weekdayLabel(date)} · ${hijriNumeric(date)}`}>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <span className="label">التاريخ الهجري</span>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-sm px-2"
                title="اليوم السابق"
                onClick={() => setDate(addDays(date, -1))}
              >
                ‹
              </button>
              <div className="input flex flex-1 items-center justify-center gap-1 text-center text-[12.5px] font-bold">
                <span>{weekdayLabel(date)}</span>
                <span>{hijriNumeric(date)}</span>
              </div>
              <button
                className="btn btn-sm px-2"
                title="اليوم التالي"
                onClick={() => setDate(addDays(date, 1))}
              >
                ›
              </button>
              <button className="btn btn-sm" onClick={() => setDate(today())}>
                اليوم
              </button>
            </div>
          </div>
          <label>
            <span className="label">بحث عن معلم</span>
            <div className="relative">
              <input className="input" placeholder="اسم المعلم" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </label>
        </div>

        <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-[var(--line)] p-2">
          <div className="flex flex-wrap gap-1.5">
            {teachers.map((teacher) => {
              const selected = absentIds.includes(teacher.id);
              return (
                <button
                  key={teacher.id}
                  onClick={() =>
                    setAbsentIds((prev) => (selected ? prev.filter((id) => id !== teacher.id) : [...prev, teacher.id]))
                  }
                  className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition ${
                    selected
                      ? 'border-red-300 bg-red-50 text-red-700'
                      : 'border-[var(--line)] bg-white text-[var(--ink-600)] hover:border-[#cbd5d1]'
                  }`}
                >
                  {teacher.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="badge">{numberAr(absentIds.length)} غائب</span>
          <span className="badge">{numberAr(lessons.length)} حصة تحتاج انتظارًا</span>
          <button className="btn btn-primary btn-sm" onClick={generate} disabled={!absentIds.length}>
            <Icon name="sparkles" size={15} /> توزيع الانتظار
          </button>
          <button className="btn btn-sm" onClick={save} disabled={!absentIds.length}>
            <Icon name="check" size={15} /> حفظ
          </button>
        </div>
      </Card>

      <Card title="الإداريون" subtitle="أضف الإداري وعدد حصص الانتظار التي يمكن إسنادها له، ويُدرج في التوزيع.">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[150px] flex-1">
            <span className="label">اسم الإداري</span>
            <input
              className="input"
              placeholder="مثال: مدير المدرسة"
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addAdmin();
              }}
            />
          </label>
          <label>
            <span className="label">عدد الحصص</span>
            <input
              className="input w-24 text-center"
              type="number"
              min={1}
              max={8}
              value={adminPeriods}
              onChange={(e) => setAdminPeriods(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <button className="btn btn-primary btn-sm" onClick={addAdmin} disabled={!adminName.trim()}>
            <Icon name="plus" size={15} /> إضافة
          </button>
        </div>

        {admins.length > 0 && (
          <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
            {admins.map((admin) => (
              <li
                key={admin.id}
                className="flex items-center justify-between rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[12.5px]"
              >
                <span className="font-semibold">{admin.name}</span>
                <span className="flex items-center gap-2">
                  <span className="badge">{numberAr(admin.periods)} حصص</span>
                  <button className="btn btn-ghost btn-sm px-1 text-[11px]" onClick={() => removeAdmin(admin.id)}>
                    حذف
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>

      <div className="grid gap-4">
        <Card
          title="حصص الانتظار"
          subtitle="يمكنك تغيير المعلم المنتظر يدويًا لكل حصة"
          actions={
            <button
              className="btn btn-sm"
              disabled={!covers.length}
              onClick={() => print('بيان حصص الانتظار', <CoverageSheet data={working} date={date} covers={covers} />)}
            >
              <Icon name="printer" size={15} /> طباعة
            </button>
          }
          padded={false}
        >
          {lessons.length === 0 ? (
            <div className="p-4">
              <Empty title="لا حصص على المعلمين الغائبين" hint="اختر المعلمين الغائبين أو غيّر التاريخ." />
            </div>
          ) : (
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>الحصة</th>
                    <th>الفصل</th>
                    <th>المادة</th>
                    <th>الغائب</th>
                    <th>المنتظر</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons.map((lesson) => {
                    const assignment = data.assignments.find((a) => a.id === lesson.assignmentId)!;
                    const value = covered.get(lesson.id) ?? '';
                    const taken = new Set(
                      covers
                        .filter((c) => c.lessonId !== lesson.id)
                        .filter((c) => data.lessons.find((l) => l.id === c.lessonId)?.period === lesson.period)
                        .map((c) => c.teacherId),
                    );
                    const candidates = candidatesFor(live, lesson, date, adminUsage).filter(
                      (c) => c.id === value || !taken.has(c.id),
                    );
                    const list =
                      value && !candidates.some((c) => c.id === value)
                        ? [{ id: value, name: personName(data, value), reason: 'مُعيّن حاليًا', score: 0, kind: 'teacher' as const }, ...candidates]
                        : candidates;
                    return (
                      <tr key={lesson.id}>
                        <td className="font-bold">{lesson.period + 1}</td>
                        <td>{className(data, assignment.classId)}</td>
                        <td>{subjectName(data, assignment.subjectId)}</td>
                        <td className="text-[12px] text-[var(--danger)]">{personName(data, assignment.teacherId)}</td>
                        <td>
                          <select className="select py-1 text-[12px]" value={value} onChange={(e) => setCover(lesson.id, e.target.value)}>
                            <option value="">— لم يُغطَّ —</option>
                            {list.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>
                                {candidate.name} ({candidate.reason})
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {covers.length > 0 && (
          <Card
            title="رسالة واتساب"
            subtitle="جاهزة للإرسال — تُحدَّث تلقائيًا عند أي تغيير"
            actions={
              <button
                className="btn btn-sm"
                onClick={async () => {
                  const ok = await copyText(message);
                  toast(ok ? 'نُسخت الرسالة.' : 'تعذّر النسخ — حدّد النص يدويًا.', ok ? 'ok' : 'warn');
                }}
              >
                <Icon name="clipboard" size={15} /> نسخ
              </button>
            }
          >
            <textarea
              className="input min-h-56 font-mono text-[12.5px] leading-6"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              dir="rtl"
            />
          </Card>
        )}
      </div>
    </div>
  );
}
