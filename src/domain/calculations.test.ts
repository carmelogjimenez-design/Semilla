import { describe, expect, it } from 'vitest';

import {
  budgetStatus,
  calculateAccountsTotal,
  calculateDebtTotal,
  calculateExtraDebtPayments,
  calculateFreeMoney,
  calculateMonthlyExpenses,
  calculateMonthlyIncome,
  calculateNecessaryVsDiscretionary,
  calculateOrdinaryVsExtraordinary,
  calculateSavingsTotal,
  calculateWeeklyExpenses,
  dailyPace,
  debtCurrentBalance,
  evaluateWeek,
  plannedForWeek,
  pocketBalance,
} from './calculations';
import { getMonthWeeks } from './dates';
import type {
  Account,
  Debt,
  MonthlyBudget,
  SavingsPocket,
  Transaction,
  WeeklyBudget,
} from './types';

/* --- Datos mínimos y explícitos: cada test dice de dónde sale su cifra ---- */

const HOUSEHOLD = 'h1';
const stamp = { createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' };
const base = {
  householdId: HOUSEHOLD,
  note: '',
  description: '',
  accountId: 'acc-main',
  paymentMethodId: null,
  ownerUserId: 'u1',
  createdByUserId: 'u1',
  updatedByUserId: null,
  plannedId: null,
  tagIds: [],
  ...stamp,
};

const expense = (
  id: string,
  date: string,
  amount: number,
  extra = false,
  necessary = true,
): Transaction => ({
  ...base,
  id,
  kind: 'expense',
  amount,
  date,
  categoryId: 'cat',
  subcategoryId: null,
  merchantId: null,
  necessity: necessary ? 'necessary' : 'discretionary',
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

const saving = (id: string, date: string, amount: number, direction: 'in' | 'out' = 'in'): Transaction => ({
  ...base,
  id,
  kind: 'saving',
  amount,
  date,
  pocketId: 'pocket',
  direction,
});

const debtPayment = (
  id: string,
  date: string,
  amount: number,
  paymentType: 'installment' | 'extra',
): Transaction => ({
  ...base,
  id,
  kind: 'debtPayment',
  amount,
  date,
  debtId: 'debt',
  paymentType,
});

const transfer = (id: string, date: string, amount: number): Transaction => ({
  ...base,
  id,
  kind: 'transfer',
  amount,
  date,
  accountId: null,
  fromAccountId: 'acc-main',
  toAccountId: 'acc-savings',
});

const account = (id: string, opening: number, available: boolean): Account => ({
  ...stamp,
  id,
  householdId: HOUSEHOLD,
  name: id,
  type: available ? 'main' : 'savings',
  openingBalance: opening,
  balanceDate: '2026-08-31',
  countsAsAvailable: available,
  position: 0,
  archived: false,
});

const pocket = (id: string, type: 'savings' | 'reserved', opening: number): SavingsPocket => ({
  ...stamp,
  id,
  householdId: HOUSEHOLD,
  name: id,
  emoji: '🫙',
  type,
  targetAmount: null,
  targetDate: null,
  openingBalance: opening,
  accountId: null,
  position: 0,
  archived: false,
});

const debt: Debt = {
  ...stamp,
  id: 'debt',
  householdId: HOUSEHOLD,
  name: 'ING',
  type: 'loan',
  initialBalance: 2_500_000,
  balanceAtStart: 1_420_000,
  trackingStart: '2026-09-01',
  installment: 47_500,
  interestBps: 615,
  startDate: null,
  endDate: null,
  priority: 1,
  notes: '',
  archived: false,
};

/* ------------------------------------------------------------------------ */

describe('ingresos y gastos del mes', () => {
  const transactions = [
    income('i1', '2026-09-01', 541_600),
    income('i2', '2026-09-01', 185_000),
    income('i3', '2026-08-31', 100_000), // mes anterior: no cuenta
    expense('e1', '2026-09-02', 8_742),
    expense('e2', '2026-09-15', 62_000),
    saving('s1', '2026-09-05', 30_000),
    debtPayment('d1', '2026-09-12', 47_500, 'installment'),
    transfer('t1', '2026-09-10', 100_000),
  ];

  it('sólo suma los ingresos del mes pedido', () => {
    expect(calculateMonthlyIncome(transactions, '2026-09')).toBe(726_600);
  });

  it('el ahorro, la deuda y las transferencias no son gasto', () => {
    expect(calculateMonthlyExpenses(transactions, '2026-09')).toBe(70_742);
  });

  it('la semana filtra por rango de fechas', () => {
    expect(calculateWeeklyExpenses(transactions, '2026-09-14', '2026-09-20')).toBe(62_000);
    expect(calculateWeeklyExpenses(transactions, '2026-09-01', '2026-09-06')).toBe(8_742);
  });
});

describe('clasificación del gasto', () => {
  const transactions = [
    expense('e1', '2026-09-02', 10_000, false, true),
    expense('e2', '2026-09-03', 5_000, false, false),
    expense('e3', '2026-09-04', 38_000, true, true),
  ];

  it('separa necesario y discrecional (§15)', () => {
    expect(calculateNecessaryVsDiscretionary(transactions)).toEqual({
      necessary: 48_000,
      discretionary: 5_000,
    });
  });

  it('separa ordinario y extraordinario (§16)', () => {
    expect(calculateOrdinaryVsExtraordinary(transactions)).toEqual({
      ordinary: 15_000,
      extraordinary: 38_000,
    });
  });
});

describe('semáforo del presupuesto (§93)', () => {
  it('no pinta rojo por pasarse un poco', () => {
    expect(budgetStatus(47_000, 47_000, 1)).toBe('green');
    expect(budgetStatus(47_500, 47_000, 1)).toBe('amber');
    expect(budgetStatus(60_000, 47_000, 1)).toBe('red');
  });

  it('avisa si se va por delante del ritmo esperado', () => {
    // Mitad de la semana con el 80 % gastado: atención, todavía no rojo.
    expect(budgetStatus(37_600, 47_000, 0.5)).toBe('amber');
    expect(budgetStatus(23_500, 47_000, 0.5)).toBe('green');
  });

  it('sin presupuesto no hay juicio', () => {
    expect(budgetStatus(10_000, 0)).toBe('neutral');
  });
});

describe('presupuesto semanal flexible (§52)', () => {
  const weeks = getMonthWeeks('2026-09');
  const monthly: MonthlyBudget = {
    ...stamp,
    id: 'mb',
    householdId: HOUSEHOLD,
    month: '2026-09',
    planned: 685_000,
    categoryLimits: [],
  };
  const weekly: WeeklyBudget[] = [
    { ...stamp, id: 'w1', householdId: HOUSEHOLD, month: '2026-09', weekIndex: 1, planned: 40_000, categoryLimits: [] },
  ];

  it('usa el presupuesto explícito de la semana cuando existe', () => {
    const week = weeks[0];
    expect(week).toBeDefined();
    if (!week) return;
    expect(plannedForWeek(weekly, monthly, week, weeks.length)).toBe(40_000);
  });

  it('si no hay, reparte el mensual por días, no dividiendo entre cuatro', () => {
    const week = weeks[4]; // 28–30 septiembre, 3 días
    expect(week).toBeDefined();
    if (!week) return;
    const planned = plannedForWeek(weekly, monthly, week, weeks.length);
    expect(planned).toBe(Math.round((685_000 * 3) / 30));
    expect(planned).not.toBe(Math.round(685_000 / 4));
  });

  it('evalúa la semana con gasto real', () => {
    const week = weeks[2];
    expect(week).toBeDefined();
    if (!week) return;
    const result = evaluateWeek({
      week,
      planned: 47_000,
      transactions: [expense('e1', '2026-09-15', 14_300)],
      today: '2026-09-17',
    });
    expect(result.spent).toBe(14_300);
    expect(result.available).toBe(32_700);
    expect(result.status).toBe('green');
  });
});

describe('ahorro y huchas (§26, §27)', () => {
  const pockets = [pocket('pocket', 'savings', 813_000), pocket('reserved', 'reserved', 60_000)];
  const transactions = [saving('s1', '2026-09-05', 30_000), saving('s2', '2026-09-20', 10_000, 'out')];

  it('el saldo de una hucha parte del saldo inicial y suma aportaciones', () => {
    const target = pockets[0];
    expect(target).toBeDefined();
    if (!target) return;
    expect(pocketBalance(target, transactions)).toBe(833_000);
  });

  it('sólo cuenta como ahorro real las huchas de tipo ahorro', () => {
    expect(calculateSavingsTotal(pockets, transactions)).toBe(833_000);
  });
});

describe('deuda (§29, §32)', () => {
  const transactions = [
    debtPayment('d1', '2026-09-12', 47_500, 'installment'),
    debtPayment('d2', '2026-09-13', 50_000, 'extra'),
  ];

  it('el saldo baja con cuotas y con amortizaciones', () => {
    expect(debtCurrentBalance(debt, transactions)).toBe(1_420_000 - 97_500);
    expect(calculateDebtTotal([debt], transactions)).toBe(1_322_500);
  });

  it('la cuota ordinaria no cuenta como amortización extraordinaria', () => {
    expect(calculateExtraDebtPayments(transactions)).toBe(50_000);
  });

  it('nunca baja de cero', () => {
    expect(debtCurrentBalance(debt, [debtPayment('d3', '2026-09-12', 9_000_000, 'extra')])).toBe(0);
  });
});

describe('transferencias internas (§45)', () => {
  const accounts = [account('acc-main', 400_000, true), account('acc-savings', 100_000, false)];
  const transactions = [transfer('t1', '2026-09-10', 50_000)];

  it('mover dinero entre cuentas no cambia el patrimonio total', () => {
    expect(calculateAccountsTotal(accounts, transactions, '2026-09-30', false)).toBe(500_000);
  });

  it('pero sí cambia el saldo de cada cuenta', () => {
    const main = accounts[0];
    const savings = accounts[1];
    expect(main).toBeDefined();
    expect(savings).toBeDefined();
    if (!main || !savings) return;
    expect(calculateAccountsTotal([main], transactions, '2026-09-30', false)).toBe(350_000);
    expect(calculateAccountsTotal([savings], transactions, '2026-09-30', false)).toBe(150_000);
  });

  it('no es ni ingreso ni gasto', () => {
    expect(calculateMonthlyIncome(transactions, '2026-09')).toBe(0);
    expect(calculateMonthlyExpenses(transactions, '2026-09')).toBe(0);
  });
});

describe('dinero libre (§18)', () => {
  it('descuenta lo comprometido del saldo disponible', () => {
    const accounts = [account('acc-main', 400_000, true), account('acc-savings', 900_000, false)];
    const pockets = [pocket('ahorro', 'savings', 100_000), pocket('navidad', 'reserved', 30_000)];

    const result = calculateFreeMoney({
      accounts,
      pockets,
      transactions: [],
      occurrences: [
        {
          planned: {
            ...stamp,
            id: 'p1',
            householdId: HOUSEHOLD,
            name: 'Hipoteca',
            kind: 'debtPayment',
            expectedAmount: 102_900,
            frequency: 'monthly',
            dayOfMonth: 5,
            months: null,
            categoryId: null,
            subcategoryId: null,
            sourceId: null,
            debtId: 'debt',
            accountId: null,
            ownerUserId: null,
            extraordinary: false,
            installments: null,
            active: true,
            notes: '',
          },
          month: '2026-09',
          dueDate: '2026-09-05',
          expectedAmount: 102_900,
          actualAmount: 0,
          status: 'pending',
          transactionIds: [],
          paidDate: null,
        },
      ],
      today: '2026-09-03',
    });

    // La cuenta de ahorro no cuenta como disponible; las huchas sin cuenta sí se descuentan.
    expect(result.balance).toBe(400_000);
    expect(result.pendingPayments).toBe(102_900);
    expect(result.reserved).toBe(30_000);
    expect(result.savings).toBe(100_000);
    expect(result.free).toBe(400_000 - 102_900 - 30_000 - 100_000);
  });
});

describe('ritmo diario (§20)', () => {
  it('reparte lo disponible entre los días que quedan', () => {
    expect(dailyPace(32_700, 4)).toBe(8_175);
  });

  it('nunca propone gastar de más cuando ya se ha superado el presupuesto', () => {
    expect(dailyPace(-5_000, 3)).toBe(0);
  });
});
