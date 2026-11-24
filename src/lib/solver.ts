import {
  DEFAULT_OPTIONS,
  type GenerationOptions,
  type Lesson,
  type SolveReport,
  type SolveResult,
  type SchoolData,
  type TeacherReport,
} from '../types';
import { gradeOf, isArt, isPE } from './model';

/**
 * محرك التوزيع: يبني جدولاً كاملاً ثم يحسّنه بالتلدين المحاكى عبر تبديلات داخل الفصل،
 * فيبقى كل فصل بلا تعارض ذاتي بطبيعة الحال، وينحصر البحث في تعارضات المعلمين والقيود الناعمة.
 *
 * قيود صارمة: تعارض المعلم، يوم الراحة، سقف فصلين للبدنية.
 * قيود جودة: سقف الحصص المتتالية، الفراغات، تكرار المادة في اليوم، تجاور الفنية،
 * توزيع الأيام، توازن الحصة السابعة، انتهاء اليوم مبكرًا، تراصّ الحصص.
 */

const HARD = 1000;

interface Task {
  id: string;
  assignmentId: string;
  cls: number;
  teacher: number;
  subject: number;
  pe: boolean;
  art: boolean;
  day: number;
  period: number;
}

export interface SolveOptions {
  seed?: number;
  budgetMs?: number;
  onProgress?: (fraction: number, message: string) => void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emptyReport(seed: number, ms: number, total = 0): SolveReport {
  return {
    total,
    placed: 0,
    conflicts: 0,
    artPairs: 0,
    artPairsIntact: 0,
    dailyRepeats: 0,
    holes: 0,
    longRuns: 0,
    seventh: 0,
    missingDays: 0,
    score: 0,
    seed,
    ms,
    iterations: 0,
    teachers: [],
    notes: [],
  };
}

export function solve(
  data: SchoolData,
  rawOptions: GenerationOptions = DEFAULT_OPTIONS,
  opts: SolveOptions = {},
): SolveResult {
  const started = Date.now();
  const options = { ...DEFAULT_OPTIONS, ...rawOptions };
  const seed = opts.seed ?? 1448;
  const budget = Math.max(400, opts.budgetMs ?? 6000);
  const rand = mulberry32(seed);
  const notes: string[] = [];

  const P = data.periods || 7;
  const D = data.days || 5;
  const S = P * D;
  const nClasses = data.classes.length;
  const nTeachers = data.teachers.length;

  const teacherIdx = new Map(data.teachers.map((t, i) => [t.id, i]));
  const classIdx = new Map(data.classes.map((c, i) => [c.id, i]));
  const subjectIdx = new Map(data.subjects.map((s, i) => [s.id, i]));
  const peSet = new Set(data.subjects.filter((s) => isPE(s.name)).map((s) => s.id));
  const artSet = new Set(data.subjects.filter((s) => isArt(s.name)).map((s) => s.id));

  // ── الجدوى ───────────────────────────────────────────────────────────────
  const demandByClass = new Map<string, number>();
  const demandByTeacher = new Map<string, number>();
  for (const a of data.assignments) {
    demandByClass.set(a.classId, (demandByClass.get(a.classId) ?? 0) + a.count);
    demandByTeacher.set(a.teacherId, (demandByTeacher.get(a.teacherId) ?? 0) + a.count);
  }
  for (const c of data.classes) {
    const demand = demandByClass.get(c.id) ?? 0;
    if (demand > S) {
      return {
        ok: false,
        lessons: data.lessons,
        report: emptyReport(seed, Date.now() - started, demand),
        error: `إسنادات ${c.name} تتجاوز سعة الأسبوع: ${demand} حصة من ${S} موعداً.`,
      };
    }
  }

  const demandOfTeacher = data.teachers.map((t) => demandByTeacher.get(t.id) ?? 0);
  data.teachers.forEach((t, i) => {
    const demand = demandOfTeacher[i];
    if (demand > t.max) {
      notes.push(
        options.relaxLoad
          ? `${t.name}: النصاب ${t.max} والإسنادات ${demand} — رُفع الحد تلقائيًا.`
          : `${t.name}: الإسنادات ${demand} تتجاوز النصاب ${t.max}.`,
      );
    }
    const freeDays = D - t.off.length;
    if (demand > freeDays * P) {
      notes.push(`${t.name}: ${demand} حصة لا تتسع لها أيام العمل (${freeDays * P} موعداً) — قد تبقى مخالفة يوم الراحة.`);
    }
  });

  // ── بناء المهام ──────────────────────────────────────────────────────────
  const tasks: Task[] = [];
  const byClassTasks: Task[][] = Array.from({ length: nClasses }, () => []);
  const byTeacherTasks: Task[][] = Array.from({ length: nTeachers }, () => []);
  const artPairsByAssignment = new Map<string, Task[]>();

  for (const a of data.assignments) {
    const ti = teacherIdx.get(a.teacherId);
    const ci = classIdx.get(a.classId);
    const si = subjectIdx.get(a.subjectId);
    if (ti === undefined || ci === undefined || si === undefined) {
      notes.push(`إسناد غير صالح أُهمل: ${a.id}`);
      continue;
    }
    const group: Task[] = [];
    for (let i = 0; i < a.count; i++) {
      const t: Task = {
        id: `${a.id}#${i}`,
        assignmentId: a.id,
        cls: ci,
        teacher: ti,
        subject: si,
        pe: peSet.has(a.subjectId),
        art: artSet.has(a.subjectId),
        day: -1,
        period: -1,
      };
      tasks.push(t);
      byClassTasks[ci].push(t);
      byTeacherTasks[ti].push(t);
      group.push(t);
    }
    if (group.length === 2 && artSet.has(a.subjectId) && options.artPairs) {
      artPairsByAssignment.set(a.id, group);
    }
  }

  // ── عدّادات القيود الصارمة ───────────────────────────────────────────────
  const teacherSlotCount = new Int16Array(nTeachers * S);
  const peSlotCount = new Int16Array(S);
  const peThird = new Int16Array(S);
  const peOther = new Int16Array(S);
  const classGrade = data.classes.map((cls) => gradeOf(cls.name));
  const peCapacity = Math.max(2, options.peCapacity ?? 3);
  const peSeparate = options.peSeparateGrade3 ?? true;
  let dup = 0;
  let peOver = 0;
  let peMix = 0;
  let peLast = 0;
  let offDay = 0;

  const place = (t: Task, day: number, period: number) => {
    const slot = day * P + period;
    const key = t.teacher * S + slot;
    const before = teacherSlotCount[key];
    teacherSlotCount[key] = before + 1;
    if (before === 1) dup++;
    if (t.pe) {
      const mixedBefore = peSlotCount[slot] >= 3 && peThird[slot] > 0;
      const n = peSlotCount[slot];
      peSlotCount[slot] = n + 1;
      if (n + 1 > peCapacity) peOver++;
      if (peSeparate) {
        if (classGrade[t.cls] === 3) peThird[slot]++;
        else peOther[slot]++;
      }
      const mixedAfter = peSlotCount[slot] >= 3 && peThird[slot] > 0;
      if (peSeparate && mixedAfter !== mixedBefore) peMix += mixedAfter ? 1 : -1;
    }
    if (t.pe && period === P - 1) peLast++;
    if (data.teachers[t.teacher].off.includes(day)) offDay++;
    t.day = day;
    t.period = period;
  };

  const lift = (t: Task) => {
    const slot = t.day * P + t.period;
    const key = t.teacher * S + slot;
    const before = teacherSlotCount[key];
    teacherSlotCount[key] = before - 1;
    if (before === 2) dup--;
    if (t.pe) {
      const mixedBefore = peSlotCount[slot] >= 3 && peThird[slot] > 0;
      const n = peSlotCount[slot];
      peSlotCount[slot] = n - 1;
      if (n > peCapacity) peOver--;
      if (peSeparate) {
        if (classGrade[t.cls] === 3) peThird[slot]--;
        else peOther[slot]--;
      }
      const mixedAfter = peSlotCount[slot] >= 3 && peThird[slot] > 0;
      if (peSeparate && mixedAfter !== mixedBefore) peMix += mixedAfter ? 1 : -1;
    }
    if (t.pe && t.period === P - 1) peLast--;
    if (data.teachers[t.teacher].off.includes(t.day)) offDay--;
    t.day = -1;
    t.period = -1;
  };

  const occupied: boolean[][] = Array.from({ length: nClasses }, () => new Array(S).fill(false));
  const mark = (t: Task) => {
    occupied[t.cls][t.day * P + t.period] = true;
  };

  // ── الحل الأولي ──────────────────────────────────────────────────────────
  // 1) حصتا الفنية متجاورتان.
  for (const pair of artPairsByAssignment.values()) {
    const [a, b] = pair;
    const free = occupied[a.cls];
    const candidates: number[] = [];
    for (let day = 0; day < D; day++) {
      if (data.teachers[a.teacher].off.includes(day)) continue;
      for (let period = 0; period < P - 1; period++) {
        if (!free[day * P + period] && !free[day * P + period + 1]) candidates.push(day * P + period);
      }
    }
    if (!candidates.length) continue;
    const slot = candidates[Math.floor(rand() * candidates.length)];
    place(a, Math.floor(slot / P), slot % P);
    place(b, Math.floor(slot / P), (slot % P) + 1);
    mark(a);
    mark(b);
  }

  // 2) الباقي جشعًا: البدنية أولاً ثم الأكثر حملًا، مع اختيار الموعد الأقل تكلفة.
  const rest = tasks
    .filter((t) => t.day === -1)
    .sort((a, b) => Number(b.pe) - Number(a.pe) || demandOfTeacher[b.teacher] - demandOfTeacher[a.teacher]);
  for (const t of rest) {
    const free = occupied[t.cls];
    const offDays = data.teachers[t.teacher].off;
    let best = -1;
    let bestCost = Infinity;
    for (let slot = 0; slot < S; slot++) {
      if (free[slot]) continue;
      const day = Math.floor(slot / P);
      const period = slot % P;
      if (offDays.includes(day)) continue;
      // قيد ثابت: حصص البدنية لا تكون في الحصة الأخيرة.
      if (t.pe && period === P - 1) continue;
      let cost = teacherSlotCount[t.teacher * S + slot] * HARD;
      if (t.pe) {
        cost += Math.max(0, peSlotCount[slot] - (peCapacity - 1)) * HARD;
        if (peSeparate) {
          const afterCount = peSlotCount[slot] + 1;
          const afterThird = peThird[slot] + (classGrade[t.cls] === 3 ? 1 : 0);
          if (afterCount >= 3 && afterThird > 0) cost += HARD;
        }
      }
      const period2 = slot % P;
      if (options.spread) cost += Math.abs(period2 - 3) * 0.1;
      cost += rand() * 3;
      if (cost < bestCost) {
        bestCost = cost;
        best = slot;
      }
    }
    if (best < 0) {
      for (let slot = 0; slot < S && best < 0; slot++) if (!free[slot]) best = slot;
    }
    if (best < 0) continue;
    place(t, Math.floor(best / P), best % P);
    mark(t);
  }

  // ── التكلفة الناعمة ──────────────────────────────────────────────────────
  const W = {
    run: options.maxRun > 0 ? 20 : 0,
    hole: 7,
    repeat: 25,
    art: options.artPairs ? 120 : 0,
    spread: options.spread && !options.compact ? 1.2 : 0,
    compact: options.compact ? 4 : 0,
    seventh: options.balanceSeventh ? 0.5 : 0,
    golden: options.goldenDay ? 2.5 : 0,
    // يوم خالٍ لمعلم = مخالفة شبه صارمة (أقل من تعارض المعلم، وأعلى من كل قيود الجودة).
    allDays: options.allDays ? 260 : 0,
  };

  // لا يمكن أن يعمل كل الأيام من حصصه أقل من عدد الأيام أصلًا.
  const allDaysEligible = data.teachers.map((_, index) => demandOfTeacher[index] >= D);

  const classCost = (ci: number): number => {
    const list = byClassTasks[ci];
    let cost = 0;
    const repeats = new Map<number, number>();
    for (const t of list) {
      if (t.art && options.artPairs) continue;
      const key = t.day * 64 + t.subject;
      const n = (repeats.get(key) ?? 0) + 1;
      repeats.set(key, n);
      if (n > 1) cost += W.repeat;
    }
    if (W.art) {
      for (const pair of artPairsByAssignment.values()) {
        if (pair[0].cls !== ci) continue;
        const a = pair[0];
        const b = pair[1];
        if (!(a.day === b.day && Math.abs(a.period - b.period) === 1)) cost += W.art;
      }
    }
    if (W.compact) {
      for (let day = 0; day < D; day++) {
        let min = P;
        let max = -1;
        let count = 0;
        for (const t of list) {
          if (t.day !== day) continue;
          count++;
          if (t.period < min) min = t.period;
          if (t.period > max) max = t.period;
        }
        if (count > 1) cost += (max - min + 1 - count) * W.compact;
      }
    }
    return cost;
  };

  const teacherCost = (ti: number): number => {
    const own = byTeacherTasks[ti];
    if (!own.length) return 0;
    let cost = 0;
    for (let day = 0; day < D; day++) {
      const periods: number[] = [];
      for (const t of own) if (t.day === day) periods.push(t.period);
      if (!periods.length) {
        if (W.allDays && allDaysEligible[ti]) cost += W.allDays;
        continue;
      }
      periods.sort((a, b) => a - b);
      if (W.spread) cost += periods.length * periods.length * W.spread;
      cost += (periods[periods.length - 1] - periods[0] + 1 - periods.length) * W.hole;
      if (W.run && options.maxRun > 0) {
        let run = 1;
        for (let i = 1; i < periods.length; i++) {
          if (periods[i] === periods[i - 1] + 1) run++;
          else {
            if (run > options.maxRun) cost += (run - options.maxRun) * W.run;
            run = 1;
          }
        }
        if (run > options.maxRun) cost += (run - options.maxRun) * W.run;
      }
      if (W.golden && periods[periods.length - 1] <= 2 && periods.length <= 3) cost -= W.golden;
      if (W.seventh) {
        const seventh = periods.filter((p) => p === P - 1).length;
        cost += seventh * seventh * W.seventh;
      }
    }
    return cost;
  };

  let hardScore = 0;
  for (let ti = 0; ti < nTeachers; ti++) hardScore += teacherCost(ti);
  for (let ci = 0; ci < nClasses; ci++) hardScore += classCost(ci);
  let current = hardScore + (dup + peOver + peMix + peLast + offDay) * HARD;
  let bestCost = current;
  let bestSnapshot: [number, number][] = tasks.map((t) => [t.day, t.period]);

  // ── التلدين المحاكى ──────────────────────────────────────────────────────
  const deadline = started + budget;
  const T0 = 55;
  const T1 = 0.3;
  let iterations = 0;
  let lastProgress = 0;
  let temperature = T0;

  while (Date.now() < deadline) {
    for (let batch = 0; batch < 256; batch++) {
      iterations++;
      const ci = (rand() * nClasses) | 0;
      const list = byClassTasks[ci];
      if (list.length < 2) continue;
      const ia = (rand() * list.length) | 0;
      let ib = (rand() * list.length) | 0;
      if (ia === ib) ib = (ib + 1) % list.length;
      const a = list[ia];
      const b = list[ib];
      if (a.day === b.day && a.period === b.period) continue;

      const beforeClass = classCost(ci);
      const beforeA = teacherCost(a.teacher);
      const beforeB = b.teacher === a.teacher ? 0 : teacherCost(b.teacher);
      const beforeHard = dup + peOver + peMix + peLast + offDay;

      const aDay = a.day;
      const aPeriod = a.period;
      const bDay = b.day;
      const bPeriod = b.period;

      lift(a);
      place(a, bDay, bPeriod);
      lift(b);
      place(b, aDay, aPeriod);

      const afterHard = dup + peOver + peMix + peLast + offDay;
      const afterClass = classCost(ci);
      const afterA = teacherCost(a.teacher);
      const afterB = b.teacher === a.teacher ? 0 : teacherCost(b.teacher);

      const delta =
        (afterHard - beforeHard) * HARD +
        (afterClass - beforeClass) +
        (afterA - beforeA) +
        (afterB - beforeB);

      if (delta <= 0 || rand() < Math.exp(-delta / temperature)) {
        current += delta;
        if (current < bestCost) {
          bestCost = current;
          bestSnapshot = tasks.map((t) => [t.day, t.period]);
        }
      } else {
        lift(a);
        place(a, aDay, aPeriod);
        lift(b);
        place(b, bDay, bPeriod);
      }
    }

    const now = Date.now();
    const fraction = Math.min(1, (now - started) / budget);
    temperature = T0 * Math.pow(T1 / T0, fraction);
    if (now - lastProgress > 150) {
      lastProgress = now;
      opts.onProgress?.(fraction, `تحسين التوزيع — ${iterations.toLocaleString('ar-EG')} محاولة`);
    }
  }

  // ── استعادة أفضل حل ──────────────────────────────────────────────────────
  for (let i = 0; i < tasks.length; i++) {
    const [day, period] = bestSnapshot[i];
    const t = tasks[i];
    if (t.day !== day || t.period !== period) {
      lift(t);
      place(t, day, period);
    }
  }

  const lessons: Lesson[] = tasks.map((t) => ({
    id: t.id,
    assignmentId: t.assignmentId,
    day: t.day,
    period: t.period,
  }));

  return {
    ok: dup + peOver + peMix + peLast + offDay === 0,
    lessons,
    report: buildReport(data, tasks, {
      seed,
      iterations,
      ms: Date.now() - started,
      notes,
      byClassTasks,
      byTeacherTasks,
      artPairsByAssignment,
    }),
  };
}

function buildReport(
  data: SchoolData,
  tasks: Task[],
  meta: {
    seed: number;
    iterations: number;
    ms: number;
    notes: string[];
    byClassTasks: Task[][];
    byTeacherTasks: Task[][];
    artPairsByAssignment: Map<string, Task[]>;
  },
): SolveReport {
  const P = data.periods;
  let dup = 0;
  let peOver = 0;
  let peMix = 0;
  let peLast = 0;
  let off = 0;
  const peCapacity = Math.max(2, data.options?.peCapacity ?? 3);
  const peSeparate = data.options?.peSeparateGrade3 ?? true;
  const classGradeById = new Map(data.classes.map((cls) => [cls.id, gradeOf(cls.name)]));
  const teacherSlots = new Map<number, number>();
  const peSlots = new Map<number, number>();
  const peThird = new Map<number, number>();
  const peOther = new Map<number, number>();
  for (const t of tasks) {
    const key = t.teacher * 100 + t.day * P + t.period;
    const n = (teacherSlots.get(key) ?? 0) + 1;
    teacherSlots.set(key, n);
    if (n === 2) dup++;
    if (t.pe) {
      const pk = t.day * P + t.period;
      const m = (peSlots.get(pk) ?? 0) + 1;
      peSlots.set(pk, m);
      if (t.period === P - 1) peLast++;
      const grade = classGradeById.get(data.classes[t.cls].id);
      if (grade === 3) peThird.set(pk, (peThird.get(pk) ?? 0) + 1);
      else peOther.set(pk, (peOther.get(pk) ?? 0) + 1);
    }
    if (data.teachers[t.teacher].off.includes(t.day)) off++;
  }
  for (const count of peSlots.values()) if (count > peCapacity) peOver += count - peCapacity;
  if (peSeparate) {
    for (const slot of peSlots.keys()) {
      if ((peSlots.get(slot) ?? 0) >= 3 && (peThird.get(slot) ?? 0) > 0) peMix++;
    }
  }

  let repeats = 0;
  for (const list of meta.byClassTasks) {
    const seen = new Map<number, number>();
    for (const t of list) {
      if (t.art) continue;
      const key = t.day * 64 + t.subject;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n > 1) repeats++;
    }
  }

