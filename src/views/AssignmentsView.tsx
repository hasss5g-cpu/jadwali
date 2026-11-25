import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { className, gradeOf, subjectName, teacherName } from '../lib/model';
import { upsertAssignments, type AssignInput } from '../lib/assign';
import { download, numberAr } from '../lib/utils';
import { Card, Field } from '../components/ui';
import { Icon } from '../components/Icon';
import { AssignmentsSheet } from '../components/PrintSheets';

type Mode = 'teacher' | 'subject';

const STAGES = [1, 2, 3] as const;
const STAGE_LABELS = ['الأول', 'الثاني', 'الثالث'];

export function AssignmentsView() {
  const { data, update, print, toast } = useStore();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>('teacher');

  // مسار «بحسب المعلم».
  const [teacherId, setTeacherId] = useState(data.teachers[0]?.id ?? '');
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id ?? '');
  const [picked, setPicked] = useState<string[]>([]);
  const [count, setCount] = useState(2);

  // مسار «بحسب المادة».
  const [subjectId2, setSubjectId2] = useState(data.subjects[0]?.id ?? '');
  const [stage, setStage] = useState<1 | 2 | 3>(1);
  const [classId2, setClassId2] = useState('');
  const [teacherId2, setTeacherId2] = useState(data.teachers[0]?.id ?? '');
  const [count2, setCount2] = useState(2);

  const teacher = data.teachers.find((item) => item.id === teacherId);
  const stageClasses = useMemo(
    () => data.classes.filter((cls) => gradeOf(cls.name) === stage),
    [data.classes, stage],
  );
  const selectedClassId = stageClasses.some((cls) => cls.id === classId2) ? classId2 : (stageClasses[0]?.id ?? '');

  const loadOf = (id: string) =>
    data.assignments.filter((assignment) => assignment.teacherId === id).reduce((total, assignment) => total + assignment.count, 0);

  const subjectTeachers = useMemo(
    () =>
      [...data.teachers].sort((a, b) => {
        const aSpecialist = a.subject === subjectId2 || a.additionalSubjects.includes(subjectId2);
        const bSpecialist = b.subject === subjectId2 || b.additionalSubjects.includes(subjectId2);
        if (aSpecialist !== bSpecialist) return aSpecialist ? -1 : 1;
        return a.name.localeCompare(b.name, 'ar');
      }),
    [data.teachers, subjectId2],
  );

  const apply = (inputs: AssignInput[], message: string) => {
    update((prev) => ({ ...prev, assignments: upsertAssignments(prev.assignments, inputs) }));
    toast(message, 'ok');
  };

  const teacherExisting = (classId: string) =>
    data.assignments.find((assignment) => assignment.classId === classId && assignment.subjectId === subjectId);

  const assignByTeacher = () => {
    if (!teacherId || !subjectId || picked.length === 0) {
      toast('اختر المعلم والمادة وفصلًا واحدًا على الأقل.', 'warn');
      return;
    }
    apply(
      picked.map((classId) => ({ classId, subjectId, teacherId, count })),
      `أُسند ${numberAr(picked.length)} فصلًا إلى ${teacherName(data, teacherId)} — ${subjectName(data, subjectId)}.`,
    );
    setPicked([]);
  };

  const assignBySubject = () => {
    if (!subjectId2 || !selectedClassId || !teacherId2) {
      toast('اختر المادة والمرحلة والصف والمعلم.', 'warn');
      return;
    }
    const existing = data.assignments.find(
      (assignment) => assignment.classId === selectedClassId && assignment.subjectId === subjectId2,
    );
    apply(
      [{ classId: selectedClassId, subjectId: subjectId2, teacherId: teacherId2, count: count2 }],
      existing
        ? `نُقل إسناد ${className(data, selectedClassId)} — ${subjectName(data, subjectId2)} إلى ${teacherName(data, teacherId2)}.`
        : `أُسند ${className(data, selectedClassId)} — ${subjectName(data, subjectId2)} إلى ${teacherName(data, teacherId2)}.`,
    );
  };

  const changeCount = (assignmentId: string, next: number) => {
    update((prev) => ({
      ...prev,
      assignments: prev.assignments.map((assignment) =>
        assignment.id === assignmentId ? { ...assignment, count: Math.max(0, next) } : assignment,
      ),
    }));
  };

  const removeAssignment = (assignmentId: string) => {
    update((prev) => ({
      ...prev,
      assignments: prev.assignments.filter((assignment) => assignment.id !== assignmentId),
      lessons: prev.lessons.filter((lesson) => lesson.assignmentId !== assignmentId),
    }));
    toast('حُذف الإسناد وحصصه.', 'ok');
  };

  const rows = useMemo(() => {
    const term = query.trim();
    return data.teachers
      .map((item) => {
        const own = data.assignments.filter((assignment) => assignment.teacherId === item.id);
        const quota = own.reduce((n, assignment) => n + assignment.count, 0);
        return { teacher: item, own, quota, overflow: Math.max(0, quota - item.max) };
      })
      .filter((row) => row.own.length)
      .filter((row) => !term || row.teacher.name.includes(term) || row.own.some((a) => className(data, a.classId).includes(term)))
      .sort((a, b) => b.overflow - a.overflow || a.teacher.name.localeCompare(b.teacher.name, 'ar'));
  }, [data, query]);

  const totalQuota = data.assignments.reduce((n, assignment) => n + assignment.count, 0);

  const exportCsv = () => {
    const lines = [['المعلم', 'النصاب', 'الحد', 'المادة', 'الفصل', 'الحصص']];
    for (const row of rows) {
      for (const assignment of row.own) {
        lines.push([
          row.teacher.name,
          String(row.quota),
          String(row.teacher.max),
          subjectName(data, assignment.subjectId),
          className(data, assignment.classId),
          String(assignment.count),
        ]);
      }
    }
    const csv = lines.map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download('الإسنادات.csv', `\ufeff${csv}`, 'text/csv');
  };

  const existingForSubject = data.assignments.find(
    (assignment) => assignment.classId === selectedClassId && assignment.subjectId === subjectId2,
  );

  return (
    <div className="grid gap-4">
      <Card
        title="إسناد الحصص"
        subtitle={`${numberAr(data.assignments.length)} إسنادًا · ${numberAr(totalQuota)} حصة · ${numberAr(rows.length)} معلمًا`}
        actions={
          <div className="tabs">
            <button className="tab" data-active={mode === 'teacher'} onClick={() => setMode('teacher')}>
              إسناد بحسب المعلم
            </button>
            <button className="tab" data-active={mode === 'subject'} onClick={() => setMode('subject')}>
              إسناد بحسب المادة
            </button>
          </div>
        }
      >
        {mode === 'teacher' ? (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="١) اختر المعلم" hint={`نصابه الحالي ${numberAr(loadOf(teacherId))} من ${numberAr(teacher?.max ?? 0)} حصة`}>
                <select className="select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                  {data.teachers.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="٢) اختر المادة" hint="المواد التي يتخصص فيها المعلم معلّمة بـ«تخصص».">
                <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                  {data.subjects.map((subject) => {
                    const specialist =
                      teacher && (teacher.subject === subject.id || teacher.additionalSubjects.includes(subject.id));
                    return (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                        {specialist ? ' — تخصص' : ''}
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="label m-0">٣) اختر الفصول</p>
                <div className="flex items-center gap-2 text-[11.5px] text-[var(--muted)]">
                  <button className="btn btn-ghost btn-sm" onClick={() => setPicked(data.classes.map((cls) => cls.id))}>
                    تحديد الكل
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setPicked([])}>
                    مسح
                  </button>
                  <span className="badge">محدد: {numberAr(picked.length)}</span>
                </div>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {[...data.classes]
                  .sort((a, b) => (gradeOf(a.name) ?? 0) - (gradeOf(b.name) ?? 0) || a.name.localeCompare(b.name, 'ar'))
                  .map((cls) => {
                    const active = picked.includes(cls.id);
                    const existing = teacherExisting(cls.id);
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() =>
                          setPicked((prev) => (active ? prev.filter((id) => id !== cls.id) : [...prev, cls.id]))
                        }
                        className={`rounded-xl border px-2 py-1.5 text-right text-[12px] transition ${
                          active
                            ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                            : 'border-[var(--line)] bg-white hover:border-[#b9dcd6]'
                        }`}
                      >
                        <span className="block truncate font-bold">{cls.name}</span>
                        <span className="block truncate text-[10.5px] text-[var(--muted)]">
                          {existing
                            ? `${teacherName(data, existing.teacherId)} — ${numberAr(existing.count)} حصة`
                            : 'غير مسند لهذه المادة'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-3">
              <Field label="عدد الحصص لكل فصل">
                <input
                  className="input w-24 text-center"
                  type="number"
                  min={1}
                  max={10}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <button className="btn btn-primary" onClick={assignByTeacher} disabled={!picked.length}>
                <Icon name="check" size={15} /> إسناد {numberAr(picked.length)} فصلًا
              </button>
              <p className="m-0 pb-2 text-[11.5px] text-[var(--muted)]">
                إن كان للفصل إسناد سابق في هذه المادة سيُنقل إلى هذا المعلم.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="١) اختر المادة">
                <select className="select" value={subjectId2} onChange={(e) => setSubjectId2(e.target.value)}>
                  {data.subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="٢) اختر المرحلة">
                <div className="flex gap-1">
                  {STAGES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`btn btn-sm flex-1 ${stage === value ? 'btn-primary' : ''}`}
                      onClick={() => setStage(value)}
                    >
                      {STAGE_LABELS[value - 1]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="٣) اختر الصف">
                <select className="select" value={selectedClassId} onChange={(e) => setClassId2(e.target.value)}>
                  {stageClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="٤) اختر المعلم" hint={existingForSubject ? `حاليًا: ${teacherName(data, existingForSubject.teacherId)}` : 'غير مسند بعد'}>
                <select className="select" value={teacherId2} onChange={(e) => setTeacherId2(e.target.value)}>
                  {subjectTeachers.map((item) => {
                    const specialist = item.subject === subjectId2 || item.additionalSubjects.includes(subjectId2);
                    return (
                      <option key={item.id} value={item.id}>
                        {item.name}
                        {specialist ? ' — تخصص' : ''} ({numberAr(loadOf(item.id))})
                      </option>
                    );
                  })}
                </select>
              </Field>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-[var(--line)] pt-3">
              <Field label="عدد الحصص">
                <input
                  className="input w-24 text-center"
                  type="number"
                  min={1}
                  max={10}
                  value={count2}
                  onChange={(e) => setCount2(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
              <button className="btn btn-primary" onClick={assignBySubject}>
                <Icon name="check" size={15} /> إسناد المادة للصف
              </button>
              <p className="m-0 pb-2 text-[11.5px] text-[var(--muted)]">
                {existingForSubject
                  ? `يوجد إسناد حالي لهذا الصف في المادة: ${teacherName(data, existingForSubject.teacherId)} (${numberAr(existingForSubject.count)} حصة) وسيُحدَّث.`
                  : 'سيُضاف إسناد جديد لهذا الصف.'}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="الإسنادات الحالية"
        subtitle={`${numberAr(data.assignments.length)} إسنادًا · ${numberAr(totalQuota)} حصة`}
        actions={
          <>
            <input className="input w-52" placeholder="بحث باسم المعلم أو الفصل" value={query} onChange={(e) => setQuery(e.target.value)} />
            <button className="btn btn-sm" onClick={exportCsv}>
              <Icon name="download" size={15} /> CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => print('بيان إسناد الحصص', <AssignmentsSheet data={data} />)}>
              <Icon name="printer" size={15} /> طباعة الإسنادات
            </button>
          </>
        }
        padded={false}
      >
        <div className="scroll-x max-h-[70vh] overflow-auto">
          <table className="table">
            <thead className="sticky top-0 z-10 bg-white">
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
                      {row.own.map((assignment) => (
                        <span
                          key={assignment.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-[11.5px]"
                        >
                          <span>
                            {subjectName(data, assignment.subjectId)} — {className(data, assignment.classId)}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={assignment.count}
                            onChange={(e) => changeCount(assignment.id, Number(e.target.value))}
                            className="w-11 rounded-md border border-[var(--line)] px-1 py-0.5 text-center text-[11.5px]"
                            aria-label="عدد الحصص"
                          />
                          <button
                            className="btn btn-ghost btn-sm px-1 text-[11px] text-[var(--danger)]"
                            title="حذف الإسناد"
                            onClick={() => removeAssignment(assignment.id)}
                          >
                            ×
                          </button>
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

      {rows.some((row) => row.overflow > 0) && (
        <Card title="تجاوزات النصاب" subtitle="إسنادات تفوق الحد الأقصى للمعلم">
          <div className="flex flex-wrap gap-2">
            {rows
              .filter((row) => row.overflow > 0)
              .map((row) => (
                <button
                  key={row.teacher.id}
                  className="badge badge-warn"
                  onClick={() => {
                    setQuery(row.teacher.name);
                    toast(`فلترنا على ${row.teacher.name} (+${row.overflow} حصة)`, 'warn');
                  }}
                >
                  {row.teacher.name} +{row.overflow}
                </button>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
