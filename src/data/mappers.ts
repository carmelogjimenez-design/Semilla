import type {
  AccountRow,
  BudgetCategoryRow,
  CategoryRow,
  DebtRow,
  GoalRow,
  HouseholdAchievementRow,
  HouseholdInviteRow,
  HouseholdMemberRow,
  HouseholdRow,
  IncomeSourceRow,
  MerchantRow,
  MonthlyBudgetRow,
  MonthlyCloseRow,
  PaymentMethodRow,
  ProfileRow,
  QuickActionRow,
  RecurringTransactionRow,
  SavingsPocketRow,
  SubcategoryRow,
  TagRow,
  TransactionRow,
  TransactionTypeDb,
  WeeklyBudgetRow,
  WeeklyCloseRow,
} from '@/lib/supabase/database.types';
import type {
  Account,
  AchievementId,
  Category,
  Debt,
  FinancialGoal,
  Household,
  HouseholdInvite,
  MarginAllocation,
  Member,
  MemberAccent,
  Merchant,
  MonthlyBudget,
  MonthlyClose,
  PaymentMethod,
  PlannedItem,
  QuickAction,
  SavingsPocket,
  IncomeSource,
  Subcategory,
  Tag,
  Transaction,
  TransactionKind,
  UnlockedAchievement,
  WeeklyBudget,
  WeeklyClose,
} from '@/domain/types';

/**
 * Traducción entre las filas de PostgreSQL (snake_case) y el modelo de dominio
 * (camelCase, discriminated unions). Un único sitio: si cambia el esquema,
 * cambia aquí y el compilador señala el resto.
 */

const ACCENTS: MemberAccent[] = ['leaf', 'forest', 'clay', 'stone'];

function toAccent(value: string): MemberAccent {
  return (ACCENTS as string[]).includes(value) ? (value as MemberAccent) : 'leaf';
}

export function initialsOf(name: string): string {
  const clean = name.trim();
  if (!clean) return '·';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 1).toUpperCase();
  return `${(parts[0] ?? '').slice(0, 1)}${(parts[1] ?? '').slice(0, 1)}`.toUpperCase();
}

export const KIND_TO_DB: Record<TransactionKind, TransactionTypeDb> = {
  income: 'income',
  expense: 'expense',
  saving: 'saving',
  debtPayment: 'debt_payment',
  transfer: 'internal_transfer',
};

export const DB_TO_KIND: Record<TransactionTypeDb, TransactionKind> = {
  income: 'income',
  expense: 'expense',
  saving: 'saving',
  debt_payment: 'debtPayment',
  internal_transfer: 'transfer',
};

/* --- Hogar e identidad --------------------------------------------------- */

export function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    locale: row.locale,
    currency: row.currency,
    timeZone: row.time_zone,
    createdAt: row.created_at,
  };
}

export function toMember(row: HouseholdMemberRow, profile?: ProfileRow): Member {
  const name = row.display_name || profile?.display_name || 'Miembro';
  return {
    id: row.id,
    householdId: row.household_id,
    userId: row.user_id,
    name,
    initials: initialsOf(name),
    role: row.role,
    accent: toAccent(row.accent),
    email: profile?.email ?? null,
  };
}

