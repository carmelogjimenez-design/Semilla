import type { SemillaClient } from '@/lib/supabase/client';
import type {
  Account,
  AchievementId,
  Category,
  Debt,
  FinancialGoal,
  HouseholdData,
  HouseholdInvite,
  ID,
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
import type { SemillaRepository } from './repository';
import {
  KIND_TO_DB,
  fromTransaction,
  toAccount,
  toCategory,
  toDebt,
  toGoal,
  toHousehold,
  toIncomeSource,
  toInvite,
  toMember,
  toMerchant,
  toMonthlyBudget,
  toMonthlyClose,
  toPaymentMethod,
  toPlannedItem,
  toPocket,
  toQuickAction,
  toTag,
  toTransaction,
  toUnlockedAchievement,
  toWeeklyBudget,
  toWeeklyClose,
} from './mappers';

/** Tablas que emiten cambios en tiempo real (§22). */
const REALTIME_TABLES = [
  'transactions',
  'transaction_tags',
  'savings_pockets',
  'debts',
  'monthly_budgets',
  'weekly_budgets',
  'budget_categories',
  'recurring_transactions',
  'goals',
  'household_achievements',
  'weekly_closes',
  'monthly_closes',
  'accounts',
  'categories',
  'subcategories',
  'tags',
  'merchants',
  'income_sources',
  'household_members',
  'quick_actions',
  'app_settings',
] as const;

/** Error de dominio con mensaje legible en español. */
export class RepositoryError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

function check<T>(result: { data: T; error: { message: string } | null }, context: string): NonNullable<T> {
  if (result.error) throw new RepositoryError(`${context}: ${result.error.message}`, result.error);
  if (result.data === null || result.data === undefined) {
    throw new RepositoryError(`${context}: la base de datos no ha devuelto nada`);
  }
  return result.data as NonNullable<T>;
}

function checkVoid(result: { error: { message: string } | null }, context: string): void {
  if (result.error) throw new RepositoryError(`${context}: ${result.error.message}`, result.error);
}

/**
 * Implementación real sobre Supabase.
 * Toda consulta pasa por RLS: no hay filtros de seguridad en el cliente, sólo de conveniencia.
 */
export class SupabaseRepository implements SemillaRepository {
  constructor(private readonly supabase: SemillaClient) {}

  async load(householdId: ID): Promise<HouseholdData> {
    const sb = this.supabase;
    const hid = householdId;

    const [
      household,
      settings,
      members,
      profiles,
      accounts,
      paymentMethods,
      categories,
      subcategories,
      tags,
      merchants,
      incomeSources,
      transactions,
      transactionTags,
      monthlyBudgets,
      weeklyBudgets,
      budgetCategories,
      planned,
      pockets,
      debts,
      goals,
      achievements,
      weeklyCloses,
      monthlyCloses,
      quickActions,
      invites,
    ] = await Promise.all([
      sb.from('households').select('*').eq('id', householdId).single(),
      sb.from('app_settings').select('*').eq('household_id', householdId).maybeSingle(),
      sb.from('household_members').select('*').eq('household_id', hid),
      sb.from('profiles').select('*'),
      sb.from('accounts').select('*').eq('household_id', hid),
      sb.from('payment_methods').select('*').eq('household_id', hid),
      sb.from('categories').select('*').eq('household_id', hid),
      sb.from('subcategories').select('*').eq('household_id', hid),
      sb.from('tags').select('*').eq('household_id', hid),
      sb.from('merchants').select('*').eq('household_id', hid),
      sb.from('income_sources').select('*').eq('household_id', hid),
      sb.from('transactions').select('*').eq('household_id', householdId).order('date', { ascending: false }),
      sb.from('transaction_tags').select('*').eq('household_id', hid),
      sb.from('monthly_budgets').select('*').eq('household_id', hid),
      sb.from('weekly_budgets').select('*').eq('household_id', hid),
      sb.from('budget_categories').select('*').eq('household_id', hid),
      sb.from('recurring_transactions').select('*').eq('household_id', hid),
      sb.from('savings_pockets').select('*').eq('household_id', hid),
      sb.from('debts').select('*').eq('household_id', hid),
      sb.from('goals').select('*').eq('household_id', hid),
      sb.from('household_achievements').select('*').eq('household_id', hid),
      sb.from('weekly_closes').select('*').eq('household_id', hid),
      sb.from('monthly_closes').select('*').eq('household_id', hid),
      sb.from('quick_actions').select('*').eq('household_id', hid),
      sb.from('household_invites').select('*').eq('household_id', hid),
    ]);

    const householdRow = check(household, 'No se ha podido cargar el hogar');
    const memberRows = check(members, 'No se han podido cargar los miembros');
    const profileRows = profiles.data ?? [];
    const subcategoryRows = check(subcategories, 'No se han podido cargar las subcategorías');
    const limitRows = check(budgetCategories, 'No se han podido cargar los límites de categoría');

    const tagsByTransaction = new Map<string, string[]>();
    for (const row of transactionTags.data ?? []) {
      const list = tagsByTransaction.get(row.transaction_id) ?? [];
      list.push(row.tag_id);
      tagsByTransaction.set(row.transaction_id, list);
    }

    const settingsRow = settings.data;

    return {
      household: toHousehold(householdRow),
      settings: {
        householdId,
        onboarded: settingsRow?.onboarded ?? false,
        demoDataLoaded: settingsRow?.demo_data_loaded ?? false,
        lastBackupAt: settingsRow?.last_backup_at ?? null,
      },
      members: memberRows
        .map((row) => toMember(row, profileRows.find((p) => p.id === row.user_id)))
        .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'owner' ? -1 : 1)),
      accounts: (accounts.data ?? []).map(toAccount).sort((a, b) => a.position - b.position),
      paymentMethods: (paymentMethods.data ?? []).map(toPaymentMethod).sort((a, b) => a.position - b.position),
      categories: (categories.data ?? [])
        .filter((c) => !c.archived)
        .sort((a, b) => a.position - b.position)
        .map((row) => toCategory(row, subcategoryRows)),
      tags: (tags.data ?? []).filter((t) => !t.archived).map(toTag).sort((a, b) => a.name.localeCompare(b.name)),
      merchants: (merchants.data ?? []).map(toMerchant),
      incomeSources: (incomeSources.data ?? [])
        .filter((s) => !s.archived)
        .map(toIncomeSource)
        .sort((a, b) => a.position - b.position),
      transactions: (transactions.data ?? []).map((row) =>
        toTransaction(row, tagsByTransaction.get(row.id) ?? []),
      ),
      monthlyBudgets: (monthlyBudgets.data ?? []).map((row) => toMonthlyBudget(row, limitRows)),
      weeklyBudgets: (weeklyBudgets.data ?? []).map((row) => toWeeklyBudget(row, limitRows)),
      plannedItems: (planned.data ?? []).map(toPlannedItem),
      pockets: (pockets.data ?? []).filter((p) => !p.archived).map(toPocket).sort((a, b) => a.position - b.position),
      debts: (debts.data ?? []).filter((d) => !d.archived).map(toDebt).sort((a, b) => a.priority - b.priority),
      goals: (goals.data ?? []).map(toGoal),
      achievements: (achievements.data ?? []).map(toUnlockedAchievement),
      weeklyCloses: (weeklyCloses.data ?? []).map(toWeeklyClose),
      monthlyCloses: (monthlyCloses.data ?? []).map(toMonthlyClose),
      quickActions: (quickActions.data ?? []).map(toQuickAction).sort((a, b) => a.position - b.position),
      invites: (invites.data ?? []).map(toInvite),
    };
  }

  /* --- Movimientos ------------------------------------------------------ */

  async createTransaction(transaction: Transaction): Promise<Transaction> {
    const row = check(
      await this.supabase.from('transactions').insert(fromTransaction(transaction)).select('*').single(),
      'No hemos podido guardar el movimiento',
    );
    await this.syncTags(transaction.id, transaction.tagIds);
    return toTransaction(row, transaction.tagIds);
  }

  async updateTransaction(transaction: Transaction): Promise<Transaction> {
    const payload = fromTransaction(transaction);
    delete payload.id;
    delete payload.household_id;
    const row = check(
      await this.supabase.from('transactions').update(payload).eq('id', transaction.id).select('*').single(),
      'No hemos podido actualizar el movimiento',
    );
    await this.syncTags(transaction.id, transaction.tagIds);
    return toTransaction(row, transaction.tagIds);
  }

  async deleteTransaction(id: ID): Promise<void> {
    checkVoid(await this.supabase.from('transactions').delete().eq('id', id), 'No hemos podido eliminar el movimiento');
  }

  private async syncTags(transactionId: ID, tagIds: readonly ID[]): Promise<void> {
    await this.supabase.from('transaction_tags').delete().eq('transaction_id', transactionId);
    if (tagIds.length === 0) return;
    checkVoid(
      await this.supabase
        .from('transaction_tags')
        .insert(tagIds.map((tagId) => ({ transaction_id: transactionId, tag_id: tagId }))),
      'No hemos podido guardar las etiquetas',
    );
  }

  /* --- Catálogos -------------------------------------------------------- */

  async saveAccount(account: Account): Promise<Account> {
    const row = check(
      await this.supabase
        .from('accounts')
        .upsert({
          id: account.id,
          household_id: account.householdId,
          name: account.name,
          type: account.type,
          opening_balance_cents: account.openingBalance,
          balance_date: account.balanceDate,
          counts_as_available: account.countsAsAvailable,
          position: account.position,
          archived: account.archived,
        })
        .select('*')
        .single(),
      'No hemos podido guardar la cuenta',
    );
    return toAccount(row);
  }

  async deleteAccount(id: ID): Promise<void> {
    checkVoid(await this.supabase.from('accounts').delete().eq('id', id), 'No hemos podido eliminar la cuenta');
  }

  async saveCategory(category: Omit<Category, 'subcategories'>): Promise<void> {
    checkVoid(
      await this.supabase.from('categories').upsert({
        id: category.id,
        household_id: category.householdId,
        name: category.name,
        emoji: category.emoji,
        tone: category.tone,
        priority: category.priority,
        quick: category.quick,
        position: category.position,
        archived: category.archived,
      }),
      'No hemos podido guardar la categoría',
    );
  }

  async deleteCategory(id: ID): Promise<void> {
    const result = await this.supabase.from('categories').delete().eq('id', id);
    if (result.error) {
      throw new RepositoryError(
        'Esta categoría tiene movimientos asociados. Archívala en lugar de borrarla.',
        result.error,
      );
    }
  }

  async saveSubcategory(subcategory: Subcategory): Promise<void> {
    checkVoid(
      await this.supabase.from('subcategories').upsert({
        id: subcategory.id,
        household_id: subcategory.householdId,
        category_id: subcategory.categoryId,
        name: subcategory.name,
        position: subcategory.position,
        archived: subcategory.archived,
      }),
      'No hemos podido guardar la subcategoría',
    );
  }

  async deleteSubcategory(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('subcategories').delete().eq('id', id),
      'No hemos podido eliminar la subcategoría',
    );
  }

  async saveTag(tag: Tag): Promise<void> {
    checkVoid(
      await this.supabase
        .from('tags')
        .upsert({ id: tag.id, household_id: tag.householdId, name: tag.name, archived: tag.archived }),
      'No hemos podido guardar la etiqueta',
    );
  }

  async deleteTag(id: ID): Promise<void> {
    checkVoid(await this.supabase.from('tags').delete().eq('id', id), 'No hemos podido eliminar la etiqueta');
  }

  async saveIncomeSource(source: IncomeSource): Promise<void> {
    checkVoid(
      await this.supabase.from('income_sources').upsert({
        id: source.id,
        household_id: source.householdId,
        name: source.name,
        owner_user_id: source.ownerUserId,
        expected_amount_cents: source.expectedAmount,
        recurring: source.recurring,
        position: source.position,
        archived: source.archived,
      }),
      'No hemos podido guardar la fuente de ingreso',
    );
  }

  async deleteIncomeSource(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('income_sources').delete().eq('id', id),
      'No hemos podido eliminar la fuente de ingreso',
    );
  }

  async savePocket(pocket: SavingsPocket): Promise<void> {
    checkVoid(
      await this.supabase.from('savings_pockets').upsert({
        id: pocket.id,
        household_id: pocket.householdId,
        name: pocket.name,
        emoji: pocket.emoji,
        type: pocket.type,
        target_amount_cents: pocket.targetAmount,
        target_date: pocket.targetDate,
        opening_balance_cents: pocket.openingBalance,
        account_id: pocket.accountId,
        position: pocket.position,
        archived: pocket.archived,
      }),
      'No hemos podido guardar la hucha',
    );
  }

  async deletePocket(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('savings_pockets').delete().eq('id', id),
      'Esta hucha tiene movimientos. Archívala en lugar de borrarla.',
    );
  }

  async saveDebt(debt: Debt): Promise<void> {
    checkVoid(
      await this.supabase.from('debts').upsert({
        id: debt.id,
        household_id: debt.householdId,
        name: debt.name,
        type: debt.type,
        initial_balance_cents: debt.initialBalance,
        balance_at_start_cents: debt.balanceAtStart,
        tracking_start: debt.trackingStart,
        installment_cents: debt.installment,
        interest_bps: debt.interestBps,
        start_date: debt.startDate,
        end_date: debt.endDate,
        priority: debt.priority,
        notes: debt.notes,
        archived: debt.archived,
      }),
      'No hemos podido guardar la deuda',
    );
  }

  async deleteDebt(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('debts').delete().eq('id', id),
      'Esta deuda tiene pagos registrados. Archívala en lugar de borrarla.',
    );
  }

  async savePlannedItem(item: PlannedItem): Promise<void> {
    checkVoid(
      await this.supabase.from('recurring_transactions').upsert({
        id: item.id,
        household_id: item.householdId,
        name: item.name,
        kind: item.kind === 'debtPayment' ? 'debt_payment' : item.kind,
        expected_amount_cents: item.expectedAmount,
        frequency: item.frequency,
        day_of_month: item.dayOfMonth,
        months: item.months,
        category_id: item.categoryId,
        subcategory_id: item.subcategoryId,
        income_source_id: item.sourceId,
        debt_id: item.debtId,
        account_id: item.accountId,
        owner_user_id: item.ownerUserId,
        extraordinary: item.extraordinary,
        installments: item.installments,
        active: item.active,
        notes: item.notes,
      }),
      'No hemos podido guardar el previsto',
    );
  }

  async deletePlannedItem(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('recurring_transactions').delete().eq('id', id),
      'No hemos podido eliminar el previsto',
    );
  }

  /* --- Presupuestos ----------------------------------------------------- */

  async saveMonthlyBudget(householdId: ID, month: MonthKey, planned: number): Promise<void> {
    checkVoid(
      await this.supabase
        .from('monthly_budgets')
        .upsert({ household_id: householdId, month, planned_cents: planned }, { onConflict: 'household_id,month' }),
      'No hemos podido guardar el presupuesto mensual',
    );
  }

  async saveWeeklyBudget(
    householdId: ID,
    month: MonthKey,
    weekIndex: number,
    planned: number,
  ): Promise<void> {
    checkVoid(
      await this.supabase.from('weekly_budgets').upsert(
        { household_id: householdId, month, week_index: weekIndex, planned_cents: planned },
        { onConflict: 'household_id,month,week_index' },
      ),
      'No hemos podido guardar el presupuesto semanal',
    );
  }

  async saveCategoryLimit(input: {
    householdId: ID;
    month: MonthKey;
    weekIndex: number | null;
    categoryId: ID;
    amount: number;
  }): Promise<void> {
    const { householdId, month, weekIndex, categoryId, amount } = input;

    if (weekIndex === null) {
      const budget = check(
        await this.supabase
          .from('monthly_budgets')
          .upsert({ household_id: householdId, month }, { onConflict: 'household_id,month' })
          .select('id')
          .single(),
        'No hemos podido preparar el presupuesto del mes',
      );
      checkVoid(
        await this.supabase
          .from('budget_categories')
          .upsert(
            {
              household_id: householdId,
              monthly_budget_id: budget.id,
              weekly_budget_id: null,
              category_id: categoryId,
              amount_cents: amount,
            },
            { onConflict: 'monthly_budget_id,category_id' },
          ),
        'No hemos podido guardar el límite de categoría',
      );
      return;
    }

    const budget = check(
      await this.supabase
        .from('weekly_budgets')
        .upsert(
          { household_id: householdId, month, week_index: weekIndex },
          { onConflict: 'household_id,month,week_index' },
        )
        .select('id')
        .single(),
      'No hemos podido preparar el presupuesto de la semana',
    );
    checkVoid(
      await this.supabase
        .from('budget_categories')
        .upsert(
          {
            household_id: householdId,
            monthly_budget_id: null,
            weekly_budget_id: budget.id,
            category_id: categoryId,
            amount_cents: amount,
          },
          { onConflict: 'weekly_budget_id,category_id' },
        ),
      'No hemos podido guardar el límite de categoría',
    );
  }

  /* --- Objetivos, cierres, logros --------------------------------------- */

  async saveGoal(goal: FinancialGoal): Promise<void> {
    checkVoid(
      await this.supabase.from('goals').upsert({
        id: goal.id,
        household_id: goal.householdId,
        name: goal.name,
        start_date: goal.startDate,
        end_date: goal.endDate,
        savings_target_cents: goal.savingsTarget,
        extra_debt_target_cents: goal.extraDebtTarget,
        green_weeks_target: goal.greenWeeksTarget,
        active: goal.active,
      }),
      'No hemos podido guardar el objetivo',
    );
  }

  async deleteGoal(id: ID): Promise<void> {
    checkVoid(await this.supabase.from('goals').delete().eq('id', id), 'No hemos podido eliminar el objetivo');
  }

  async saveWeeklyClose(close: WeeklyClose): Promise<void> {
    checkVoid(
      await this.supabase.from('weekly_closes').upsert(
        {
          id: close.id,
          household_id: close.householdId,
          month: close.month,
          week_index: close.weekIndex,
          start_date: close.start,
          end_date: close.end,
          planned_cents: close.planned,
          spent_cents: close.spent,
          margin_cents: close.margin,
          green: close.green,
          allocation: close.allocation
            ? {
                type: close.allocation.type,
                savingCents: close.allocation.savingCents,
                debtCents: close.allocation.debtCents,
                pocketId: close.allocation.pocketId,
                debtId: close.allocation.debtId,
              }
            : null,
        },
        { onConflict: 'household_id,month,week_index' },
      ),
      'No hemos podido cerrar la semana',
    );
  }

  async deleteWeeklyClose(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('weekly_closes').delete().eq('id', id),
      'No hemos podido reabrir la semana',
    );
  }

  async saveMonthlyClose(close: MonthlyClose): Promise<void> {
    checkVoid(
      await this.supabase.from('monthly_closes').upsert(
        {
          id: close.id,
          household_id: close.householdId,
          month: close.month,
          income_cents: close.income,
          ordinary_cents: close.ordinaryExpenses,
          extraordinary_cents: close.extraordinaryExpenses,
          saved_cents: close.saved,
          debt_paid_cents: close.debtPaid,
          extra_debt_cents: close.extraDebtPaid,
          result_cents: close.result,
          net_worth_delta_cents: close.netWorthDelta,
          narrative: close.narrative,
          reopened_at: null,
        },
        { onConflict: 'household_id,month' },
      ),
      'No hemos podido cerrar el mes',
    );
  }

  async reopenMonth(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('monthly_closes').update({ reopened_at: new Date().toISOString() }).eq('id', id),
      'No hemos podido reabrir el mes',
    );
  }

  async unlockAchievements(householdId: ID, ids: AchievementId[]): Promise<void> {
    if (ids.length === 0) return;
    await this.supabase
      .from('household_achievements')
      .upsert(
        ids.map((achievementId) => ({ household_id: householdId, achievement_id: achievementId })),
        { onConflict: 'household_id,achievement_id', ignoreDuplicates: true },
      );
  }

  /* --- Varios ----------------------------------------------------------- */

  async saveQuickAction(action: QuickAction): Promise<void> {
    checkVoid(
      await this.supabase.from('quick_actions').upsert({
        id: action.id,
        household_id: action.householdId,
        label: action.label,
        emoji: action.emoji,
        kind: KIND_TO_DB[action.kind],
        amount_cents: action.amount,
        category_id: action.categoryId,
        subcategory_id: action.subcategoryId,
        merchant_id: action.merchantId,
        pocket_id: action.pocketId,
        debt_id: action.debtId,
        position: action.position,
      }),
      'No hemos podido guardar el acceso rápido',
    );
  }

  async deleteQuickAction(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('quick_actions').delete().eq('id', id),
      'No hemos podido eliminar el acceso rápido',
    );
  }

  async upsertMerchant(merchant: Merchant): Promise<Merchant> {
    const row = check(
      await this.supabase
        .from('merchants')
        .upsert(
          {
            household_id: merchant.householdId,
            name: merchant.name,
            normalized: merchant.normalized,
            default_category_id: merchant.defaultCategoryId,
            default_subcategory_id: merchant.defaultSubcategoryId,
            uses: merchant.uses,
            last_used_at: merchant.lastUsedAt,
          },
          { onConflict: 'household_id,normalized' },
        )
        .select('*')
        .single(),
      'No hemos podido guardar el comercio',
    );
    return toMerchant(row);
  }

  async renameHousehold(householdId: ID, name: string): Promise<void> {
    checkVoid(
      await this.supabase.from('households').update({ name }).eq('id', householdId),
      'No hemos podido renombrar el hogar',
    );
  }

  async updateMemberName(memberId: ID, name: string): Promise<void> {
    checkVoid(
      await this.supabase.from('household_members').update({ display_name: name }).eq('id', memberId),
      'No hemos podido actualizar el nombre',
    );
  }

  async updateSettings(
    householdId: ID,
    patch: { onboarded?: boolean; lastBackupAt?: string | null },
  ): Promise<void> {
    checkVoid(
      await this.supabase.from('app_settings').upsert(
        {
          household_id: householdId,
          ...(patch.onboarded === undefined ? {} : { onboarded: patch.onboarded }),
          ...(patch.lastBackupAt === undefined ? {} : { last_backup_at: patch.lastBackupAt }),
        },
        { onConflict: 'household_id' },
      ),
      'No hemos podido guardar los ajustes',
    );
  }

  async createInvite(householdId: ID, email: string): Promise<HouseholdInvite> {
    const row = check(
      await this.supabase.rpc('create_invite', { p_household_id: householdId, p_email: email }),
      'No hemos podido crear la invitación',
    );
    return toInvite(row);
  }

  async cancelInvite(id: ID): Promise<void> {
    checkVoid(
      await this.supabase.from('household_invites').update({ status: 'cancelled' }).eq('id', id),
      'No hemos podido cancelar la invitación',
    );
  }

  /* --- Realtime (§22) --------------------------------------------------- */

  subscribe(householdId: ID, onChange: () => void): () => void {
    const channel = this.supabase.channel(`semilla:${householdId}`);

    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `household_id=eq.${householdId}` },
        () => onChange(),
      );
    }

    channel.subscribe();

    return () => {
      void this.supabase.removeChannel(channel);
    };
  }
}
