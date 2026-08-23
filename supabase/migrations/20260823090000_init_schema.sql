-- ===========================================================================
-- SEMILLA · 01 — Esquema base
--
-- Principios:
--   · La unidad económica es el HOGAR (household), no el usuario.
--   · Toda tabla financiera lleva household_id. Sin excepciones.
--   · El dinero se guarda en CÉNTIMOS (bigint). Nunca float.
--   · Un movimiento es UNA fila. Semana, mes y categoría son agregaciones.
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Dominios y tipos
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type public.transaction_type as enum (
      'income', 'expense', 'saving', 'debt_payment', 'internal_transfer'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type public.member_role as enum ('owner', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'invite_status') then
    create type public.invite_status as enum ('pending', 'accepted', 'expired', 'cancelled');
  end if;
  if not exists (select 1 from pg_type where typname = 'necessity_kind') then
    create type public.necessity_kind as enum ('necessary', 'discretionary');
  end if;
  if not exists (select 1 from pg_type where typname = 'regularity_kind') then
    create type public.regularity_kind as enum ('ordinary', 'extraordinary');
  end if;
  if not exists (select 1 from pg_type where typname = 'pocket_kind') then
    create type public.pocket_kind as enum ('savings', 'reserved');
  end if;
  if not exists (select 1 from pg_type where typname = 'account_kind') then
    create type public.account_kind as enum ('main', 'savings', 'cash', 'card', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_method_kind') then
    create type public.payment_method_kind as enum ('account', 'card', 'cash', 'bizum', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'debt_kind') then
    create type public.debt_kind as enum ('mortgage', 'loan', 'card', 'vehicle', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'category_priority') then
    create type public.category_priority as enum ('protected', 'flexible');
  end if;
  if not exists (select 1 from pg_type where typname = 'recurrence_frequency') then
    create type public.recurrence_frequency as enum ('monthly', 'quarterly', 'yearly', 'custom');
  end if;
  if not exists (select 1 from pg_type where typname = 'planned_kind') then
    create type public.planned_kind as enum ('expense', 'income', 'debt_payment');
  end if;
end
$$;

-- `YYYY-MM`
do $$
begin
  if not exists (select 1 from pg_type where typname = 'month_key') then
    create domain public.month_key as char(7)
      check (value ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Identidad
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text        not null default '',
  email         citext,
  avatar_url    text,
  accent        text        not null default 'leaf',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Perfil público de cada usuario autenticado.';

create table if not exists public.households (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null check (length(btrim(name)) between 1 and 80),
  created_by    uuid        references auth.users (id) on delete set null,
  locale        text        not null default 'es-ES',
  currency      text        not null default 'EUR',
  time_zone     text        not null default 'Europe/Madrid',
  week_starts_on smallint   not null default 1 check (week_starts_on between 0 and 6),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.households is 'Una economía compartida. Todos los datos financieros cuelgan de aquí.';

create table if not exists public.household_members (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.member_role not null default 'member',
  display_name  text not null default '',
  accent        text not null default 'leaf',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, user_id)
);

create index if not exists household_members_user_idx on public.household_members (user_id);
create index if not exists household_members_household_idx on public.household_members (household_id);

create table if not exists public.household_invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  email         citext not null,
  role          public.member_role not null default 'member',
  token         text not null unique,
  status        public.invite_status not null default 'pending',
  created_by    uuid references auth.users (id) on delete set null,
  accepted_by   uuid references auth.users (id) on delete set null,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '14 days')
);

create index if not exists household_invites_email_idx on public.household_invites (email, status);
create index if not exists household_invites_household_idx on public.household_invites (household_id);

-- Preferencias de interfaz por usuario (no financieras).
create table if not exists public.user_preferences (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  current_household_id  uuid references public.households (id) on delete set null,
  reduce_motion         boolean not null default false,
  haptics               boolean not null default true,
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Configuración del hogar
-- ---------------------------------------------------------------------------

create table if not exists public.app_settings (
  household_id      uuid primary key references public.households (id) on delete cascade,
  onboarded         boolean not null default false,
  demo_data_loaded  boolean not null default false,
  last_backup_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cuentas y medios de pago
-- ---------------------------------------------------------------------------

create table if not exists public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null check (length(btrim(name)) between 1 and 60),
  type                  public.account_kind not null default 'main',
  opening_balance_cents bigint not null default 0,
  balance_date          date   not null default current_date,
  counts_as_available   boolean not null default true,
  position              integer not null default 0,
  archived              boolean not null default false,
  created_by_user_id    uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists accounts_household_idx on public.accounts (household_id) where archived = false;

create table if not exists public.payment_methods (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null,
  type          public.payment_method_kind not null default 'account',
  account_id    uuid references public.accounts (id) on delete set null,
  position      integer not null default 0,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists payment_methods_household_idx on public.payment_methods (household_id);

-- ---------------------------------------------------------------------------
-- Categorías, subcategorías, etiquetas, comercios
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 40),
  emoji         text not null default '•',
  tone          smallint not null default 0 check (tone between 0 and 7),
  priority      public.category_priority not null default 'flexible',
  quick         boolean not null default false,
  position      integer not null default 0,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, name)
);

create index if not exists categories_household_idx on public.categories (household_id);

create table if not exists public.subcategories (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  category_id   uuid not null references public.categories (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 40),
  position      integer not null default 0,
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (category_id, name)
);

create index if not exists subcategories_category_idx on public.subcategories (category_id);
create index if not exists subcategories_household_idx on public.subcategories (household_id);

create table if not exists public.tags (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (length(btrim(name)) between 1 and 32),
  archived      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, name)
);

