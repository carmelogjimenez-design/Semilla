import type {
  AchievementContext,
  Account,
  Category,
  Cents,
  Debt,
  HealthStatus,
  HouseholdData,
  ID,
  ISODate,
  Member,
  MonthKey,
  MonthlyBudget,
  PlannedOccurrence,
  SavingsPocket,
  Transaction,
  WeeklyClose,
} from './types';
import { isExpense, isSaving } from './types';
import { addMoney, sumBy } from './money';
import {
  addMonths,
  getMonthWeeks,
  monthKeyOf,
  weekProgress,
  type WeekSpan,
} from './dates';
import {
  budgetStatus,
  buildMonthWeeks,
  buildPlannedOccurrences,
  calculateAccountsTotal,
  calculateDebtReducedSinceStart,
  calculateDebtReducedTotal,
  calculateDebtTotal,
  calculateExtraDebtPayments,
  calculateFreeMoney,
  calculateInstallmentPayments,
  calculateMonthlyExpenses,
  calculateMonthlyIncome,
  calculateNecessaryVsDiscretionary,
  calculateNetWorth,
  calculateOrdinaryVsExtraordinary,
  calculateProjectedMonthEnd,
  calculateReservedMoney,
  calculateSavingsTotal,
  dailyPace,
  expensesByCategory,
  inMonth,
  pendingPlannedTotal,
  pocketBalance,
  upcomingNeed,
  type FreeMoneyBreakdown,
  type MonthProjection,
  type WeekResult,
} from './calculations';
import { buildInsights, type Insight } from './insights';

/**
 * Traduce el snapshot del hogar en las cifras que pinta la interfaz.
 * Nada de esto se guarda: todo se deriva de los movimientos (§26, §54, §76).
 */

export interface MonthSummary {
  month: MonthKey;
  income: Cents;
  expectedIncome: Cents;
  expenses: Cents;
  ordinary: Cents;
  extraordinary: Cents;
  necessary: Cents;
  discretionary: Cents;
  saved: Cents;
  withdrawn: Cents;
  installments: Cents;
  extraDebt: Cents;
  pending: Cents;
  budget: Cents;
  usedRatio: number;
  status: HealthStatus;
  result: Cents;
}

export interface CategorySpend {
  category: Category;
  amount: Cents;
  limit: Cents | null;
  ratio: number;
  status: HealthStatus;
  count: number;
}

export interface SemillaView {
  today: ISODate;
  month: MonthKey;
  previousMonth: MonthKey;
  weeks: WeekResult[];
  currentWeek: WeekResult | null;
  currentWeekSpan: WeekSpan | null;
  daysLeftInWeek: number;
  pacePerDay: Cents;
  monthSummary: MonthSummary;
  monthCategories: CategorySpend[];
  weekCategories: CategorySpend[];
  freeMoney: FreeMoneyBreakdown;
  occurrences: PlannedOccurrence[];
  upcoming: { total: Cents; items: PlannedOccurrence[] };
  savingsTotal: Cents;
  reservedTotal: Cents;
  debtTotal: Cents;
  debtReducedTotal: Cents;
  debtReducedSinceStart: Cents;
  extraDebtTotal: Cents;
  netWorth: ReturnType<typeof calculateNetWorth>;
  projection: MonthProjection;
  greenWeeks: number;
  currentStreak: number;
  achievementContext: AchievementContext;
  insights: Insight[];
  marginGenerated: Cents;
}

/* --- Índices auxiliares -------------------------------------------------- */

export function indexById<T extends { id: ID }>(items: readonly T[]): Map<ID, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export function memberByUserId(members: readonly Member[]): Map<ID, Member> {
  return new Map(members.map((m) => [m.userId, m]));
}

export function findMonthlyBudget(data: HouseholdData, month: MonthKey): MonthlyBudget | undefined {
  return data.monthlyBudgets.find((b) => b.month === month);
}

/* --- Semanas y rachas ---------------------------------------------------- */

function orderCloses(closes: readonly WeeklyClose[]): WeeklyClose[] {
  return [...closes].sort((a, b) =>
    a.month === b.month ? a.weekIndex - b.weekIndex : a.month.localeCompare(b.month),
  );
}

export function greenWeekCount(closes: readonly WeeklyClose[]): number {
  return closes.filter((c) => c.green).length;
}

/** §38 — la racha se rompe sin culpa: se cuenta desde el final hacia atrás. */
export function currentStreak(closes: readonly WeeklyClose[]): number {
  const ordered = orderCloses(closes);
  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i]?.green) streak += 1;
    else break;
  }
  return streak;
}

function weeksWithActivity(transactions: readonly Transaction[]): number {
  const keys = new Set<string>();
  for (const t of transactions) {
    const weeks = getMonthWeeks(monthKeyOf(t.date));
    const week = weeks.find((w) => t.date >= w.start && t.date <= w.end);
    if (week) keys.add(week.key);
  }
  return keys.size;
}

