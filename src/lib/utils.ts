import { DAY_NAMES } from './model';
import { formatTime12 } from './time';

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

const HIJRI_NUMERIC = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

export function hijri(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  return HIJRI.format(d);
}

/** تاريخ هجري رقمي: «20 / 12 / 1448 هـ». */
export function hijriNumeric(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
  const parts = HIJRI_NUMERIC.formatToParts(d);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')} / ${part('month')} / ${part('year')} هـ`;
}

/** إضافة أيام إلى تاريخ ISO (YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
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

/** أوقات الحصص بنظام 12 ساعة (بلا فسح) — للاستخدام العام. */
export function periodTimes(start: string, duration: number, periods: number): string[] {
  const [h, m] = start.split(':').map(Number);
  const base = h * 60 + (m || 0);
  return Array.from({ length: periods }, (_, i) => {
    const from = base + i * duration;
    const to = from + duration;
    return `${formatTime12(from)}–${formatTime12(to)}`;
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

