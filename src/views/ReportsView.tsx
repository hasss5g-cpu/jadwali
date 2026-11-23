import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { DAY_NAMES, className, teacherName, validate } from '../lib/model';
import { hijri, numberAr, today } from '../lib/utils';
import { Card, Field, Toggle } from '../components/ui';
import { Icon } from '../components/Icon';
import {
  AllClassesSheet,
  AllTeachersSheet,
  AssignmentsSheet,
  AuditSheet,
  ClassSheet,
  CoverageSheet,
  DailySheet,
  ExamsSheet,
  TeacherSheet,
  TeachersLoadSheet,
} from '../components/PrintSheets';

type Orientation = 'portrait' | 'landscape';
type PaperSize = 'A4' | 'A3';

interface ReportCardProps {
  title: string;
  description: string;
  icon: string;
  badge?: string;
  controls?: React.ReactNode;
  disabled?: boolean;
  onPrint: () => void;
}

function ReportCard({ title, description, icon, badge, controls, disabled, onPrint }: ReportCardProps) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-[var(--line)] bg-white p-3">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
              <Icon name={icon} size={17} />
            </span>
            <div>
              <p className="m-0 text-[13.5px] font-extrabold">{title}</p>
              <p className="m-0 mt-0.5 text-[11px] leading-4 text-[var(--muted)]">{description}</p>
            </div>
          </div>
          {badge && <span className="badge shrink-0">{badge}</span>}
        </div>
        {controls && <div className="mt-2 grid gap-2">{controls}</div>}
      </div>
      <button className="btn btn-primary btn-sm mt-3 w-full justify-center" disabled={disabled} onClick={onPrint}>
        <Icon name="printer" size={15} /> معاينة وطباعة
      </button>
    </div>
  );
}

