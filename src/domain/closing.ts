import type {
  Category,
  Cents,
  HouseholdData,
  ID,
  ISODate,
  MarginAllocation,
  MonthKey,
  MonthlyClose,
  Transaction,
  WeeklyClose,
} from './types';
import { isSaving } from './types';
import { formatCurrency, sumBy } from './money';
import { addMonths, lastDayOfMonth, monthKeyOf, monthLabel, type WeekSpan } from './dates';
import {
  calculateExtraDebtPayments,
  calculateInstallmentPayments,
  calculateMonthlyExpenses,
  calculateMonthlyIncome,
  calculateOrdinaryVsExtraordinary,
  expensesByCategory,
  inMonth,
  type WeekResult,
} from './calculations';
import { buildMonthlySeries } from './progress';

/**
 * CIERRE Y RITMO (§30, §31, §32, §60, §101).
 *
 * Cerrar no es un trámite administrativo: es el momento en que la semana o el mes
 * dejan de estar abiertos y se decide qué hacer con lo que sobró. Por eso todo lo
 * de aquí calcula un BORRADOR que la persona confirma, nunca algo que ocurra solo.
 *
 * Ninguna frase de las que se generan aquí juzga. Se dice lo que pasó, con el
 * contexto que lo explica, y nada más.
 */

/* ------------------------------------------------------------------ *
 * Cierre de semana (§30)
 * ------------------------------------------------------------------ */

export interface WeekCloseDraft {
  week: WeekSpan;
  month: MonthKey;
  planned: Cents;
  spent: Cents;
  /** Lo que sobró. Negativo si se gastó de más. */
  margin: Cents;
  /** Verde = se cerró dentro de lo previsto. Sin presupuesto no hay verde ni rojo. */
  green: boolean;
  closed: WeeklyClose | null;
}

/**
 * Semanas del mes que ya han terminado, con su borrador de cierre.
 *
 * Una semana sólo se puede cerrar cuando ha pasado su último día: cerrarla antes
 * sería inventar un resultado con movimientos aún por registrar.
 */
export function weekCloseDrafts(input: {
  weeks: readonly WeekResult[];
  month: MonthKey;
  closes: readonly WeeklyClose[];
  today: ISODate;
}): WeekCloseDraft[] {
  const { weeks, month, closes, today } = input;
  return weeks
    .filter((entry) => entry.week.end < today)
    .map((entry) => ({
      week: entry.week,
      month,
      planned: entry.planned,
      spent: entry.spent,
      margin: entry.planned - entry.spent,
      green: entry.planned > 0 && entry.spent <= entry.planned,
      closed:
        closes.find((close) => close.month === month && close.weekIndex === entry.week.index) ?? null,
    }));
}

/** La primera semana terminada que sigue sin cerrar, si la hay. */
export function nextWeekToClose(drafts: readonly WeekCloseDraft[]): WeekCloseDraft | null {
  return drafts.find((draft) => draft.closed === null) ?? null;
}

