import type {
  Cents,
  ExpenseTransaction,
  ISODate,
  MonthKey,
  PlannedItem,
  PlannedOccurrence,
  Transaction,
} from './types';
import { isExpense } from './types';
import { sumBy } from './money';
import { MONTH_NAMES, daysBetween } from './dates';
import { inMonth } from './calculations';

/**
 * LO COMPROMETIDO (§62, §63, §127).
 *
 * Un gasto fijo no es un gasto más: ya está decidido. Saber cuánto del mes está
 * comprometido antes de empezar es lo que evita la sensación de que el dinero
 * «desaparece». Aquí se calcula qué está comprometido, qué ya se ha pagado y qué
 * queda por caer, sin adivinar nada: un previsto sólo cuenta como pagado cuando
 * hay un movimiento real enlazado a él.
 */

/* ------------------------------------------------------------------ *
 * Resumen del mes
 * ------------------------------------------------------------------ */

export interface CommittedSummary {
  /** Suma prevista de todo lo comprometido del mes. */
  expected: Cents;
  /** Lo que ya se ha pagado de verdad. */
  paid: Cents;
  /** Lo que falta por caer. Nunca negativo. */
  remaining: Cents;
  /** Previstos que ya deberían haberse pagado y no constan. */
  overdue: PlannedOccurrence[];
  /** Cuánto de lo comprometido son ingresos previstos, no gastos. */
  expectedIncome: Cents;
  ratio: number;
}

export function committedSummary(occurrences: readonly PlannedOccurrence[]): CommittedSummary {
  const outgoing = occurrences.filter((o) => o.planned.kind !== 'income');
  const expected = sumBy(outgoing, (o) => o.expectedAmount);
  const paid = sumBy(outgoing, (o) => o.actualAmount);
  return {
    expected,
    paid,
    remaining: Math.max(0, expected - paid),
    overdue: outgoing.filter((o) => o.status === 'overdue'),
    expectedIncome: sumBy(
      occurrences.filter((o) => o.planned.kind === 'income'),
      (o) => o.expectedAmount,
    ),
    ratio: expected > 0 ? Math.min(1, paid / expected) : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Calendario de pagos (§63)
 * ------------------------------------------------------------------ */

export interface CalendarDay {
  date: ISODate;
  day: number;
  occurrences: PlannedOccurrence[];
  total: Cents;
  /** Días desde hoy. Negativo si ya pasó. */
  offset: number;
}

/**
 * Un día por fecha con algo previsto, en orden. No se rellenan los días vacíos:
 * una rejilla de mes con 25 huecos en blanco no dice nada que no diga una lista.
 */
export function paymentCalendar(
  occurrences: readonly PlannedOccurrence[],
  today: ISODate,
): CalendarDay[] {
  const byDate = new Map<ISODate, PlannedOccurrence[]>();
  for (const occurrence of occurrences) {
    const list = byDate.get(occurrence.dueDate) ?? [];
    list.push(occurrence);
    byDate.set(occurrence.dueDate, list);
  }

  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => ({
      date,
      day: Number(date.slice(8, 10)),
      occurrences: list,
      total: sumBy(
        list.filter((o) => o.planned.kind !== 'income'),
        (o) => o.expectedAmount,
      ),
      offset: daysBetween(today, date),
    }));
}

/* ------------------------------------------------------------------ *
 * Extraordinarios (§16, §127)
 * ------------------------------------------------------------------ */

export interface ExtraordinaryReport {
  transactions: ExpenseTransaction[];
  total: Cents;
  /** Qué parte del gasto del mes fue extraordinario. */
  shareOfExpenses: number;
}

/**
 * Los extraordinarios se separan porque distorsionan la lectura del mes: una
 * caldera rota no dice nada sobre cómo se ha gestionado el día a día.
 */
export function extraordinaryReport(
  transactions: readonly Transaction[],
  month: MonthKey,
): ExtraordinaryReport {
  const monthExpenses = inMonth(transactions, month).filter(isExpense);
  const extraordinary = monthExpenses.filter((t) => t.frequency === 'extraordinary');
  const total = sumBy(extraordinary, (t) => t.amount);
  const all = sumBy(monthExpenses, (t) => t.amount);
  return {
    transactions: [...extraordinary].sort((a, b) => b.amount - a.amount),
    total,
    shareOfExpenses: all > 0 ? total / all : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Etiquetas y coste real de un previsto
 * ------------------------------------------------------------------ */

/** «Todos los meses» · «Cada trimestre» · «Enero y julio». */
export function frequencyLabel(item: PlannedItem): string {
  if (item.months && item.months.length > 0) {
    const names = item.months
      .slice()
      .sort((a, b) => a - b)
      .map((month) => MONTH_NAMES[month - 1] ?? '');
    if (names.length === 1) return `Sólo en ${names[0]}`;
    const last = names[names.length - 1];
    return `${names.slice(0, -1).join(', ')} y ${last}`;
  }
  switch (item.frequency) {
    case 'monthly':
      return 'Todos los meses';
    case 'quarterly':
      return 'Cada trimestre';
    case 'yearly':
      return 'Una vez al año';
    default:
      return 'A medida';
  }
}

/**
 * Cuánto cuesta al año. Un recibo de 14 € al mes son 168 € al año, y esa cifra
 * cambia la conversación sobre si merece la pena.
 */
export function annualCost(item: PlannedItem): Cents {
  const times =
    item.months && item.months.length > 0
      ? item.months.length
      : item.frequency === 'monthly'
        ? 12
        : item.frequency === 'quarterly'
          ? 4
          : 1;
  return item.expectedAmount * times;
}

/** Coste anual de todo lo comprometido activo, para la frase de cabecera. */
export function annualCommitted(items: readonly PlannedItem[]): Cents {
  return sumBy(
    items.filter((item) => item.active && item.kind !== 'income'),
    annualCost,
  );
}