/* --- Gasto por categoría ------------------------------------------------- */

export function buildCategorySpend(input: {
  categories: readonly Category[];
  transactions: readonly Transaction[];
  limits: ReadonlyMap<ID, Cents>;
  elapsedRatio: number;
}): CategorySpend[] {
  const totals = expensesByCategory(input.transactions);
  const counts = new Map<ID, number>();
  for (const t of input.transactions) {
    if (!isExpense(t)) continue;
    counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
  }

  return input.categories
    .map<CategorySpend>((category) => {
      const amount = totals.get(category.id) ?? 0;
      const limit = input.limits.get(category.id) ?? null;
      return {
        category,
        amount,
        limit,
        ratio: limit ? amount / limit : 0,
        status: limit ? budgetStatus(amount, limit, input.elapsedRatio) : 'neutral',
        count: counts.get(category.id) ?? 0,
      };
    })
    .filter((entry) => entry.amount > 0 || entry.limit !== null)
    .sort((a, b) => b.amount - a.amount);
}

/* --- Vista principal ----------------------------------------------------- */

export function buildView(data: HouseholdData, today: ISODate, month: MonthKey): SemillaView {
  const previousMonth = addMonths(month, -1);
  const transactions = data.transactions;
  const monthTx = inMonth(transactions, month);

  const monthlyBudget = findMonthlyBudget(data, month);
  const budget = monthlyBudget?.planned ?? 0;

  const weeks = buildMonthWeeks({
    month,
    weeklyBudgets: data.weeklyBudgets,
    monthlyBudget,
    transactions,
    today,
  });

  const currentWeek =
    weeks.find((w) => today >= w.week.start && today <= w.week.end) ?? weeks[weeks.length - 1] ?? null;
  const currentWeekSpan = currentWeek?.week ?? null;
  const progress = currentWeekSpan ? weekProgress(currentWeekSpan, today) : { elapsed: 0, remaining: 0 };
  const daysLeftInWeek = Math.max(0, progress.remaining);

  const occurrences = buildPlannedOccurrences(data.plannedItems, transactions, month, today);
  const freeMoney = calculateFreeMoney({
    accounts: data.accounts,
    pockets: data.pockets,
    transactions,
    occurrences,
    today,
  });

  const income = calculateMonthlyIncome(transactions, month);
  const expectedIncome = sumBy(
    data.incomeSources.filter((s) => s.recurring && s.expectedAmount),
    (s) => s.expectedAmount ?? 0,
  );
  const expenses = calculateMonthlyExpenses(transactions, month);
  const { ordinary, extraordinary } = calculateOrdinaryVsExtraordinary(monthTx);
  const { necessary, discretionary } = calculateNecessaryVsDiscretionary(monthTx);
  const savedIn = sumBy(
    monthTx.filter((t) => isSaving(t) && t.direction === 'in'),
    (t) => t.amount,
  );
  const savedOut = sumBy(
    monthTx.filter((t) => isSaving(t) && t.direction === 'out'),
    (t) => t.amount,
  );
  const installments = calculateInstallmentPayments(monthTx);
  const extraDebt = calculateExtraDebtPayments(monthTx);
  const pending = pendingPlannedTotal(occurrences);

  const monthElapsed = weeks.reduce((acc, w) => acc + (today > w.week.end ? w.week.days : 0), 0);
  const monthDays = weeks.reduce((acc, w) => acc + w.week.days, 0);
  const elapsedRatio = Math.min(1, (monthElapsed + progress.elapsed) / Math.max(1, monthDays));

  const monthSummary: MonthSummary = {
    month,
    income,
    expectedIncome,
    expenses,
    ordinary,
    extraordinary,
    necessary,
    discretionary,
    saved: savedIn,
    withdrawn: savedOut,
    installments,
    extraDebt,
    pending,
    budget,
    usedRatio: budget ? expenses / budget : 0,
    status: budgetStatus(expenses, budget, elapsedRatio),
    result: income - expenses - installments - extraDebt,
  };

  const monthLimits = new Map<ID, Cents>(
    (monthlyBudget?.categoryLimits ?? []).map((l) => [l.categoryId, l.amount]),
  );
  const weekBudgetRow = currentWeekSpan
    ? data.weeklyBudgets.find((b) => b.month === month && b.weekIndex === currentWeekSpan.index)
    : undefined;
  const weekLimits = new Map<ID, Cents>(
    (weekBudgetRow?.categoryLimits ?? []).map((l) => [l.categoryId, l.amount]),
  );

  const monthCategories = buildCategorySpend({
    categories: data.categories,
    transactions: monthTx,
    limits: monthLimits,
    elapsedRatio,
  });

  const weekTx = currentWeekSpan
    ? transactions.filter((t) => t.date >= currentWeekSpan.start && t.date <= currentWeekSpan.end)
    : [];
  const weekCategories = buildCategorySpend({
    categories: data.categories,
    transactions: weekTx,
    limits: weekLimits,
    elapsedRatio: currentWeekSpan ? progress.elapsed / currentWeekSpan.days : 0,
  });

  const savingsTotal = calculateSavingsTotal(data.pockets, transactions);
  const reservedTotal = calculateReservedMoney(data.pockets, transactions);
  const debtTotal = calculateDebtTotal(data.debts, transactions);
  const debtReducedTotal = calculateDebtReducedTotal(data.debts, transactions);
  const debtReducedSinceStart = calculateDebtReducedSinceStart(data.debts, transactions);
  const extraDebtTotal = calculateExtraDebtPayments(transactions);

  const emergency = data.pockets.find((p) => p.type === 'savings');
  const pocketsCompleted = data.pockets.filter(
    (p) => p.targetAmount && pocketBalance(p, transactions) >= p.targetAmount,
  ).length;

  const closes = data.weeklyCloses;
  const green = greenWeekCount(closes);
  const streak = currentStreak(closes);
  const marginGenerated = sumBy(
    closes.filter((c) => c.margin > 0),
    (c) => c.margin,
  );

  const achievementContext: AchievementContext = {
    savingsTotal,
    emergencyFundTotal: emergency ? pocketBalance(emergency, transactions) : 0,
    extraDebtTotal,
    debtReduced: debtReducedSinceStart,
    greenWeeks: green,
    currentStreak: streak,
    greenMonths: data.monthlyCloses.filter((c) => c.result >= 0).length,
    closedMonths: data.monthlyCloses.filter((c) => c.reopenedAt === null).length,
    weeksWithActivity: weeksWithActivity(transactions),
    incomeCount: transactions.filter((t) => t.kind === 'income').length,
    biggestExtraPayment: transactions.reduce(
      (max, t) => (t.kind === 'debtPayment' && t.paymentType === 'extra' ? Math.max(max, t.amount) : max),
      0,
    ),
    pocketsCompleted,
    pocketsCount: data.pockets.length,
  };

  return {
    today,
    month,
    previousMonth,
    weeks,
    currentWeek,
    currentWeekSpan,
    daysLeftInWeek,
    pacePerDay: currentWeek ? dailyPace(currentWeek.available, Math.max(1, daysLeftInWeek)) : 0,
    monthSummary,
    monthCategories,
    weekCategories,
    freeMoney,
    occurrences,
    upcoming: upcomingNeed(occurrences, today, 14),
    savingsTotal,
    reservedTotal,
    debtTotal,
    debtReducedTotal,
    debtReducedSinceStart,
    extraDebtTotal,
    netWorth: calculateNetWorth({
      accounts: data.accounts,
      pockets: data.pockets,
      debts: data.debts,
      transactions,
      today,
    }),
    projection: calculateProjectedMonthEnd({ transactions, month, today, budget, occurrences }),
    greenWeeks: green,
    currentStreak: streak,
    achievementContext,
    insights: buildInsights({
      transactions,
      previousTransactions: transactions,
      categories: data.categories,
      month,
      previousMonth,
      occurrences,
    }),
    marginGenerated,
  };
}

