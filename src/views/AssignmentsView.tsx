import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { className, subjectName } from '../lib/model';
import { download, numberAr } from '../lib/utils';
import { Card, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { AssignmentsSheet } from '../components/PrintSheets';

export function AssignmentsView() {
  const { data, update, print, toast } = useStore();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const term = query.trim();
    return data.teachers
      .map((teacher) => {
        const own = data.assignments.filter((a) => a.teacherId === teacher.id);
        return {
          teacher,
          own,
          quota: own.reduce((n, a) => n + a.count, 0),
          overflow: Math.max(0, own.reduce((n, a) => n + a.count, 0) - teacher.max),
        };
      })
      .filter((row) => row.own.length)
      .filter((row) => !term || row.teacher.name.includes(term) || row.own.some((a) => className(data, a.classId).includes(term)))
      .sort((a, b) => b.overflow - a.overflow || a.teacher.name.localeCompare(b.teacher.name, 'ar'));
  }, [data, query]);

  const totalQuota = data.assignments.reduce((n, a) => n + a.count, 0);

  const changeCount = (assignmentId: string, count: number) => {
    update((prev) => ({
      ...prev,
      assignments: prev.assignments.map((a) => (a.id === assignmentId ? { ...a, count: Math.max(0, count) } : a)),
    }));
  };

  const exportCsv = () => {
    const lines = [['المعلم', 'النصاب', 'الحد', 'المادة', 'الفصل', 'الحصص']];
    for (const row of rows) {
      for (const a of row.own) {
        lines.push([row.teacher.name, String(row.quota), String(row.teacher.max), subjectName(data, a.subjectId), className(data, a.classId), String(a.count)]);
      }
    }
    const csv = lines.map((l) => l.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download('الإسنادات.csv', `\ufeff${csv}`, 'text/csv');
  };

  if (!data.assignments.length) return <Empty title="لا توجد إسنادات" hint="استورد ملف البيانات أو أضف الإسنادات." />;

  return (
    <div className="grid gap-4">
      <Card
        title="إسناد الحصص"
        subtitle={`${numberAr(data.assignments.length)} إسنادًا · ${numberAr(totalQuota)} حصة · ${numberAr(rows.length)} معلمًا`}
        actions={
          <>
            <input className="input w-52" placeholder="بحث باسم المعلم أو الفصل" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn btn-sm" onClick={exportCsv}>
              <Icon name="download" size={15} /> CSV
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => print('بيان إسناد الحصص', <AssignmentsSheet data={data} />)}
            >
              <Icon name="printer" size={15} /> طباعة الإسنادات
            </button>
          </>
        }
        padded={false}
      >
        <div className="scroll-x">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>#</th>
                <th>المعلم</th>
                <th>الإسنادات (مادة — فصل — عدد)</th>
                <th>النصاب</th>
                <th>الحد</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.teacher.id}>
                  <td>{index + 1}</td>
                  <td className="whitespace-nowrap font-bold">{row.teacher.name}</td>
                  <td>
                    <div className="flex flex-wrap gap-1.5">
                      {row.own.map((a) => (
                        <span key={a.id} className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-[11.5px]">
                          <span>{subjectName(data, a.subjectId)} — {className(data, a.classId)}</span>
                          <input
                            type="number"
                            min={0}
                            value={a.count}
                            onChange={(e) => changeCount(a.id, Number(e.target.value))}
                            className="w-11 rounded-md border border-[var(--line)] px-1 py-0.5 text-center text-[11.5px]"
                            aria-label="عدد الحصص"
                          />
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className={row.overflow ? 'font-bold text-[var(--danger)]' : 'font-bold'}>{row.quota}</td>
                  <td>{row.teacher.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {rows.some((r) => r.overflow > 0) && (
        <Card title="تجاوزات النصاب" subtitle="إسنادات تفوق الحد الأقصى للمعلم">
          <div className="flex flex-wrap gap-2">
            {rows
              .filter((r) => r.overflow > 0)
              .map((r) => (
                <button
                  key={r.teacher.id}
                  className="badge badge-warn"
                  onClick={() => {
                    setQuery(r.teacher.name);
                    toast(`فلترنا على ${r.teacher.name} (+${r.overflow} حصة)`, 'warn');
                  }}
                >
                  {r.teacher.name} +{r.overflow}
                </button>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
