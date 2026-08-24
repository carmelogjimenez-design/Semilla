/**
 * Tipos de la base de datos de SEMILLA.
 *
 * Este archivo refleja `supabase/migrations`. Es el contrato entre PostgreSQL y
 * TypeScript: si cambias una migración, regenera este archivo con
 *
 *     npm run db:types      (supabase gen types typescript --linked)
 *
 * y vuelve a compilar. Nada en la app accede a Supabase sin pasar por aquí.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type TransactionTypeDb = 'income' | 'expense' | 'saving' | 'debt_payment' | 'internal_transfer';
export type MemberRoleDb = 'owner' | 'member';
export type InviteStatusDb = 'pending' | 'accepted' | 'expired' | 'cancelled';
export type NecessityDb = 'necessary' | 'discretionary';
export type RegularityDb = 'ordinary' | 'extraordinary';
export type PocketKindDb = 'savings' | 'reserved';
export type AccountKindDb = 'main' | 'savings' | 'cash' | 'card' | 'other';
export type PaymentMethodKindDb = 'account' | 'card' | 'cash' | 'bizum' | 'other';
export type DebtKindDb = 'mortgage' | 'loan' | 'card' | 'vehicle' | 'other';
export type CategoryPriorityDb = 'protected' | 'flexible';
export type RecurrenceFrequencyDb = 'monthly' | 'quarterly' | 'yearly' | 'custom';
export type PlannedKindDb = 'expense' | 'income' | 'debt_payment';

/* --- Filas -------------------------------------------------------------- */

export type ProfileRow = {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  accent: string;
  created_at: string;
  updated_at: string;
}

export type HouseholdRow = {
  id: string;
  name: string;
  created_by: string | null;
  locale: string;
  currency: string;
  time_zone: string;
  week_starts_on: number;
  created_at: string;
  updated_at: string;
}

export type HouseholdMemberRow = {
  id: string;
  household_id: string;
  user_id: string;
  role: MemberRoleDb;
  display_name: string;
  accent: string;
  created_at: string;
  updated_at: string;
}

export type HouseholdInviteRow = {
  id: string;
  household_id: string;
  email: string;
  role: MemberRoleDb;
  token: string;
  status: InviteStatusDb;
  created_by: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  expires_at: string;
}

export type UserPreferencesRow = {
  user_id: string;
  current_household_id: string | null;
  reduce_motion: boolean;
  haptics: boolean;
  updated_at: string;
}

export type AppSettingsRow = {
  household_id: string;
  onboarded: boolean;
  demo_data_loaded: boolean;
  last_backup_at: string | null;
  created_at: string;
  updated_at: string;
}

