import type { SemillaRepository } from '@/data/repository';
import type {
  Account,
  Category,
  FinancialGoal,
  HouseholdSettings,
  Subcategory,
  Tag,
  HouseholdData,
  ID,
  Merchant,
  MonthlyClose,
  PaymentMethod,
  PlannedItem,
  Transaction,
  WeeklyClose,
} from '@/domain/types';

/** Sustituye por id o añade al final. */
function upsert<T extends { id: ID }>(items: readonly T[], item: T): T[] {
  return items.some((entry) => entry.id === item.id)
    ? items.map((entry) => (entry.id === item.id ? item : entry))
    : [...items, item];
}

/**
 * Repositorio en memoria para el modo previsualización de interfaz.
 * SOLO desarrollo: no persiste nada y desaparece al recargar.
 */
export class MemoryRepository implements SemillaRepository {
  private data: HouseholdData;
  private listeners = new Set<() => void>();

  constructor(seed: HouseholdData) {
    this.data = seed;
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  async load(): Promise<HouseholdData> {
    return structuredClone(this.data);
  }

  async createTransaction(transaction: Transaction): Promise<Transaction> {
    this.data = {
      ...this.data,
      transactions: [transaction, ...this.data.transactions].sort((a, b) => b.date.localeCompare(a.date)),
    };
    this.notify();
    return transaction;
  }

  async updateTransaction(transaction: Transaction): Promise<Transaction> {
    this.data = {
      ...this.data,
      transactions: this.data.transactions.map((t) => (t.id === transaction.id ? transaction : t)),
    };
    this.notify();
    return transaction;
  }

  async deleteTransaction(id: ID): Promise<void> {
    this.data = { ...this.data, transactions: this.data.transactions.filter((t) => t.id !== id) };
    this.notify();
  }

  async upsertMerchant(merchant: Merchant): Promise<Merchant> {
    const exists = this.data.merchants.some((m) => m.normalized === merchant.normalized);
    this.data = {
      ...this.data,
      merchants: exists
        ? this.data.merchants.map((m) => (m.normalized === merchant.normalized ? merchant : m))
        : [...this.data.merchants, merchant],
    };
    return merchant;
  }

  async saveAccount(account: Account): Promise<Account> {
    this.data = { ...this.data, accounts: upsert(this.data.accounts, account) };
    this.notify();
    return account;
  }
  async deleteAccount(id: ID): Promise<void> {
    this.data = { ...this.data, accounts: this.data.accounts.filter((a) => a.id !== id) };
    this.notify();
  }
  async savePaymentMethod(method: PaymentMethod): Promise<void> {
    this.data = { ...this.data, paymentMethods: upsert(this.data.paymentMethods, method) };
    this.notify();
  }
  async saveCategory(category: Category): Promise<void> {
    /* Las subcategorías viven en su propia tabla: al guardar la categoría no se
       pierden las que ya tenía. */
    const previous = this.data.categories.find((entry) => entry.id === category.id);
    this.data = {
      ...this.data,
      categories: upsert(this.data.categories, {
        ...category,
        subcategories: previous?.subcategories ?? category.subcategories,
      }),
    };
    this.notify();
  }
  async deleteCategory(id: ID): Promise<void> {
    this.data = { ...this.data, categories: this.data.categories.filter((c) => c.id !== id) };
    this.notify();
  }
  async saveSubcategory(subcategory: Subcategory): Promise<void> {
    this.data = {
      ...this.data,
      categories: this.data.categories.map((category) =>
        category.id === subcategory.categoryId
          ? { ...category, subcategories: upsert(category.subcategories, subcategory) }
          : category,
      ),
    };
    this.notify();
  }
  async deleteSubcategory(id: ID): Promise<void> {
    this.data = {
      ...this.data,
      categories: this.data.categories.map((category) => ({
        ...category,
        subcategories: category.subcategories.filter((sub) => sub.id !== id),
      })),
    };
    this.notify();
  }
  async saveTag(tag: Tag): Promise<void> {
    this.data = { ...this.data, tags: upsert(this.data.tags, tag) };
    this.notify();
  }
  async deleteTag(id: ID): Promise<void> {
    this.data = { ...this.data, tags: this.data.tags.filter((t) => t.id !== id) };
    this.notify();
  }
  async saveIncomeSource(): Promise<void> {}
  async deleteIncomeSource(): Promise<void> {}
  async savePocket(): Promise<void> {}
  async deletePocket(): Promise<void> {}
  async saveDebt(): Promise<void> {}
  async deleteDebt(): Promise<void> {}
  async savePlannedItem(item: PlannedItem): Promise<void> {
    this.data = { ...this.data, plannedItems: upsert(this.data.plannedItems, item) };
    this.notify();
  }
  async deletePlannedItem(id: ID): Promise<void> {
    this.data = { ...this.data, plannedItems: this.data.plannedItems.filter((p) => p.id !== id) };
    this.notify();
  }
  async saveMonthlyBudget(): Promise<void> {}
  async saveWeeklyBudget(): Promise<void> {}
  async saveCategoryLimit(): Promise<void> {}

  /* Objetivos y cierres sí se guardan en memoria: son flujos que hay que poder
     recorrer enteros al revisar el diseño. El provider recarga desde aquí después
     de cada escritura, así que sin esto el cambio se vería y se desharía solo. */
  async saveGoal(goal: FinancialGoal): Promise<void> {
    this.data = { ...this.data, goals: upsert(this.data.goals, goal) };
    this.notify();
  }
  async deleteGoal(id: ID): Promise<void> {
    this.data = { ...this.data, goals: this.data.goals.filter((g) => g.id !== id) };
    this.notify();
  }
  async saveWeeklyClose(close: WeeklyClose): Promise<void> {
    this.data = { ...this.data, weeklyCloses: upsert(this.data.weeklyCloses, close) };
    this.notify();
  }
  async deleteWeeklyClose(id: ID): Promise<void> {
    this.data = { ...this.data, weeklyCloses: this.data.weeklyCloses.filter((c) => c.id !== id) };
    this.notify();
  }
  async saveMonthlyClose(close: MonthlyClose): Promise<void> {
    this.data = { ...this.data, monthlyCloses: upsert(this.data.monthlyCloses, close) };
    this.notify();
  }
  async reopenMonth(id: ID): Promise<void> {
    this.data = {
      ...this.data,
      monthlyCloses: this.data.monthlyCloses.map((c) =>
        c.id === id ? { ...c, reopenedAt: new Date().toISOString() } : c,
      ),
    };
    this.notify();
  }
  async unlockAchievements(): Promise<void> {}
  async saveQuickAction(): Promise<void> {}
  async deleteQuickAction(): Promise<void> {}
  async renameHousehold(_householdId: ID, name: string): Promise<void> {
    this.data = { ...this.data, household: { ...this.data.household, name } };
    this.notify();
  }
  async updateMemberName(memberId: ID, name: string): Promise<void> {
    this.data = {
      ...this.data,
      members: this.data.members.map((m) => (m.id === memberId ? { ...m, name } : m)),
    };
    this.notify();
  }
  async updateSettings(_householdId: ID, patch: Partial<HouseholdSettings>): Promise<void> {
    this.data = { ...this.data, settings: { ...this.data.settings, ...patch } };
    this.notify();
  }
  async createInvite(): Promise<never> {
    throw new Error('Las invitaciones necesitan Supabase.');
  }
  async cancelInvite(): Promise<void> {}

  subscribe(_householdId: ID, onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }
}
