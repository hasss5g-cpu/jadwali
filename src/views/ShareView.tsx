import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { copyText, download, numberAr, sha256 } from '../lib/utils';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';

export function ShareView() {
  const { data, update, toast, print } = useStore();
  const [codes, setCodes] = useState<{ name: string; code: string }[]>([]);

  const base = `${window.location.origin}${window.location.pathname}`;
  const links = useMemo(
    () => [
      {
        title: 'رابط جداول الفصول',
        url: `${base}#/classes`,
        hint: 'يفتح قائمة الفصول لولي الأمر أو الطالب، بلا أي بيانات شخصية.',
      },
      {
        title: 'رابط استعلام المعلم',
        url: `${base}#/lookup`,
        hint: 'يدخل المعلم سجله المدني فيرى جدوله فقط. يُحفظ السجل كبصمة SHA-256 لا كنص صريح.',
      },
    ],
    [base],
  );

  const activeCodes = data.teachers.filter((t) => t.codeHash).length;

  const generateCodes = async () => {
    const fresh: { name: string; code: string }[] = [];
    const teachers = [...data.teachers];
    for (const teacher of teachers) {
      if (teacher.codeHash) continue;
      const code = String(Math.floor(100000 + Math.random() * 900000));
      teacher.codeHash = await sha256(code);
      fresh.push({ name: teacher.name, code });
    }
    update((prev) => ({ ...prev, teachers }));
    setCodes(fresh);
    if (fresh.length) toast(`وُلدت رموز لـ ${fresh.length} معلمًا — اطبعها ووزّعها.`, 'ok');
    else toast('كل المعلمين لديهم رموز بالفعل.', 'warn');
  };

  const printCodes = () => {
    if (!codes.length) return;
    print(
      'رموز استعلام المعلمين',
      <div>
        <header style={{ textAlign: 'center', marginBottom: 10 }}>
          <h1 style={{ margin: 0, fontSize: 17 }}>رموز استعلام المعلمين — {data.school}</h1>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#475569' }}>
            احتفظ بهذه الورقة. لا يمكن استرجاع الرموز بعد إغلاقها؛ يمكن توليد رموز جديدة عند الحاجة.
          </p>
        </header>
        <table>
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>المعلم</th>
              <th style={{ width: 100 }}>الرمز</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((row, index) => (
              <tr key={row.name}>
                <td>{index + 1}</td>
                <td style={{ textAlign: 'right' }}>{row.name}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 }}>{row.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
  };

  return (
    <div className="grid gap-4">
      <Card title="روابط المشاركة" subtitle="النسخة الثابتة تعمل بلا سيرفر، والروابط تحمل البيانات المنشورة معها">
        <div className="grid gap-3">
          {links.map((link) => (
            <div key={link.title} className="rounded-xl border border-[var(--line)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="m-0 text-[13.5px] font-extrabold">{link.title}</p>
                  <p className="m-0 mt-0.5 text-[11.5px] text-[var(--muted)]">{link.hint}</p>
                </div>
                <div className="flex gap-2">
                  <a className="btn btn-sm" href={link.url} target="_blank" rel="noreferrer">
                    فتح
                  </a>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      const ok = await copyText(link.url);
                      toast(ok ? 'نُسخ الرابط.' : 'تعذّر النسخ.', ok ? 'ok' : 'warn');
                    }}
                  >
                    <Icon name="clipboard" size={15} /> نسخ
                  </button>
                </div>
              </div>
              <code className="mt-2 block overflow-x-auto rounded-lg bg-[#f6f9f8] px-2 py-1.5 text-[11px] text-[var(--ink-600)]" dir="ltr">
                {link.url}
              </code>
            </div>
          ))}
        </div>
        <p className="m-0 mt-3 text-[12px] leading-5 text-[var(--muted)]">
          الصفحات العامة تقرأ بيانات هذا المتصفح إن وُجدت، وإلا فالبيانات المضمّنة في النسخة المنشورة (ملف{' '}
          <code>src/data/school.json</code>). بعد اعتماد تعديلاتك، صدّرها من تبويب البيانات وحدّث الملف في المستودع ثم
          أعد النشر؛ أو فعّل الاستعلام ثم اختبره من الزر «فتح» في هذا المتصفح.
        </p>
      </Card>

      <Card
        title="رموز استعلام المعلمين"
        subtitle={`${numberAr(activeCodes)} من ${numberAr(data.teachers.length)} معلمًا لديه رمز`}
        actions={
          <>
            <button className="btn btn-primary btn-sm" onClick={generateCodes}>
              <Icon name="sparkles" size={15} /> توليد الرموز الناقصة
            </button>
            <button className="btn btn-sm" disabled={!codes.length} onClick={printCodes}>
              <Icon name="printer" size={15} /> طباعة الرموز
            </button>
            <button
              className="btn btn-sm"
              disabled={!codes.length}
              onClick={() => {
                const csv = ['المعلم,الرمز', ...codes.map((c) => `"${c.name}","${c.code}"`)].join('\r\n');
                download('رموز-المعلمين.csv', `\ufeff${csv}`, 'text/csv');
              }}
            >
              <Icon name="download" size={15} /> CSV
            </button>
          </>
        }
      >
        {codes.length ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {codes.map((row) => (
              <div key={row.name} className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2">
                <span className="text-[12.5px] font-semibold">{row.name}</span>
                <code className="rounded bg-[#f1f5f3] px-2 py-0.5 font-mono text-[12.5px] font-bold tracking-widest">{row.code}</code>
              </div>
            ))}
          </div>
        ) : (
          <p className="m-0 text-[12.5px] leading-6 text-[var(--muted)]">
            لم تولّد رموزًا في هذه الجلسة. اضغط «توليد الرموز الناقصة» لإنشاء رمز من ستة أرقام لكل معلم، ثم اطبعها
            ووزّعها. يُحفظ في البيانات بصمة الرمز فقط، فلا يمكن استخراج الرمز من الملف المنشور.
          </p>
        )}
      </Card>
    </div>
  );
}
