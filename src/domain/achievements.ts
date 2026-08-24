import type { AchievementContext, AchievementDefinition, AchievementId } from './types';
import { formatCurrency } from './money';

/**
 * §37 — Gamificación adulta. Los logros son del HOGAR (§36), nunca de una persona.
 * El catálogo vive también en la base de datos (`public.achievements`); aquí está
 * la lógica de medición, que es puro cálculo sobre datos ya cargados.
 */

const ratio = (current: number, target: number): number =>
  target <= 0 ? 0 : Math.min(1, current / target);

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-seed',
    emoji: '🌱',
    title: 'Primera semilla',
    description: 'Vuestro primer ingreso registrado.',
    measure: (c) => ({
      progress: ratio(c.incomeCount, 1),
      detail: c.incomeCount > 0 ? 'Conseguido' : 'Registra el primer ingreso',
    }),
  },
  {
    id: 'green-week',
    emoji: '🏆',
    title: 'Semana verde',
    description: 'Una semana entera dentro del presupuesto.',
    measure: (c) => ({
      progress: ratio(c.greenWeeks, 1),
      detail: c.greenWeeks > 0 ? `${c.greenWeeks} semanas verdes` : 'Aún ninguna',
    }),
  },
  {
    id: 'streak-3',
    emoji: '🔥',
    title: 'En racha',
    description: 'Tres semanas seguidas dentro del plan.',
    measure: (c) => ({
      progress: ratio(c.currentStreak, 3),
      detail: `${c.currentStreak} de 3 seguidas`,
    }),
  },
  {
    id: 'first-pocket',
    emoji: '🫙',
    title: 'Primera hucha',
    description: 'Habéis creado vuestra primera hucha.',
    measure: (c) => ({
      progress: ratio(c.pocketsCount, 1),
      detail: c.pocketsCount > 0 ? `${c.pocketsCount} huchas` : 'Crea una hucha',
    }),
  },
  {
    id: 'first-cushion',
    emoji: '🛡️',
    title: 'Primer colchón',
    description: '1.000 € ahorrados.',
    measure: (c) => ({
      progress: ratio(c.savingsTotal, 100_000),
      detail: `${formatCurrency(Math.min(c.savingsTotal, 100_000))} de 1.000 €`,
    }),
  },
  {
    id: 'strong-roots',
    emoji: '🌳',
    title: 'Raíces fuertes',
    description: '5.000 € en el fondo de emergencia.',
    measure: (c) => ({
      progress: ratio(c.emergencyFundTotal, 500_000),
      detail: `${formatCurrency(Math.min(c.emergencyFundTotal, 500_000))} de 5.000 €`,
    }),
  },
  {
    id: 'full-pocket',
    emoji: '🎯',
    title: 'Hucha completa',
    description: 'Habéis llegado al objetivo de una hucha.',
    measure: (c) => ({
      progress: ratio(c.pocketsCompleted, 1),
      detail: c.pocketsCompleted > 0 ? `${c.pocketsCompleted} completadas` : 'Aún ninguna',
    }),
  },
  {
    id: 'first-strike',
    emoji: '⚔️',
    title: 'Primer golpe',
    description: 'Primera amortización extraordinaria.',
    measure: (c) => ({
      progress: ratio(c.extraDebtTotal > 0 ? 1 : 0, 1),
      detail: c.extraDebtTotal > 0 ? formatCurrency(c.extraDebtTotal) : 'Aún ninguna',
    }),
  },
  {
    id: 'strike-1k',
    emoji: '💥',
    title: 'Golpe de 1K',
    description: 'Una amortización de 1.000 € de una vez.',
    measure: (c) => ({
      progress: ratio(c.biggestExtraPayment, 100_000),
      detail: `Mayor: ${formatCurrency(c.biggestExtraPayment)}`,
    }),
  },
  {
    id: 'debt-10k',
    emoji: '📉',
    title: '10K menos',
    description: '10.000 € menos de deuda.',
    measure: (c) => ({
      progress: ratio(c.debtReduced, 1_000_000),
      detail: `${formatCurrency(Math.max(0, c.debtReduced))} reducidos`,
    }),
  },
  {
    id: 'round-month',
    emoji: '🎯',
    title: 'Mes redondo',
    description: 'Un mes completo dentro del objetivo.',
    measure: (c) => ({
      progress: ratio(c.greenMonths, 1),
      detail: c.greenMonths > 0 ? `${c.greenMonths} meses` : 'Aún ninguno',
    }),
  },
  {
    id: 'first-quarter',
    emoji: '🌿',
    title: 'Primer trimestre',
    description: 'Tres meses cerrados.',
    measure: (c) => ({
      progress: ratio(c.closedMonths, 3),
      detail: `${c.closedMonths} de 3 meses`,
    }),
  },
  {
    id: 'consistency-10',
    emoji: '🏅',
    title: 'Constancia',
    description: 'Diez semanas registrando movimientos.',
    measure: (c) => ({
      progress: ratio(c.weeksWithActivity, 10),
      detail: `${c.weeksWithActivity} de 10 semanas`,
    }),
  },
];

export const ACHIEVEMENT_BY_ID = new Map<AchievementId, AchievementDefinition>(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

export interface AchievementState extends AchievementDefinition {
  progress: number;
  detail: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export function evaluateAchievements(
  ctx: AchievementContext,
  unlocked: readonly { id: AchievementId; unlockedAt: string }[],
): AchievementState[] {
  const unlockedMap = new Map(unlocked.map((u) => [u.id, u.unlockedAt]));
  return ACHIEVEMENTS.map((definition) => {
    const { progress, detail } = definition.measure(ctx);
    const stored = unlockedMap.get(definition.id) ?? null;
    return {
      ...definition,
      progress,
      detail,
      unlocked: stored !== null || progress >= 1,
      unlockedAt: stored,
    };
  });
}

/** Logros que acaban de cumplirse y todavía no están guardados en la base. */
export function newlyUnlocked(
  ctx: AchievementContext,
  unlocked: readonly { id: AchievementId; unlockedAt: string }[],
): AchievementId[] {
  const stored = new Set(unlocked.map((u) => u.id));
  return ACHIEVEMENTS.filter((a) => !stored.has(a.id) && a.measure(ctx).progress >= 1).map((a) => a.id);
}
