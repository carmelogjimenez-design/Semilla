import { describe, expect, it } from 'vitest';

import {
  annualCommitted,
  annualCost,
  committedSummary,
  extraordinaryReport,
  frequencyLabel,
  paymentCalendar,
} from './planned';
import { buildPlannedOccurrences } from './calculations';
import type { PlannedItem, Transaction } from './types';

const stamp = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const H = 'h1';

function planned(overrides: Partial<PlannedItem> & { id: string; name: string }): PlannedItem {
  return {
    householdId: H,
    kind: 'expense',
    expectedAmount: 10_000,
    frequency: 'monthly',
    dayOfMonth: 5,
    months: null,
    categoryId: 'cat',
    subcategoryId: null,
    sourceId: null,
    debtId: null,
    accountId: null,
    ownerUserId: null,
    extraordinary: false,
    installments: null,
    active: true,
    notes: '',
    ...stamp,
    ...overrides,
  };
}

const base = {
  householdId: H,
  note: '',
  description: '',
  accountId: 'acc',
  paymentMethodId: null,
  ownerUserId: 'u1',
  createdByUserId: 'u1',
  updatedByUserId: null,
  tagIds: [],
  ...stamp,
};

const expense = (
  id: string,
  date: string,
  amount: number,
  plannedId: string | null = null,
  extra = false,
): Transaction => ({
  ...base,
  id,
  kind: 'expense',
  amount,
  date,
  plannedId,
  categoryId: 'cat',
  subcategoryId: null,
  merchantId: null,
  necessity: 'necessary',
  frequency: extra ? 'extraordinary' : 'ordinary',
  expectedAmount: null,
});

/* ------------------------------------------------------------------------ */

describe('lo comprometido del mes (§62)', () => {
  const items = [
    planned({ id: 'p1', name: 'Hipoteca', expectedAmount: 100_000, dayOfMonth: 5 }),
    planned({ id: 'p2', name: 'Internet', expectedAmount: 14_000, dayOfMonth: 22 }),
    planned({ id: 'p3', name: 'Nómina', kind: 'income', expectedAmount: 500_000, dayOfMonth: 1 }),
  ];

  it('sólo cuenta como pagado lo que tiene un movimiento enlazado', () => {
    const occurrences = buildPlannedOccurrences(
      items,
      [expense('t1', '2026-03-05', 100_000, 'p1')],
      '2026-03',
      '2026-03-10',
    );
    const summary = committedSummary(occurrences);

    expect(summary.expected).toBe(114_000);
    expect(summary.paid).toBe(100_000);
    expect(summary.remaining).toBe(14_000);
  });

  it('los ingresos previstos no se mezclan con los gastos comprometidos', () => {
    const occurrences = buildPlannedOccurrences(items, [], '2026-03', '2026-03-10');
    const summary = committedSummary(occurrences);
    expect(summary.expected).toBe(114_000);
    expect(summary.expectedIncome).toBe(500_000);
  });

  it('marca como vencido lo que ya debería haberse pagado', () => {
    const occurrences = buildPlannedOccurrences(items, [], '2026-03', '2026-03-10');
    const summary = committedSummary(occurrences);
    expect(summary.overdue.map((o) => o.planned.name)).toEqual(['Hipoteca']);
  });
});

describe('calendario de pagos (§63)', () => {
  it('agrupa por día y ordena por fecha, sin rellenar los días vacíos', () => {
    const items = [
      planned({ id: 'p1', name: 'Internet', dayOfMonth: 22 }),
      planned({ id: 'p2', name: 'Seguro', dayOfMonth: 5 }),
      planned({ id: 'p3', name: 'Gimnasio', dayOfMonth: 5 }),
    ];
    const days = paymentCalendar(buildPlannedOccurrences(items, [], '2026-03', '2026-03-01'), '2026-03-01');

    expect(days).toHaveLength(2);
    expect(days[0]?.day).toBe(5);
    expect(days[0]?.occurrences).toHaveLength(2);
    expect(days[0]?.total).toBe(20_000);
    expect(days[0]?.offset).toBe(4);
    expect(days[1]?.day).toBe(22);
  });
});

describe('extraordinarios (§16)', () => {
  it('los separa del gasto corriente y dice qué parte del mes fueron', () => {
    const report = extraordinaryReport(
      [
        expense('t1', '2026-03-02', 60_000),
        expense('t2', '2026-03-04', 30_000, null, true),
        expense('t3', '2026-03-08', 10_000, null, true),
      ],
      '2026-03',
    );

    expect(report.total).toBe(40_000);
    expect(report.shareOfExpenses).toBeCloseTo(0.4, 5);
    // Ordenados de mayor a menor: el que explica el mes va primero.
    expect(report.transactions.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('un mes sin gastos no divide entre cero', () => {
    expect(extraordinaryReport([], '2026-03').shareOfExpenses).toBe(0);
  });
});

describe('coste real de lo comprometido', () => {
  it('un recibo mensual cuesta doce veces al año', () => {
    expect(annualCost(planned({ id: 'p', name: 'Internet', expectedAmount: 14_000 }))).toBe(168_000);
  });

  it('uno de meses concretos cuesta lo que dicen sus meses', () => {
    const seguro = planned({
      id: 'p',
      name: 'Seguro coche',
      expectedAmount: 30_000,
      frequency: 'custom',
      months: [1, 7],
    });
    expect(annualCost(seguro)).toBe(60_000);
    expect(frequencyLabel(seguro)).toBe('enero y julio');
  });

  it('el total anual ignora los ingresos y lo desactivado', () => {
    const items = [
      planned({ id: 'p1', name: 'Internet', expectedAmount: 14_000 }),
      planned({ id: 'p2', name: 'Nómina', kind: 'income', expectedAmount: 500_000 }),
      planned({ id: 'p3', name: 'Gimnasio viejo', expectedAmount: 4_000, active: false }),
    ];
    expect(annualCommitted(items)).toBe(168_000);
  });

  it('describe la frecuencia en palabras', () => {
    expect(frequencyLabel(planned({ id: 'p', name: 'x' }))).toBe('Todos los meses');
    expect(frequencyLabel(planned({ id: 'p', name: 'x', frequency: 'yearly' }))).toBe('Una vez al año');
  });
});
