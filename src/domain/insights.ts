import type { Category, Cents, ID, MonthKey, PlannedOccurrence, Transaction } from './types';
import { formatCurrency, formatPercent, percentChange } from './money';
import { monthLabel } from './dates';
import {
  calculateExtraDebtPayments,
  calculateMonthlyExpenses,
  calculateNecessaryVsDiscretionary,
  calculateOrdinaryVsExtraordinary,
  expensesByCategory,
  inMonth,
} from './calculations';

/**
 * §60 — Insights deterministas, sin IA.
 * Cada frase sale de una comparación real. Si no hay base para comparar, no se dice.
 * §101 — principio de verdad: si se ha gastado más, se dice, pero con contexto.
 */

export interface Insight {
  id: string;
  text: string;
  tone: 'neutral' | 'good' | 'watch';
}

function categoryName(categories: readonly Category[], id: ID): string {
  return categories.find((c) => c.id === id)?.name ?? 'Otros';
}

export function buildInsights(input: {
  transactions: readonly Transaction[];
  previousTransactions: readonly Transaction[];
  categories: readonly Category[];
  month: MonthKey;
  previousMonth: MonthKey;
  occurrences: readonly PlannedOccurrence[];
}): Insight[] {
  const { transactions, previousTransactions, categories, month, previousMonth, occurrences } = input;
  const insights: Insight[] = [];

  const monthTx = inMonth(transactions, month);
  const total = calculateMonthlyExpenses(transactions, month);
  if (total === 0) return insights;

  // Categoría dominante
  const byCategory = [...expensesByCategory(monthTx).entries()].sort((a, b) => b[1] - a[1]);
  const top = byCategory[0];
  if (top) {
    insights.push({
      id: 'top-category',
      tone: 'neutral',
      text: `La mayor categoría es ${categoryName(categories, top[0]).toLowerCase()}: ${formatCurrency(top[1])}, un ${formatPercent(top[1] / total)} del mes.`,
    });
  }

  // Extraordinarios (§16, §127)
  const { extraordinary } = calculateOrdinaryVsExtraordinary(monthTx);
  if (extraordinary > 0) {
    insights.push({
      id: 'extraordinary',
      tone: 'neutral',
      text: `Los gastos extraordinarios suman ${formatCurrency(extraordinary)}, un ${formatPercent(extraordinary / total)} del mes. Sin ellos estaríais ${formatCurrency(extraordinary)} por debajo.`,
    });
  }

  // Necesario vs discrecional (§15)
  const { necessary, discretionary } = calculateNecessaryVsDiscretionary(monthTx);
  if (discretionary > 0 || necessary > 0) {
    insights.push({
      id: 'necessity',
      tone: 'neutral',
      text: `Necesario ${formatCurrency(necessary)} · Discrecional ${formatCurrency(discretionary)}.`,
    });
  }

  // Comparación con el mes anterior (§41) — sólo si hay mes anterior con datos
  const previousTotal = calculateMonthlyExpenses(previousTransactions, previousMonth);
  if (previousTotal > 0) {
    const change = percentChange(total, previousTotal);
    if (change !== null && Math.abs(change) >= 0.02) {
      insights.push({
        id: 'month-compare',
        tone: change < 0 ? 'good' : 'watch',
        text:
          change < 0
            ? `Habéis gastado un ${formatPercent(Math.abs(change))} menos que en ${monthLabel(previousMonth, { capitalize: false })}.`
            : `Habéis gastado un ${formatPercent(change)} más que en ${monthLabel(previousMonth, { capitalize: false })}.`,
      });
    }

    const previousByCategory = expensesByCategory(inMonth(previousTransactions, previousMonth));
    for (const [categoryId, amount] of byCategory.slice(0, 4)) {
      const before = previousByCategory.get(categoryId) ?? 0;
      const delta = percentChange(amount, before);
      if (delta === null || Math.abs(delta) < 0.15) continue;
      insights.push({
        id: `cat-${categoryId}`,
        tone: delta < 0 ? 'good' : 'watch',
        text: `${categoryName(categories, categoryId)}: ${delta < 0 ? '↓' : '↑'} ${formatPercent(Math.abs(delta))} respecto al mes anterior.`,
      });
      if (insights.length > 6) break;
    }
  }

  // Pagos pendientes (§63)
  const pending = occurrences.filter((o) => o.status === 'pending' || o.status === 'overdue');
  if (pending.length > 0) {
    insights.push({
      id: 'pending',
      tone: 'neutral',
      text: `Quedan ${pending.length} ${pending.length === 1 ? 'pago pendiente' : 'pagos pendientes'} este mes.`,
    });
  }

  const extra = calculateExtraDebtPayments(monthTx);
  if (extra > 0) {
    insights.push({
      id: 'extra-debt',
      tone: 'good',
      text: `Habéis amortizado ${formatCurrency(extra)} de más este mes.`,
    });
  }

  return insights.slice(0, 6);
}

/** §40 — narrativa breve del cierre de mes, siempre derivada de datos. */
export function buildMonthNarrative(input: {
  transactions: readonly Transaction[];
  previousTransactions: readonly Transaction[];
  categories: readonly Category[];
  month: MonthKey;
  previousMonth: MonthKey;
  saved: Cents;
  debtReduced: Cents;
  weeksClosed: number;
  greenWeeks: number;
}): string[] {
  const lines: string[] = [];
  const monthTx = inMonth(input.transactions, input.month);
  const byCategory = [...expensesByCategory(monthTx).entries()].sort((a, b) => b[1] - a[1]);
  const top = byCategory[0];

  if (top) {
    lines.push(`El mayor gasto fue ${categoryName(input.categories, top[0]).toLowerCase()}: ${formatCurrency(top[1])}.`);
  }

  const previousTotal = calculateMonthlyExpenses(input.previousTransactions, input.previousMonth);
  const total = calculateMonthlyExpenses(input.transactions, input.month);
  const change = previousTotal > 0 ? percentChange(total, previousTotal) : null;
  if (change !== null && Math.abs(change) >= 0.02) {
    lines.push(
      change < 0
        ? `Gastasteis un ${formatPercent(Math.abs(change))} menos que el mes anterior.`
        : `Gastasteis un ${formatPercent(change)} más que el mes anterior.`,
    );
  }

  const { extraordinary } = calculateOrdinaryVsExtraordinary(monthTx);
  if (extraordinary > 0) {
    lines.push(
      `Los extraordinarios explican ${formatCurrency(extraordinary)} del total. Por eso la capacidad de ahorro ha sido menor.`,
    );
  }

  if (input.debtReduced > 0) lines.push(`La deuda bajó ${formatCurrency(input.debtReduced)}.`);
  if (input.saved > 0) lines.push(`Guardasteis ${formatCurrency(input.saved)} en huchas.`);
  if (input.weeksClosed > 0) {
    lines.push(
      `Habéis completado ${input.weeksClosed} ${input.weeksClosed === 1 ? 'semana' : 'semanas'}, ${input.greenWeeks} dentro del plan.`,
    );
  }

  return lines;
}
