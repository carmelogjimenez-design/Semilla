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
