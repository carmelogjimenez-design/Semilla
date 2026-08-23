import type {
  Account,
  Cents,
  Debt,
  DebtPaymentTransaction,
  ExpenseTransaction,
  FinancialGoal,
  HealthStatus,
  ID,
  ISODate,
  IncomeTransaction,
  MonthKey,
  MonthlyBudget,
  PlannedItem,
  PlannedOccurrence,
  PlannedStatus,
  SavingTransaction,
  SavingsPocket,
  Transaction,
  WeeklyBudget,
} from './types';
import { isDebtPayment, isExpense, isIncome, isSaving, isTransfer } from './types';
import { addMoney, ratio, sumBy } from './money';
import {
  addDays,
  daysBetween,
  daysInMonth,
  getMonthWeeks,
  lastDayOfMonth,
  monthKeyOf,
  pad,
  type WeekSpan,
} from './dates';

/**
 * Módulo de dominio financiero (§75).
 * Todas las funciones son PURAS: reciben datos, devuelven datos. Sin React, sin storage.
 */

/* ------------------------------------------------------------------ *
 * Filtros base
 * ------------------------------------------------------------------ */

export function inMonth<T extends { date: ISODate }>(items: readonly T[], month: MonthKey): T[] {
  return items.filter((item) => monthKeyOf(item.date) === month);
}

export function inRange<T extends { date: ISODate }>(items: readonly T[], start: ISODate, end: ISODate): T[] {
  return items.filter((item) => item.date >= start && item.date <= end);
}

export function incomes(transactions: readonly Transaction[]): IncomeTransaction[] {
  return transactions.filter(isIncome);
}

export function expenses(transactions: readonly Transaction[]): ExpenseTransaction[] {
  return transactions.filter(isExpense);
}

export function savings(transactions: readonly Transaction[]): SavingTransaction[] {
  return transactions.filter(isSaving);
}

export function debtPayments(transactions: readonly Transaction[]): DebtPaymentTransaction[] {
  return transactions.filter(isDebtPayment);
}

/* ------------------------------------------------------------------ *
 * Ingresos y gastos
 * ------------------------------------------------------------------ */

export function calculateMonthlyIncome(transactions: readonly Transaction[], month: MonthKey): Cents {
  return sumBy(inMonth(incomes(transactions), month), (t) => t.amount);
}

export function calculateExpectedMonthlyIncome(transactions: readonly Transaction[], month: MonthKey): Cents {
  return sumBy(inMonth(incomes(transactions), month), (t) => t.expectedAmount ?? t.amount);
}

export function calculateMonthlyExpenses(transactions: readonly Transaction[], month: MonthKey): Cents {
  return sumBy(inMonth(expenses(transactions), month), (t) => t.amount);
}

export function calculateWeeklyExpenses(
  transactions: readonly Transaction[],
  start: ISODate,
  end: ISODate,
): Cents {
  return sumBy(inRange(expenses(transactions), start, end), (t) => t.amount);
}

/** §15 — necesario vs discrecional. */
export function calculateNecessaryVsDiscretionary(
  transactions: readonly Transaction[],
): { necessary: Cents; discretionary: Cents } {
  const list = expenses(transactions);
  return {
    necessary: sumBy(
      list.filter((t) => t.necessity === 'necessary'),
      (t) => t.amount,
    ),
    discretionary: sumBy(
      list.filter((t) => t.necessity === 'discretionary'),
      (t) => t.amount,
    ),
  };
}

/** §16 — ordinario vs extraordinario. */
export function calculateOrdinaryVsExtraordinary(
  transactions: readonly Transaction[],
): { ordinary: Cents; extraordinary: Cents } {
  const list = expenses(transactions);
  return {
    ordinary: sumBy(
      list.filter((t) => t.frequency === 'ordinary'),
      (t) => t.amount,
    ),
    extraordinary: sumBy(
      list.filter((t) => t.frequency === 'extraordinary'),
      (t) => t.amount,
    ),
  };
}

