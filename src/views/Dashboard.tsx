import { useMemo } from 'react';
import { useStore } from '../store';
import { DAY_NAMES, validate } from '../lib/model';
import { absentLessons } from '../lib/coverage';
import { numberAr, today, weekdayLabel } from '../lib/utils';
import { Card, Stat } from '../components/ui';
import { Icon } from '../components/Icon';

export function Dashboard({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { data } = useStore();
  const violations = useMemo(() => validate(data), [data]);
  const todayAbsent = data.absences.filter((a) => a.date === today());
  const todayLessons = todayAbsent.length ? absentLessons(data, today()).length : 0;
  const quota = data.assignments.reduce((n, a) => n + a.count, 0);
  const over = data.teachers.filter((t) => {
    const load = data.assignments.filter((a) => a.teacherId === t.id).reduce((n, a) => n + a.count, 0);
    return load > t.max;
  });

  const metrics = useMemo(() => {
    const teacherOf = new Map(data.assignments.map((a) => [a.id, a.teacherId]));
    const byDay = new Map<string, number[]>();
    for (const lesson of data.lessons) {
      const teacherId = teacherOf.get(lesson.assignmentId);
      if (!teacherId) continue;
      const key = `${teacherId}:${lesson.day}`;
      const list = byDay.get(key) ?? [];
      list.push(lesson.period);
      byDay.set(key, list);
    }
    let holes = 0;
    let longRuns = 0;
    for (const periods of byDay.values()) {
      periods.sort((a, b) => a - b);
      holes += periods[periods.length - 1] - periods[0] + 1 - periods.length;
      let run = 1;
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] === periods[i - 1] + 1) run++;
        else {
          if (run > 3) longRuns++;
          run = 1;
        }
      }
      if (run > 3) longRuns++;
    }
    return { holes, longRuns };
  }, [data]);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="حالة الجدول"
          value={violations.length === 0 ? 'سليم' : `${numberAr(violations.length)} مخالفة`}
          hint={violations.length === 0 ? 'كل القيود الصارمة محققة' : 'افتح الجدول لمراجعة التفاصيل'}
          tone={violations.length === 0 ? 'ok' : 'danger'}
        />
        <Stat label="الحصص الموزعة" value={numberAr(data.lessons.length)} hint={`من ${numberAr(quota)} حصة مسندة`} tone={data.lessons.length === quota ? 'ok' : 'warn'} />
        <Stat label="فراغات المعلمين" value={numberAr(metrics.holes)} hint={`${numberAr(metrics.longRuns)} تتابعًا أطول من 3`} />
        <Stat
          label="غياب اليوم"
          value={numberAr(todayAbsent.length)}
          hint={todayAbsent.length ? `${numberAr(todayLessons)} حصة تحتاج انتظارًا` : `${weekdayLabel(today())} — لا غياب مسجل`}
          tone={todayAbsent.length ? 'warn' : 'ok'}
        />
      </div>

      {violations.length > 0 && (
        <Card title="تحتاج انتباهك" subtitle="أول المخالفات في الجدول الحالي">
          <ul className="m-0 grid list-disc gap-1 ps-5 text-[13px] text-[var(--danger)]">
            {violations.slice(0, 5).map((v, i) => (
              <li key={i}>{v.message}</li>
            ))}
          </ul>
          <button className="btn btn-primary btn-sm mt-3" onClick={() => onNavigate('generate')}>
            <Icon name="sparkles" size={15} /> أعد التوليد
          </button>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="خطوات سريعة">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { tab: 'generate', label: 'توليد جدول جديد', hint: 'قيود صارمة + تحسين جودة', icon: 'sparkles' },
              { tab: 'schedule', label: 'عرض وطباعة الجدول', hint: 'فصل أو معلم على A4', icon: 'calendar' },
              { tab: 'coverage', label: 'توزيع حصص الانتظار', hint: 'غياب اليوم ورسالة واتساب', icon: 'shield' },
              { tab: 'exams', label: 'جدول الاختبارات', hint: 'فترية ورسمية', icon: 'clipboard' },
              { tab: 'assignments', label: 'مراجعة الإسنادات', hint: 'النصاب وتجاوزاته', icon: 'users' },
              { tab: 'share', label: 'روابط المشاركة', hint: 'الفصول واستعلام المعلم', icon: 'share' },
            ].map((item) => (
              <button
                key={item.tab}
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-white p-3 text-right transition hover:border-[#b9dcd6] hover:bg-[#f7fdfb]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon name={item.icon} size={17} />
                </span>
                <span>
                  <span className="block text-[13px] font-extrabold">{item.label}</span>
                  <span className="block text-[11px] text-[var(--muted)]">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="صحة البيانات" subtitle="ملخص سريع للمدرسة">
          <div className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl bg-[#f6f9f8] p-3">
              <p className="m-0 text-[11px] text-[var(--muted)]">الفصول</p>
              <p className="m-0 text-lg font-extrabold">{numberAr(data.classes.length)}</p>
            </div>
            <div className="rounded-xl bg-[#f6f9f8] p-3">
              <p className="m-0 text-[11px] text-[var(--muted)]">المعلمون</p>
              <p className="m-0 text-lg font-extrabold">{numberAr(data.teachers.length)}</p>
            </div>
            <div className="rounded-xl bg-[#f6f9f8] p-3">
              <p className="m-0 text-[11px] text-[var(--muted)]">المواد</p>
              <p className="m-0 text-lg font-extrabold">{numberAr(data.subjects.length)}</p>
            </div>
            <div className="rounded-xl bg-[#f6f9f8] p-3">
              <p className="m-0 text-[11px] text-[var(--muted)]">الإسنادات</p>
              <p className="m-0 text-lg font-extrabold">{numberAr(data.assignments.length)}</p>
            </div>
          </div>
          {over.length > 0 && (
            <p className="m-0 mt-3 rounded-xl bg-[#fff7ed] p-3 text-[12px] leading-5 text-[var(--warn)]">
              {numberAr(over.length)} معلمًا فوق النصاب: {over.slice(0, 3).map((t) => t.name).join('، ')}
              {over.length > 3 ? '…' : ''}
            </p>
          )}
          <p className="m-0 mt-3 text-[11.5px] text-[var(--muted)]">
            البيانات محفوظة في هذا المتصفح تلقائيًا، ويمكنك تصديرها نسخة احتياطية من تبويب البيانات.
          </p>
        </Card>
      </div>

      <Card title="أيام الأسبوع" subtitle="عدد الحصص في كل يوم">
        <div className="grid grid-cols-5 gap-2">
          {DAY_NAMES.slice(0, data.days).map((day, index) => {
            const count = data.lessons.filter((l) => l.day === index).length;
            return (
              <div key={day} className="rounded-xl border border-[var(--line)] p-3 text-center">
                <p className="m-0 text-[12px] font-bold text-[var(--muted)]">{day}</p>
                <p className="m-0 mt-1 text-xl font-extrabold">{numberAr(count)}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
