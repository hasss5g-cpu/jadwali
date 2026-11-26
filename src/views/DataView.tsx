import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import type { SchoolData, Season } from '../types';
import { DAY_SHORT, DEFAULT_BREAKS, DEFAULT_GRADE_BREAK, gradeOf, seasonStart } from '../lib/model';
import { download, numberAr, sha256, uid } from '../lib/utils';
import { Card, Field } from '../components/ui';
import { Icon } from '../components/Icon';
import { normalizeData } from '../lib/model';
import { AssignmentsView } from './AssignmentsView';

export type SettingsTab = 'general' | 'teachers' | 'classes' | 'subjects' | 'assignments';
type Tab = SettingsTab;

export function DataView({ initialTab }: { initialTab?: SettingsTab }) {
  const { data, update, replace, reset, toast } = useStore();
  const [tab, setTab] = useState<Tab>(initialTab ?? 'general');

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const [idInputs, setIdInputs] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const setField = <K extends keyof SchoolData>(key: K, value: SchoolData[K]) =>
    update((prev) => ({ ...prev, [key]: value }));

  const applySubjectPlan = () => {
    const plannedOf = (subjectId: string, classId: string) => {
      const subject = data.subjects.find((item) => item.id === subjectId);
      const cls = data.classes.find((item) => item.id === classId);
      const grade = cls ? gradeOf(cls.name) : null;
      return grade ? subject?.stages?.[grade] : undefined;
    };
    const changed = data.assignments.filter((assignment) => {
      const planned = plannedOf(assignment.subjectId, assignment.classId);
      return planned !== undefined && planned > 0 && planned !== assignment.count;
    }).length;
    update((prev) => ({
      ...prev,
      assignments: prev.assignments.map((assignment) => {
        const planned = plannedOf(assignment.subjectId, assignment.classId);
        return planned !== undefined && planned > 0 ? { ...assignment, count: planned } : assignment;
      }),
    }));
    toast(
      changed ? `حُدّثت ${numberAr(changed)} إسنادًا حسب خطة المرحلة — أعد توليد الجدول.` : 'كل الإسنادات مطابقة للخطة.',
      'ok',
    );
  };

  /** يفعّل استعلام المعلم بسجله المدني (أو أي رمز) ويحفظ بصمة SHA-256 فقط. */
  const activateCode = async (teacherId: string) => {
    const value = (idInputs[teacherId] ?? '').trim();
    if (value.length < 4) {
      toast('أدخل السجل المدني (٤ أرقام على الأقل).', 'warn');
      return;
    }
    const codeHash = await sha256(value);
    update((prev) => ({
      ...prev,
      teachers: prev.teachers.map((t) => (t.id === teacherId ? { ...t, codeHash } : t)),
    }));
    setIdInputs((prev) => ({ ...prev, [teacherId]: '' }));
    toast('فُعّل استعلام المعلم — حُفظت البصمة فقط.', 'ok');
  };

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
        title="إعدادات المدرسة"
        subtitle={`${numberAr(data.classes.length)} فصلًا · ${numberAr(data.teachers.length)} معلمًا · ${numberAr(data.subjects.length)} مادة · ${numberAr(data.assignments.length)} إسنادًا`}
        actions={
          <div className="tabs">
            {(
              [
                ['general', 'عام'],
                ['teachers', 'المعلمون'],
                ['classes', 'الفصول'],
                ['subjects', 'المواد'],
                ['assignments', 'الإسنادات'],
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
            <Field label="الدوام">
              <select
                className="select"
                value={data.season ?? 'summer'}
                onChange={(e) => {
                  const season = e.target.value as Season;
                  update((prev) => ({ ...prev, season, start: seasonStart(season) }));
                }}
              >
                <option value="summer">صيفي — يبدأ ٧:٠٠</option>
                <option value="winter">شتوي — يبدأ ٧:٣٠</option>
              </select>
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
            <Field label="مدة الفسحة الأولى (بعد الحصة الثانية)">
              <input
                className="input"
                type="number"
                min={5}
                max={60}
                value={data.breaks?.first ?? 25}
                onChange={(e) =>
                  update((prev) => ({
                    ...prev,
                    breaks: { ...(prev.breaks ?? DEFAULT_BREAKS), first: Number(e.target.value) || 25 },
                  }))
                }
              />
            </Field>
            <Field label="مدة الفسحة الثانية (بعد الحصة الثالثة)">
              <input
                className="input"
                type="number"
                min={5}
                max={60}
                value={data.breaks?.second ?? 25}
                onChange={(e) =>
                  update((prev) => ({
                    ...prev,
                    breaks: { ...(prev.breaks ?? DEFAULT_BREAKS), second: Number(e.target.value) || 25 },
                  }))
                }
              />
            </Field>
            {([1, 2, 3] as const).map((grade) => (
              <Field key={grade} label={`الصف ${['الأول', 'الثاني', 'الثالث'][grade - 1]} — تبدأ الفسحة بعد`}>
                <select
                  className="select"
                  value={data.gradeBreak?.[grade] ?? DEFAULT_GRADE_BREAK[grade]}
                  onChange={(e) =>
                    update((prev) => ({
                      ...prev,
                      gradeBreak: {
                        ...(prev.gradeBreak ?? DEFAULT_GRADE_BREAK),
                        [grade]: Number(e.target.value) === 2 ? 2 : 3,
                      },
                    }))
                  }
                >
                  <option value={2}>بعد الثانية</option>
                  <option value={3}>بعد الثالثة</option>
                </select>
              </Field>
            ))}
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
                    <th>الانتظار</th>
                    <th>رمز الاستعلام</th>
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
                          className={`badge ${teacher.exemptCoverage ? 'bg-[#fee2e2] text-red-700' : 'bg-emerald-50 text-emerald-700'}`}
                          title="معفى من الانتظار: لا يظهر كبديل في توزيع الانتظار"
                          onClick={() =>
                            update((prev) => ({
                              ...prev,
                              teachers: prev.teachers.map((t, i) =>
                                i === index ? { ...t, exemptCoverage: !t.exemptCoverage } : t,
                              ),
                            }))
                          }
                        >
                          {teacher.exemptCoverage ? 'معفى' : 'متاح'}
                        </button>
                      </td>
                      <td>
                        {teacher.codeHash ? (
                          <div className="flex items-center gap-1">
                            <span className="badge">مفعّل</span>
                            <button
                              className="btn btn-ghost btn-sm px-1 text-[11px]"
                              onClick={() =>
                                update((prev) => ({
                                  ...prev,
                                  teachers: prev.teachers.map((t, i) =>
                                    i === index ? { ...t, codeHash: undefined } : t,
                                  ),
                                }))
                              }
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <input
                              className="input w-28 py-1 text-center text-[11px]"
                              placeholder="السجل المدني"
                              inputMode="numeric"
                              value={idInputs[teacher.id] ?? ''}
                              onChange={(e) => setIdInputs((prev) => ({ ...prev, [teacher.id]: e.target.value }))}
                            />
                            <button className="btn btn-sm" onClick={() => void activateCode(teacher.id)}>
                              تفعيل
                            </button>
                          </div>
                        )}
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
                  <div className="flex flex-1 items-center gap-2">
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
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'assignments' && <AssignmentsView />}

        {tab === 'subjects' && (
          <div className="grid gap-2">
            <p className="m-0 text-[12px] text-[var(--muted)]">
              عدد الحصص الأسبوعية لكل مادة بحسب المرحلة — تُستخدم خطةً افتراضية عند الإسناد.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="btn btn-sm" onClick={applySubjectPlan}>
                تطبيق الخطة على الإسنادات
              </button>
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
            <div className="scroll-x">
              <table className="table">
                <thead>
                  <tr>
                    <th>المادة</th>
                    <th>الأول</th>
                    <th>الثاني</th>
                    <th>الثالث</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.subjects.map((subject, index) => (
                    <tr key={subject.id}>
                      <td>
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
                      </td>
                      {([1, 2, 3] as const).map((grade) => (
                        <td key={grade}>
                          <input
                            className="input w-20 py-1 text-center text-[12.5px]"
                            type="number"
                            min={0}
                            max={12}
                            aria-label={`حصص ${subject.name} للصف ${grade}`}
                            value={subject.stages?.[grade] ?? 0}
                            onChange={(e) =>
                              update((prev) => ({
                                ...prev,
                                subjects: prev.subjects.map((s, i) =>
                                  i === index
                                    ? {
                                        ...s,
                                        stages: {
                                          ...(s.stages ?? { 1: 0, 2: 0, 3: 0 }),
                                          [grade]: Math.max(0, Number(e.target.value) || 0),
                                        },
                                      }
                                    : s,
                                ),
                              }))
                            }
                          />
                        </td>
                      ))}
                      <td>
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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