export function buildWeeklyClose(input: {
  draft: WeekCloseDraft;
  householdId: ID;
  userId: ID;
  allocation: MarginAllocation | null;
  now: string;
  id: ID;
}): WeeklyClose {
  const { draft, householdId, userId, allocation, now, id } = input;
  return {
    id,
    householdId,
    month: draft.month,
    weekIndex: draft.week.index,
    start: draft.week.start,
    end: draft.week.end,
    planned: draft.planned,
    spent: draft.spent,
    margin: draft.margin,
    green: draft.green,
    allocation,
    closedBy: userId,
    closedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Reparto del margen (§31). Devuelve los movimientos que hay que crear.
 *
 * Van con fecha del último día de la semana, no de hoy: el dinero lo generó esa
 * semana, y así el mes al que pertenece es el correcto aunque se cierre tarde.
 * Guardar en una hucha no mueve el saldo de la cuenta —es una etiqueta—, así que
 * repartir el margen nunca descuadra las cuentas.
 */
export function allocationTransactions(input: {
  allocation: MarginAllocation;
  draft: WeekCloseDraft;
  householdId: ID;
  userId: ID;
  accountId: ID | null;
  now: string;
  ids: readonly ID[];
}): Transaction[] {
  const { allocation, draft, householdId, userId, accountId, now, ids } = input;
  const created: Transaction[] = [];
  const base = {
    householdId,
    date: draft.week.end,
    note: '',
    accountId,
    paymentMethodId: null,
    ownerUserId: userId,
    createdByUserId: userId,
    updatedByUserId: null,
    plannedId: null,
    tagIds: [] as ID[],
    createdAt: now,
    updatedAt: now,
  };

  if (allocation.savingCents > 0 && allocation.pocketId) {
    created.push({
      ...base,
      id: ids[created.length] ?? '',
      kind: 'saving',
      amount: allocation.savingCents,
      description: `Margen de la semana ${draft.week.index}`,
      pocketId: allocation.pocketId,
      direction: 'in',
    });
  }

  if (allocation.debtCents > 0 && allocation.debtId) {
    created.push({
      ...base,
      id: ids[created.length] ?? '',
      kind: 'debtPayment',
      amount: allocation.debtCents,
      description: `Margen de la semana ${draft.week.index}`,
      debtId: allocation.debtId,
      paymentType: 'extra',
    });
  }

  return created;
}

/* ------------------------------------------------------------------ *
 * Cierre de mes (§32)
 * ------------------------------------------------------------------ */

export interface MonthCloseDraft {
  month: MonthKey;
  income: Cents;
  expenses: Cents;
  ordinaryExpenses: Cents;
  extraordinaryExpenses: Cents;
  /** Ahorro neto del mes: lo guardado menos lo sacado. */
  saved: Cents;
  debtPaid: Cents;
  extraDebtPaid: Cents;
  /** Ingresos menos gastos. Ni las cuotas ni el ahorro restan aquí. */
  result: Cents;
  netWorthDelta: Cents;
  weeksTotal: number;
  greenWeeks: number;
  narrative: string[];
  closed: MonthlyClose | null;
}

/** Un mes sólo se cierra cuando ha terminado. */
export function isMonthClosable(month: MonthKey, today: ISODate): boolean {
  return lastDayOfMonth(month) < today;
}

export function buildMonthCloseDraft(input: {
  data: HouseholdData;
  month: MonthKey;
  categories: readonly Category[];
}): MonthCloseDraft {
  const { data, month, categories } = input;
  const transactions = data.transactions;
  const monthTx = inMonth(transactions, month);

  const income = calculateMonthlyIncome(transactions, month);
  const expenses = calculateMonthlyExpenses(transactions, month);
  const { ordinary, extraordinary } = calculateOrdinaryVsExtraordinary(monthTx);
  const savedIn = sumBy(
    monthTx.filter((t) => isSaving(t) && t.direction === 'in'),
    (t) => t.amount,
  );
  const savedOut = sumBy(
    monthTx.filter((t) => isSaving(t) && t.direction === 'out'),
    (t) => t.amount,
  );
  const extraDebtPaid = calculateExtraDebtPayments(monthTx);
  const debtPaid = calculateInstallmentPayments(monthTx);

  /* El patrimonio se compara con el cierre del mes anterior: dos fotos, no una
     suma de movimientos. Así incluye cualquier cosa que lo mueva. */
  const series = buildMonthlySeries(data, month, 2);
  const netWorthDelta = (series[1]?.netWorth ?? 0) - (series[0]?.netWorth ?? 0);

  const weekCloses = data.weeklyCloses.filter((close) => close.month === month);
  const greenWeeks = weekCloses.filter((close) => close.green).length;

  const draft: Omit<MonthCloseDraft, 'narrative'> = {
    month,
    income,
    expenses,
    ordinaryExpenses: ordinary,
    extraordinaryExpenses: extraordinary,
    saved: savedIn - savedOut,
    debtPaid,
    extraDebtPaid,
    result: income - expenses,
    netWorthDelta,
    weeksTotal: weekCloses.length,
    greenWeeks,
    closed: data.monthlyCloses.find((c) => c.month === month && c.reopenedAt === null) ?? null,
  };

  return {
    ...draft,
    narrative: buildMonthNarrative({
      draft,
      previousExpenses: calculateMonthlyExpenses(transactions, addMonths(month, -1)),
      previousMonth: addMonths(month, -1),
      categories,
      monthTx,
    }),
  };
}

/**
 * El relato del mes (§32, §101): frases deterministas, ninguna generada por IA.
 * Se dice lo que pasó y por qué pasó. Nunca aparece la palabra fracaso, y un mes
 * en negativo se cuenta con el contexto que lo explica, no como una condena.
 */
export function buildMonthNarrative(input: {
  draft: Omit<MonthCloseDraft, 'narrative'>;
  previousExpenses: Cents;
  previousMonth: MonthKey;
  categories: readonly Category[];
  monthTx: readonly Transaction[];
}): string[] {
  const { draft, previousExpenses, previousMonth, categories, monthTx } = input;
  const lines: string[] = [];

  if (draft.income === 0 && draft.expenses === 0) {
    return ['Este mes no tiene movimientos registrados.'];
  }

  lines.push(`Entraron ${euros(draft.income)} y salieron ${euros(draft.expenses)}.`);

  if (draft.result >= 0) {
    lines.push(`Os quedasteis con ${euros(draft.result)} sin gastar.`);
  } else if (draft.extraordinaryExpenses > 0) {
    lines.push(
      `Se fueron ${euros(-draft.result)} más de lo que entró, y ${euros(draft.extraordinaryExpenses)} del mes fueron extraordinarios: no es el gasto de todos los meses.`,
    );
  } else {
    lines.push(`Se fueron ${euros(-draft.result)} más de lo que entró.`);
  }

  if (draft.extraordinaryExpenses > 0 && draft.result >= 0) {
    lines.push(
      `${euros(draft.extraordinaryExpenses)} fueron gastos extraordinarios, aparte del mes normal.`,
    );
  }

  if (draft.saved > 0) lines.push(`Guardasteis ${euros(draft.saved)} en huchas.`);
  else if (draft.saved < 0) lines.push(`Sacasteis ${euros(-draft.saved)} de las huchas.`);

  if (draft.extraDebtPaid > 0) {
    lines.push(`Y amortizasteis ${euros(draft.extraDebtPaid)} de más, por encima de las cuotas.`);
  }

  if (draft.weeksTotal > 0) {
    lines.push(
      `${draft.greenWeeks} de ${draft.weeksTotal} ${draft.weeksTotal === 1 ? 'semana cerró' : 'semanas cerraron'} dentro del presupuesto.`,
    );
  }

  /* La comparación sólo se dice si hay con qué comparar. */
  if (previousExpenses > 0 && draft.expenses > 0) {
    const delta = draft.expenses - previousExpenses;
    const ratio = Math.abs(delta) / previousExpenses;
    if (ratio >= 0.05) {
      lines.push(
        `Se gastó ${euros(Math.abs(delta))} ${delta < 0 ? 'menos' : 'más'} que en ${monthLabel(previousMonth, { capitalize: false })}.`,
      );
    } else {
      lines.push(`El gasto quedó casi igual que en ${monthLabel(previousMonth, { capitalize: false })}.`);
    }
  }

  const byCategory = [...expensesByCategory(monthTx).entries()].sort((a, b) => b[1] - a[1]);
  const top = byCategory[0];
  if (top && draft.expenses > 0) {
    const name = categories.find((c) => c.id === top[0])?.name ?? 'Otros';
    lines.push(`Donde más se fue: ${name.toLowerCase()}, ${euros(top[1])}.`);
  }

  return lines;
}

export function buildMonthlyClose(input: {
  draft: MonthCloseDraft;
  householdId: ID;
  userId: ID;
  now: string;
  id: ID;
}): MonthlyClose {
  const { draft, householdId, userId, now, id } = input;
  return {
    id,
    householdId,
    month: draft.month,
    income: draft.income,
    ordinaryExpenses: draft.ordinaryExpenses,
    extraordinaryExpenses: draft.extraordinaryExpenses,
    saved: draft.saved,
    debtPaid: draft.debtPaid,
    extraDebtPaid: draft.extraDebtPaid,
    result: draft.result,
    netWorthDelta: draft.netWorthDelta,
    narrative: draft.narrative,
    closedBy: userId,
    closedAt: now,
    reopenedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ *
 * Histórico y comparativas (§66)
 * ------------------------------------------------------------------ */

export interface MonthRow {
  month: MonthKey;
  income: Cents;
  expenses: Cents;
  saved: Cents;
  result: Cents;
  closed: MonthlyClose | null;
}

/** Meses con actividad, del más reciente al más antiguo. */
export function historyMonths(data: HouseholdData, upTo: MonthKey, count = 12): MonthKey[] {
  const withActivity = new Set(data.transactions.map((t) => monthKeyOf(t.date)));
  for (const close of data.monthlyCloses) withActivity.add(close.month);

  const months: MonthKey[] = [];
  for (let i = 0; i < count; i += 1) {
    const month = addMonths(upTo, -i);
    if (withActivity.has(month)) months.push(month);
  }
  return months;
}

export function monthRow(data: HouseholdData, month: MonthKey): MonthRow {
  const monthTx = inMonth(data.transactions, month);
  const income = calculateMonthlyIncome(data.transactions, month);
  const expenses = calculateMonthlyExpenses(data.transactions, month);
  const saved =
    sumBy(
      monthTx.filter((t) => isSaving(t) && t.direction === 'in'),
      (t) => t.amount,
    ) -
    sumBy(
      monthTx.filter((t) => isSaving(t) && t.direction === 'out'),
      (t) => t.amount,
    );
  return {
    month,
    income,
    expenses,
    saved,
    result: income - expenses,
    closed: data.monthlyCloses.find((c) => c.month === month && c.reopenedAt === null) ?? null,
  };
}

export interface CategoryChange {
  categoryId: ID;
  name: string;
  emoji: string;
  current: Cents;
  previous: Cents;
  delta: Cents;
}

/**
 * Qué cambió entre dos meses, categoría a categoría.
 *
 * Ordenado por tamaño del cambio, no por importe: lo interesante de comparar no
 * es la categoría más grande, es la que más se ha movido.
 */
export function compareCategories(input: {
  data: HouseholdData;
  month: MonthKey;
  previous: MonthKey;
  limit?: number;
}): CategoryChange[] {
  const { data, month, previous, limit = 5 } = input;
  const current = expensesByCategory(inMonth(data.transactions, month));
  const before = expensesByCategory(inMonth(data.transactions, previous));

  const ids = new Set<ID>([...current.keys(), ...before.keys()]);
  const rows: CategoryChange[] = [];

  for (const id of ids) {
    const category = data.categories.find((c) => c.id === id);
    const a = current.get(id) ?? 0;
    const b = before.get(id) ?? 0;
    if (a === 0 && b === 0) continue;
    rows.push({
      categoryId: id,
      name: category?.name ?? 'Otros',
      emoji: category?.emoji ?? '•',
      current: a,
      previous: b,
      delta: a - b,
    });
  }

  return rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)).slice(0, limit);
}

/** Gasto medio de los meses con actividad, sin contar el mes en curso. */
export function averageExpenses(data: HouseholdData, upTo: MonthKey, count = 3): Cents | null {
  const months = historyMonths(data, addMonths(upTo, -1), count);
  if (months.length === 0) return null;
  const total = months.reduce((sum, month) => sum + calculateMonthlyExpenses(data.transactions, month), 0);
  return Math.round(total / months.length);
}

/** Todas las frases del relato escriben el dinero igual. */
function euros(cents: Cents): string {
  return formatCurrency(cents);
}
