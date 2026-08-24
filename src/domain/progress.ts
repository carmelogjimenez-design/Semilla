import type { Cents, HouseholdData, ISODate, MonthKey } from './types';
import { isSaving } from './types';
import { sumBy } from './money';
import { addMonths, daysBetween, lastDayOfMonth, monthKeyOf } from './dates';
import {
  calculateAccountsTotal,
  calculateDebtTotal,
  calculateExtraDebtPayments,
  calculateSavingsTotal,
  inRange,
} from './calculations';

/**
 * Cálculos de la pantalla Progreso (§33, §35, §36, §66).
 *
 * Todo lo de aquí es una PROYECCIÓN o un HISTÓRICO, nunca una promesa: si no hay
 * suficiente recorrido para estimar con honestidad, se devuelve `null` y la
 * interfaz calla en vez de inventar una cifra.
 */

/* ------------------------------------------------------------------ *
 * Serie mensual — para los gráficos de evolución
 * ------------------------------------------------------------------ */

export interface MonthlyPoint {
  month: MonthKey;
  /** Ahorro acumulado en huchas al cierre del mes. */
  savings: Cents;
  /** Deuda viva al cierre del mes. */
  debt: Cents;
  /** Patrimonio: lo que hay menos lo que se debe. */
  netWorth: Cents;
}

/**
 * Últimos `count` meses hasta `month` incluido, con la foto de cada cierre.
 *
 * Con `today`, el último punto se corta en el día de hoy en vez de en el fin de
 * mes: si no, un movimiento con fecha futura ya haría subir la línea y el gráfico
 * no cuadraría con la cifra grande de la pantalla, que sí cuenta hasta hoy.
 */
export function buildMonthlySeries(
  data: HouseholdData,
  month: MonthKey,
  count = 6,
  today?: ISODate,
): MonthlyPoint[] {
  const months: MonthKey[] = [];
  for (let i = count - 1; i >= 0; i -= 1) months.push(addMonths(month, -i));

  return months.map((current) => {
    const monthEnd = lastDayOfMonth(current);
    const cutoff = today && today < monthEnd ? today : monthEnd;
    const upTo = data.transactions.filter((t) => t.date <= cutoff);

    /* Ahorro real, no dinero reservado: la misma cuenta que la cifra grande de
       la pantalla. Si aquí sumáramos también las huchas de reserva, el gráfico
       terminaría en un número distinto al del titular y parecería un error. */
    const savings = calculateSavingsTotal(data.pockets, upTo);
    const debt = calculateDebtTotal(data.debts, upTo);
    const accounts = calculateAccountsTotal(data.accounts, upTo, cutoff, false);

    /* Las huchas no se suman: son etiquetas sobre el saldo que ya está en cuentas. */
    return { month: current, savings, debt, netWorth: accounts - debt };
  });
}

/* ------------------------------------------------------------------ *
 * Margen generado (§33)
 * ------------------------------------------------------------------ */

/**
 * Lo que habéis conseguido apartar: ahorro neto + amortización extraordinaria.
 * No cuenta las cuotas ordinarias: esas no son un logro, son una obligación.
 */
export function calculateMarginGenerated(data: HouseholdData): Cents {
  const savedIn = sumBy(
    data.transactions.filter((t) => isSaving(t) && t.direction === 'in'),
    (t) => t.amount,
  );
  const savedOut = sumBy(
    data.transactions.filter((t) => isSaving(t) && t.direction === 'out'),
    (t) => t.amount,
  );
  return savedIn - savedOut + calculateExtraDebtPayments(data.transactions);
}

/* ------------------------------------------------------------------ *
 * Proyecciones (§35)
 * ------------------------------------------------------------------ */

export interface Projection {
  /** Ritmo observado, por mes. */
  savingsPerMonth: Cents;
  extraDebtPerMonth: Cents;
  /** Estimación al final del periodo del objetivo. */
  projectedSavings: Cents;
  projectedExtraDebt: Cents;
  monthsAhead: number;
  /** Meses de recorrido real sobre los que se ha calculado. */
  monthsObserved: number;
  /** Días de recorrido real. Con pocos, la interfaz habla de semanas. */
  daysObserved: number;
}

/**
 * Proyecta a ritmo actual. Devuelve `null` si hay menos de 21 días de recorrido:
 * con menos, cualquier número sería inventado.
 */
export function projectAtCurrentPace(input: {
  data: HouseholdData;
  from: ISODate;
  to: ISODate;
  today: ISODate;
}): Projection | null {
  const { data, from, to, today } = input;
  const elapsedDays = daysBetween(from, today) + 1;
  if (elapsedDays < 21) return null;

  const window = inRange(data.transactions, from, today);
  const savedIn = sumBy(
    window.filter((t) => isSaving(t) && t.direction === 'in'),
    (t) => t.amount,
  );
  const savedOut = sumBy(
    window.filter((t) => isSaving(t) && t.direction === 'out'),
    (t) => t.amount,
  );
  const saved = savedIn - savedOut;
  const extra = calculateExtraDebtPayments(window);

  const monthsObserved = elapsedDays / 30.44;
  const totalDays = daysBetween(from, to) + 1;
  const totalMonths = totalDays / 30.44;
  const monthsAhead = Math.max(0, totalMonths - monthsObserved);

  const savingsPerMonth = Math.round(saved / monthsObserved);
  const extraDebtPerMonth = Math.round(extra / monthsObserved);

  return {
    savingsPerMonth,
    extraDebtPerMonth,
    projectedSavings: saved + Math.round(savingsPerMonth * monthsAhead),
    projectedExtraDebt: extra + Math.round(extraDebtPerMonth * monthsAhead),
    monthsAhead: Math.round(monthsAhead),
    monthsObserved: Math.round(monthsObserved * 10) / 10,
    daysObserved: elapsedDays,
  };
}

/* ------------------------------------------------------------------ *
 * Progreso anual (§123)
 * ------------------------------------------------------------------ */

export interface TimeProgress {
  weeksElapsed: number;
  weeksTotal: number;
  ratio: number;
}

export function timeProgress(from: ISODate, to: ISODate, today: ISODate): TimeProgress {
  const totalDays = Math.max(1, daysBetween(from, to) + 1);
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(from, today) + 1));
  return {
    weeksElapsed: Math.max(1, Math.ceil(elapsed / 7)),
    weeksTotal: Math.ceil(totalDays / 7),
    ratio: elapsed / totalDays,
  };
}

/** Meses cerrados con resultado positivo, para el contador de meses buenos. */
export function greenMonthCount(data: HouseholdData): number {
  return data.monthlyCloses.filter((close) => close.result >= 0 && close.reopenedAt === null).length;
}

/** Mes actual en formato `YYYY-MM` a partir de una fecha. */
export function currentMonthOf(today: ISODate): MonthKey {
  return monthKeyOf(today);
}
