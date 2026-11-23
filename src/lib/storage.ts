import raw from '../data/school.json';
import type { SchoolData } from '../types';
import { normalizeData } from './model';

const KEY = 'jadwali:data:v1';

export const seedData: SchoolData = normalizeData({
  ...(raw as unknown as SchoolData),
  source: 'assignments-1448-term1-v1',
});

export function loadData(): SchoolData {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return seedData;
    const parsed = JSON.parse(stored) as SchoolData;
    return normalizeData(parsed);
  } catch {
    return seedData;
  }
}

export function saveData(data: SchoolData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* تجاهل امتلاء التخزين */
  }
}

export function clearData(): void {
  localStorage.removeItem(KEY);
}
