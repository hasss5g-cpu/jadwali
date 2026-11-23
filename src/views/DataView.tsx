import { useRef, useState } from 'react';
import { useStore } from '../store';
import type { SchoolData } from '../types';
import { DAY_SHORT } from '../lib/model';
import { download, numberAr, uid } from '../lib/utils';
import { Card, Field } from '../components/ui';
import { Icon } from '../components/Icon';
import { normalizeData } from '../lib/model';

type Tab = 'general' | 'teachers' | 'classes' | 'subjects';

export function DataView() {
  const { data, update, replace, reset, toast } = useStore();
  const [tab, setTab] = useState<Tab>('general');
  const fileRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof SchoolData>(key: K, value: SchoolData[K]) =>
    update((prev) => ({ ...prev, [key]: value }));

  const exportJson = () => {
    download(`jadwali-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
    toast('نُزّلت نسخة البيانات.', 'ok');
  };

  const importJson = async (file: File) => {
    try {
      const parsed = normalizeData(JSON.parse(await file.text()) as SchoolData);
      replace(parsed);
      toast('استُوردت البيانات بنجاح.', 'ok');
    } catch {
      toast('ملف غير صالح — تأكد أنه JSON لبيانات جدولي.', 'error');
    }
  };

  return (
    <div className="grid gap-4">
      <Card
        title="بيانات المدرسة"
        subtitle={`${numberAr(data.classes.length)} فصلًا · ${numberAr(data.teachers.length)} معلمًا · ${numberAr(data.subjects.length)} مادة · ${numberAr(data.assignments.length)} إسنادًا`}
        actions={
          <div className="tabs">
            {(
              [
                ['general', 'عام'],
                ['teachers', 'المعلمون'],
                ['classes', 'الفصول'],
                ['subjects', 'المواد'],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button key={id} className="tab" data-active={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
        }
      >
        {tab === 'general' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم المدرسة">
              <input className="input" value={data.school} onChange={(e) => setField('school', e.target.value)} />
            </Field>
            <Field label="الفصل الدراسي">
              <input className="input" value={data.term} onChange={(e) => setField('term', e.target.value)} />
            </Field>
            <Field label="عدد الحصص اليومية">
              <select className="select" value={data.periods} onChange={(e) => setField('periods', Number(e.target.value))}>
                {[5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} حصص
                  </option>
                ))}
              </select>
            </Field>
            <Field label="بداية اليوم">
              <input className="input" type="time" value={data.start} onChange={(e) => setField('start', e.target.value)} />
            </Field>
            <Field label="مدة الحصة (دقيقة)">
              <input
                className="input"
                type="number"
                min={20}
                max={90}
                value={data.duration}
                onChange={(e) => setField('duration', Number(e.target.value) || 45)}
              />
            </Field>
            <Field label="عدد أيام الدراسة">
              <select className="select" value={data.days} onChange={(e) => setField('days', Number(e.target.value))}>
                {[5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} أيام
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {tab === 'teachers' && (
          <div className="grid gap-2">
            <div className="flex justify-end">
              <button
                className="btn btn-sm"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    teachers: [
                      ...prev.teachers,
                      { id: uid('t'), name: 'معلم جديد', subject: prev.subjects[0]?.id ?? '', additionalSubjects: [], max: 24, off: [] },
                    ],
                  }))
                }
              >
                <Icon name="plus" size={15} /> إضافة معلم
              </button>
            </div>
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>الاسم</th>
                    <th>المادة</th>
                    <th>النصاب</th>
                    <th>أيام الراحة</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.teachers.map((teacher, index) => (
                    <tr key={teacher.id}>
                      <td>
                        <input
                          className="input py-1 text-[12.5px]"
                          value={teacher.name}
                          onChange={(e) =>
                            update((prev) => ({
                              ...prev,
                              teachers: prev.teachers.map((t, i) => (i === index ? { ...t, name: e.target.value } : t)),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="select py-1 text-[12.5px]"
                          value={teacher.subject}
                          onChange={(e) =>
                            update((prev) => ({
                              ...prev,
                              teachers: prev.teachers.map((t, i) => (i === index ? { ...t, subject: e.target.value } : t)),
                            }))
                          }
                        >
                          {data.subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                              {subject.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          className="input w-16 py-1 text-center text-[12.5px]"
                          type="number"
                          value={teacher.max}
                          onChange={(e) =>
                            update((prev) => ({
                              ...prev,
                              teachers: prev.teachers.map((t, i) => (i === index ? { ...t, max: Number(e.target.value) || 0 } : t)),
                            }))
                          }
                        />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {DAY_SHORT.slice(0, data.days).map((day, d) => {
                            const on = teacher.off.includes(d);
                            return (
                              <button
                                key={day}
                                className={`rounded-md border px-1.5 py-0.5 text-[10.5px] ${on ? 'border-red-300 bg-red-50 text-red-700' : 'border-[var(--line)] bg-white text-[var(--muted)]'}`}
                                onClick={() =>
                                  update((prev) => ({
                                    ...prev,
                                    teachers: prev.teachers.map((t, i) =>
                                      i === index
                                        ? { ...t, off: on ? t.off.filter((x) => x !== d) : [...t.off, d] }
                                        : t,
                                    ),
                                  }))
                                }
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() =>
                            update((prev) => ({
                              ...prev,
                              teachers: prev.teachers.filter((_, i) => i !== index),
                              assignments: prev.assignments.filter((a) => a.teacherId !== teacher.id),
                            }))
                          }
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'classes' && (
          <div className="grid gap-2">
            <div className="flex justify-end">
              <button
                className="btn btn-sm"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    classes: [...prev.classes, { id: uid('c'), name: 'فصل جديد', room: `قاعة ${prev.classes.length + 1}` }],
                  }))
                }
              >
                <Icon name="plus" size={15} /> إضافة فصل
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.classes.map((cls, index) => (
                <div key={cls.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-2">
                  <input
                    className="input py-1 text-[12.5px]"
                    value={cls.name}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        classes: prev.classes.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)),
                      }))
                    }
                  />
                  <input
                    className="input py-1 text-[12.5px]"
                    value={cls.room}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        classes: prev.classes.map((c, i) => (i === index ? { ...c, room: e.target.value } : c)),
                      }))
                    }
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        classes: prev.classes.filter((_, i) => i !== index),
                        assignments: prev.assignments.filter((a) => a.classId !== cls.id),
                      }))
                    }
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'subjects' && (
          <div className="grid gap-2">
            <div className="flex justify-end">
              <button
                className="btn btn-sm"
                onClick={() =>
                  update((prev) => ({
                    ...prev,
                    subjects: [...prev.subjects, { id: uid('s'), name: 'مادة جديدة', color: prev.subjects.length }],
                  }))
                }
              >
                <Icon name="plus" size={15} /> إضافة مادة
              </button>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {data.subjects.map((subject, index) => (
                <div key={subject.id} className="flex items-center gap-2 rounded-xl border border-[var(--line)] p-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: '#0f766e' }} />
                  <input
                    className="input py-1 text-[12.5px]"
                    value={subject.name}
                    onChange={(e) =>
                      update((prev) => ({
                        ...prev,
                        subjects: prev.subjects.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                      }))
                    }
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() =>
                      update((prev) => ({
                        ...prev,
                        subjects: prev.subjects.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title="النسخ الاحتياطي" subtitle="صدّر البيانات أو استوردها، أو أعد النسخة الأصلية">
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={exportJson}>
            <Icon name="download" size={15} /> تصدير JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="database" size={15} /> استيراد JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
          <button className="btn btn-danger" onClick={() => { reset(); toast('أُعيدت بيانات المدرسة الأصلية.', 'warn'); }}>
            استعادة النسخة الأصلية
          </button>
        </div>
        <p className="m-0 mt-3 text-[12px] leading-5 text-[var(--muted)]">
          يُحفظ كل تعديل تلقائيًا في هذا المتصفح. لرفع البيانات إلى الروابط المنشورة، صدّر ملف JSON وحدّث
          <code className="mx-1 rounded bg-[#f1f5f3] px-1 py-0.5">src/data/school.json</code>
          في المستودع.
        </p>
      </Card>
    </div>
  );
}
