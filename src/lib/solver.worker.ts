import { solve } from './solver';
import type { GenerationOptions, SchoolData } from '../types';

self.onmessage = (event: MessageEvent) => {
  const { data, options, seed, budgetMs } = event.data as {
    data: SchoolData;
    options: GenerationOptions;
    seed: number;
    budgetMs: number;
  };
  try {
    const result = solve(data, options, {
      seed,
      budgetMs,
      onProgress: (fraction, message) => self.postMessage({ type: 'progress', fraction, message }),
    });
    self.postMessage({ type: 'done', result });
  } catch (error) {
    self.postMessage({ type: 'error', error: (error as Error).message });
  }
};
