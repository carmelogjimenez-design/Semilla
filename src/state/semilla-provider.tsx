'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { SemillaRepository } from '@/data/repository';
import { newlyUnlocked } from '@/domain/achievements';
import { monthKeyOf, nowISO, systemToday } from '@/domain/dates';
import { buildView, type SemillaView } from '@/domain/selectors';
import type {
  Account,
  Category,
  Debt,
  FinancialGoal,
  HouseholdData,
  ID,
  ISODate,
  Member,
  Merchant,
  MonthKey,
  MonthlyClose,
  PlannedItem,
  QuickAction,
  SavingsPocket,
  IncomeSource,
  Subcategory,
  Tag,
  Transaction,
  WeeklyClose,
} from '@/domain/types';
import { useToast } from './toast';

/**
 * Estado de SEMILLA.
 *
 * Supabase es la fuente de verdad (§23). Este provider:
 *   1. carga el snapshot completo del hogar,
 *   2. aplica cambios optimistas para que la interfaz responda al instante,
 *   3. reconcilia con el servidor y con lo que hace la otra persona vía Realtime.
 */

export interface SemillaActions {
  addTransaction(transaction: Transaction, feedback?: { title: string; detail?: string; emoji?: string }): Promise<void>;
  updateTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(id: ID): Promise<void>;

  saveAccount(account: Account): Promise<void>;
  deleteAccount(id: ID): Promise<void>;

  saveCategory(category: Category): Promise<void>;
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

  saveMonthlyBudget(month: MonthKey, planned: number): Promise<void>;
  saveWeeklyBudget(month: MonthKey, weekIndex: number, planned: number): Promise<void>;
  saveCategoryLimit(month: MonthKey, weekIndex: number | null, categoryId: ID, amount: number): Promise<void>;

  saveGoal(goal: FinancialGoal): Promise<void>;
  deleteGoal(id: ID): Promise<void>;

  saveWeeklyClose(close: WeeklyClose): Promise<void>;
  reopenWeek(id: ID): Promise<void>;
  saveMonthlyClose(close: MonthlyClose): Promise<void>;
  reopenMonth(id: ID): Promise<void>;

  saveQuickAction(action: QuickAction): Promise<void>;
  deleteQuickAction(id: ID): Promise<void>;

  rememberMerchant(merchant: Merchant): Promise<Merchant | null>;

  renameHousehold(name: string): Promise<void>;
  updateMemberName(memberId: ID, name: string): Promise<void>;
  markOnboarded(): Promise<void>;
  markBackup(): Promise<void>;

  invite(email: string): Promise<void>;
  cancelInvite(id: ID): Promise<void>;
}

interface SemillaContextValue {
  data: HouseholdData;
  view: SemillaView;
  today: ISODate;
  month: MonthKey;
  setMonth(month: MonthKey): void;
  currentUserId: ID;
  currentMember: Member | null;
  online: boolean;
  syncing: boolean;
  actions: SemillaActions;
  refresh(): Promise<void>;
}

const SemillaContext = createContext<SemillaContextValue | null>(null);

export function useSemilla(): SemillaContextValue {
  const context = useContext(SemillaContext);
  if (!context) throw new Error('useSemilla debe usarse dentro de <SemillaProvider>');
  return context;
}

export interface SemillaProviderProps {
  repository: SemillaRepository;
  initialData: HouseholdData;
  currentUserId: ID;
  children: ReactNode;
}

