import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { DEFAULT_OPTIONS, type GenerationOptions } from '../types';
import { useSolver } from '../lib/useSolver';
import { numberAr } from '../lib/utils';
import { Card, Field, Stat, Toggle } from '../components/ui';
import { Icon } from '../components/Icon';

export function GenerateView() {
  const { data, update, toast } = useStore();
  const [options, setOptions] = useState<GenerationOptions>({ ...DEFAULT_OPTIONS, ...data.options });
  const [seed, setSeed] = useState(1448);
  const solver = useSolver();

  const set = <K extends keyof GenerationOptions>(key: K, value: GenerationOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const report = solver.result?.report;
  const teachers = useMemo(
    () => (report ? [...report.teachers].sort((a, b) => b.overflow - a.overflow || b.longRuns - a.longRuns || b.holes - a.holes).slice(0, 8) : []),
    [report],
  );

  const run = async () => {
    const result = await solver.run(data, options, seed, 6000);
    if (result.ok) toast('اكتمل التوزيع دون تعارض — راجعه ثم طبّقه.', 'ok');
    else toast(`اكتمل التوزيع مع ${result.report.conflicts} مخالفة تحتاج مراجعة.`, 'warn');
  };

  const apply = () => {
    if (!solver.result) return;
    const lessons = solver.result.lessons;
    const ids = new Set(lessons.map((l) => l.id));
    update((prev) => ({
      ...prev,
      lessons,
      options,
      covers: prev.covers.filter((c) => ids.has(c.lessonId)),
    }));
    toast('طُبّق الجدول الجديد وحُفظ. يمكنك التراجع من الشريط العلوي.', 'ok');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <Card
        title="توليد الجدول"
        subtitle="قيود صارمة أولًا (بلا تعارض)، ثم تحسين الجودة: فراغات أقل، تتابع أقل، توزيع أفضل."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle
            label="حصص مفرقة"
            hint="توزيع حصص المعلم على أيام الأسبوع بدل تراكمها."
            checked={options.spread}
            onChange={(v) => {
              set('spread', v);
              if (v) set('compact', false);
            }}
          />
          <Toggle
            label="حصص متراصة"
            hint="تقريب حصص الفصل داخل اليوم. يعاكس «مفرقة»."
            checked={options.compact}
            onChange={(v) => {
              set('compact', v);
              if (v) set('spread', false);
            }}
          />
          <Toggle
            label="حصتا الفنية متجاورتان"
            hint="لنفس الفصل، في اليوم نفسه وحصتين متتاليتين."
            checked={options.artPairs}
            onChange={(v) => set('artPairs', v)}
          />
          <Toggle
            label="يوم قصير للمعلم"
            hint="يفضّل أن ينتهي يوم المعلم مبكرًا عند الإمكان."
            checked={options.goldenDay}
            onChange={(v) => set('goldenDay', v)}
          />
          <Toggle
            label="توازن الحصة السابعة"
            hint="توزيع حصص الحصة الأخيرة بعدالة بين المعلمين."
            checked={options.balanceSeventh}
            onChange={(v) => set('balanceSeventh', v)}
          />
          <Toggle
            label="كل أيام الأسبوع"
            hint="لا يبقى لأي معلم يوم خالٍ من الحصص (مفعّل افتراضيًا)."
            checked={options.allDays}
            onChange={(v) => set('allDays', v)}
          />
          <Toggle
            label="السماح بتجاوز النصاب"
            hint="عند تعذّر التوزيع ضمن النصاب، يرفعه ويذكر ذلك في التقرير."
            checked={options.relaxLoad}
            onChange={(v) => set('relaxLoad', v)}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="سقف الحصص المتتالية للمعلم" hint="0 = بلا سقف. الافتراضي ثلاث حصص ثم حصة فراغ.">
            <select className="select" value={options.maxRun} onChange={(e) => set('maxRun', Number(e.target.value))}>
              {[0, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? 'بلا سقف' : `${n} حصص`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="مفتاح النتيجة (Seed)" hint="المفتاح نفسه يعطي النتيجة نفسها دائمًا.">
            <div className="flex gap-2">
              <input
                className="input"
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value) || 1)}
              />
              <button className="btn btn-sm" onClick={() => setSeed(Math.floor(Math.random() * 9000) + 1000)}>
                عشوائي
              </button>
            </div>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn btn-primary" onClick={run} disabled={solver.running}>
            <Icon name="sparkles" size={16} />
            {solver.running ? 'جارٍ التوليد…' : 'توليد الجدول'}
          </button>
          <button className="btn" onClick={apply} disabled={!solver.result || solver.running}>
            <Icon name="check" size={16} /> تطبيق على الجدول
          </button>
          {solver.result && (
            <button className="btn btn-ghost" onClick={solver.clear} disabled={solver.running}>
              مسح النتيجة
            </button>
          )}
        </div>

        {(solver.running || solver.fraction > 0) && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-[#e8efec]">
              <div
                className="h-full rounded-full bg-[var(--brand)] transition-[width] duration-200"
                style={{ width: `${Math.round(solver.fraction * 100)}%` }}
              />
            </div>
            <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">{solver.message}</p>
          </div>
        )}
      </Card>

      <div className="grid gap-4">
        {report ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="درجة الجودة" value={report.score} hint="100 = أفضل توزيع ممكن" tone={report.score >= 75 ? 'ok' : report.score >= 50 ? 'warn' : 'danger'} />
              <Stat
                label="الحصص الموزعة"
                value={`${numberAr(report.placed)}/${numberAr(report.total)}`}
                hint={report.conflicts === 0 ? 'دون تعارض' : `${numberAr(report.conflicts)} مخالفة`}
                tone={report.conflicts === 0 ? 'ok' : 'danger'}
              />
              <Stat label="الفراغات" value={numberAr(report.holes)} hint="فجوات في يوم المعلم" />
              <Stat
                label="التتابع الطويل"
                value={numberAr(report.longRuns)}
                hint={`أكثر من ${options.maxRun || '∞'} حصص متتالية`}
              />
              <Stat
                label="تجاور الفنية"
                value={`${numberAr(report.artPairsIntact)}/${numberAr(report.artPairs)}`}
                tone={report.artPairsIntact === report.artPairs ? 'ok' : 'warn'}
              />
              <Stat
                label="أيام خالية"
                value={numberAr(report.missingDays)}
                hint="أيام بلا حصص لأي معلم"
                tone={report.missingDays === 0 ? 'ok' : 'warn'}
              />
              <Stat
                label="زمن التوليد"
                value={`${(report.ms / 1000).toFixed(1)}s`}
                hint={`${numberAr(report.iterations)} محاولة`}
              />
            </div>

            {report.notes.length > 0 && (
              <Card title="ملاحظات التقرير" subtitle="حالات اضطرّ المحرك لتجاوز قيد ناعم">
                <ul className="m-0 grid list-disc gap-1 ps-5 text-[12.5px] text-[var(--warn)]">
                  {report.notes.slice(0, 6).map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
              </Card>
            )}

            <Card title="أكثر المعلمين حاجة للمتابعة" padded={false}>
              <div className="scroll-x">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المعلم</th>
                      <th>الحصص</th>
                      <th>النصاب</th>
                      <th>الفراغات</th>
                      <th>التتابع</th>
                      <th>الأيام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <tr key={teacher.id}>
                        <td className="font-bold">{teacher.name}</td>
                        <td>{numberAr(teacher.lessons)}</td>
                        <td className={teacher.overflow > 0 ? 'font-bold text-[var(--danger)]' : ''}>
                          {numberAr(teacher.quota)}
                        </td>
                        <td>{numberAr(teacher.holes)}</td>
                        <td>{numberAr(teacher.longRuns)}</td>
                        <td className={teacher.missingDays ? 'font-bold text-[var(--warn)]' : ''}>
                          {teacher.activeDays}/{data.days}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        ) : (
          <Card title="كيف يعمل التوليد؟">
            <ol className="m-0 grid list-decimal gap-2 ps-5 text-[13px] leading-6 text-[var(--ink-600)]">
              <li>يبني جدولًا أوليًا كامل العدد: كل فصل يشغل مقاعده كلها بلا تصادم داخلي.</li>
              <li>يبدّل الحصص بين المواعيد داخل الفصل نفسه، فيبقى الجدول صالحًا في كل خطوة.</li>
              <li>يعاقب بشدّة كل تعارض صارم (معلم، يوم راحة، سقف البدنية) حتى يصل إلى صفر.</li>
              <li>ثم يحسّن الجودة: فراغات أقل، تتابع محدود، تكرار أقل، فنية متجاورة، توازن السابعة.</li>
              <li>يعيد أفضل حل وجده خلال الميزانية الزمنية، ويعرض تقريرًا قابلًا للقياس قبل التطبيق.</li>
            </ol>
            <p className="m-0 mt-3 rounded-xl bg-[#f4f8f6] p-3 text-[12px] leading-5 text-[var(--ink-600)]">
              الجدول الحالي لا يتغيّر حتى تضغط «تطبيق على الجدول»، ويمكنك التراجع بضغطة واحدة.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