export function ReportsView() {
  const { data, print } = useStore();
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [size, setSize] = useState<PaperSize>('A4');
  const [compact, setCompact] = useState(false);
  const [classId, setClassId] = useState(data.classes[0]?.id ?? '');
  const [teacherId, setTeacherId] = useState(data.teachers[0]?.id ?? '');
  const [day, setDay] = useState(0);
  const [examKind, setExamKind] = useState<'periodic' | 'official'>('periodic');

  const coverageDates = useMemo(() => {
    const dates = new Set<string>();
    for (const absence of data.absences) dates.add(absence.date);
    for (const cover of data.covers) dates.add(cover.date);
    return [...dates].sort((a, b) => b.localeCompare(a));
  }, [data.absences, data.covers]);
  const [coverDate, setCoverDate] = useState(coverageDates[0] ?? today());
  const coverRows = data.covers.filter((cover) => cover.date === coverDate);

  const violations = useMemo(() => validate(data), [data]);
  const options = { orientation, size, compact };
  const pad = (title: string, content: React.ReactNode) => print(title, content, options);

  return (
    <div className="grid gap-4">
      <Card
        title="التقارير والطباعة"
        subtitle="اختر التقرير ثم عدّل خيارات الورق قبل المعاينة. كل تقرير يُطبع مباشرة أو يُحفظ PDF."
        actions={
          <span className="badge">
            <Icon name="printer" size={13} /> {numberAr(10)} تقارير
          </span>
        }
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="اتجاه الورق">
            <select className="select" value={orientation} onChange={(e) => setOrientation(e.target.value as Orientation)}>
              <option value="portrait">طولي</option>
              <option value="landscape">عرضي</option>
            </select>
          </Field>
          <Field label="مقاس الورق">
            <select className="select" value={size} onChange={(e) => setSize(e.target.value as PaperSize)}>
              <option value="A4">A4</option>
              <option value="A3">A3</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Toggle
              label="طباعة مضغوطة"
              hint="تصغير الخط والحواشي لاستيعاب جدول أكبر في الصفحة."
              checked={compact}
              onChange={setCompact}
            />
          </div>
        </div>
        <p className="m-0 mt-3 rounded-xl bg-[#f4f8f6] p-3 text-[11.5px] leading-5 text-[var(--ink-600)]">
          الخيارات تُطبَّق على كل تقارير هذه الصفحة. «عرضي» مناسب لجداول الأسبوع الكاملة، و«A3» للجداول العريضة،
          و«مضغوط» لتقارير النصاب والتدقيق الطويلة.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          title="جدول فصل"
          description="جدول أسبوعي كامل لفصل واحد — أفقي افتراضيًا على A4."
          icon="calendar"
          controls={
            <Field label="الفصل">
              <select className="select" value={classId} onChange={(e) => setClassId(e.target.value)}>
                {data.classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </Field>
          }
          disabled={!classId}
          onPrint={() => pad(`جدول الفصل — ${className(data, classId)}`, <ClassSheet data={data} classId={classId} />)}
        />

        <ReportCard
          title="جدول معلم"
          description="حصص المعلم وتوزيعها على أيام الأسبوع."
          icon="users"
          controls={
            <Field label="المعلم">
              <select className="select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                {data.teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
            </Field>
          }
          disabled={!teacherId}
          onPrint={() =>
            pad(`جدول المعلم — ${teacherName(data, teacherId)}`, <TeacherSheet data={data} teacherId={teacherId} />)
          }
        />

        <ReportCard
          title="كل جداول الفصول"
          description={`مستند واحد يضم ${numberAr(data.classes.length)} فصلًا، كل فصل في صفحة.`}
          icon="calendar"
          badge={`${numberAr(data.classes.length)} صفحة`}
          onPrint={() => pad('كل جداول الفصول', <AllClassesSheet data={data} />)}
        />

        <ReportCard
          title="كل جداول المعلمين"
          description={`جداول ${numberAr(data.teachers.length)} معلمًا في مستند واحد — للطباعة المضغوطة.`}
          icon="users"
          badge={`${numberAr(data.teachers.length)} صفحة`}
          onPrint={() => pad('كل جداول المعلمين', <AllTeachersSheet data={data} />)}
        />

        <ReportCard
          title="الحصص اليومية"
          description="جدول ليوم واحد: كل الفصول × كل الحصص — مناسب للجولة اليومية."
          icon="dashboard"
          controls={
            <Field label="اليوم">
              <select className="select" value={day} onChange={(e) => setDay(Number(e.target.value))}>
                {DAY_NAMES.slice(0, data.days).map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
          }
          onPrint={() => pad(`الحصص اليومية — ${DAY_NAMES[day]}`, <DailySheet data={data} day={day} />)}
        />

        <ReportCard
          title="بيان الإسنادات"
          description="لكل معلم: المواد والفصول المسندة وعدد الحصص والنصاب."
          icon="clipboard"
          onPrint={() => pad('بيان إسناد الحصص', <AssignmentsSheet data={data} />)}
        />

        <ReportCard
          title="جدول الاختبارات"
          description="الفترية أو الرسمية، مرتبة حسب الفصول والأيام."
          icon="clipboard"
          controls={
            <Field label="نوع الاختبار">
              <select className="select" value={examKind} onChange={(e) => setExamKind(e.target.value as 'periodic' | 'official')}>
                <option value="periodic">الفترية</option>
                <option value="official">الرسمية</option>
              </select>
            </Field>
          }
          disabled={
            (examKind === 'periodic' ? data.exams.periodic : data.exams.official).length === 0
          }
          onPrint={() =>
            pad(examKind === 'periodic' ? 'جدول الاختبارات الفترية' : 'جدول الاختبارات الرسمية', <ExamsSheet data={data} kind={examKind} />)
          }
        />

        <ReportCard
          title="حصص الانتظار"
          description="بيان الغياب والبدلاء ليوم محدد — من الأيام المسجّلة."
          icon="shield"
          controls={
            <Field label="التاريخ">
              <select className="select" value={coverDate} onChange={(e) => setCoverDate(e.target.value)}>
                {coverageDates.length ? (
                  coverageDates.map((date) => (
                    <option key={date} value={date}>
                      {date} · {hijri(date)}
                    </option>
                  ))
                ) : (
                  <option value={today()}>لا يوجد غياب مسجّل</option>
                )}
              </select>
            </Field>
          }
          disabled={!coverRows.length}
          badge={`${numberAr(coverRows.length)} حصة`}
          onPrint={() =>
            pad(`حصص الانتظار — ${coverDate}`, <CoverageSheet data={data} date={coverDate} covers={coverRows} />)
          }
        />

        <ReportCard
          title="النصاب والتوزيع"
          description="حصص كل معلم ونصابه وفراغاته وتتابعه وتوازن الحصة السابعة."
          icon="users"
          onPrint={() => pad('تقرير النصاب والتوزيع', <TeachersLoadSheet data={data} />)}
        />

        <ReportCard
          title="التدقيق والجودة"
          description="المخالفات الصارمة، تجاوزات النصاب، وسعة الفصول والبدنية."
          icon={violations.length ? 'alert' : 'check'}
          badge={violations.length ? `${numberAr(violations.length)} مخالفة` : 'سليم'}
          onPrint={() => pad('تقرير التدقيق والجودة', <AuditSheet data={data} />)}
        />
      </div>
    </div>
  );
}
