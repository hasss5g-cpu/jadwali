import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { DAY_NAMES, className, subjectColor, subjectName, teacherName, validate } from '../lib/model';
import { download, periodTimes } from '../lib/utils';
import { Card, Empty } from '../components/ui';
import { Icon } from '../components/Icon';
import { ClassSheet, TeacherSheet } from '../components/PrintSheets';

export function ScheduleView() {
  const { data, print } = useStore();
  const [mode, setMode] = useState<'class' | 'teacher'>('class');
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '');
  const [teacherId, setTeacherId] = useState(data.teachers[0]?.id ?? '');

  const violations = useMemo(() => validate(data), [data]);
  const times = useMemo(() => periodTimes(data.start, data.duration, data.periods), [data.start, data.duration, data.periods]);

  const lessons = useMemo(
    () =>
      data.lessons.filter((lesson) => {
        const assignment = data.assignments.find((a) => a.id === lesson.assignmentId);
        if (!assignment) return false;
        return mode === 'class' ? assignment.classId === classId : assignment.teacherId === teacherId;
      }),
    [data, mode, classId, teacherId],
  );

  const cellAt = (day: number, period: number) => {
    const lesson = lessons.find((l) => l.day === day && l.period === period);
    if (!lesson) return null;
    return data.assignments.find((a) => a.id === lesson.assignmentId) ?? null;
  };

  const exportCsv = () => {
    const subject = mode === 'class' ? className(data, classId) : teacherName(data, teacherId);
    const rows = [['اليوم', 'الحصة', 'التوقيت', 'المادة', mode === 'class' ? 'المعلم' : 'الفصل']];
    for (let day = 0; day < data.days; day++) {
      for (let period = 0; period < data.periods; period++) {
        const assignment = cellAt(day, period);
        if (!assignment) continue;
        rows.push([
          DAY_NAMES[day],
          String(period + 1),
          times[period],
          subjectName(data, assignment.subjectId),
          mode === 'class' ? teacherName(data, assignment.teacherId) : className(data, assignment.classId),
        ]);
      }
    }
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    download(`جدول-${subject}.csv`, `\ufeff${csv}`, 'text/csv');
  };

  const printSheet = () => {
    if (mode === 'class') {
      print(`جدول الفصل — ${className(data, classId)}`, <ClassSheet data={data} classId={classId} />, {
        orientation: 'landscape',
      });
    } else {
      print(`جدول المعلم — ${teacherName(data, teacherId)}`, <TeacherSheet data={data} teacherId={teacherId} />);
    }
  };

  if (!data.classes.length) return <Empty title="لا توجد فصول بعد" hint="أضف الفصول من تبويب البيانات." />;

  return (
    <div className="grid gap-4">
      <Card
        title="الجدول الدراسي"
        subtitle={`${data.periods} حصص يوميًا · ${data.classes.length} فصلًا · ${data.lessons.length} حصة موزعة`}
        actions={
          <>
            <div className="tabs">
              <button className="tab" data-active={mode === 'class'} onClick={() => setMode('class')}>
                جدول الفصل
              </button>
              <button className="tab" data-active={mode === 'teacher'} onClick={() => setMode('teacher')}>
                جدول المعلم
              </button>
            </div>
            <button className="btn btn-sm" onClick={exportCsv}>
              <Icon name="download" size={15} /> تصدير CSV
            </button>
            <button className="btn btn-primary btn-sm" onClick={printSheet}>
              <Icon name="printer" size={15} /> طباعة
            </button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1">
            <span className="label">{mode === 'class' ? 'الفصل' : 'المعلم'}</span>
            {mode === 'class' ? (
              <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {data.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            ) : (
              <select className="select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                {data.teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            )}
          </label>
          <div className="flex items-center gap-2 pb-1">
            {violations.length === 0 ? (
              <span className="badge">
                <Icon name="check" size={13} /> دون تعارض
              </span>
            ) : (
              <span className="badge badge-danger">
                <Icon name="alert" size={13} /> {violations.length} مخالفة
              </span>
            )}
            <span className="badge">{lessons.length} حصة</span>
          </div>
        </div>

        <div className="scroll-x">
          <div
            className="schedule-grid"
            style={{ gridTemplateColumns: `88px repeat(${data.periods}, minmax(0, 1fr))` }}
          >
            <div className="schedule-corner">الحصة</div>
            {Array.from({ length: data.periods }, (_, period) => (
              <div key={period} className="schedule-period-head">
                <span className="text-[13px] font-extrabold">{period + 1}</span>
                <span className="text-[9.5px] text-[var(--muted)]">{times[period]}</span>
              </div>
            ))}
            {DAY_NAMES.slice(0, data.days).map((day, dayIndex) => (
              <div key={day} className="contents">
                <div className="schedule-day">{day}</div>
                {Array.from({ length: data.periods }, (_, period) => {
                  const assignment = cellAt(dayIndex, period);
                  if (!assignment) {
                    return <div key={period} className="schedule-cell" data-empty="true" />;
                  }
                  const color = subjectColor(data, assignment.subjectId);
                  return (
                    <div
                      key={period}
                      className="schedule-cell"
                      style={{ borderInlineStartColor: color, borderInlineStartWidth: 4 }}
                    >
                      <div className="lesson-subject" style={{ color }}>
                        {subjectName(data, assignment.subjectId)}
                      </div>
                      <div className="lesson-meta">
                        {mode === 'class' ? teacherName(data, assignment.teacherId) : className(data, assignment.classId)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {violations.length > 0 && (
        <Card title="مخالفات تحتاج مراجعة" subtitle="الجدول الحالي لا يحقق كل القيود الصارمة">
          <ul className="m-0 grid list-disc gap-1 ps-5 text-[13px] text-[var(--danger)]">
            {violations.slice(0, 12).map((violation, index) => (
              <li key={index}>{violation.message}</li>
            ))}
          </ul>
          {violations.length > 12 && (
            <p className="m-0 mt-2 text-xs text-[var(--muted)]">و{violations.length - 12} مخالفة أخرى…</p>
          )}
        </Card>
      )}
    </div>
  );
}
