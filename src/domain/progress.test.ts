import { describe, expect, it } from 'vitest';

import { buildMonthlySeries, calculateMarginGenerated, projectAtCurrentPace, timeProgress } from './progress';
import type { Account, Debt, HouseholdData, SavingsPocket, Transaction } from './types';

/* --- Hogar mínimo para probar el progreso ------------------------------- */

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
): Transaction => ({ ...base, id, kind: 'debtPayment', amount, date, debtId: 'debt', paymentType });

const account: Account = {
  ...stamp,
  id: 'acc',
  householdId: H,
  name: 'Principal',
  type: 'main',
  openingBalance: 500_000,
  balanceDate: '2025-12-31',
  countsAsAvailable: true,
  position: 0,
  archived: false,
};

const pocket: SavingsPocket = {
  ...stamp,
  id: 'pocket',
  householdId: H,
  name: 'Fondo',
  emoji: '🛡️',
  type: 'savings',
  targetAmount: null,
  targetDate: null,
  openingBalance: 100_000,
  accountId: null,
  position: 0,
  archived: false,
};

const debt: Debt = {
  ...stamp,
  id: 'debt',
  householdId: H,
  name: 'ING',
  type: 'loan',
  initialBalance: 1_000_000,
  balanceAtStart: 600_000,
  trackingStart: '2026-01-01',
  installment: 20_000,
  interestBps: 500,
  startDate: null,
  endDate: null,
  priority: 0,
  notes: '',
  archived: false,
};

function household(transactions: Transaction[]): HouseholdData {
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
    accounts: [account],
    paymentMethods: [],
    categories: [],
    tags: [],
    merchants: [],
    incomeSources: [],
    transactions,
    monthlyBudgets: [],
    weeklyBudgets: [],
    plannedItems: [],
    pockets: [pocket],
    debts: [debt],
    goals: [],
    achievements: [],
    weeklyCloses: [],
    monthlyCloses: [],
    quickActions: [],
    invites: [],
  };
}

/* ------------------------------------------------------------------------ */

describe('margen generado (§33)', () => {
  it('suma ahorro neto y amortización extraordinaria, no las cuotas', () => {
    const data = household([
      saving('s1', '2026-01-10', 30_000),
      saving('s2', '2026-02-10', 20_000),
      saving('s3', '2026-02-20', 5_000, 'out'),
      debtPayment('d1', '2026-01-15', 20_000, 'installment'),
      debtPayment('d2', '2026-02-15', 50_000, 'extra'),
    ]);
    // 30.000 + 20.000 − 5.000 de ahorro, más 50.000 de amortización extra.
    expect(calculateMarginGenerated(data)).toBe(95_000);
  });
});

describe('proyección a ritmo actual (§35)', () => {
  it('no proyecta con menos de tres semanas de recorrido', () => {
    const data = household([saving('s1', '2026-01-05', 30_000)]);
    expect(
      projectAtCurrentPace({ data, from: '2026-01-01', to: '2026-12-31', today: '2026-01-10' }),
    ).toBeNull();
  });

  it('extrapola el ritmo observado al resto del periodo', () => {
    const data = household([saving('s1', '2026-01-10', 30_000), saving('s2', '2026-02-10', 30_000)]);
    const projection = projectAtCurrentPace({
      data,
      from: '2026-01-01',
      to: '2026-06-30',
      today: '2026-03-01',
    });
    expect(projection).not.toBeNull();
    if (!projection) return;
    // Dos meses de recorrido con 60.000 ahorrados: unos 30.000 al mes.
    expect(projection.savingsPerMonth).toBeGreaterThan(28_000);
    expect(projection.savingsPerMonth).toBeLessThan(32_000);
    // Y al final del periodo debe haber más de lo ya ahorrado.
    expect(projection.projectedSavings).toBeGreaterThan(60_000);
  });

  it('sólo cuenta amortizaciones extraordinarias, nunca las cuotas', () => {
    const data = household([
      debtPayment('d1', '2026-01-15', 20_000, 'installment'),
      debtPayment('d2', '2026-02-15', 20_000, 'installment'),
    ]);
    const projection = projectAtCurrentPace({
      data,
      from: '2026-01-01',
      to: '2026-06-30',
      today: '2026-03-01',
    });
    expect(projection?.projectedExtraDebt).toBe(0);
  });
});

describe('progreso temporal (§123)', () => {
  it('cuenta las semanas transcurridas del periodo', () => {
    const progress = timeProgress('2026-01-01', '2026-12-31', '2026-04-01');
    expect(progress.weeksTotal).toBe(53);
    expect(progress.weeksElapsed).toBe(13);
    expect(progress.ratio).toBeCloseTo(91 / 365, 2);
  });

  it('nunca pasa del 100 % aunque se haya cumplido la fecha', () => {
    const progress = timeProgress('2026-01-01', '2026-03-31', '2026-12-01');
    expect(progress.ratio).toBe(1);
  });
});

describe('serie mensual', () => {
  it('devuelve una foto por mes, con el patrimonio del cierre', () => {
    const data = household([saving('s1', '2026-01-10', 30_000), debtPayment('d1', '2026-02-15', 50_000, 'extra')]);
    const series = buildMonthlySeries(data, '2026-03', 3);

    expect(series.map((point) => point.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    // El ahorro sube en enero y se mantiene.
    expect(series[0]?.savings).toBe(130_000);
    expect(series[2]?.savings).toBe(130_000);
    // La deuda baja en febrero por la amortización.
    expect(series[0]?.debt).toBe(600_000);
    expect(series[1]?.debt).toBe(550_000);

    // Amortizar NO crea patrimonio: baja la deuda y baja el saldo a la vez.
    // Lo que hace crecer el patrimonio es gastar menos de lo que entra.
    expect(series[1]?.netWorth).toBe(series[0]?.netWorth);

    // Guardar en una hucha tampoco: el dinero sigue siendo el mismo,
    // sólo queda etiquetado. Sumarlo aparte sería contarlo dos veces.
    expect(series[0]?.netWorth).toBe(500_000 - 600_000);
  });

  it('corta el último punto en hoy: lo que tiene fecha futura no cuenta todavía', () => {
    const data = household([saving('s1', '2026-03-10', 30_000), saving('s2', '2026-03-28', 90_000)]);
    const hasta = buildMonthlySeries(data, '2026-03', 1, '2026-03-15');
    const mesEntero = buildMonthlySeries(data, '2026-03', 1);

    expect(hasta[0]?.savings).toBe(130_000);
    expect(mesEntero[0]?.savings).toBe(220_000);
  });

  it('el patrimonio sube cuando entra más de lo que sale', () => {
    const income: Transaction = {
      ...base,
      id: 'i1',
      kind: 'income',
      amount: 200_000,
      date: '2026-02-05',
      sourceId: 'src',
      recurrence: 'recurring',
      expectedAmount: null,
    };
    const series = buildMonthlySeries(household([income]), '2026-03', 3);
    expect(series[1]?.netWorth).toBe((series[0]?.netWorth ?? 0) + 200_000);
  });
});
