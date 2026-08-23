import type { SemillaRepository } from '@/data/repository';
import type { HouseholdData, ID, Merchant, Transaction } from '@/domain/types';

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
  async saveGoal(): Promise<void> {}
  async deleteGoal(): Promise<void> {}
  async saveWeeklyClose(): Promise<void> {}
  async deleteWeeklyClose(): Promise<void> {}
  async saveMonthlyClose(): Promise<void> {}
  async reopenMonth(): Promise<void> {}
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
