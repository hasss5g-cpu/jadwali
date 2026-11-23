import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './store';
import { Icon } from './components/Icon';
import { PrintOverlay, ToastHost } from './components/ui';
import { Dashboard } from './views/Dashboard';
import { ScheduleView } from './views/ScheduleView';
import { GenerateView } from './views/GenerateView';
import { AssignmentsView } from './views/AssignmentsView';
import { CoverageView } from './views/CoverageView';
import { ExamsView } from './views/ExamsView';
import { ReportsView } from './views/ReportsView';
import { DataView } from './views/DataView';
import { ShareView } from './views/ShareView';
import { PublicApp } from './views/PublicApp';

const TABS = [
  { id: 'dashboard', label: 'نظرة عامة', icon: 'dashboard' },
  { id: 'schedule', label: 'الجدول', icon: 'calendar' },
  { id: 'generate', label: 'التوليد', icon: 'sparkles' },
  { id: 'assignments', label: 'الإسنادات', icon: 'users' },
  { id: 'coverage', label: 'الانتظار', icon: 'shield' },
  { id: 'exams', label: 'الاختبارات', icon: 'clipboard' },
  { id: 'reports', label: 'التقارير', icon: 'printer' },
  { id: 'data', label: 'البيانات', icon: 'database' },
  { id: 'share', label: 'المشاركة', icon: 'share' },
];

function Admin() {
  const { data, canUndo, canRedo, undo, redo } = useStore();
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="app">
      <header className="sticky top-0 z-40 -mx-4 mb-4 border-b border-[var(--line)] bg-[#f7f8f6]/85 px-4 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--brand)] text-white shadow-sm">
              <Icon name="calendar" size={20} />
            </span>
            <div>
              <p className="m-0 text-[15px] font-extrabold leading-tight">جدولي</p>
              <p className="m-0 text-[11px] text-[var(--muted)]">
                {data.school} · {data.term}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="btn btn-sm" onClick={undo} disabled={!canUndo} title="تراجع">
              <Icon name="undo" size={15} /> تراجع
            </button>
            <button className="btn btn-sm" onClick={redo} disabled={!canRedo} title="إعادة">
              <Icon name="redo" size={15} /> إعادة
            </button>
            <span className="badge">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> حفظ تلقائي
            </span>
          </div>
        </div>

        <nav className="scroll-x mt-2 flex gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[12.5px] font-bold transition ${
                tab === item.id ? 'bg-white text-[var(--brand)] shadow-sm' : 'text-[var(--muted)] hover:bg-white/60'
              }`}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'schedule' && <ScheduleView />}
        {tab === 'generate' && <GenerateView />}
        {tab === 'assignments' && <AssignmentsView />}
        {tab === 'coverage' && <CoverageView />}
        {tab === 'exams' && <ExamsView />}
        {tab === 'reports' && <ReportsView />}
        {tab === 'data' && <DataView />}
        {tab === 'share' && <ShareView />}
      </main>

      <footer className="mt-8 text-center text-[11px] leading-5 text-[var(--muted)]">
        جدولي — نسخة ثابتة تعمل دون سيرفر · تُحفظ البيانات في هذا المتصفح ·{' '}
        <a className="font-bold text-[var(--brand)]" href="#/classes">
          عرض الفصول
        </a>
      </footer>
    </div>
  );
}

function Root() {
  const [route, setRoute] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const isPublic = /^#\/(classes|class\/|lookup)/.test(route);

  return (
    <StoreProvider>
      {isPublic ? (
        <PublicApp />
      ) : (
        <>
          <Admin />
          <PrintOverlay />
          <ToastHost />
        </>
      )}
    </StoreProvider>
  );
}

export default Root;