create index if not exists tags_household_idx on public.tags (household_id);

create table if not exists public.merchants (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  name                   text not null,
  normalized             text not null,
  default_category_id    uuid references public.categories (id) on delete set null,
  default_subcategory_id uuid references public.subcategories (id) on delete set null,
  uses                   integer not null default 0,
  last_used_at           timestamptz not null default now(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (household_id, normalized)
);

create index if not exists merchants_household_idx on public.merchants (household_id);

create table if not exists public.income_sources (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null check (length(btrim(name)) between 1 and 60),
  owner_user_id         uuid references auth.users (id) on delete set null,
  expected_amount_cents bigint,
  recurring             boolean not null default true,
  position              integer not null default 0,
  archived              boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (household_id, name)
);

create index if not exists income_sources_household_idx on public.income_sources (household_id);

-- ---------------------------------------------------------------------------
-- Huchas y deudas
-- ---------------------------------------------------------------------------

create table if not exists public.savings_pockets (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null check (length(btrim(name)) between 1 and 60),
  emoji                 text not null default '🌱',
  type                  public.pocket_kind not null default 'savings',
  target_amount_cents   bigint,
  target_date           date,
  opening_balance_cents bigint not null default 0,
  account_id            uuid references public.accounts (id) on delete set null,
  position              integer not null default 0,
  archived              boolean not null default false,
  created_by_user_id    uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists savings_pockets_household_idx on public.savings_pockets (household_id);

create table if not exists public.debts (
  id                      uuid primary key default gen_random_uuid(),
  household_id            uuid not null references public.households (id) on delete cascade,
  name                    text not null check (length(btrim(name)) between 1 and 60),
  type                    public.debt_kind not null default 'loan',
  initial_balance_cents   bigint not null default 0 check (initial_balance_cents >= 0),
  balance_at_start_cents  bigint not null default 0 check (balance_at_start_cents >= 0),
  tracking_start          date not null default current_date,
  installment_cents       bigint not null default 0 check (installment_cents >= 0),
  interest_bps            integer not null default 0 check (interest_bps >= 0),
  start_date              date,
  end_date                date,
  priority                integer not null default 0,
  notes                   text not null default '',
  archived                boolean not null default false,
  created_by_user_id      uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists debts_household_idx on public.debts (household_id);

-- ---------------------------------------------------------------------------
-- Previstos / recurrentes / gastos fijos
-- ---------------------------------------------------------------------------

create table if not exists public.recurring_transactions (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null check (length(btrim(name)) between 1 and 60),
  kind                  public.planned_kind not null default 'expense',
  expected_amount_cents bigint not null check (expected_amount_cents >= 0),
  frequency             public.recurrence_frequency not null default 'monthly',
  day_of_month          smallint not null default 1 check (day_of_month between 1 and 31),
  months                smallint[],
  category_id           uuid references public.categories (id) on delete set null,
  subcategory_id        uuid references public.subcategories (id) on delete set null,
  income_source_id      uuid references public.income_sources (id) on delete set null,
  debt_id               uuid references public.debts (id) on delete cascade,
  account_id            uuid references public.accounts (id) on delete set null,
  owner_user_id         uuid references auth.users (id) on delete set null,
  extraordinary         boolean not null default false,
  installments          smallint,
  active                boolean not null default true,
  notes                 text not null default '',
  created_by_user_id    uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists recurring_household_idx on public.recurring_transactions (household_id) where active;

comment on table public.recurring_transactions is
  'Previstos: gastos fijos, seguros fraccionados, cuotas e ingresos recurrentes. Nunca se dan por pagados solos.';

-- ---------------------------------------------------------------------------
-- MOVIMIENTOS — una fila por movimiento real
-- ---------------------------------------------------------------------------

create table if not exists public.transactions (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  type                  public.transaction_type not null,
  amount_cents          bigint not null check (amount_cents > 0),
  date                  date not null,
  description           text not null default '',
  note                  text not null default '',

  -- gasto
  category_id           uuid references public.categories (id) on delete restrict,
  subcategory_id        uuid references public.subcategories (id) on delete set null,
  merchant_id           uuid references public.merchants (id) on delete set null,
  necessity             public.necessity_kind,
  regularity            public.regularity_kind,

  -- ingreso
  income_source_id      uuid references public.income_sources (id) on delete restrict,
  income_recurring      boolean,

  -- ahorro
  pocket_id             uuid references public.savings_pockets (id) on delete restrict,
  saving_direction      text check (saving_direction in ('in', 'out')),

  -- amortización / cuota
  debt_id               uuid references public.debts (id) on delete restrict,
  debt_payment_type     text check (debt_payment_type in ('installment', 'extra')),

  -- cuentas
  account_id            uuid references public.accounts (id) on delete set null,
  from_account_id       uuid references public.accounts (id) on delete set null,
  to_account_id         uuid references public.accounts (id) on delete set null,
  payment_method_id     uuid references public.payment_methods (id) on delete set null,

  -- previsto vs real (§11)
  expected_amount_cents bigint,
  planned_id            uuid references public.recurring_transactions (id) on delete set null,

  -- autoría (§10, §11, §33)
  owner_user_id         uuid references auth.users (id) on delete set null,
  created_by_user_id    uuid references auth.users (id) on delete set null,
  updated_by_user_id    uuid references auth.users (id) on delete set null,

  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint transactions_shape check (
    case type
      when 'income' then
        income_source_id is not null
        and pocket_id is null and debt_id is null
        and from_account_id is null and to_account_id is null
      when 'expense' then
        category_id is not null and necessity is not null and regularity is not null
        and pocket_id is null and debt_id is null
        and from_account_id is null and to_account_id is null
      when 'saving' then
        pocket_id is not null and saving_direction is not null
        and debt_id is null and category_id is null
        and from_account_id is null and to_account_id is null
      when 'debt_payment' then
        debt_id is not null and debt_payment_type is not null
        and pocket_id is null
        and from_account_id is null and to_account_id is null
      when 'internal_transfer' then
        from_account_id is not null and to_account_id is not null
        and from_account_id <> to_account_id
        and category_id is null and pocket_id is null and debt_id is null
    end
  )
);

create index if not exists transactions_household_date_idx
  on public.transactions (household_id, date desc);
create index if not exists transactions_household_type_idx
  on public.transactions (household_id, type, date desc);
create index if not exists transactions_household_category_idx
  on public.transactions (household_id, category_id) where category_id is not null;
create index if not exists transactions_created_by_idx
  on public.transactions (created_by_user_id);
create index if not exists transactions_planned_idx
  on public.transactions (planned_id) where planned_id is not null;
create index if not exists transactions_debt_idx
  on public.transactions (debt_id) where debt_id is not null;
create index if not exists transactions_pocket_idx
  on public.transactions (pocket_id) where pocket_id is not null;

create table if not exists public.transaction_tags (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  tag_id         uuid not null references public.tags (id) on delete cascade,
  household_id   uuid not null references public.households (id) on delete cascade,
  primary key (transaction_id, tag_id)
);

create index if not exists transaction_tags_tag_idx on public.transaction_tags (tag_id);
create index if not exists transaction_tags_household_idx on public.transaction_tags (household_id);

-- Vistas de conveniencia. NO duplican datos (§26).
create or replace view public.debt_payments as
  select id, household_id, debt_id, amount_cents, date, debt_payment_type,
         account_id, owner_user_id, created_by_user_id, note, created_at, updated_at
  from public.transactions
  where type = 'debt_payment';

create or replace view public.fixed_expenses as
  select *
  from public.recurring_transactions
  where kind in ('expense', 'debt_payment');

-- ---------------------------------------------------------------------------
-- Presupuestos
-- ---------------------------------------------------------------------------

create table if not exists public.monthly_budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  month         public.month_key not null,
  planned_cents bigint not null default 0 check (planned_cents >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, month)
);

-- §52 — cada semana lleva su propio presupuesto, incluidas las parciales.
create table if not exists public.weekly_budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  month         public.month_key not null,
  week_index    smallint not null check (week_index between 1 and 6),
  planned_cents bigint not null default 0 check (planned_cents >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, month, week_index)
);

create table if not exists public.budget_categories (
  id                uuid primary key default gen_random_uuid(),
  household_id      uuid not null references public.households (id) on delete cascade,
  monthly_budget_id uuid references public.monthly_budgets (id) on delete cascade,
  weekly_budget_id  uuid references public.weekly_budgets (id) on delete cascade,
  category_id       uuid not null references public.categories (id) on delete cascade,
  amount_cents      bigint not null default 0 check (amount_cents >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint budget_categories_scope check (
    (monthly_budget_id is not null and weekly_budget_id is null)
    or (monthly_budget_id is null and weekly_budget_id is not null)
  )
);

create unique index if not exists budget_categories_monthly_uidx
  on public.budget_categories (monthly_budget_id, category_id) where monthly_budget_id is not null;
create unique index if not exists budget_categories_weekly_uidx
  on public.budget_categories (weekly_budget_id, category_id) where weekly_budget_id is not null;

-- ---------------------------------------------------------------------------
-- Objetivos, logros, cierres, avisos
-- ---------------------------------------------------------------------------

create table if not exists public.goals (
  id                       uuid primary key default gen_random_uuid(),
  household_id             uuid not null references public.households (id) on delete cascade,
  name                     text not null check (length(btrim(name)) between 1 and 80),
  start_date               date not null,
  end_date                 date not null,
  savings_target_cents     bigint not null default 0 check (savings_target_cents >= 0),
  extra_debt_target_cents  bigint not null default 0 check (extra_debt_target_cents >= 0),
  green_weeks_target       smallint not null default 0 check (green_weeks_target >= 0),
  active                   boolean not null default true,
  created_by_user_id       uuid references auth.users (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint goals_dates check (end_date > start_date)
);

create index if not exists goals_household_idx on public.goals (household_id) where active;

-- Catálogo global de logros (§36: pertenecen al hogar, no a la persona).
create table if not exists public.achievements (
  id          text primary key,
  emoji       text not null,
  title       text not null,
  description text not null,
  position    integer not null default 0
);

create table if not exists public.household_achievements (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  unique (household_id, achievement_id)
);

create index if not exists household_achievements_household_idx
  on public.household_achievements (household_id);

create table if not exists public.weekly_closes (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  month          public.month_key not null,
  week_index     smallint not null check (week_index between 1 and 6),
  start_date     date not null,
  end_date       date not null,
  planned_cents  bigint not null default 0,
  spent_cents    bigint not null default 0,
  margin_cents   bigint not null default 0,
  green          boolean not null default false,
  allocation     jsonb,
  closed_by      uuid references auth.users (id) on delete set null,
  closed_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (household_id, month, week_index)
);

create table if not exists public.monthly_closes (
  id                        uuid primary key default gen_random_uuid(),
  household_id              uuid not null references public.households (id) on delete cascade,
  month                     public.month_key not null,
  income_cents              bigint not null default 0,
  ordinary_cents            bigint not null default 0,
  extraordinary_cents       bigint not null default 0,
  saved_cents               bigint not null default 0,
  debt_paid_cents           bigint not null default 0,
  extra_debt_cents          bigint not null default 0,
  result_cents              bigint not null default 0,
  net_worth_delta_cents     bigint not null default 0,
  narrative                 jsonb not null default '[]'::jsonb,
  closed_by                 uuid references auth.users (id) on delete set null,
  closed_at                 timestamptz not null default now(),
  reopened_at               timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (household_id, month)
);

create table if not exists public.notifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  kind          text not null,
  tone          text not null default 'info',
  title         text not null,
  body          text not null default '',
  target        text,
  date          date not null default current_date,
  dismissed_at  timestamptz,
  dismissed_by  uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists notifications_household_idx
  on public.notifications (household_id, date desc) where dismissed_at is null;

-- Accesos rápidos / favoritos (§95, §97)
create table if not exists public.quick_actions (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households (id) on delete cascade,
  label          text not null,
  emoji          text not null default '⚡',
  kind           public.transaction_type not null default 'expense',
  amount_cents   bigint,
  category_id    uuid references public.categories (id) on delete cascade,
  subcategory_id uuid references public.subcategories (id) on delete set null,
  merchant_id    uuid references public.merchants (id) on delete set null,
  pocket_id      uuid references public.savings_pockets (id) on delete cascade,
  debt_id        uuid references public.debts (id) on delete cascade,
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists quick_actions_household_idx on public.quick_actions (household_id);