export function SemillaProvider({ repository, initialData, currentUserId, children }: SemillaProviderProps) {
  const [data, setData] = useState<HouseholdData>(initialData);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);
  const today = useMemo(() => systemToday(), []);
  const [month, setMonth] = useState<MonthKey>(() => monthKeyOf(today));
  const toast = useToast();
  const householdId = initialData.household.id;
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const fresh = await repository.load(householdId);
      setData(fresh);
    } catch (error) {
      console.error(error);
    }
  }, [repository, householdId]);

  /* --- Conexión (§24) --------------------------------------------------- */
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  /* --- Realtime (§22) --------------------------------------------------- */
  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => {
        void refresh();
      }, 350);
    };
    const unsubscribe = repository.subscribe(householdId, scheduleReload);
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      unsubscribe();
    };
  }, [repository, householdId, refresh]);

  /* --- Al volver a primer plano, reconcilia ----------------------------- */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const view = useMemo(() => buildView(data, today, month), [data, today, month]);

  /* --- Motor de mutaciones ---------------------------------------------- */

  const run = useCallback(
    async (
      optimistic: (current: HouseholdData) => HouseholdData,
      persist: () => Promise<void>,
      feedback?: { title: string; detail?: string; emoji?: string; tone?: 'good' | 'neutral' },
    ) => {
      const snapshot = data;
      setData(optimistic(snapshot));
      setSyncing(true);
      try {
        await persist();
        if (feedback) {
          toast({
            title: feedback.title,
            ...(feedback.detail === undefined ? {} : { detail: feedback.detail }),
            ...(feedback.emoji === undefined ? {} : { emoji: feedback.emoji }),
            tone: feedback.tone ?? 'good',
          });
        }
        await refresh();
      } catch (error) {
        setData(snapshot);
        toast({
          title: 'No hemos podido guardarlo',
          detail: error instanceof Error ? error.message : 'Inténtalo otra vez',
          tone: 'bad',
        });
        throw error;
      } finally {
        setSyncing(false);
      }
    },
    [data, refresh, toast],
  );

  /* --- Logros automáticos (§37) ----------------------------------------- */
  const unlockedRef = useRef<string>('');
  useEffect(() => {
    const pending = newlyUnlocked(view.achievementContext, data.achievements);
    const signature = pending.join(',');
    if (pending.length === 0 || signature === unlockedRef.current) return;
    unlockedRef.current = signature;
    void repository
      .unlockAchievements(householdId, pending)
      .then(() => refresh())
      .catch(() => undefined);
  }, [view.achievementContext, data.achievements, repository, householdId, refresh]);

  const actions = useMemo<SemillaActions>(() => {
    const patch = (mutate: (current: HouseholdData) => Partial<HouseholdData>) => (current: HouseholdData) => ({
      ...current,
      ...mutate(current),
    });

    return {
      async addTransaction(transaction, feedback) {
        await run(
          patch((current) => ({ transactions: [transaction, ...current.transactions] })),
          async () => {
            await repository.createTransaction(transaction);
          },
          feedback ? { ...feedback, tone: 'good' } : undefined,
        );
      },

      async updateTransaction(transaction) {
        await run(
          patch((current) => ({
            transactions: current.transactions.map((t) => (t.id === transaction.id ? transaction : t)),
          })),
          async () => {
            await repository.updateTransaction(transaction);
          },
          { title: 'Movimiento actualizado' },
        );
      },

      async deleteTransaction(id) {
        const removed = data.transactions.find((t) => t.id === id) ?? null;
        await run(
          patch((current) => ({ transactions: current.transactions.filter((t) => t.id !== id) })),
          async () => {
            await repository.deleteTransaction(id);
          },
        );
        if (removed) {
          // §80 — deshacer
          toast({
            title: 'Movimiento eliminado',
            tone: 'neutral',
            action: {
              label: 'Deshacer',
              onPress: () => {
                void run(
                  patch((current) => ({ transactions: [removed, ...current.transactions] })),
                  async () => {
                    await repository.createTransaction(removed);
                  },
                );
              },
            },
          });
        }
      },

      async saveAccount(account) {
        await run(
          patch((current) => ({
            accounts: upsertById(current.accounts, account),
          })),
          async () => {
            await repository.saveAccount(account);
          },
          { title: 'Cuenta guardada' },
        );
      },

      async deleteAccount(id) {
        await run(
          patch((current) => ({ accounts: current.accounts.filter((a) => a.id !== id) })),
          async () => repository.deleteAccount(id),
        );
      },

      async saveCategory(category) {
        const { subcategories: _subcategories, ...rest } = category;
        await run(
          patch((current) => ({ categories: upsertById(current.categories, category) })),
          async () => repository.saveCategory(rest),
          { title: 'Categoría guardada' },
        );
      },

      async deleteCategory(id) {
        await run(
          patch((current) => ({ categories: current.categories.filter((c) => c.id !== id) })),
          async () => repository.deleteCategory(id),
        );
      },

      async saveSubcategory(subcategory) {
        await run(
          patch((current) => ({
            categories: current.categories.map((category) =>
              category.id === subcategory.categoryId
                ? { ...category, subcategories: upsertById(category.subcategories, subcategory) }
                : category,
            ),
          })),
          async () => repository.saveSubcategory(subcategory),
        );
      },

      async deleteSubcategory(id) {
        await run(
          patch((current) => ({
            categories: current.categories.map((category) => ({
              ...category,
              subcategories: category.subcategories.filter((s) => s.id !== id),
            })),
          })),
          async () => repository.deleteSubcategory(id),
        );
      },

      async saveTag(tag) {
        await run(
          patch((current) => ({ tags: upsertById(current.tags, tag) })),
          async () => repository.saveTag(tag),
        );
      },

      async deleteTag(id) {
        await run(
          patch((current) => ({ tags: current.tags.filter((t) => t.id !== id) })),
          async () => repository.deleteTag(id),
        );
      },

      async saveIncomeSource(source) {
        await run(
          patch((current) => ({ incomeSources: upsertById(current.incomeSources, source) })),
          async () => repository.saveIncomeSource(source),
        );
      },

      async deleteIncomeSource(id) {
        await run(
          patch((current) => ({ incomeSources: current.incomeSources.filter((s) => s.id !== id) })),
          async () => repository.deleteIncomeSource(id),
        );
      },

      async savePocket(pocket) {
        await run(
          patch((current) => ({ pockets: upsertById(current.pockets, pocket) })),
          async () => repository.savePocket(pocket),
          { title: 'Hucha guardada', emoji: pocket.emoji },
        );
      },

      async deletePocket(id) {
        await run(
          patch((current) => ({ pockets: current.pockets.filter((p) => p.id !== id) })),
          async () => repository.deletePocket(id),
        );
      },

      async saveDebt(debt) {
        await run(
          patch((current) => ({ debts: upsertById(current.debts, debt) })),
          async () => repository.saveDebt(debt),
          { title: 'Deuda guardada' },
        );
      },

      async deleteDebt(id) {
        await run(
          patch((current) => ({ debts: current.debts.filter((d) => d.id !== id) })),
          async () => repository.deleteDebt(id),
        );
      },

      async savePlannedItem(item) {
        await run(
          patch((current) => ({ plannedItems: upsertById(current.plannedItems, item) })),
          async () => repository.savePlannedItem(item),
          { title: 'Compromiso guardado' },
        );
      },

      async deletePlannedItem(id) {
        await run(
          patch((current) => ({ plannedItems: current.plannedItems.filter((p) => p.id !== id) })),
          async () => repository.deletePlannedItem(id),
        );
      },

      async saveMonthlyBudget(targetMonth, planned) {
        await run(
          patch((current) => ({
            monthlyBudgets: current.monthlyBudgets.some((b) => b.month === targetMonth)
              ? current.monthlyBudgets.map((b) => (b.month === targetMonth ? { ...b, planned } : b))
              : [
                  ...current.monthlyBudgets,
                  {
                    id: crypto.randomUUID(),
                    householdId,
                    month: targetMonth,
                    planned,
                    categoryLimits: [],
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  },
                ],
          })),
          async () => repository.saveMonthlyBudget(householdId, targetMonth, planned),
          { title: 'Presupuesto actualizado' },
        );
      },

      async saveWeeklyBudget(targetMonth, weekIndex, planned) {
        await run(
          patch((current) => ({
            weeklyBudgets: current.weeklyBudgets.some(
              (b) => b.month === targetMonth && b.weekIndex === weekIndex,
            )
              ? current.weeklyBudgets.map((b) =>
                  b.month === targetMonth && b.weekIndex === weekIndex ? { ...b, planned } : b,
                )
              : [
                  ...current.weeklyBudgets,
                  {
                    id: crypto.randomUUID(),
                    householdId,
                    month: targetMonth,
                    weekIndex,
                    planned,
                    categoryLimits: [],
                    createdAt: nowISO(),
                    updatedAt: nowISO(),
                  },
                ],
          })),
          async () => repository.saveWeeklyBudget(householdId, targetMonth, weekIndex, planned),
        );
      },

      async saveCategoryLimit(targetMonth, weekIndex, categoryId, amount) {
        await run(
          (current) => current,
          async () =>
            repository.saveCategoryLimit({ householdId, month: targetMonth, weekIndex, categoryId, amount }),
        );
      },

      async saveGoal(goal) {
        await run(
          patch((current) => ({ goals: upsertById(current.goals, goal) })),
          async () => repository.saveGoal(goal),
          { title: 'Objetivo guardado', emoji: '🎯' },
        );
      },

      async deleteGoal(id) {
        await run(
          patch((current) => ({ goals: current.goals.filter((g) => g.id !== id) })),
          async () => repository.deleteGoal(id),
        );
      },

      async saveWeeklyClose(close) {
        await run(
          patch((current) => ({ weeklyCloses: upsertById(current.weeklyCloses, close) })),
          async () => repository.saveWeeklyClose(close),
        );
      },

      async reopenWeek(id) {
        await run(
          patch((current) => ({ weeklyCloses: current.weeklyCloses.filter((c) => c.id !== id) })),
          async () => repository.deleteWeeklyClose(id),
        );
      },

      async saveMonthlyClose(close) {
        await run(
          patch((current) => ({ monthlyCloses: upsertById(current.monthlyCloses, close) })),
          async () => repository.saveMonthlyClose(close),
        );
      },

      async reopenMonth(id) {
        await run(
          patch((current) => ({
            monthlyCloses: current.monthlyCloses.map((c) =>
              c.id === id ? { ...c, reopenedAt: nowISO() } : c,
            ),
          })),
          async () => repository.reopenMonth(id),
          { title: 'Mes reabierto', tone: 'neutral' },
        );
      },

      async saveQuickAction(action) {
        await run(
          patch((current) => ({ quickActions: upsertById(current.quickActions, action) })),
          async () => repository.saveQuickAction(action),
        );
      },

      async deleteQuickAction(id) {
        await run(
          patch((current) => ({ quickActions: current.quickActions.filter((q) => q.id !== id) })),
          async () => repository.deleteQuickAction(id),
        );
      },

      async rememberMerchant(merchant) {
        try {
          return await repository.upsertMerchant(merchant);
        } catch {
          return null;
        }
      },

      async renameHousehold(name) {
        await run(
          patch((current) => ({ household: { ...current.household, name } })),
          async () => repository.renameHousehold(householdId, name),
          { title: 'Nombre actualizado' },
        );
      },

      async updateMemberName(memberId, name) {
        await run(
          patch((current) => ({
            members: current.members.map((m) => (m.id === memberId ? { ...m, name } : m)),
          })),
          async () => repository.updateMemberName(memberId, name),
        );
      },

      async markOnboarded() {
        await run(
          patch((current) => ({ settings: { ...current.settings, onboarded: true } })),
          async () => repository.updateSettings(householdId, { onboarded: true }),
        );
      },

      async markBackup() {
        const at = nowISO();
        await run(
          patch((current) => ({ settings: { ...current.settings, lastBackupAt: at } })),
          async () => repository.updateSettings(householdId, { lastBackupAt: at }),
        );
      },

      async invite(email) {
        await run(
          (current) => current,
          async () => {
            await repository.createInvite(householdId, email);
          },
          { title: 'Invitación creada', detail: email, emoji: '✉️' },
        );
      },

      async cancelInvite(id) {
        await run(
          patch((current) => ({ invites: current.invites.filter((i) => i.id !== id) })),
          async () => repository.cancelInvite(id),
        );
      },
    };
  }, [data.transactions, householdId, repository, run, toast]);

  const currentMember = useMemo(
    () => data.members.find((m) => m.userId === currentUserId) ?? null,
    [data.members, currentUserId],
  );

  const value = useMemo<SemillaContextValue>(
    () => ({
      data,
      view,
      today,
      month,
      setMonth,
      currentUserId,
      currentMember,
      online,
      syncing,
      actions,
      refresh,
    }),
    [data, view, today, month, currentUserId, currentMember, online, syncing, actions, refresh],
  );

  return <SemillaContext.Provider value={value}>{children}</SemillaContext.Provider>;
}

function upsertById<T extends { id: string }>(items: readonly T[], item: T): T[] {
  const exists = items.some((entry) => entry.id === item.id);
  return exists ? items.map((entry) => (entry.id === item.id ? item : entry)) : [...items, item];
}
