import type { ReactNode } from 'react';
import { useStore } from '../store';
import { cn } from '../lib/utils';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
          <div>
            {title && <h2 className="m-0 text-[15px] font-extrabold text-[var(--ink)]">{title}</h2>}
            {subtitle && <p className="m-0 mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'ok' | 'warn' | 'danger';
}) {
  const color =
    tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-700' : tone === 'danger' ? 'text-red-700' : 'text-[var(--ink)]';
  return (
    <div className="card p-4">
      <p className="m-0 text-xs font-bold text-[var(--muted)]">{label}</p>
      <p className={cn('kpi-value m-0 mt-1', color)}>{value}</p>
      {hint && <p className="m-0 mt-1 text-[11.5px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="option-row cursor-pointer" data-on={checked}>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[var(--brand)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-[13.5px] font-bold">{label}</span>
        {hint && <span className="block text-[11.5px] text-[var(--muted)]">{hint}</span>}
      </span>
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] bg-[#fafbfa] p-6 text-center">
      <p className="m-0 text-sm font-bold">{title}</p>
      {hint && <p className="m-0 mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function ToastHost() {
  const { toasts } = useStore();
  if (!toasts.length) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} data-tone={t.tone}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function PrintOverlay() {
  const { printDoc, closePrint } = useStore();
  if (!printDoc) return null;
  const { options } = printDoc;
  const landscape = options.orientation === 'landscape';
  const size = options.size ?? 'A4';
  const widthMm = size === 'A3' ? (landscape ? 420 : 297) : landscape ? 297 : 210;
  return (
    <div className="print-overlay" role="dialog" aria-label={printDoc.title}>
      <div
        className="print-toolbar sticky top-0 z-10 mx-auto mb-3 flex max-w-full items-center justify-between gap-2 rounded-xl bg-white/95 px-3 py-2 shadow"
        style={{ maxWidth: `${widthMm}mm` }}
      >
        <div>
          <strong className="text-sm">{printDoc.title}</strong>
          <span className="ms-2 text-[11px] text-[var(--muted)]">
            {size} · {landscape ? 'عرضي' : 'طولي'}
            {options.compact ? ' · مضغوط' : ''}
          </span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            طباعة / حفظ PDF
          </button>
          <button className="btn btn-sm" onClick={closePrint}>
            إغلاق
          </button>
        </div>
      </div>
      <div
        className="print-sheet"
        data-orientation={options.orientation ?? 'portrait'}
        data-size={size}
        data-compact={options.compact ? 'true' : 'false'}
        data-edge={options.edge ? 'true' : 'false'}
      >
        {printDoc.content}
      </div>
    </div>
  );
}
