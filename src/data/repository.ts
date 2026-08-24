import type {
  Account,
  Category,
  Debt,
  FinancialGoal,
  HouseholdData,
  HouseholdInvite,
  ID,
  Merchant,
  MonthKey,
  MonthlyClose,
  PaymentMethod,
  PlannedItem,
  QuickAction,
  SavingsPocket,
  IncomeSource,
  Subcategory,
  Tag,
  Transaction,
  WeeklyClose,
  AchievementId,
} from '@/domain/types';

/**
 * Contrato de persistencia (§72 del brief original, §54 del brief de infraestructura).
 *
 * La interfaz existe para que la UI nunca hable con Supabase directamente:
 *   · `SupabaseRepository` es la implementación real y la fuente de verdad.
 *   · `MemoryRepository` sólo se usa en el modo previsualización de desarrollo.
 */
export interface SemillaRepository {
  load(householdId: ID): Promise<HouseholdData>;

  createTransaction(transaction: Transaction): Promise<Transaction>;
  updateTransaction(transaction: Transaction): Promise<Transaction>;
  deleteTransaction(id: ID): Promise<void>;

  saveAccount(account: Account): Promise<Account>;
  deleteAccount(id: ID): Promise<void>;

  savePaymentMethod(method: PaymentMethod): Promise<void>;

  saveCategory(category: Omit<Category, 'subcategories'>): Promise<void>;
  deleteCategory(id: ID): Promise<void>;
  saveSubcategory(subcategory: Subcategory): Promise<void>;
  deleteSubcategory(id: ID): Promise<void>;

  saveTag(tag: Tag): Promise<void>;
  deleteTag(id: ID): Promise<void>;

  saveIncomeSource(source: IncomeSource): Promise<void>;
  deleteIncomeSource(id: ID): Promise<void>;

  savePocket(pocket: SavingsPocket): Promise<void>;
  deletePocket(id: ID): Promise<void>;

  saveDebt(debt: Debt): Promise<void>;
  deleteDebt(id: ID): Promise<void>;

  savePlannedItem(item: PlannedItem): Promise<void>;
  deletePlannedItem(id: ID): Promise<void>;

  saveMonthlyBudget(householdId: ID, month: MonthKey, planned: number): Promise<void>;
  saveWeeklyBudget(householdId: ID, month: MonthKey, weekIndex: number, planned: number): Promise<void>;
  saveCategoryLimit(input: {
    householdId: ID;
    month: MonthKey;
    weekIndex: number | null;
    categoryId: ID;
    amount: number;
  }): Promise<void>;

  saveGoal(goal: FinancialGoal): Promise<void>;
  deleteGoal(id: ID): Promise<void>;

  saveWeeklyClose(close: WeeklyClose): Promise<void>;
  deleteWeeklyClose(id: ID): Promise<void>;
  saveMonthlyClose(close: MonthlyClose): Promise<void>;
  reopenMonth(id: ID): Promise<void>;

  unlockAchievements(householdId: ID, ids: AchievementId[]): Promise<void>;

  saveQuickAction(action: QuickAction): Promise<void>;
  deleteQuickAction(id: ID): Promise<void>;

  upsertMerchant(merchant: Merchant): Promise<Merchant>;

  renameHousehold(householdId: ID, name: string): Promise<void>;
  updateMemberName(memberId: ID, name: string): Promise<void>;
  updateSettings(householdId: ID, patch: { onboarded?: boolean; lastBackupAt?: string | null }): Promise<void>;

  createInvite(householdId: ID, email: string): Promise<HouseholdInvite>;
  cancelInvite(id: ID): Promise<void>;

  /** Devuelve una función para cancelar la suscripción. */
  subscribe(householdId: ID, onChange: () => void): () => void;
}