export type AccountRow = {
  id: string;
  household_id: string;
  name: string;
  type: AccountKindDb;
  opening_balance_cents: number;
  balance_date: string;
  counts_as_available: boolean;
  position: number;
  archived: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type PaymentMethodRow = {
  id: string;
  household_id: string;
  name: string;
  type: PaymentMethodKindDb;
  account_id: string | null;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type CategoryRow = {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  tone: number;
  priority: CategoryPriorityDb;
  quick: boolean;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type SubcategoryRow = {
  id: string;
  household_id: string;
  category_id: string;
  name: string;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type TagRow = {
  id: string;
  household_id: string;
  name: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type MerchantRow = {
  id: string;
  household_id: string;
  name: string;
  normalized: string;
  default_category_id: string | null;
  default_subcategory_id: string | null;
  uses: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

export type IncomeSourceRow = {
  id: string;
  household_id: string;
  name: string;
  owner_user_id: string | null;
  expected_amount_cents: number | null;
  recurring: boolean;
  position: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type SavingsPocketRow = {
  id: string;
  household_id: string;
  name: string;
  emoji: string;
  type: PocketKindDb;
  target_amount_cents: number | null;
  target_date: string | null;
  opening_balance_cents: number;
  account_id: string | null;
  position: number;
  archived: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DebtRow = {
  id: string;
  household_id: string;
  name: string;
  type: DebtKindDb;
  initial_balance_cents: number;
  balance_at_start_cents: number;
  tracking_start: string;
  installment_cents: number;
  interest_bps: number;
  start_date: string | null;
  end_date: string | null;
  priority: number;
  notes: string;
  archived: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type RecurringTransactionRow = {
  id: string;
  household_id: string;
  name: string;
  kind: PlannedKindDb;
  expected_amount_cents: number;
  frequency: RecurrenceFrequencyDb;
  day_of_month: number;
  months: number[] | null;
  category_id: string | null;
  subcategory_id: string | null;
  income_source_id: string | null;
  debt_id: string | null;
  account_id: string | null;
  owner_user_id: string | null;
  extraordinary: boolean;
  installments: number | null;
  active: boolean;
  notes: string;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionRow = {
  id: string;
  household_id: string;
  type: TransactionTypeDb;
  amount_cents: number;
  date: string;
  description: string;
  note: string;
  category_id: string | null;
  subcategory_id: string | null;
  merchant_id: string | null;
  necessity: NecessityDb | null;
  regularity: RegularityDb | null;
  income_source_id: string | null;
  income_recurring: boolean | null;
  pocket_id: string | null;
  saving_direction: 'in' | 'out' | null;
  debt_id: string | null;
  debt_payment_type: 'installment' | 'extra' | null;
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  payment_method_id: string | null;
  expected_amount_cents: number | null;
  planned_id: string | null;
  owner_user_id: string | null;
  created_by_user_id: string | null;
  updated_by_user_id: string | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
}

export type TransactionTagRow = {
  transaction_id: string;
  tag_id: string;
  household_id: string;
}

export type MonthlyBudgetRow = {
  id: string;
  household_id: string;
  month: string;
  planned_cents: number;
  created_at: string;
  updated_at: string;
}

export type WeeklyBudgetRow = {
  id: string;
  household_id: string;
  month: string;
  week_index: number;
  planned_cents: number;
  created_at: string;
  updated_at: string;
}

export type BudgetCategoryRow = {
  id: string;
  household_id: string;
  monthly_budget_id: string | null;
  weekly_budget_id: string | null;
  category_id: string;
  amount_cents: number;
  created_at: string;
  updated_at: string;
}

export type GoalRow = {
  id: string;
  household_id: string;
  name: string;
  start_date: string;
  end_date: string;
  savings_target_cents: number;
  extra_debt_target_cents: number;
  green_weeks_target: number;
  active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export type AchievementRow = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  position: number;
}

export type HouseholdAchievementRow = {
  id: string;
  household_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export type WeeklyCloseRow = {
  id: string;
  household_id: string;
  month: string;
  week_index: number;
  start_date: string;
  end_date: string;
  planned_cents: number;
  spent_cents: number;
  margin_cents: number;
  green: boolean;
  allocation: Json | null;
  closed_by: string | null;
  closed_at: string;
  created_at: string;
  updated_at: string;
}

export type MonthlyCloseRow = {
  id: string;
  household_id: string;
  month: string;
  income_cents: number;
  ordinary_cents: number;
  extraordinary_cents: number;
  saved_cents: number;
  debt_paid_cents: number;
  extra_debt_cents: number;
  result_cents: number;
  net_worth_delta_cents: number;
  narrative: Json;
  closed_by: string | null;
  closed_at: string;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
}

export type NotificationRow = {
  id: string;
  household_id: string;
  kind: string;
  tone: string;
  title: string;
  body: string;
  target: string | null;
  date: string;
  dismissed_at: string | null;
  dismissed_by: string | null;
  created_at: string;
}

export type QuickActionRow = {
  id: string;
  household_id: string;
  label: string;
  emoji: string;
  kind: TransactionTypeDb;
  amount_cents: number | null;
  category_id: string | null;
  subcategory_id: string | null;
  merchant_id: string | null;
  pocket_id: string | null;
  debt_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/* --- Mapa de tablas ----------------------------------------------------- */

type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      households: Table<HouseholdRow>;
      household_members: Table<HouseholdMemberRow>;
      household_invites: Table<HouseholdInviteRow>;
      user_preferences: Table<UserPreferencesRow>;
      app_settings: Table<AppSettingsRow>;
      accounts: Table<AccountRow>;
      payment_methods: Table<PaymentMethodRow>;
      categories: Table<CategoryRow>;
      subcategories: Table<SubcategoryRow>;
      tags: Table<TagRow>;
      merchants: Table<MerchantRow>;
      income_sources: Table<IncomeSourceRow>;
      savings_pockets: Table<SavingsPocketRow>;
      debts: Table<DebtRow>;
      recurring_transactions: Table<RecurringTransactionRow>;
      transactions: Table<TransactionRow>;
      transaction_tags: Table<TransactionTagRow>;
      monthly_budgets: Table<MonthlyBudgetRow>;
      weekly_budgets: Table<WeeklyBudgetRow>;
      budget_categories: Table<BudgetCategoryRow>;
      goals: Table<GoalRow>;
      achievements: Table<AchievementRow>;
      household_achievements: Table<HouseholdAchievementRow>;
      weekly_closes: Table<WeeklyCloseRow>;
      monthly_closes: Table<MonthlyCloseRow>;
      notifications: Table<NotificationRow>;
      quick_actions: Table<QuickActionRow>;
    };
    Views: {
      debt_payments: { Row: Partial<TransactionRow>; Relationships: [] };
      fixed_expenses: { Row: RecurringTransactionRow; Relationships: [] };
    };
    Functions: {
      create_household: {
        Args: { p_name: string; p_display_name?: string | null };
        Returns: string;
      };
      create_invite: {
        Args: { p_household_id: string; p_email: string; p_role?: MemberRoleDb };
        Returns: HouseholdInviteRow;
      };
      accept_invite: {
        Args: { p_token: string; p_display_name?: string | null };
        Returns: string;
      };
      invite_preview: {
        Args: { p_token: string };
        Returns: {
          household_name: string;
          email: string;
          status: InviteStatusDb;
          expired: boolean;
        }[];
      };
      my_pending_invites: {
        Args: Record<string, never>;
        Returns: {
          token: string;
          household_name: string;
          email: string;
          expires_at: string;
        }[];
      };
      is_household_member: { Args: { hid: string }; Returns: boolean };
      is_household_owner: { Args: { hid: string }; Returns: boolean };
    };
    Enums: {
      transaction_type: TransactionTypeDb;
      member_role: MemberRoleDb;
      invite_status: InviteStatusDb;
      necessity_kind: NecessityDb;
      regularity_kind: RegularityDb;
      pocket_kind: PocketKindDb;
      account_kind: AccountKindDb;
      payment_method_kind: PaymentMethodKindDb;
      debt_kind: DebtKindDb;
      category_priority: CategoryPriorityDb;
      recurrence_frequency: RecurrenceFrequencyDb;
      planned_kind: PlannedKindDb;
    };
    CompositeTypes: Record<string, never>;
  };
}
