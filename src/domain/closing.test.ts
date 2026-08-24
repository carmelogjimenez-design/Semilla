import { describe, expect, it } from 'vitest';

import {
  allocationTransactions,
  averageExpenses,
  buildMonthCloseDraft,
  compareCategories,
  historyMonths,
  isMonthClosable,
  nextWeekToClose,
  weekCloseDrafts,
} from './closing';
import { getMonthWeeks } from './dates';
import type { Category, HouseholdData, Transaction, WeeklyClose } from './types';
import type { WeekResult } from './calculations';

/* --- Hogar mínimo ------------------------------------------------------- */

const stamp = { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const H = 'h1';

const base = {
  householdId: H,
  note: '',
  description: '',
  accountId: 'acc',
  paymentMethodId: null,
  ownerUserId: 'u1',
  createdByUserId: 'u1',
  updatedByUserId: null,
  plannedId: null,
  tagIds: [],
  ...stamp,
};

const expense = (id: string, date: string, amount: number, categoryId: string, extra = false): Transaction => ({
  ...base,
  id,
  kind: 'expense',
  amount,
  date,
  categoryId,
  subcategoryId: null,
  merchantId: null,
  necessity: 'necessary',
  frequency: extra ? 'extraordinary' : 'ordinary',
  expectedAmount: null,
});

const income = (id: string, date: string, amount: number): Transaction => ({
  ...base,
  id,
  kind: 'income',
  amount,
  date,
  sourceId: 'src',
  recurrence: 'recurring',
  expectedAmount: null,
});

const categories: Category[] = [
  {
    ...stamp,
    id: 'c-food',
    householdId: H,
    name: 'Alimentación',
    emoji: '🥗',
    tone: 0,
    priority: 'protected',
    quick: true,
    position: 0,
    archived: false,
    subcategories: [],
  },
  {
    ...stamp,
    id: 'c-fun',
    householdId: H,
    name: 'Ocio',
    emoji: '🎉',
    tone: 1,
    priority: 'flexible',
    quick: true,
    position: 1,
    archived: false,
    subcategories: [],
  },
];

function household(transactions: Transaction[], closes: WeeklyClose[] = []): HouseholdData {
  return {
    household: {
      id: H,
      name: 'Casa',
      createdBy: 'u1',
      locale: 'es-ES',
      currency: 'EUR',
      timeZone: 'Europe/Madrid',
      createdAt: stamp.createdAt,
    },
    settings: { householdId: H, onboarded: true, demoDataLoaded: false, lastBackupAt: null },
    members: [],
    accounts: [],
    paymentMethods: [],
    categories,
    tags: [],
    merchants: [],
    incomeSources: [],
    transactions,
    monthlyBudgets: [],
    weeklyBudgets: [],
    plannedItems: [],
    pockets: [],
    debts: [],
    goals: [],
    achievements: [],
    weeklyCloses: closes,
    monthlyCloses: [],
    quickActions: [],
    invites: [],
  };
}

function weekResults(month: string): WeekResult[] {
  return getMonthWeeks(month).map((week) => ({
    week,
    planned: 10_000,
    spent: 8_000,
    available: 2_000,
    ratio: 0.8,
    status: 'green' as const,
  }));
}

/* ------------------------------------------------------------------------ */

describe('cierre de semana (§30)', () => {
  it('sólo ofrece cerrar las semanas que ya han terminado', () => {
    const weeks = weekResults('2026-03');
    const drafts = weekCloseDrafts({ weeks, month: '2026-03', closes: [], today: '2026-03-10' });

    // El 10 de marzo sólo han terminado las semanas anteriores al día 9.
    expect(drafts.length).toBeGreaterThan(0);
    for (const draft of drafts) expect(draft.week.end < '2026-03-10').toBe(true);
  });

  it('una semana sin presupuesto no es ni verde ni roja', () => {
    const weeks = weekResults('2026-03').map((entry) => ({ ...entry, planned: 0, spent: 4_000 }));
    const drafts = weekCloseDrafts({ weeks, month: '2026-03', closes: [], today: '2026-03-31' });
    expect(drafts[0]?.green).toBe(false);
    expect(drafts[0]?.margin).toBe(-4_000);
  });

  it('propone la primera semana pendiente y ninguna cuando están todas cerradas', () => {
    const weeks = weekResults('2026-03');
    const drafts = weekCloseDrafts({ weeks, month: '2026-03', closes: [], today: '2026-04-05' });
    expect(nextWeekToClose(drafts)?.week.index).toBe(1);

    const allClosed = drafts.map((draft) => ({ ...draft, closed: {} as WeeklyClose }));
    expect(nextWeekToClose(allClosed)).toBeNull();
  });
});

describe('reparto del margen (§31)', () => {
  const weeks = weekResults('2026-03');
  const drafts = weekCloseDrafts({ weeks, month: '2026-03', closes: [], today: '2026-04-05' });
  const draft = drafts[0]!;

  it('crea un ahorro y una amortización con la fecha de la semana, no la de hoy', () => {
    const created = allocationTransactions({
      allocation: { type: 'split', savingCents: 1_500, debtCents: 500, pocketId: 'p1', debtId: 'd1' },
      draft,
      householdId: H,
      userId: 'u1',
      accountId: 'acc',
      now: '2026-04-05T10:00:00Z',
      ids: ['t1', 't2'],
    });

    expect(created).toHaveLength(2);
    expect(created[0]?.kind).toBe('saving');
    expect(created[1]?.kind).toBe('debtPayment');
    for (const transaction of created) expect(transaction.date).toBe(draft.week.end);
  });

  it('dejarlo en la cuenta no crea ningún movimiento', () => {
    const created = allocationTransactions({
      allocation: { type: 'keep', savingCents: 0, debtCents: 0, pocketId: null, debtId: null },
      draft,
      householdId: H,
      userId: 'u1',
      accountId: 'acc',
      now: '2026-04-05T10:00:00Z',
      ids: [],
    });
    expect(created).toHaveLength(0);
  });

  it('una amortización del margen es siempre extraordinaria, nunca cuota', () => {
    const created = allocationTransactions({
      allocation: { type: 'debt', savingCents: 0, debtCents: 2_000, pocketId: null, debtId: 'd1' },
      draft,
      householdId: H,
      userId: 'u1',
      accountId: null,
      now: '2026-04-05T10:00:00Z',
      ids: ['t1'],
    });
    const payment = created[0];
    expect(payment?.kind === 'debtPayment' && payment.paymentType).toBe('extra');
  });
});

describe('cierre de mes (§32)', () => {
  it('no deja cerrar un mes que aún no ha terminado', () => {
    expect(isMonthClosable('2026-03', '2026-03-20')).toBe(false);
    expect(isMonthClosable('2026-03', '2026-04-01')).toBe(true);
  });

  it('el resultado son ingresos menos gastos: las cuotas de deuda no restan ahí', () => {
    const data = household([
      income('i1', '2026-03-01', 200_000),
      expense('e1', '2026-03-05', 60_000, 'c-food'),
      expense('e2', '2026-03-08', 40_000, 'c-fun', true),
    ]);
    const draft = buildMonthCloseDraft({ data, month: '2026-03', categories });

    expect(draft.income).toBe(200_000);
    expect(draft.expenses).toBe(100_000);
    expect(draft.extraordinaryExpenses).toBe(40_000);
    expect(draft.result).toBe(100_000);
  });

  it('el relato cuenta lo que pasó y nunca dice fracaso', () => {
    const data = household([
      income('i1', '2026-03-01', 100_000),
      expense('e1', '2026-03-05', 150_000, 'c-fun', true),
    ]);
    const { narrative } = buildMonthCloseDraft({ data, month: '2026-03', categories });

    expect(narrative.length).toBeGreaterThan(1);
    expect(narrative.join(' ')).toContain('extraordinarios');
    expect(narrative.join(' ').toLowerCase()).not.toContain('fracas');
  });

  it('un mes sin movimientos lo dice y no inventa cifras', () => {
    const { narrative } = buildMonthCloseDraft({ data: household([]), month: '2026-03', categories });
    expect(narrative).toEqual(['Este mes no tiene movimientos registrados.']);
  });
});

describe('histórico y comparativas (§66)', () => {
  const data = household([
    expense('e1', '2026-01-10', 50_000, 'c-food'),
    expense('e2', '2026-02-10', 30_000, 'c-food'),
    expense('e3', '2026-02-11', 20_000, 'c-fun'),
    expense('e4', '2026-03-10', 90_000, 'c-fun'),
  ]);

  it('lista sólo los meses con actividad, del más reciente al más antiguo', () => {
    expect(historyMonths(data, '2026-03', 6)).toEqual(['2026-03', '2026-02', '2026-01']);
  });

  it('ordena las categorías por cuánto se movieron, no por cuánto valen', () => {
    const rows = compareCategories({ data, month: '2026-03', previous: '2026-02' });
    expect(rows[0]?.name).toBe('Ocio');
    expect(rows[0]?.delta).toBe(70_000);
    expect(rows[1]?.name).toBe('Alimentación');
    expect(rows[1]?.delta).toBe(-30_000);
  });

  it('la media no cuenta el mes en curso', () => {
    // Enero 50.000 y febrero 50.000; marzo queda fuera.
    expect(averageExpenses(data, '2026-03', 6)).toBe(50_000);
  });
});
