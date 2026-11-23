import { DAY_NAMES } from './model';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function sha256(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const HIJRI = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function hijri(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  return HIJRI.format(d);
}

export function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  const d = new Date(`${date}T12:00:00`);
  return d.getDay(); // الأحد = 0 … الخميس = 4
}

export function weekdayLabel(date: string): string {
  const w = weekdayOf(date);
  return w < DAY_NAMES.length ? DAY_NAMES[w] : 'الجمعة/السبت';
}

export function periodTimes(start: string, duration: number, periods: number): string[] {
  const [h, m] = start.split(':').map(Number);
  const base = h * 60 + (m || 0);
  return Array.from({ length: periods }, (_, i) => {
    const from = base + i * duration;
    const to = from + duration;
    const fmt = (mins: number) => {
      const hh = Math.floor(mins / 60) % 24;
      const mm = mins % 60;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };
    return `${fmt(from)}–${fmt(to)}`;
  });
}

export function download(filename: string, content: string, type = 'application/json'): void {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function numberAr(n: number): string {
  return n.toLocaleString('ar-EG');
}