export function expensesByCategory(transactions: readonly Transaction[]): Map<ID, Cents> {
  const map = new Map<ID, Cents>();
  for (const t of expenses(transactions)) {
    map.set(t.categoryId, addMoney(map.get(t.categoryId) ?? 0, t.amount));
  }
  return map;
}

export function expensesBySubcategory(transactions: readonly Transaction[], categoryId: ID): Map<ID, Cents> {
  const map = new Map<ID, Cents>();
  for (const t of expenses(transactions)) {
    if (t.categoryId !== categoryId) continue;
    const key = t.subcategoryId ?? '—';
    map.set(key, addMoney(map.get(key) ?? 0, t.amount));
  }
  return map;
}

/* ------------------------------------------------------------------ *
 * Presupuestos
 * ------------------------------------------------------------------ */

/** Presupuesto disponible en la semana: planificado − gastado. Puede ser negativo. */
export function calculateAvailableWeeklyBudget(planned: Cents, spent: Cents): Cents {
  return planned - spent;
}

export function calculateBudgetVariance(planned: Cents, actual: Cents): Cents {
  return planned - actual;
}

/**
 * §93 — semáforo con umbrales razonables. Nunca rojo por una desviación mínima.
 * `elapsedRatio` (0..1) permite comparar contra el ritmo esperado, no sólo contra el total.
 */
export function budgetStatus(spent: Cents, planned: Cents, elapsedRatio = 1): HealthStatus {
  if (planned <= 0) return 'neutral';
  const used = spent / planned;
  const expected = Math.min(1, Math.max(0.05, elapsedRatio));
  // Pasarse mucho es rojo; pasarse un poco es ámbar, nunca rojo (§93).
  if (used > 1.1) return 'red';
  if (used > 1) return 'amber';
  // Ir por delante del ritmo esperado avisa antes de que sea tarde.
  if (used > expected + 0.12) return 'amber';
  return 'green';
}

export function statusLabel(status: HealthStatus): string {
  switch (status) {
    case 'green':
      return 'Buen ritmo';
    case 'amber':
      return 'Atención';
    case 'red':
      return 'Revisar';
    default:
      return 'Sin presupuesto';
  }
}

/* ------------------------------------------------------------------ *
 * Previstos (§62, §63, §24)
 * ------------------------------------------------------------------ */

function plannedAppliesToMonth(item: PlannedItem, month: MonthKey): boolean {
  if (!item.active) return false;
  const monthNumber = Number(month.slice(5, 7));
  if (item.frequency === 'monthly') return true;
  if (item.months && item.months.length > 0) return item.months.includes(monthNumber);
  if (item.frequency === 'quarterly') return monthNumber % 3 === 1;
  if (item.frequency === 'yearly') return monthNumber === 1;
  return true;
}

export function plannedDueDate(item: PlannedItem, month: MonthKey): ISODate {
  const day = Math.min(Math.max(1, item.dayOfMonth), daysInMonth(month));
  return `${month}-${pad(day)}`;
}

