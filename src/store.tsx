import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SchoolData } from './types';
import { loadData, saveData, seedData, clearData } from './lib/storage';

export interface Toast {
  id: number;
  message: string;
  tone: 'ok' | 'warn' | 'error';
}

export interface PrintOptions {
  orientation?: 'portrait' | 'landscape';
  size?: 'A4' | 'A3';
  compact?: boolean;
}

interface StoreValue {
  data: SchoolData;
  update: (fn: (data: SchoolData) => SchoolData) => void;
  replace: (next: SchoolData) => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  toast: (message: string, tone?: Toast['tone']) => void;
  toasts: Toast[];
  print: (title: string, content: ReactNode, options?: PrintOptions) => void;
  printDoc: { title: string; content: ReactNode; options: PrintOptions } | null;
  closePrint: () => void;
}

const Store = createContext<StoreValue | null>(null);

const HISTORY_LIMIT = 40;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SchoolData>(() => loadData());
  const [past, setPast] = useState<SchoolData[]>([]);
  const [future, setFuture] = useState<SchoolData[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [printDoc, setPrintDoc] = useState<{ title: string; content: ReactNode; options: PrintOptions } | null>(null);
  const toastId = useRef(1);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => saveData(data), 350);
    return () => window.clearTimeout(saveTimer.current);
  }, [data]);

  const toast = useCallback((message: string, tone: Toast['tone'] = 'ok') => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const pushHistory = useCallback((prev: SchoolData) => {
    setPast((stack) => [...stack.slice(-HISTORY_LIMIT + 1), prev]);
    setFuture([]);
  }, []);

  const update = useCallback(
    (fn: (data: SchoolData) => SchoolData) => {
      setData((prev) => {
        const next = fn(prev);
        if (next === prev) return prev;
        pushHistory(prev);
        return next;
      });
    },
    [pushHistory],
  );

  const replace = useCallback(
    (next: SchoolData) => {
      setData((prev) => {
        pushHistory(prev);
        return next;
      });
    },
    [pushHistory],
  );

  const reset = useCallback(() => {
    setData((prev) => {
      pushHistory(prev);
      clearData();
      return seedData;
    });
  }, [pushHistory]);

  const undo = useCallback(() => {
    setPast((stack) => {
      if (!stack.length) return stack;
      const prev = stack[stack.length - 1];
      setFuture((f) => [data, ...f].slice(0, HISTORY_LIMIT));
      setData(prev);
      return stack.slice(0, -1);
    });
  }, [data]);

  const redo = useCallback(() => {
    setFuture((stack) => {
      if (!stack.length) return stack;
      const next = stack[0];
      setPast((p) => [...p, data].slice(-HISTORY_LIMIT));
      setData(next);
      return stack.slice(1);
    });
  }, [data]);

  const value = useMemo<StoreValue>(
    () => ({
      data,
      update,
      replace,
      reset,
      undo,
      redo,
      canUndo: past.length > 0,
      canRedo: future.length > 0,
      toast,
      toasts,
      print: (title, content, options = {}) => setPrintDoc({ title, content, options }),
      printDoc,
      closePrint: () => setPrintDoc(null),
    }),
    [data, update, replace, reset, undo, redo, past.length, future.length, toast, toasts, printDoc],
  );

  return <Store.Provider value={value}>{children}</Store.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(Store);
  if (!value) throw new Error('useStore outside provider');
  return value;
}

/** يختار عنصرًا من البيانات مع تحديث آمن. */
export function useSchool() {
  const { data } = useStore();
  return data;
}
