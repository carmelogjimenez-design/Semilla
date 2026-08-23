-- ===========================================================================
-- SEMILLA · ESQUEMA COMPLETO (todo en uno)
--
-- CÓMO USARLO
--   1. Entra en tu proyecto de Supabase.
--   2. Menú lateral → SQL Editor → New query.
--   3. Copia TODO este archivo y pégalo.
--   4. Pulsa RUN (o Ctrl/Cmd + Enter).
--
-- Tarda unos segundos. Al terminar debe decir "Success. No rows returned".
-- Es re-ejecutable: si lo lanzas dos veces no rompe nada.
--
-- NO incluye datos de prueba. Producción empieza limpia.
-- Equivale a los 4 archivos de supabase/migrations/ ejecutados en orden.
-- ===========================================================================



-- ###########################################################################
-- ORIGEN: supabase/migrations/20260823090000_init_schema.sql
-- ###########################################################################

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


-- ###########################################################################
-- ORIGEN: supabase/migrations/20260823090100_functions_triggers.sql
-- ###########################################################################

-- ===========================================================================
-- SEMILLA · 02 — Funciones, triggers y bootstrap del hogar
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'profiles', 'households', 'household_members', 'user_preferences', 'app_settings',
    'accounts', 'payment_methods', 'categories', 'subcategories', 'tags', 'merchants',
    'income_sources', 'savings_pockets', 'debts', 'recurring_transactions',
    'transactions', 'monthly_budgets', 'weekly_budgets', 'budget_categories',
    'goals', 'weekly_closes', 'monthly_closes', 'quick_actions'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Perfil automático al registrarse
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = case
          when public.profiles.display_name = '' then excluded.display_name
          else public.profiles.display_name
        end;

  insert into public.user_preferences (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Autoría de movimientos (§33)
-- ---------------------------------------------------------------------------

create or replace function public.stamp_transaction_actor()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id := coalesce(new.created_by_user_id, auth.uid());
    new.owner_user_id := coalesce(new.owner_user_id, auth.uid());
  else
    new.created_by_user_id := old.created_by_user_id;
    new.updated_by_user_id := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_actor on public.transactions;
create trigger stamp_actor
  before insert or update on public.transactions
  for each row execute function public.stamp_transaction_actor();

-- Coherencia: las etiquetas heredan el household del movimiento.
create or replace function public.stamp_transaction_tag_household()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select t.household_id into new.household_id
  from public.transactions t where t.id = new.transaction_id;
  return new;
end;
$$;

drop trigger if exists stamp_tag_household on public.transaction_tags;
create trigger stamp_tag_household
  before insert on public.transaction_tags
  for each row execute function public.stamp_transaction_tag_household();

-- ---------------------------------------------------------------------------
-- Pertenencia al hogar — base de TODA la seguridad
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

create or replace function public.current_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Categorías por defecto (§13)
-- ---------------------------------------------------------------------------

create or replace function public.seed_household_defaults(hid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  spec jsonb := '[
    {"name":"Alimentación","emoji":"🛒","tone":0,"priority":"protected","quick":true,
     "subs":["Supermercado","Carnicería","Pescadería","Fruta","Panadería","Comida preparada","Snacks","Otros"]},
    {"name":"Transporte","emoji":"⛽","tone":1,"priority":"protected","quick":true,
     "subs":["Gasolina","Parking","Peajes","Transporte público","Taller","Mantenimiento","Lavado","Otros"]},
    {"name":"Vivienda","emoji":"🏠","tone":2,"priority":"protected","quick":true,
     "subs":["Hipoteca","Electricidad","Gas","Agua","Internet","Reparaciones","Ferretería","Muebles","Electrodomésticos"]},
    {"name":"Ayuda doméstica","emoji":"🧺","tone":3,"priority":"flexible","quick":false,
     "subs":["Limpieza","Cuidadora","Babysitter","Ayuda puntual","Plancha","Otros"]},
    {"name":"Salud","emoji":"❤️","tone":4,"priority":"protected","quick":true,
     "subs":["Farmacia","Médico","Fisioterapia","Dentista","Óptica","Pruebas","Tratamientos","Otros"]},
    {"name":"Niños y educación","emoji":"👶","tone":5,"priority":"protected","quick":true,
     "subs":["Colegio","Comedor","Material","Libros","Actividades","Deporte","Excursiones","Ropa","Cumpleaños","Cuidadores","Otros"]},
    {"name":"Ocio","emoji":"🍽️","tone":6,"priority":"flexible","quick":true,
     "subs":["Restaurantes","Cafés","Bares","Delivery","Cine","Planes","Escapadas","Viajes","Otros"]},
    {"name":"Personal","emoji":"💇","tone":7,"priority":"flexible","quick":false,
     "subs":["Ropa","Peluquería","Gimnasio","Estética","Cuidado personal"]},
    {"name":"Compras","emoji":"🛍️","tone":3,"priority":"flexible","quick":true,
     "subs":["Amazon","Casa","Regalos","Tecnología","Otros"]},
    {"name":"Digital","emoji":"📱","tone":1,"priority":"flexible","quick":false,
     "subs":["Apple","ChatGPT","Streaming","Software","Almacenamiento","Otras suscripciones"]},
    {"name":"Seguros","emoji":"🛡️","tone":2,"priority":"protected","quick":false,
     "subs":["Hogar","Coche","Furgoneta","Salud","Otros"]},
    {"name":"Deuda","emoji":"🏦","tone":5,"priority":"protected","quick":false,
     "subs":["Hipoteca","ING","BBVA","CaixaBank","Jaecoo","Otros"]},
    {"name":"Otros","emoji":"✳️","tone":7,"priority":"flexible","quick":false,
     "subs":["Varios"]}
  ]'::jsonb;
  item jsonb;
  sub text;
  cat_id uuid;
  idx integer := 0;
  sub_idx integer;
  main_account uuid;
  savings_account uuid;
begin
  if exists (select 1 from public.categories where household_id = hid) then
    return;
  end if;

  for item in select * from jsonb_array_elements(spec) loop
    insert into public.categories (household_id, name, emoji, tone, priority, quick, position)
    values (
      hid,
      item ->> 'name',
      item ->> 'emoji',
      (item ->> 'tone')::smallint,
      (item ->> 'priority')::public.category_priority,
      (item ->> 'quick')::boolean,
      idx
    )
    returning id into cat_id;

    sub_idx := 0;
    for sub in select * from jsonb_array_elements_text(item -> 'subs') loop
      insert into public.subcategories (household_id, category_id, name, position)
      values (hid, cat_id, sub, sub_idx);
      sub_idx := sub_idx + 1;
    end loop;

    idx := idx + 1;
  end loop;

  insert into public.accounts (household_id, name, type, counts_as_available, position)
  values (hid, 'Cuenta principal', 'main', true, 0)
  returning id into main_account;

  insert into public.accounts (household_id, name, type, counts_as_available, position)
  values (hid, 'Cuenta de ahorro', 'savings', false, 1)
  returning id into savings_account;

  insert into public.accounts (household_id, name, type, counts_as_available, position)
  values (hid, 'Efectivo', 'cash', true, 2);

  insert into public.payment_methods (household_id, name, type, account_id, position) values
    (hid, 'Cuenta', 'account', main_account, 0),
    (hid, 'Tarjeta', 'card', main_account, 1),
    (hid, 'Efectivo', 'cash', null, 2),
    (hid, 'Bizum', 'bizum', main_account, 3),
    (hid, 'Otro', 'other', null, 4);

  insert into public.savings_pockets
    (household_id, name, emoji, type, target_amount_cents, account_id, position)
  values
    (hid, 'Fondo de emergencia', '🛡️', 'savings', 1500000, savings_account, 0);

  insert into public.app_settings (household_id) values (hid)
  on conflict (household_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- Crear hogar (§14 caso A) — atómico y a prueba de RLS
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
begin
  if uid is null then
    raise exception 'No hay sesión activa' using errcode = '28000';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'El hogar necesita un nombre' using errcode = '22023';
  end if;

  insert into public.households (name, created_by)
  values (btrim(p_name), uid)
  returning id into hid;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (
    hid, uid, 'owner',
    coalesce(nullif(btrim(p_display_name), ''), (select display_name from public.profiles where id = uid), '')
  );

  perform public.seed_household_defaults(hid);

  update public.user_preferences set current_household_id = hid, updated_at = now()
  where user_id = uid;

  if not found then
    insert into public.user_preferences (user_id, current_household_id) values (uid, hid);
  end if;

  return hid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitaciones (§12, §13)
-- ---------------------------------------------------------------------------

create or replace function public.create_invite(
  p_household_id uuid,
  p_email text,
  p_role public.member_role default 'member'
)
returns public.household_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result public.household_invites;
begin
  if uid is null then
    raise exception 'No hay sesión activa' using errcode = '28000';
  end if;
  if not public.is_household_owner(p_household_id) then
    raise exception 'Solo quien creó el hogar puede invitar' using errcode = '42501';
  end if;
  if coalesce(btrim(p_email), '') = '' then
    raise exception 'Hace falta un correo' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.household_members m
    join public.profiles pr on pr.id = m.user_id
    where m.household_id = p_household_id and pr.email = btrim(p_email)::citext
  ) then
    raise exception 'Esa persona ya forma parte del hogar' using errcode = '23505';
  end if;

  update public.household_invites
  set status = 'cancelled'
  where household_id = p_household_id
    and email = btrim(p_email)::citext
    and status = 'pending';

  insert into public.household_invites (household_id, email, role, token, created_by)
  values (
    p_household_id,
    btrim(p_email)::citext,
    p_role,
    encode(gen_random_bytes(24), 'hex'),
    uid
  )
  returning * into result;

  return result;
end;
$$;

/**
 * Vista previa pública de una invitación: sólo el nombre del hogar y su estado.
 * Permite pintar la pantalla de bienvenida sin haber iniciado sesión todavía.
 */
create or replace function public.invite_preview(p_token text)
returns table (household_name text, email citext, status public.invite_status, expired boolean)
language sql
stable
security definer
set search_path = public
as $$
  select h.name, i.email, i.status, (i.expires_at < now())
  from public.household_invites i
  join public.households h on h.id = i.household_id
  where i.token = p_token;
$$;

create or replace function public.accept_invite(p_token text, p_display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  invite public.household_invites;
  user_email citext;
begin
  if uid is null then
    raise exception 'No hay sesión activa' using errcode = '28000';
  end if;

  select * into invite from public.household_invites where token = p_token for update;

  if invite.id is null then
    raise exception 'Invitación no encontrada' using errcode = 'P0002';
  end if;
  if invite.status = 'accepted' then
    if exists (select 1 from public.household_members
               where household_id = invite.household_id and user_id = uid) then
      return invite.household_id;
    end if;
    raise exception 'Esta invitación ya se ha utilizado' using errcode = '22023';
  end if;
  if invite.status <> 'pending' then
    raise exception 'Esta invitación ya no es válida' using errcode = '22023';
  end if;
  if invite.expires_at < now() then
    update public.household_invites set status = 'expired' where id = invite.id;
    raise exception 'Esta invitación ha caducado' using errcode = '22023';
  end if;

  select email into user_email from public.profiles where id = uid;
  if user_email is null or user_email <> invite.email then
    raise exception 'Esta invitación es para %', invite.email using errcode = '42501';
  end if;

  insert into public.household_members (household_id, user_id, role, display_name)
  values (
    invite.household_id, uid, invite.role,
    coalesce(nullif(btrim(p_display_name), ''), (select display_name from public.profiles where id = uid), '')
  )
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
  set status = 'accepted', accepted_by = uid, accepted_at = now()
  where id = invite.id;

  update public.user_preferences
  set current_household_id = invite.household_id, updated_at = now()
  where user_id = uid;

  if not found then
    insert into public.user_preferences (user_id, current_household_id)
    values (uid, invite.household_id);
  end if;

  return invite.household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

revoke all on function public.seed_household_defaults(uuid) from public, anon, authenticated;

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.create_invite(uuid, text, public.member_role) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.is_household_member(uuid) to authenticated;
grant execute on function public.is_household_owner(uuid) to authenticated;
grant execute on function public.current_household_ids() to authenticated;


-- ###########################################################################
-- ORIGEN: supabase/migrations/20260823090200_rls_policies.sql
-- ###########################################################################

-- ===========================================================================
-- SEMILLA · 03 — Row Level Security
--
-- Regla única: sólo puedes ver y tocar datos de un hogar al que perteneces.
-- Se comprueba en PostgreSQL, no en el frontend.
-- ===========================================================================

-- Las vistas deben respetar las políticas del usuario que consulta.
alter view public.debt_payments set (security_invoker = on);
alter view public.fixed_expenses set (security_invoker = on);

-- ---------------------------------------------------------------------------
-- Tablas financieras con household_id — política uniforme
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'app_settings', 'accounts', 'payment_methods', 'categories', 'subcategories',
    'tags', 'merchants', 'income_sources', 'savings_pockets', 'debts',
    'recurring_transactions', 'transactions', 'transaction_tags',
    'monthly_budgets', 'weekly_budgets', 'budget_categories', 'goals',
    'household_achievements', 'weekly_closes', 'monthly_closes',
    'notifications', 'quick_actions'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
       using (public.is_household_member(household_id))', t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated
       with check (public.is_household_member(household_id))', t || '_insert', t);

    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
       using (public.is_household_member(household_id))
       with check (public.is_household_member(household_id))', t || '_update', t);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
       using (public.is_household_member(household_id))', t || '_delete', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1
      from public.household_members mine
      join public.household_members theirs on theirs.household_id = mine.household_id
      where mine.user_id = auth.uid() and theirs.user_id = public.profiles.id
    )
  );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- households
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;

drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

drop policy if exists households_delete on public.households;
create policy households_delete on public.households
  for delete to authenticated
  using (public.is_household_owner(id));

-- La creación pasa siempre por public.create_household(), que además siembra
-- categorías, cuentas y ajustes en la misma transacción.

-- ---------------------------------------------------------------------------
-- household_members
-- ---------------------------------------------------------------------------

alter table public.household_members enable row level security;

drop policy if exists household_members_select on public.household_members;
create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_members_insert on public.household_members;
create policy household_members_insert on public.household_members
  for insert to authenticated
  with check (public.is_household_owner(household_id));

drop policy if exists household_members_update on public.household_members;
create policy household_members_update on public.household_members
  for update to authenticated
  using (user_id = auth.uid() or public.is_household_owner(household_id))
  with check (user_id = auth.uid() or public.is_household_owner(household_id));

drop policy if exists household_members_delete on public.household_members;
create policy household_members_delete on public.household_members
  for delete to authenticated
  using (user_id = auth.uid() or public.is_household_owner(household_id));

-- ---------------------------------------------------------------------------
-- household_invites
-- ---------------------------------------------------------------------------

alter table public.household_invites enable row level security;

drop policy if exists household_invites_select on public.household_invites;
create policy household_invites_select on public.household_invites
  for select to authenticated
  using (
    public.is_household_member(household_id)
    or email = (select p.email from public.profiles p where p.id = auth.uid())
  );