/** Proyecta los previstos activos sobre un mes y los cruza con los movimientos reales. */
export function buildPlannedOccurrences(
  plannedItems: readonly PlannedItem[],
  transactions: readonly Transaction[],
  month: MonthKey,
  today: ISODate,
): PlannedOccurrence[] {
  const monthTransactions = inMonth(transactions, month);
  return plannedItems
    .filter((item) => plannedAppliesToMonth(item, month))
    .map<PlannedOccurrence>((item) => {
      const linked = monthTransactions.filter((t) => t.plannedId === item.id);
      const actualAmount = sumBy(linked, (t) => t.amount);
      const dueDate = plannedDueDate(item, month);
      let status: PlannedStatus;
      if (linked.length === 0) status = today > dueDate ? 'overdue' : 'pending';
      else if (actualAmount < item.expectedAmount * 0.9) status = 'partial';
      else status = 'paid';
      const paidDate = linked.length
        ? linked.map((t) => t.date).sort()[linked.length - 1] ?? null
        : null;
      return {
        planned: item,
        month,
        dueDate,
        expectedAmount: item.expectedAmount,
        actualAmount,
        status,
        transactionIds: linked.map((t) => t.id),
        paidDate,
      };
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function pendingPlannedTotal(occurrences: readonly PlannedOccurrence[]): Cents {
  return sumBy(
    occurrences.filter((o) => o.status === 'pending' || o.status === 'overdue' || o.status === 'partial'),
    (o) => Math.max(0, o.expectedAmount - o.actualAmount),
  );
}

/** Dinero necesario para los próximos N días (§63). */
export function upcomingNeed(
  occurrences: readonly PlannedOccurrence[],
  today: ISODate,
  days: number,
): { total: Cents; items: PlannedOccurrence[] } {
  const limit = addDays(today, days);
  const items = occurrences.filter(
    (o) => (o.status === 'pending' || o.status === 'overdue') && o.dueDate <= limit,
  );
  return { total: sumBy(items, (o) => Math.max(0, o.expectedAmount - o.actualAmount)), items };
}

/* ------------------------------------------------------------------ *
 * Cuentas, huchas, dinero libre
 * ------------------------------------------------------------------ */

/** Efecto neto de un movimiento sobre el saldo de una cuenta concreta. */
export function accountDelta(transaction: Transaction, accountId: ID): Cents {
  if (isTransfer(transaction)) {
    if (transaction.fromAccountId === accountId) return -transaction.amount;
    if (transaction.toAccountId === accountId) return transaction.amount;
    return 0;
  }
  if (transaction.accountId !== accountId) return 0;
  if (isIncome(transaction)) return transaction.amount;
  if (isSaving(transaction)) return 0; // el dinero sigue en la cuenta, sólo queda etiquetado
  return -transaction.amount;
}

export function accountBalance(
  account: Account,
  transactions: readonly Transaction[],
  upTo: ISODate,
): Cents {
  const movements = transactions.filter((t) => t.date > account.balanceDate && t.date <= upTo);
  return addMoney(account.openingBalance, sumBy(movements, (t) => accountDelta(t, account.id)));
}

export function calculateAccountsTotal(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  upTo: ISODate,
  onlyAvailable = false,
): Cents {
  return sumBy(
    accounts.filter((a) => !a.archived && (!onlyAvailable || a.countsAsAvailable)),
    (a) => accountBalance(a, transactions, upTo),
  );
}

export function pocketBalance(pocket: SavingsPocket, transactions: readonly Transaction[]): Cents {
  const movements = savings(transactions).filter((t) => t.pocketId === pocket.id);
  return addMoney(
    pocket.openingBalance,
    sumBy(movements, (t) => (t.direction === 'in' ? t.amount : -t.amount)),
  );
}

/** §26 — ahorro real acumulado (huchas de tipo `savings`). */
export function calculateSavingsTotal(
  pockets: readonly SavingsPocket[],
  transactions: readonly Transaction[],
): Cents {
  return sumBy(
    pockets.filter((p) => !p.archived && p.type === 'savings'),
    (p) => pocketBalance(p, transactions),
  );
}

/** §27 B — dinero reservado para un gasto futuro. */
export function calculateReservedMoney(
  pockets: readonly SavingsPocket[],
  transactions: readonly Transaction[],
): Cents {
  return sumBy(
    pockets.filter((p) => !p.archived && p.type === 'reserved'),
    (p) => pocketBalance(p, transactions),
  );
}

export interface FreeMoneyBreakdown {
  balance: Cents;
  pendingPayments: Cents;
  reserved: Cents;
  savings: Cents;
  free: Cents;
}

/**
 * §18 — Dinero libre.
 * Saldo disponible − pagos pendientes − dinero reservado − ahorro alojado en esas cuentas.
 */
export function calculateFreeMoney(input: {
  accounts: readonly Account[];
  pockets: readonly SavingsPocket[];
  transactions: readonly Transaction[];
  occurrences: readonly PlannedOccurrence[];
  today: ISODate;
}): FreeMoneyBreakdown {
  const { accounts, pockets, transactions, occurrences, today } = input;
  const availableAccountIds = new Set(
    accounts.filter((a) => !a.archived && a.countsAsAvailable).map((a) => a.id),
  );
  const balance = calculateAccountsTotal(accounts, transactions, today, true);
  const pendingPayments = pendingPlannedTotal(occurrences);

  const insideAvailable = (p: SavingsPocket): boolean =>
    p.accountId === null || availableAccountIds.has(p.accountId);

  const reserved = sumBy(
    pockets.filter((p) => !p.archived && p.type === 'reserved' && insideAvailable(p)),
    (p) => pocketBalance(p, transactions),
  );
  const savingsHeld = sumBy(
    pockets.filter((p) => !p.archived && p.type === 'savings' && insideAvailable(p)),
    (p) => pocketBalance(p, transactions),
  );

  return {
    balance,
    pendingPayments,
    reserved,
    savings: savingsHeld,
    free: balance - pendingPayments - reserved - savingsHeld,
  };
}

/* ------------------------------------------------------------------ *
 * Deuda
 * ------------------------------------------------------------------ */

export function debtPaidSince(debt: Debt, transactions: readonly Transaction[]): Cents {
  return sumBy(
    debtPayments(transactions).filter((t) => t.debtId === debt.id && t.date >= debt.trackingStart),
    (t) => t.amount,
  );
}

export function debtCurrentBalance(debt: Debt, transactions: readonly Transaction[]): Cents {
  return Math.max(0, debt.balanceAtStart - debtPaidSince(debt, transactions));
}

export function calculateDebtTotal(debts: readonly Debt[], transactions: readonly Transaction[]): Cents {
  return sumBy(
    debts.filter((d) => !d.archived),
    (d) => debtCurrentBalance(d, transactions),
  );
}

/** Deuda eliminada desde el importe original de cada préstamo. */
export function calculateDebtReducedTotal(
  debts: readonly Debt[],
  transactions: readonly Transaction[],
): Cents {
  return sumBy(
    debts.filter((d) => !d.archived),
    (d) => d.initialBalance - debtCurrentBalance(d, transactions),
  );
}

/** Deuda reducida desde que se usa Semilla. */
export function calculateDebtReducedSinceStart(
  debts: readonly Debt[],
  transactions: readonly Transaction[],
): Cents {
  return sumBy(
    debts.filter((d) => !d.archived),
    (d) => debtPaidSince(d, transactions),
  );
}

/** §32 — sólo amortizaciones extraordinarias. */
export function calculateExtraDebtPayments(transactions: readonly Transaction[]): Cents {
  return sumBy(
    debtPayments(transactions).filter((t) => t.paymentType === 'extra'),
    (t) => t.amount,
  );
}

export function calculateInstallmentPayments(transactions: readonly Transaction[]): Cents {
  return sumBy(
    debtPayments(transactions).filter((t) => t.paymentType === 'installment'),
    (t) => t.amount,
  );
}

/* ------------------------------------------------------------------ *
 * Cash flow, patrimonio, proyección
 * ------------------------------------------------------------------ */

/** Ingresos − gastos del periodo (el ahorro y las transferencias no son gasto). */
export function calculateNetCashflow(transactions: readonly Transaction[]): Cents {
  return (
    sumBy(incomes(transactions), (t) => t.amount) -
    sumBy(expenses(transactions), (t) => t.amount) -
    sumBy(debtPayments(transactions), (t) => t.amount)
  );
}

export interface NetWorth {
  accounts: Cents;
  pocketsOutsideAccounts: Cents;
  debt: Cents;
  total: Cents;
}

/** §36 — patrimonio conceptual. Sin valor de vivienda en el MVP. */
export function calculateNetWorth(input: {
  accounts: readonly Account[];
  pockets: readonly SavingsPocket[];
  debts: readonly Debt[];
  transactions: readonly Transaction[];
  today: ISODate;
}): NetWorth {
  const accountsTotal = calculateAccountsTotal(input.accounts, input.transactions, input.today, false);
  const outside = sumBy(
    input.pockets.filter((p) => !p.archived && p.accountId === null),
    (p) => pocketBalance(p, input.transactions),
  );
  const debt = calculateDebtTotal(input.debts, input.transactions);
  return {
    accounts: accountsTotal,
    pocketsOutsideAccounts: outside,
    debt,
    total: accountsTotal + outside - debt,
  };
}

export interface MonthProjection {
  spentSoFar: Cents;
  pendingPlanned: Cents;
  variablePace: Cents;
  projectedTotal: Cents;
  budget: Cents;
  projectedVariance: Cents;
  daysRemaining: number;
}

/** §35 — proyección, nunca certeza. */
export function calculateProjectedMonthEnd(input: {
  transactions: readonly Transaction[];
  month: MonthKey;
  today: ISODate;
  budget: Cents;
  occurrences: readonly PlannedOccurrence[];
}): MonthProjection {
  const { transactions, month, today, budget, occurrences } = input;
  const monthExpenses = inMonth(expenses(transactions), month);
  const spentSoFar = sumBy(monthExpenses, (t) => t.amount);
  const pending = pendingPlannedTotal(occurrences);

  const total = daysInMonth(month);
  const lastDay = lastDayOfMonth(month);
  const cursor = today > lastDay ? lastDay : today < `${month}-01` ? `${month}-01` : today;
  const elapsed = Math.max(1, daysBetween(`${month}-01`, cursor) + 1);
  const daysRemaining = Math.max(0, total - elapsed);

  const variableSoFar = sumBy(
    monthExpenses.filter((t) => t.plannedId === null && t.frequency === 'ordinary'),
    (t) => t.amount,
  );
  const dailyPace = Math.round(variableSoFar / elapsed);
  const variablePace = dailyPace * daysRemaining;
  const projectedTotal = spentSoFar + pending + variablePace;

  return {
    spentSoFar,
    pendingPlanned: pending,
    variablePace,
    projectedTotal,
    budget,
    projectedVariance: budget - projectedTotal,
    daysRemaining,
  };
}

/* ------------------------------------------------------------------ *
 * Objetivos
 * ------------------------------------------------------------------ */

export interface GoalProgress {
  savings: { current: Cents; target: Cents; ratio: number };
  extraDebt: { current: Cents; target: Cents; ratio: number };
  greenWeeks: { current: number; target: number; ratio: number };
  elapsedRatio: number;
  weeksElapsed: number;
  weeksTotal: number;
  overallRatio: number;
}

export function calculateGoalProgress(
  goal: FinancialGoal,
  input: {
    transactions: readonly Transaction[];
    greenWeeks: number;
    today: ISODate;
  },
): GoalProgress {
  const window = inRange(input.transactions, goal.startDate, goal.endDate);
  const savedIn = sumBy(
    savings(window).filter((t) => t.direction === 'in'),
    (t) => t.amount,
  );
  const savedOut = sumBy(
    savings(window).filter((t) => t.direction === 'out'),
    (t) => t.amount,
  );
  const saved = savedIn - savedOut;
  const extra = calculateExtraDebtPayments(window);

  const totalDays = Math.max(1, daysBetween(goal.startDate, goal.endDate) + 1);
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, daysBetween(goal.startDate, input.today) + 1),
  );

  const savingsRatio = goal.savingsTarget ? Math.min(1, saved / goal.savingsTarget) : 0;
  const debtRatio = goal.extraDebtTarget ? Math.min(1, extra / goal.extraDebtTarget) : 0;
  const weeksRatio = goal.greenWeeksTarget ? Math.min(1, input.greenWeeks / goal.greenWeeksTarget) : 0;
  const active = [goal.savingsTarget, goal.extraDebtTarget, goal.greenWeeksTarget].filter(Boolean).length || 1;

  return {
    savings: { current: saved, target: goal.savingsTarget, ratio: savingsRatio },
    extraDebt: { current: extra, target: goal.extraDebtTarget, ratio: debtRatio },
    greenWeeks: { current: input.greenWeeks, target: goal.greenWeeksTarget, ratio: weeksRatio },
    elapsedRatio: elapsedDays / totalDays,
    weeksElapsed: Math.ceil(elapsedDays / 7),
    weeksTotal: Math.ceil(totalDays / 7),
    overallRatio: (savingsRatio + debtRatio + weeksRatio) / active,
  };
}

/* ------------------------------------------------------------------ *
 * Semanas
 * ------------------------------------------------------------------ */

export interface WeekResult {
  week: WeekSpan;
  planned: Cents;
  spent: Cents;
  available: Cents;
  ratio: number;
  status: HealthStatus;
}

export function plannedForWeek(
  weeklyBudgets: readonly WeeklyBudget[],
  monthlyBudget: MonthlyBudget | undefined,
  week: WeekSpan,
  weeksInMonth: number,
): Cents {
  const explicit = weeklyBudgets.find((b) => b.month === week.month && b.weekIndex === week.index);
  if (explicit) return explicit.planned;
  if (!monthlyBudget) return 0;
  // Reparto proporcional a los días de la semana (§22 y §52: nunca mensual / 4 a ciegas).
  const totalDays = daysInMonth(week.month);
  void weeksInMonth;
  return Math.round((monthlyBudget.planned * week.days) / totalDays);
}

export function evaluateWeek(input: {
  week: WeekSpan;
  planned: Cents;
  transactions: readonly Transaction[];
  today: ISODate;
}): WeekResult {
  const spent = calculateWeeklyExpenses(input.transactions, input.week.start, input.week.end);
  const elapsed =
    input.today > input.week.end
      ? 1
      : input.today < input.week.start
        ? 0
        : (daysBetween(input.week.start, input.today) + 1) / input.week.days;
  return {
    week: input.week,
    planned: input.planned,
    spent,
    available: input.planned - spent,
    ratio: ratio(spent, input.planned),
    status: budgetStatus(spent, input.planned, elapsed),
  };
}

export function buildMonthWeeks(input: {
  month: MonthKey;
  weeklyBudgets: readonly WeeklyBudget[];
  monthlyBudget: MonthlyBudget | undefined;
  transactions: readonly Transaction[];
  today: ISODate;
}): WeekResult[] {
  const weeks = getMonthWeeks(input.month);
  return weeks.map((week) =>
    evaluateWeek({
      week,
      planned: plannedForWeek(input.weeklyBudgets, input.monthlyBudget, week, weeks.length),
      transactions: input.transactions,
      today: input.today,
    }),
  );
}

/** Ritmo diario disponible (§20). No es un objetivo de gasto. */
export function dailyPace(available: Cents, daysRemaining: number): Cents {
  if (daysRemaining <= 0) return Math.max(0, available);
  return Math.round(Math.max(0, available) / daysRemaining);
}

/* ------------------------------------------------------------------ *
 * Metáfora de crecimiento (§58)
 * ------------------------------------------------------------------ */

export type GrowthStage = 'seed' | 'sprout' | 'leaves' | 'plant';

export function growthStage(progress: number): GrowthStage {
  if (progress >= 0.75) return 'plant';
  if (progress >= 0.5) return 'leaves';
  if (progress >= 0.25) return 'sprout';
  return 'seed';
}

export function milestoneReached(previous: number, next: number): 25 | 50 | 75 | 100 | null {
  const marks = [25, 50, 75, 100] as const;
  for (let i = marks.length - 1; i >= 0; i -= 1) {
    const mark = marks[i];
    if (mark !== undefined && previous < mark / 100 && next >= mark / 100) return mark;
  }
  return null;
}
