import { useCallback, useEffect, useRef, useState } from 'react';
import type { GenerationOptions, SchoolData, SolveResult } from '../types';
import { solve } from './solver';

interface SolverState {
  running: boolean;
  fraction: number;
  message: string;
  result: SolveResult | null;
  error: string | null;
}

export function useSolver() {
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<SolverState>({
    running: false,
    fraction: 0,
    message: '',
    result: null,
    error: null,
  });

  useEffect(() => {
    return () => workerRef.current?.terminate();
  }, []);

  const run = useCallback(async (data: SchoolData, options: GenerationOptions, seed = 1448, budgetMs = 6000) => {
    setState({ running: true, fraction: 0, message: 'تهيئة المحرك…', result: null, error: null });
    try {
      const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const result = await new Promise<SolveResult>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent) => {
          const payload = event.data as
            | { type: 'progress'; fraction: number; message: string }
            | { type: 'done'; result: SolveResult }
            | { type: 'error'; error: string };
          if (payload.type === 'progress') {
            setState((prev) => ({ ...prev, fraction: payload.fraction, message: payload.message }));
          } else if (payload.type === 'done') {
            resolve(payload.result);
          } else {
            reject(new Error(payload.error));
          }
        };
        worker.onerror = () => reject(new Error('تعذّر تشغيل محرك التوزيع في الخلفية.'));
        worker.postMessage({ data, options, seed, budgetMs });
      });
      worker.terminate();
      workerRef.current = null;
      setState({ running: false, fraction: 1, message: 'انتهى التوزيع', result, error: null });
      return result;
    } catch (error) {
      // احتياطي: التشغيل في الخيط الرئيسي إن تعذّر العامل.
      const result = solve(data, options, { seed, budgetMs });
      setState({ running: false, fraction: 1, message: 'انتهى التوزيع', result, error: null });
      return result;
    }
  }, []);

  const clear = useCallback(() => setState({ running: false, fraction: 0, message: '', result: null, error: null }), []);

  return { ...state, run, clear };
}
