/**
 * SEMILLA — Modelo de dominio.
 *
 * Reglas:
 *  - La unidad económica es el HOGAR. Toda entidad lleva `householdId`.
 *  - Todo importe es un entero en CÉNTIMOS (`Cents`). Nunca floats.
 *  - Los importes de movimiento son SIEMPRE positivos; el signo lo da `kind`.
 *  - `Transaction` es una discriminated union por `kind`.
 *  - Estos tipos son los que usa la interfaz. La traducción desde/hacia las filas
 *    de PostgreSQL vive en `src/data/mappers.ts`, en un único sitio.
 */

export type ID = string;
/** Importe entero en céntimos. 87,43 € === 8743 */
export type Cents = number;
/** Fecha civil `YYYY-MM-DD` (Europe/Madrid) */
export type ISODate = string;
/** Instante ISO completo */
export type ISODateTime = string;
/** Mes `YYYY-MM` */
export type MonthKey = string;
/** Semana dentro de un mes: `YYYY-MM-W1` */
export type WeekKey = string;

export interface Entity {
  id: ID;
  householdId: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* ------------------------------------------------------------------ *
 * Identidad y hogar
 * ------------------------------------------------------------------ */

export type MemberRole = 'owner' | 'member';
export type MemberAccent = 'leaf' | 'forest' | 'clay' | 'stone';

export interface Household {
  id: ID;
  name: string;
  createdBy: ID | null;
  locale: string;
  currency: string;
  timeZone: string;
  createdAt: ISODateTime;
}

/** Una persona dentro del hogar. La identidad es su usuario de Supabase. */
export interface Member {
  id: ID;
  householdId: ID;
  userId: ID;
  name: string;
  initials: string;
  role: MemberRole;
  accent: MemberAccent;
  email: string | null;
}

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface HouseholdInvite {
  id: ID;
  householdId: ID;
  email: string;
  role: MemberRole;
  token: string;
  status: InviteStatus;
  createdAt: ISODateTime;
  expiresAt: ISODateTime;
}

/* ------------------------------------------------------------------ *
 * Cuentas y medios de pago
 * ------------------------------------------------------------------ */

export type AccountType = 'main' | 'savings' | 'cash' | 'card' | 'other';

export interface Account extends Entity {
  name: string;
  type: AccountType;
  openingBalance: Cents;
  balanceDate: ISODate;
  countsAsAvailable: boolean;
  position: number;
  archived: boolean;
}

export type PaymentMethodType = 'account' | 'card' | 'cash' | 'bizum' | 'other';

export interface PaymentMethod extends Entity {
  name: string;
  type: PaymentMethodType;
  accountId: ID | null;
  position: number;
  archived: boolean;
}

/* ------------------------------------------------------------------ *
 * Categorías, subcategorías, etiquetas, comercios
 * ------------------------------------------------------------------ */

export interface Subcategory {
  id: ID;
  householdId: ID;
  categoryId: ID;
  name: string;
  position: number;
  archived: boolean;
}

/** §53 — qué se protege y qué es flexible cuando la semana se desvía. */
export type CategoryPriority = 'protected' | 'flexible';

export interface Category extends Entity {
  name: string;
  emoji: string;
  tone: number;
  priority: CategoryPriority;
  quick: boolean;
  position: number;
  archived: boolean;
  subcategories: Subcategory[];
}

export interface Tag extends Entity {
  name: string;
  archived: boolean;
}

export interface Merchant extends Entity {
  name: string;
  normalized: string;
  defaultCategoryId: ID | null;
  defaultSubcategoryId: ID | null;
  uses: number;
  lastUsedAt: ISODateTime;
}

export interface IncomeSource extends Entity {
  name: string;
  ownerUserId: ID | null;
  expectedAmount: Cents | null;
  recurring: boolean;
  position: number;
  archived: boolean;
}

/* ------------------------------------------------------------------ *
 * Movimientos — discriminated union
 * ------------------------------------------------------------------ */

export type TransactionKind = 'income' | 'expense' | 'saving' | 'debtPayment' | 'transfer';

export interface TransactionBase extends Entity {
  /** Siempre positivo, en céntimos. */
  amount: Cents;
  date: ISODate;
  description: string;
  note: string;
  accountId: ID | null;
  paymentMethodId: ID | null;
  /** A quién corresponde el movimiento (§11). */
  ownerUserId: ID | null;
  /** Quién lo registró (§10). */
  createdByUserId: ID | null;
  updatedByUserId: ID | null;
  /** Previsto que lo origina (§62). */
  plannedId: ID | null;
  tagIds: ID[];
}

export interface IncomeTransaction extends TransactionBase {
  kind: 'income';
  sourceId: ID;
  recurrence: 'recurring' | 'extraordinary';
  expectedAmount: Cents | null;
}

export type Necessity = 'necessary' | 'discretionary';
export type Frequency = 'ordinary' | 'extraordinary';

export interface ExpenseTransaction extends TransactionBase {
  kind: 'expense';
  categoryId: ID;
  subcategoryId: ID | null;
  merchantId: ID | null;
  necessity: Necessity;
  frequency: Frequency;
  expectedAmount: Cents | null;
}

export interface SavingTransaction extends TransactionBase {
  kind: 'saving';
  pocketId: ID;
  direction: 'in' | 'out';
}

export interface DebtPaymentTransaction extends TransactionBase {
  kind: 'debtPayment';
  debtId: ID;
  /** §32 — cuota ordinaria vs amortización extraordinaria. */
  paymentType: 'installment' | 'extra';
}

export interface InternalTransferTransaction extends TransactionBase {
  kind: 'transfer';
  fromAccountId: ID;
  toAccountId: ID;
}

export type Transaction =
  | IncomeTransaction
  | ExpenseTransaction
  | SavingTransaction
  | DebtPaymentTransaction
  | InternalTransferTransaction;

/* ------------------------------------------------------------------ *
 * Presupuestos
 * ------------------------------------------------------------------ */

export interface CategoryLimit {
  id: ID;
  categoryId: ID;
  amount: Cents;
}

export interface MonthlyBudget extends Entity {
  month: MonthKey;
  planned: Cents;
  categoryLimits: CategoryLimit[];
}

/** §52 — cada semana lleva su presupuesto, incluidas las parciales. */
export interface WeeklyBudget extends Entity {
  month: MonthKey;
  weekIndex: number;
  planned: Cents;
  categoryLimits: CategoryLimit[];
}

/* ------------------------------------------------------------------ *
 * Previstos / recurrentes / gastos fijos
 * ------------------------------------------------------------------ */

export type PlannedKind = 'expense' | 'income' | 'debtPayment';
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'yearly' | 'custom';

export interface PlannedItem extends Entity {
  name: string;
  kind: PlannedKind;
  expectedAmount: Cents;
  frequency: RecurrenceFrequency;
  dayOfMonth: number;
  months: number[] | null;
  categoryId: ID | null;
  subcategoryId: ID | null;
  sourceId: ID | null;
  debtId: ID | null;
  accountId: ID | null;
  ownerUserId: ID | null;
  extraordinary: boolean;
  installments: number | null;
  active: boolean;
  notes: string;
}

export type PlannedStatus = 'pending' | 'paid' | 'partial' | 'overdue';

/** Derivado, no se persiste: un previsto proyectado sobre un mes. */
export interface PlannedOccurrence {
  planned: PlannedItem;
  month: MonthKey;
  dueDate: ISODate;
  expectedAmount: Cents;
  actualAmount: Cents;
  status: PlannedStatus;
  transactionIds: ID[];
  paidDate: ISODate | null;
}

/* ------------------------------------------------------------------ *
 * Huchas y deuda
 * ------------------------------------------------------------------ */

/** §27 — A) ahorro real  B) dinero reservado para un gasto futuro. */
export type PocketType = 'savings' | 'reserved';

export interface SavingsPocket extends Entity {
  name: string;
  emoji: string;
  type: PocketType;
  targetAmount: Cents | null;
  targetDate: ISODate | null;
  openingBalance: Cents;
  accountId: ID | null;
  position: number;
  archived: boolean;
}

export type DebtType = 'mortgage' | 'loan' | 'card' | 'vehicle' | 'other';

export interface Debt extends Entity {
  name: string;
  type: DebtType;
  initialBalance: Cents;
  balanceAtStart: Cents;
  trackingStart: ISODate;
  installment: Cents;
  /** TIN en puntos básicos: 3,15 % === 315 */
  interestBps: number;
  startDate: ISODate | null;
  endDate: ISODate | null;
  priority: number;
  notes: string;
  archived: boolean;
}

/* ------------------------------------------------------------------ *
 * Objetivos, logros, cierres
 * ------------------------------------------------------------------ */

export interface FinancialGoal extends Entity {
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  savingsTarget: Cents;
  extraDebtTarget: Cents;
  greenWeeksTarget: number;
  active: boolean;
}

export type AchievementId =
  | 'first-seed'
  | 'green-week'
  | 'streak-3'
  | 'first-pocket'
  | 'first-cushion'
  | 'strong-roots'
  | 'full-pocket'
  | 'first-strike'
  | 'strike-1k'
  | 'debt-10k'
  | 'round-month'
  | 'first-quarter'
  | 'consistency-10';

export interface AchievementContext {
  savingsTotal: Cents;
  emergencyFundTotal: Cents;
  extraDebtTotal: Cents;
  debtReduced: Cents;
  greenWeeks: number;
  currentStreak: number;
  greenMonths: number;
  closedMonths: number;
  weeksWithActivity: number;
  incomeCount: number;
  biggestExtraPayment: Cents;
  pocketsCompleted: number;
  pocketsCount: number;
}

export interface AchievementDefinition {
  id: AchievementId;
  emoji: string;
  title: string;
  description: string;
  measure: (ctx: AchievementContext) => { progress: number; detail: string };
}

export interface UnlockedAchievement {
  id: AchievementId;
  unlockedAt: ISODateTime;
}

export type MarginAllocationType = 'save' | 'debt' | 'keep' | 'split';

export interface MarginAllocation {
  type: MarginAllocationType;
  savingCents: Cents;
  debtCents: Cents;
  pocketId: ID | null;
  debtId: ID | null;
}

export interface WeeklyClose extends Entity {
  month: MonthKey;
  weekIndex: number;
  start: ISODate;
  end: ISODate;
  planned: Cents;
  spent: Cents;
  margin: Cents;
  green: boolean;
  allocation: MarginAllocation | null;
  closedBy: ID | null;
  closedAt: ISODateTime;
}

export interface MonthlyClose extends Entity {
  month: MonthKey;
  income: Cents;
  ordinaryExpenses: Cents;
  extraordinaryExpenses: Cents;
  saved: Cents;
  debtPaid: Cents;
  extraDebtPaid: Cents;
  result: Cents;
  netWorthDelta: Cents;
  narrative: string[];
  closedBy: ID | null;
  closedAt: ISODateTime;
  reopenedAt: ISODateTime | null;
}

/* ------------------------------------------------------------------ *
 * Accesos rápidos, avisos, ajustes
 * ------------------------------------------------------------------ */

export interface QuickAction extends Entity {
  label: string;
  emoji: string;
  kind: TransactionKind;
  amount: Cents | null;
  categoryId: ID | null;
  subcategoryId: ID | null;
  merchantId: ID | null;
  pocketId: ID | null;
  debtId: ID | null;
  position: number;
}

export type NotificationKind =
  | 'upcoming-payment'
  | 'week-limit'
  | 'goal-reached'
  | 'week-close-pending'
  | 'month-close-pending'
  | 'expected-income-missing'
  | 'backup-reminder';

export type NotificationTone = 'info' | 'attention' | 'celebrate';

export interface AppNotification {
  id: ID;
  kind: NotificationKind;
  tone: NotificationTone;
  title: string;
  body: string;
  target: string | null;
  date: ISODate;
}

export interface HouseholdSettings {
  householdId: ID;
  onboarded: boolean;
  demoDataLoaded: boolean;
  lastBackupAt: ISODateTime | null;
}

export interface UserPreferences {
  userId: ID;
  currentHouseholdId: ID | null;
  reduceMotion: boolean;
  haptics: boolean;
}

/* ------------------------------------------------------------------ *
 * Snapshot completo del hogar en memoria
 * ------------------------------------------------------------------ */

export interface HouseholdData {
  household: Household;
  settings: HouseholdSettings;
  members: Member[];
  accounts: Account[];
  paymentMethods: PaymentMethod[];
  categories: Category[];
  tags: Tag[];
  merchants: Merchant[];
  incomeSources: IncomeSource[];
  transactions: Transaction[];
  monthlyBudgets: MonthlyBudget[];
  weeklyBudgets: WeeklyBudget[];
  plannedItems: PlannedItem[];
  pockets: SavingsPocket[];
  debts: Debt[];
  goals: FinancialGoal[];
  achievements: UnlockedAchievement[];
  weeklyCloses: WeeklyClose[];
  monthlyCloses: MonthlyClose[];
  quickActions: QuickAction[];
  invites: HouseholdInvite[];
}

/* ------------------------------------------------------------------ *
 * Type guards
 * ------------------------------------------------------------------ */

export const isIncome = (t: Transaction): t is IncomeTransaction => t.kind === 'income';
export const isExpense = (t: Transaction): t is ExpenseTransaction => t.kind === 'expense';
export const isSaving = (t: Transaction): t is SavingTransaction => t.kind === 'saving';
export const isDebtPayment = (t: Transaction): t is DebtPaymentTransaction => t.kind === 'debtPayment';
export const isTransfer = (t: Transaction): t is InternalTransferTransaction => t.kind === 'transfer';

/** Estado semáforo (§93) — nunca rojo por una desviación mínima. */
export type HealthStatus = 'green' | 'amber' | 'red' | 'neutral';

/** Estado de sincronización de un movimiento optimista (§24). */
export type SyncState = 'synced' | 'pending' | 'error';