export function toInvite(row: HouseholdInviteRow): HouseholdInvite {
  return {
    id: row.id,
    householdId: row.household_id,
    email: row.email,
    role: row.role,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

/* --- Catálogos ----------------------------------------------------------- */

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    type: row.type,
    openingBalance: Number(row.opening_balance_cents),
    balanceDate: row.balance_date,
    countsAsAvailable: row.counts_as_available,
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    type: row.type,
    accountId: row.account_id,
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSubcategory(row: SubcategoryRow): Subcategory {
  return {
    id: row.id,
    householdId: row.household_id,
    categoryId: row.category_id,
    name: row.name,
    position: row.position,
    archived: row.archived,
  };
}

export function toCategory(row: CategoryRow, subs: SubcategoryRow[]): Category {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    emoji: row.emoji,
    tone: row.tone,
    priority: row.priority,
    quick: row.quick,
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    subcategories: subs
      .filter((s) => s.category_id === row.id && !s.archived)
      .sort((a, b) => a.position - b.position)
      .map(toSubcategory),
  };
}

export function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toMerchant(row: MerchantRow): Merchant {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    normalized: row.normalized,
    defaultCategoryId: row.default_category_id,
    defaultSubcategoryId: row.default_subcategory_id,
    uses: row.uses,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toIncomeSource(row: IncomeSourceRow): IncomeSource {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    ownerUserId: row.owner_user_id,
    expectedAmount: row.expected_amount_cents === null ? null : Number(row.expected_amount_cents),
    recurring: row.recurring,
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPocket(row: SavingsPocketRow): SavingsPocket {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    emoji: row.emoji,
    type: row.type,
    targetAmount: row.target_amount_cents === null ? null : Number(row.target_amount_cents),
    targetDate: row.target_date,
    openingBalance: Number(row.opening_balance_cents),
    accountId: row.account_id,
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDebt(row: DebtRow): Debt {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    type: row.type,
    initialBalance: Number(row.initial_balance_cents),
    balanceAtStart: Number(row.balance_at_start_cents),
    trackingStart: row.tracking_start,
    installment: Number(row.installment_cents),
    interestBps: row.interest_bps,
    startDate: row.start_date,
    endDate: row.end_date,
    priority: row.priority,
    notes: row.notes,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toPlannedItem(row: RecurringTransactionRow): PlannedItem {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    kind: row.kind === 'debt_payment' ? 'debtPayment' : row.kind,
    expectedAmount: Number(row.expected_amount_cents),
    frequency: row.frequency,
    dayOfMonth: row.day_of_month,
    months: row.months,
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    sourceId: row.income_source_id,
    debtId: row.debt_id,
    accountId: row.account_id,
    ownerUserId: row.owner_user_id,
    extraordinary: row.extraordinary,
    installments: row.installments,
    active: row.active,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* --- Movimientos --------------------------------------------------------- */

export function toTransaction(row: TransactionRow, tagIds: string[] = []): Transaction {
  const base = {
    id: row.id,
    householdId: row.household_id,
    amount: Number(row.amount_cents),
    date: row.date,
    description: row.description,
    note: row.note,
    accountId: row.account_id,
    paymentMethodId: row.payment_method_id,
    ownerUserId: row.owner_user_id,
    createdByUserId: row.created_by_user_id,
    updatedByUserId: row.updated_by_user_id,
    plannedId: row.planned_id,
    tagIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  switch (row.type) {
    case 'income':
      return {
        ...base,
        kind: 'income',
        sourceId: row.income_source_id ?? '',
        recurrence: row.income_recurring === false ? 'extraordinary' : 'recurring',
        expectedAmount: row.expected_amount_cents === null ? null : Number(row.expected_amount_cents),
      };
    case 'expense':
      return {
        ...base,
        kind: 'expense',
        categoryId: row.category_id ?? '',
        subcategoryId: row.subcategory_id,
        merchantId: row.merchant_id,
        necessity: row.necessity ?? 'necessary',
        frequency: row.regularity ?? 'ordinary',
        expectedAmount: row.expected_amount_cents === null ? null : Number(row.expected_amount_cents),
      };
    case 'saving':
      return {
        ...base,
        kind: 'saving',
        pocketId: row.pocket_id ?? '',
        direction: row.saving_direction ?? 'in',
      };
    case 'debt_payment':
      return {
        ...base,
        kind: 'debtPayment',
        debtId: row.debt_id ?? '',
        paymentType: row.debt_payment_type ?? 'installment',
      };
    case 'internal_transfer':
      return {
        ...base,
        kind: 'transfer',
        fromAccountId: row.from_account_id ?? '',
        toAccountId: row.to_account_id ?? '',
      };
  }
}

/** Modelo de dominio → fila lista para insertar/actualizar. */
export function fromTransaction(t: Transaction): Partial<TransactionRow> {
  const base: Partial<TransactionRow> = {
    id: t.id,
    household_id: t.householdId,
    type: KIND_TO_DB[t.kind],
    amount_cents: t.amount,
    date: t.date,
    description: t.description,
    note: t.note,
    account_id: t.accountId,
    payment_method_id: t.paymentMethodId,
    owner_user_id: t.ownerUserId,
    planned_id: t.plannedId,
    category_id: null,
    subcategory_id: null,
    merchant_id: null,
    necessity: null,
    regularity: null,
    income_source_id: null,
    income_recurring: null,
    pocket_id: null,
    saving_direction: null,
    debt_id: null,
    debt_payment_type: null,
    from_account_id: null,
    to_account_id: null,
    expected_amount_cents: null,
  };

  switch (t.kind) {
    case 'income':
      return {
        ...base,
        income_source_id: t.sourceId,
        income_recurring: t.recurrence === 'recurring',
        expected_amount_cents: t.expectedAmount,
      };
    case 'expense':
      return {
        ...base,
        category_id: t.categoryId,
        subcategory_id: t.subcategoryId,
        merchant_id: t.merchantId,
        necessity: t.necessity,
        regularity: t.frequency,
        expected_amount_cents: t.expectedAmount,
      };
    case 'saving':
      return { ...base, pocket_id: t.pocketId, saving_direction: t.direction };
    case 'debtPayment':
      return { ...base, debt_id: t.debtId, debt_payment_type: t.paymentType };
    case 'transfer':
      return {
        ...base,
        account_id: null,
        from_account_id: t.fromAccountId,
        to_account_id: t.toAccountId,
      };
  }
}

/* --- Presupuestos -------------------------------------------------------- */

export function toMonthlyBudget(row: MonthlyBudgetRow, limits: BudgetCategoryRow[]): MonthlyBudget {
  return {
    id: row.id,
    householdId: row.household_id,
    month: row.month,
    planned: Number(row.planned_cents),
    categoryLimits: limits
      .filter((l) => l.monthly_budget_id === row.id)
      .map((l) => ({ id: l.id, categoryId: l.category_id, amount: Number(l.amount_cents) })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toWeeklyBudget(row: WeeklyBudgetRow, limits: BudgetCategoryRow[]): WeeklyBudget {
  return {
    id: row.id,
    householdId: row.household_id,
    month: row.month,
    weekIndex: row.week_index,
    planned: Number(row.planned_cents),
    categoryLimits: limits
      .filter((l) => l.weekly_budget_id === row.id)
      .map((l) => ({ id: l.id, categoryId: l.category_id, amount: Number(l.amount_cents) })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* --- Objetivos, logros, cierres ------------------------------------------ */

export function toGoal(row: GoalRow): FinancialGoal {
  return {
    id: row.id,
    householdId: row.household_id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    savingsTarget: Number(row.savings_target_cents),
    extraDebtTarget: Number(row.extra_debt_target_cents),
    greenWeeksTarget: row.green_weeks_target,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toUnlockedAchievement(row: HouseholdAchievementRow): UnlockedAchievement {
  return { id: row.achievement_id as AchievementId, unlockedAt: row.unlocked_at };
}

function parseAllocation(value: unknown): MarginAllocation | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const type = raw.type;
  if (type !== 'save' && type !== 'debt' && type !== 'keep' && type !== 'split') return null;
  return {
    type,
    savingCents: Number(raw.savingCents ?? 0),
    debtCents: Number(raw.debtCents ?? 0),
    pocketId: typeof raw.pocketId === 'string' ? raw.pocketId : null,
    debtId: typeof raw.debtId === 'string' ? raw.debtId : null,
  };
}

export function toWeeklyClose(row: WeeklyCloseRow): WeeklyClose {
  return {
    id: row.id,
    householdId: row.household_id,
    month: row.month,
    weekIndex: row.week_index,
    start: row.start_date,
    end: row.end_date,
    planned: Number(row.planned_cents),
    spent: Number(row.spent_cents),
    margin: Number(row.margin_cents),
    green: row.green,
    allocation: parseAllocation(row.allocation),
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toMonthlyClose(row: MonthlyCloseRow): MonthlyClose {
  const narrative = Array.isArray(row.narrative)
    ? row.narrative.filter((n): n is string => typeof n === 'string')
    : [];
  return {
    id: row.id,
    householdId: row.household_id,
    month: row.month,
    income: Number(row.income_cents),
    ordinaryExpenses: Number(row.ordinary_cents),
    extraordinaryExpenses: Number(row.extraordinary_cents),
    saved: Number(row.saved_cents),
    debtPaid: Number(row.debt_paid_cents),
    extraDebtPaid: Number(row.extra_debt_cents),
    result: Number(row.result_cents),
    netWorthDelta: Number(row.net_worth_delta_cents),
    narrative,
    closedBy: row.closed_by,
    closedAt: row.closed_at,
    reopenedAt: row.reopened_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toQuickAction(row: QuickActionRow): QuickAction {
  return {
    id: row.id,
    householdId: row.household_id,
    label: row.label,
    emoji: row.emoji,
    kind: DB_TO_KIND[row.kind],
    amount: row.amount_cents === null ? null : Number(row.amount_cents),
    categoryId: row.category_id,
    subcategoryId: row.subcategory_id,
    merchantId: row.merchant_id,
    pocketId: row.pocket_id,
    debtId: row.debt_id,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