drop policy if exists household_invites_update on public.household_invites;
create policy household_invites_update on public.household_invites
  for update to authenticated
  using (public.is_household_owner(household_id))
  with check (public.is_household_owner(household_id));

drop policy if exists household_invites_delete on public.household_invites;
create policy household_invites_delete on public.household_invites
  for delete to authenticated
  using (public.is_household_owner(household_id));

-- El alta pasa por public.create_invite() para garantizar token y validaciones.

-- ---------------------------------------------------------------------------
-- user_preferences
-- ---------------------------------------------------------------------------

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_all on public.user_preferences;
create policy user_preferences_all on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- achievements (catálogo global de sólo lectura)
-- ---------------------------------------------------------------------------

alter table public.achievements enable row level security;

drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements
  for select to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Realtime (§22) — Sara registra, Carmelo lo ve.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  tables text[] := array[
    'transactions', 'transaction_tags', 'savings_pockets', 'debts',
    'monthly_budgets', 'weekly_budgets', 'budget_categories',
    'recurring_transactions', 'goals', 'household_achievements',
    'weekly_closes', 'monthly_closes', 'accounts', 'categories',
    'subcategories', 'tags', 'merchants', 'income_sources',
    'household_members', 'quick_actions', 'notifications', 'app_settings'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- Realtime necesita la fila completa para reconciliar cambios y borrados.
alter table public.transactions replica identity full;
alter table public.transaction_tags replica identity full;


-- ###########################################################################
-- ORIGEN: supabase/migrations/20260823090300_achievements_catalog.sql
-- ###########################################################################

-- ===========================================================================
-- SEMILLA · 04 — Catálogo de logros (§37)
-- Los logros pertenecen al HOGAR, no a la persona (§36).
-- ===========================================================================

insert into public.achievements (id, emoji, title, description, position) values
  ('first-seed',     '🌱', 'Primera semilla',  'Habéis registrado vuestro primer ingreso.', 0),
  ('green-week',     '🏆', 'Semana verde',     'Una semana entera dentro del presupuesto.', 1),
  ('streak-3',       '🔥', 'En racha',         'Tres semanas seguidas dentro del plan.', 2),
  ('first-pocket',   '🫙', 'Primera hucha',    'Habéis creado vuestra primera hucha.', 3),
  ('first-cushion',  '🛡️', 'Primer colchón',   '1.000 € ahorrados.', 4),
  ('strong-roots',   '🌳', 'Raíces fuertes',   '5.000 € en el fondo de emergencia.', 5),
  ('full-pocket',    '🎯', 'Hucha completa',   'Habéis llegado al objetivo de una hucha.', 6),
  ('first-strike',   '⚔️', 'Primer golpe',     'Primera amortización extraordinaria.', 7),
  ('strike-1k',      '💥', 'Golpe de 1K',      'Una amortización de 1.000 € de una vez.', 8),
  ('debt-10k',       '📉', '10K menos',        '10.000 € menos de deuda.', 9),
  ('round-month',    '🎯', 'Mes redondo',      'Un mes completo dentro del objetivo.', 10),
  ('first-quarter',  '🌿', 'Primer trimestre', 'Tres meses cerrados.', 11),
  ('consistency-10', '🏅', 'Constancia',       'Diez semanas registrando movimientos.', 12)
on conflict (id) do update
  set emoji = excluded.emoji,
      title = excluded.title,
      description = excluded.description,
      position = excluded.position;