/* --- Utilidades para pantallas ------------------------------------------- */

export function accountBalances(
  accounts: readonly Account[],
  transactions: readonly Transaction[],
  today: ISODate,
): { account: Account; balance: Cents }[] {
  return accounts.map((account) => ({
    account,
    balance: calculateAccountsTotal([account], transactions, today, false),
  }));
}

export function pocketsWithBalance(
  pockets: readonly SavingsPocket[],
  transactions: readonly Transaction[],
): { pocket: SavingsPocket; balance: Cents; ratio: number }[] {
  return pockets.map((pocket) => {
    const balance = pocketBalance(pocket, transactions);
    return {
      pocket,
      balance,
      ratio: pocket.targetAmount ? Math.min(1, balance / pocket.targetAmount) : 0,
    };
  });
}

export function debtsWithBalance(
  debts: readonly Debt[],
  transactions: readonly Transaction[],
): { debt: Debt; balance: Cents; paid: Cents; ratio: number }[] {
  return debts.map((debt) => {
    const balance = Math.max(0, debt.balanceAtStart - sumBy(
      transactions.filter((t) => t.kind === 'debtPayment' && t.debtId === debt.id && t.date >= debt.trackingStart),
      (t) => t.amount,
    ));
    const paid = debt.initialBalance - balance;
    return {
      debt,
      balance,
      paid,
      ratio: debt.initialBalance ? Math.min(1, paid / debt.initialBalance) : 0,
    };
  });
}

/** Suma de saldos, útil para la tarjeta de patrimonio. */
export function totalOf(values: readonly Cents[]): Cents {
  return addMoney(...values);
}
