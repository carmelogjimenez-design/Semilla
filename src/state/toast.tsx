'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

export interface ToastInput {
  title: string;
  detail?: string;
  tone?: 'neutral' | 'good' | 'watch' | 'bad';
  emoji?: string;
  action?: ToastAction;
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: string;
}

const ToastContext = createContext<((input: ToastInput) => void) | null>(null);

export function useToast(): (input: ToastInput) => void {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return context;
}

const TONE_CLASS: Record<NonNullable<ToastInput['tone']>, string> = {
  neutral: 'bg-forest text-white',
  good: 'bg-forest text-white',
  watch: 'bg-amber-bg text-amber-deep border border-amber-soft/40',
  bad: 'bg-coral-bg text-coral-deep border border-coral/30',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setItems((current) => [...current.slice(-2), { ...input, id }]);
      const timer = setTimeout(() => dismiss(id), input.duration ?? (input.action ? 6000 : 3200));
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Arriba, no abajo: abajo viven la barra, el botón flotante y el pie de
          las hojas, y el aviso tapaba justo el botón que se acababa de pulsar. */}
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
        style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}
        role="status"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl px-4 py-3 shadow-raised ${
                TONE_CLASS[item.tone ?? 'neutral']
              }`}
            >
              {item.emoji ? <span className="text-lg leading-none">{item.emoji}</span> : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.detail ? <p className="line-clamp-3 text-xs leading-snug opacity-80">{item.detail}</p> : null}
              </div>
              {item.action ? (
                <button
                  type="button"
                  onClick={() => {
                    item.action?.onPress();
                    dismiss(item.id);
                  }}
                  className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
                >
                  {item.action.label}
                </button>
              ) : null}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
