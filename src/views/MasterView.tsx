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
  const [query, setQuery] = useState('');

  const count = mode === 'teacher' ? data.teachers.length : data.classes.length;

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
            <input
              className="input w-44"
              placeholder={mode === 'teacher' ? 'بحث باسم المعلم' : 'بحث باسم الفصل'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                print(
                  masterTitle(mode),
                  <MasterSheet data={data} mode={mode} query={query} />,
                  {
                    orientation: mode === 'teacher' ? 'portrait' : 'landscape',
                    size: 'A3',
                    compact: true,
                    edge: true,
                  },
                )
              }
            >
              <Icon name="printer" size={15} /> طباعة {mode === 'teacher' ? 'جدول المعلمين' : 'جدول الفصول'}
            </button>
          </>
        }
        padded={false}
      >
        <div className="p-3">
          <MasterTable data={data} mode={mode} query={query} />
          <p className="m-0 mt-2 text-[11px] text-[var(--muted)]">
            {mode === 'teacher'
              ? 'الصفوف معلمون، والأعمدة أيام الأسبوع وحصصها. الخلية تعرض المادة والفصل. للطباعة: A3 عرضي مضغوط.'
              : 'الصفوف فصول، والأعمدة أيام الأسبوع وحصصها. الخلية تعرض المادة والمعلم. للطباعة: A3 عرضي مضغوط.'}
          </p>
        </div>
      </Card>
    </div>
  );
}
