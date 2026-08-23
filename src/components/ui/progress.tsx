'use client';

import { motion } from 'framer-motion';

import type { Cents, HealthStatus } from '@/domain/types';
import { growthStage } from '@/domain/calculations';
import { formatCurrency } from '@/domain/money';

const TRACK: Record<HealthStatus, string> = {
  green: '#22C55E',
  amber: '#D8951F',
  red: '#C0503F',
  neutral: '#9C9C93',
};

/* --- Anillo de progreso -------------------------------------------------- */

export function ProgressRing({
  value,
  size = 128,
  thickness = 12,
  status = 'green',
  trackClassName = 'stroke-sage',
  children,
  label,
}: {
  value: number;
  size?: number;
  thickness?: number;
  status?: HealthStatus;
  trackClassName?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label ?? 'Progreso'}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          className={trackClassName}
          strokeLinecap="round"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={TRACK[status]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - clamped) }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* --- Barra de presupuesto ------------------------------------------------ */

export function BudgetBar({
  value,
  status = 'green',
  height = 8,
  className,
  marker,
}: {
  value: number;
  status?: HealthStatus;
  height?: number;
  className?: string;
  /** Marca opcional 0..1 para señalar el ritmo esperado. */
  marker?: number;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div
      className={`relative w-full overflow-hidden rounded-full bg-sage ${className ?? ''}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: TRACK[status] }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ type: 'spring', stiffness: 140, damping: 24 }}
      />
      {marker !== undefined && marker > 0 && marker < 1 ? (
        <span
          className="absolute top-0 h-full w-px bg-forest/30"
          style={{ left: `${Math.min(1, marker) * 100}%` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

/* --- Barra de deuda: se consume de derecha a izquierda -------------------- */

export function DebtBar({ paidRatio, className }: { paidRatio: number; className?: string }) {
  const remaining = Math.max(0, Math.min(1, 1 - paidRatio));
  return (
    <div className={`relative h-3 w-full overflow-hidden rounded-full bg-sage ${className ?? ''}`}>
      <motion.div
        className="absolute left-0 top-0 h-full rounded-full bg-forest"
        initial={{ width: '100%' }}
        animate={{ width: `${remaining * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 24 }}
      />
    </div>
  );
}

/* --- Metáfora de crecimiento (§58) --------------------------------------- */

const STAGE_EMOJI = { seed: '·', sprout: '🌱', leaves: '🌿', plant: '🪴' } as const;

export function GrowthMark({ progress, className }: { progress: number; className?: string }) {
  const stage = growthStage(progress);
  return (
    <span className={className} aria-hidden>
      {STAGE_EMOJI[stage]}
    </span>
  );
}

/* --- Vaso de hucha: algo que se llena ------------------------------------ */

export function PocketGlass({
  ratio,
  emoji,
  size = 56,
}: {
  ratio: number;
  emoji: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div
      className="relative flex items-end justify-center overflow-hidden rounded-2xl bg-sage"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <motion.div
        className="absolute inset-x-0 bottom-0 bg-leaf/35"
        initial={{ height: 0 }}
        animate={{ height: `${clamped * 100}%` }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      />
      <span className="relative pb-[18%] text-xl">{emoji}</span>
    </div>
  );
}

/* --- Cifra grande -------------------------------------------------------- */

export function BigMoney({
  cents,
  className,
  signed = false,
}: {
  cents: Cents;
  className?: string;
  signed?: boolean;
}) {
  return <span className={`tnum ${className ?? ''}`}>{formatCurrency(cents, { signed })}</span>;
}
