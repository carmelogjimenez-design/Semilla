import type { SemillaRepository } from '@/data/repository';
import type {
  FinancialGoal,
  HouseholdData,
  ID,
  Merchant,
  MonthlyClose,
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

  /* El resto de operaciones no se ejercitan en la previsualización. */
  async saveAccount(account: never): Promise<never> {
    return account;
  }
  async deleteAccount(): Promise<void> {}
  async saveCategory(): Promise<void> {}
  async deleteCategory(): Promise<void> {}
  async saveSubcategory(): Promise<void> {}
  async deleteSubcategory(): Promise<void> {}
  async saveTag(): Promise<void> {}
  async deleteTag(): Promise<void> {}
  async saveIncomeSource(): Promise<void> {}
  async deleteIncomeSource(): Promise<void> {}
  async savePocket(): Promise<void> {}
  async deletePocket(): Promise<void> {}
  async saveDebt(): Promise<void> {}
  async deleteDebt(): Promise<void> {}
  async savePlannedItem(): Promise<void> {}
  async deletePlannedItem(): Promise<void> {}
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
  async renameHousehold(): Promise<void> {}
  async updateMemberName(): Promise<void> {}
  async updateSettings(): Promise<void> {}
  async createInvite(): Promise<never> {
    throw new Error('Las invitaciones necesitan Supabase.');
  }
  async cancelInvite(): Promise<void> {}

  subscribe(_householdId: ID, onChange: () => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }
}