  let artPairs = 0;
  let artIntact = 0;
  for (const pair of meta.artPairsByAssignment.values()) {
    artPairs++;
    const a = pair[0];
    const b = pair[1];
    if (a.day === b.day && Math.abs(a.period - b.period) === 1) artIntact++;
  }

  let holes = 0;
  let longRuns = 0;
  let seventh = 0;
  let missingDays = 0;
  const teachers: TeacherReport[] = data.teachers.map((teacher, ti) => {
    const own = meta.byTeacherTasks[ti];
    let localHoles = 0;
    let localRuns = 0;
    let localMax = 0;
    let activeDays = 0;
    let goldenDays = 0;
    let seventhCount = 0;
    for (let day = 0; day < data.days; day++) {
      const periods = own.filter((t) => t.day === day).map((t) => t.period).sort((a, b) => a - b);
      if (!periods.length) continue;
      activeDays++;
      if (periods[periods.length - 1] <= 2 && periods.length <= 3) goldenDays++;
      localHoles += periods[periods.length - 1] - periods[0] + 1 - periods.length;
      seventhCount += periods.filter((p) => p === P - 1).length;
      let run = 1;
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] === periods[i - 1] + 1) run++;
        else {
          localMax = Math.max(localMax, run);
          if (run > 3) localRuns++;
          run = 1;
        }
      }
      localMax = Math.max(localMax, run);
      if (run > 3) localRuns++;
    }
    holes += localHoles;
    longRuns += localRuns;
    seventh += seventhCount;
    const demand = data.assignments.filter((a) => a.teacherId === teacher.id).reduce((n, a) => n + a.count, 0);
    // الأيام الخالية تُحسب فقط لمن يكفيه نصابه لتغطية الأسبوع.
    const missing = demand >= data.days ? data.days - activeDays : 0;
    missingDays += missing;
    return {
      id: teacher.id,
      name: teacher.name,
      lessons: own.length,
      quota: demand,
      overflow: Math.max(0, demand - teacher.max),
      holes: localHoles,
      longRuns: localRuns,
      maxRun: localMax,
      activeDays,
      missingDays: missing,
      seventh: seventhCount,
      goldenDays,
    };
  });

  const conflicts = dup + peOver + peMix + peLast + off;
  if (peOver > 0) meta.notes.push(`التربية البدنية: ${peOver} تجاوزًا لسقف ${peCapacity} فصول في الحصة.`);
  if (peMix > 0) meta.notes.push(`التربية البدنية: ${peMix} حصة اختلط فيها الثالث المتوسط مع ثلاثة فصول أو أكثر.`);
  if (peLast > 0) meta.notes.push(`التربية البدنية: ${peLast} حصة في الحصة السابعة (ممنوعة).`);
  const brokenArt = artPairs - artIntact;
  // أقل تكرار ممكن: لكل مادة تزيد حصصها على عدد الأيام، التكرار الزائد حتمي.
  let floorRepeats = 0;
  for (const list of meta.byClassTasks) {
    const bySubject = new Map<number, number>();
    for (const t of list) bySubject.set(t.subject, (bySubject.get(t.subject) ?? 0) + 1);
    for (const n of bySubject.values()) if (n > data.days) floorRepeats += n - data.days;
  }
  const avoidableRepeats = Math.max(0, repeats - floorRepeats);
  if (missingDays > 0) {
    meta.notes.push(`${missingDays} يومًا بلا حصص لبعض المعلمين — تعذّر إشغالها ضمن القيود الحالية.`);
  }
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          conflicts * 25 -
          brokenArt * 4 -
          longRuns * 1.5 -
          avoidableRepeats * 2 -
          holes * 0.12 -
          missingDays * 3,
      ),
    ),
  );

  return {
    total: tasks.length,
    placed: tasks.filter((t) => t.day >= 0).length,
    conflicts,
    artPairs,
    artPairsIntact: artIntact,
    dailyRepeats: repeats,
    holes,
    longRuns,
    seventh,
    missingDays,
    score,
    seed: meta.seed,
    ms: meta.ms,
    iterations: meta.iterations,
    teachers,
    notes: meta.notes,
  };
}


