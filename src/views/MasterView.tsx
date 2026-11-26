import { useState } from 'react';
import { useStore } from '../store';
import { MasterTable, masterTitle, type MasterMode } from '../components/MasterTable';
import { MasterSheet } from '../components/PrintSheets';
import { Card } from '../components/ui';
import { Icon } from '../components/Icon';
import { numberAr } from '../lib/utils';

export function MasterView() {
  const { data, print } = useStore();
  const [mode, setMode] = useState<MasterMode>('teacher');

  const count = mode === 'teacher' ? data.teachers.length : data.classes.length;

  const printSheet = (target: MasterMode) =>
    print(masterTitle(target), <MasterSheet data={data} mode={target} />, {
      orientation: target === 'teacher' ? 'portrait' : 'landscape',
      size: 'A3',
      compact: true,
      edge: true,
    });

  return (
    <div className="grid gap-4">
      <Card
        title="الجدول العام"
        subtitle={`${mode === 'teacher' ? 'كل المعلمين' : 'كل الفصول'} في جدول واحد · ${numberAr(count)} ${mode === 'teacher' ? 'معلمًا' : 'فصلًا'} · ${numberAr(data.lessons.length)} حصة`}
        actions={
          <>
            <div className="tabs">
              <button className="tab" data-active={mode === 'teacher'} onClick={() => setMode('teacher')}>
                ترتيب المعلمين
              </button>
              <button className="tab" data-active={mode === 'class'} onClick={() => setMode('class')}>
                ترتيب الفصول
              </button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => printSheet('teacher')}>
              <Icon name="printer" size={15} /> طباعة جدول المعلمين
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => printSheet('class')}>
              <Icon name="printer" size={15} /> طباعة جدول الفصول
            </button>
          </>
        }
        padded={false}
      >
        <div className="p-3">
          <MasterTable data={data} mode={mode} />
          <p className="m-0 mt-2 text-[11px] text-[var(--muted)]">
            {mode === 'teacher'
              ? 'الصفوف معلمون، والأعمدة أيام الأسبوع وحصصها. الخلية تعرض المادة والفصل. للطباعة: A3 طولي مضغوط.'
              : 'الصفوف فصول، والأعمدة أيام الأسبوع وحصصها. الخلية تعرض المادة والمعلم. للطباعة: A3 عرضي مضغوط.'}
          </p>
        </div>
      </Card>
    </div>
  );
}
