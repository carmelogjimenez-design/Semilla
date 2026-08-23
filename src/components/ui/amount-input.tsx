'use client';

import { motion } from 'framer-motion';
import { Delete } from 'lucide-react';
import { useCallback } from 'react';

import type { Cents } from '@/domain/types';
import { formatAmount } from '@/domain/money';

/**
 * Entrada de importe.
 *
 * Teclado propio en lugar del teclado del sistema: aparece al instante, tiene
 * áreas táctiles grandes y evita el zoom de iOS. Registrar un gasto en menos de
 * 8 segundos empieza aquí (§2, §12).
 *
 * El valor SIEMPRE es un entero de céntimos: se van empujando dígitos por la
 * derecha, como en un datáfono. Nunca hay floats de por medio.
 */

export function AmountDisplay({ cents, tone = 'ink' }: { cents: Cents; tone?: 'ink' | 'leaf' | 'coral' }) {
  const color = tone === 'leaf' ? 'text-seed-700' : tone === 'coral' ? 'text-coral-deep' : 'text-ink';
  return (
    <div className="flex items-baseline justify-center gap-1.5 py-6">
      <motion.span
        key={cents}
        initial={{ scale: 0.96, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`text-hero tnum ${cents === 0 ? 'text-stone-300' : color}`}
      >
        {formatAmount(cents, 'always')}
      </motion.span>
      <span className={`text-2xl font-semibold ${cents === 0 ? 'text-stone-300' : color}`}>€</span>
    </div>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

export function NumericKeypad({
  value,
  onChange,
  max = 99_999_999,
}: {
  value: Cents;
  onChange: (next: Cents) => void;
  max?: Cents;
}) {
  const press = useCallback(
    (key: (typeof KEYS)[number]) => {
      if (navigator.vibrate) navigator.vibrate(6);
      if (key === 'del') {
        onChange(Math.floor(value / 10));
        return;
      }
      const digits = key === '00' ? 2 : 1;
      const next = value * 10 ** digits + Number(key);
      onChange(Math.min(next, max));
    },
    [value, onChange, max],
  );

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => press(key)}
          aria-label={key === 'del' ? 'Borrar' : key}
          className="flex h-[58px] items-center justify-center rounded-2xl bg-stone-100 text-[22px] font-semibold text-ink transition active:scale-[0.97] active:bg-stone-200"
        >
          {key === 'del' ? <Delete size={22} aria-hidden /> : key}
        </button>
      ))}
    </div>
  );
}
