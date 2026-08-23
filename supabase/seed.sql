-- ===========================================================================
-- SEMILLA · SEED DE DESARROLLO (§29)
--
-- Se ejecuta SOLO con `supabase db reset` en local. Nunca en producción.
-- Crea dos usuarios de prueba que comparten un hogar, con un mes realista.
--
--   carmelo@semilla.test  ·  semilla1234
--   sara@semilla.test     ·  semilla1234
-- ===========================================================================

do $$
declare
  carmelo uuid := '11111111-1111-4111-8111-111111111111';
  sara    uuid := '22222222-2222-4222-8222-222222222222';
  hid     uuid := '33333333-3333-4333-8333-333333333333';
  m0      date := date_trunc('month', current_date)::date;
  month_key char(7) := to_char(current_date, 'YYYY-MM');

  main_acc uuid; save_acc uuid;
  pm_account uuid; pm_card uuid; pm_cash uuid;
  c_food uuid; c_transport uuid; c_home uuid; c_help uuid; c_health uuid;
  c_kids uuid; c_fun uuid; c_shop uuid; c_insurance uuid; c_debt uuid;
  s_super uuid; s_fuel uuid; s_physio uuid; s_school uuid; s_restaurant uuid;
  src_carmelo uuid; src_sara uuid; src_rent uuid;
  p_emergency uuid; p_car uuid; p_xmas uuid; p_holiday uuid;
  d_mortgage uuid; d_ing uuid; d_bbva uuid; d_caixa uuid; d_jaecoo uuid;
  r_mortgage uuid; r_school uuid; r_orange uuid; r_home_ins uuid; r_ing uuid;
  mb uuid;
  merchant_merca uuid; merchant_repsol uuid; merchant_amazon uuid;
begin
  if exists (select 1 from auth.users where id = carmelo) then
    raise notice 'Seed ya aplicado, no se repite.';
    return;
  end if;

  -- Usuarios de desarrollo ------------------------------------------------
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values
    ('00000000-0000-0000-0000-000000000000', carmelo, 'authenticated', 'authenticated',
     'carmelo@semilla.test', crypt('semilla1234', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"display_name":"Carmelo"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', sara, 'authenticated', 'authenticated',
     'sara@semilla.test', crypt('semilla1234', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{"display_name":"Sara"}', now(), now());

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values
    (gen_random_uuid(), carmelo, carmelo::text,
     format('{"sub":"%s","email":"carmelo@semilla.test"}', carmelo)::jsonb, 'email', now(), now(), now()),
    (gen_random_uuid(), sara, sara::text,
     format('{"sub":"%s","email":"sara@semilla.test"}', sara)::jsonb, 'email', now(), now(), now());

  -- Hogar compartido -------------------------------------------------------
  insert into public.households (id, name, created_by) values (hid, 'Familia García', carmelo);
  insert into public.household_members (household_id, user_id, role, display_name, accent) values
    (hid, carmelo, 'owner',  'Carmelo', 'forest'),
    (hid, sara,    'member', 'Sara',    'leaf');

  perform public.seed_household_defaults(hid);
  update public.app_settings set onboarded = true, demo_data_loaded = true where household_id = hid;
  update public.user_preferences set current_household_id = hid where user_id in (carmelo, sara);

  select id into main_acc from public.accounts where household_id = hid and type = 'main';
  select id into save_acc from public.accounts where household_id = hid and type = 'savings';
  select id into pm_account from public.payment_methods where household_id = hid and name = 'Cuenta';
  select id into pm_card    from public.payment_methods where household_id = hid and name = 'Tarjeta';
  select id into pm_cash    from public.payment_methods where household_id = hid and name = 'Efectivo';

  update public.accounts set opening_balance_cents = 412000, balance_date = m0 - 1 where id = main_acc;
  update public.accounts set opening_balance_cents = 843000, balance_date = m0 - 1 where id = save_acc;

  select id into c_food      from public.categories where household_id = hid and name = 'Alimentación';
  select id into c_transport from public.categories where household_id = hid and name = 'Transporte';
  select id into c_home      from public.categories where household_id = hid and name = 'Vivienda';
  select id into c_help      from public.categories where household_id = hid and name = 'Ayuda doméstica';
  select id into c_health    from public.categories where household_id = hid and name = 'Salud';
  select id into c_kids      from public.categories where household_id = hid and name = 'Niños y educación';
  select id into c_fun       from public.categories where household_id = hid and name = 'Ocio';
  select id into c_shop      from public.categories where household_id = hid and name = 'Compras';
  select id into c_insurance from public.categories where household_id = hid and name = 'Seguros';
  select id into c_debt      from public.categories where household_id = hid and name = 'Deuda';

  select id into s_super      from public.subcategories where category_id = c_food and name = 'Supermercado';
  select id into s_fuel       from public.subcategories where category_id = c_transport and name = 'Gasolina';
  select id into s_physio     from public.subcategories where category_id = c_health and name = 'Fisioterapia';
  select id into s_school     from public.subcategories where category_id = c_kids and name = 'Colegio';
  select id into s_restaurant from public.subcategories where category_id = c_fun and name = 'Restaurantes';

  -- Comercios frecuentes (§44)
  insert into public.merchants (household_id, name, normalized, default_category_id, default_subcategory_id, uses)
  values (hid, 'Mercadona', 'mercadona', c_food, s_super, 6) returning id into merchant_merca;
  insert into public.merchants (household_id, name, normalized, default_category_id, default_subcategory_id, uses)
  values (hid, 'Repsol', 'repsol', c_transport, s_fuel, 4) returning id into merchant_repsol;
  insert into public.merchants (household_id, name, normalized, default_category_id, default_subcategory_id, uses)
  values (hid, 'Amazon', 'amazon', c_shop, null, 3) returning id into merchant_amazon;

  -- Etiquetas
  insert into public.tags (household_id, name) values
    (hid, 'Irene'), (hid, 'Javi'), (hid, 'Mía'), (hid, 'Andrea'), (hid, 'Cova'),
    (hid, 'Casa'), (hid, 'Colegio'), (hid, 'Trabajo'), (hid, 'Salud'),
    (hid, 'Viaje'), (hid, 'Extraordinario'), (hid, 'Navidad'), (hid, 'Asturias');

  -- Fuentes de ingreso
  insert into public.income_sources (household_id, name, owner_user_id, expected_amount_cents, recurring, position)
  values (hid, 'Nómina Carmelo', carmelo, 530000, true, 0) returning id into src_carmelo;
  insert into public.income_sources (household_id, name, owner_user_id, expected_amount_cents, recurring, position)
  values (hid, 'Nómina Sara', sara, 185000, true, 1) returning id into src_sara;
  insert into public.income_sources (household_id, name, owner_user_id, expected_amount_cents, recurring, position)
  values (hid, 'Alquiler', null, 71600, true, 2) returning id into src_rent;
  insert into public.income_sources (household_id, name, expected_amount_cents, recurring, position) values
    (hid, 'CIMA', null, false, 3),
    (hid, 'Santiago', null, false, 4),
    (hid, 'Hacienda', null, false, 5),
    (hid, 'Otros', null, false, 6);

  -- Huchas (§27)
  select id into p_emergency from public.savings_pockets where household_id = hid;
  update public.savings_pockets set opening_balance_cents = 813000 where id = p_emergency;

  insert into public.savings_pockets (household_id, name, emoji, type, target_amount_cents, opening_balance_cents, account_id, position)
  values (hid, 'Coche', '🚗', 'reserved', 150000, 60000, save_acc, 1) returning id into p_car;
  insert into public.savings_pockets (household_id, name, emoji, type, target_amount_cents, opening_balance_cents, account_id, position)
  values (hid, 'Navidad', '🎄', 'reserved', 100000, 10000, save_acc, 2) returning id into p_xmas;
  insert into public.savings_pockets (household_id, name, emoji, type, target_amount_cents, opening_balance_cents, account_id, position)
  values (hid, 'Vacaciones', '🏖️', 'reserved', 200000, 50000, save_acc, 3) returning id into p_holiday;
  insert into public.savings_pockets (household_id, name, emoji, type, target_amount_cents, opening_balance_cents, account_id, position)
  values (hid, 'Casa', '🏠', 'reserved', 500000, 120000, save_acc, 4);

  -- Deudas (§30)
  insert into public.debts (household_id, name, type, initial_balance_cents, balance_at_start_cents, tracking_start, installment_cents, interest_bps, priority)
  values (hid, 'Hipoteca', 'mortgage', 21000000, 8600000, m0 - 1, 102900, 195, 5) returning id into d_mortgage;
  insert into public.debts (household_id, name, type, initial_balance_cents, balance_at_start_cents, tracking_start, installment_cents, interest_bps, priority)
  values (hid, 'ING', 'loan', 2500000, 1420000, m0 - 1, 47500, 615, 1) returning id into d_ing;
  insert into public.debts (household_id, name, type, initial_balance_cents, balance_at_start_cents, tracking_start, installment_cents, interest_bps, priority)
  values (hid, 'BBVA', 'loan', 1800000, 980000, m0 - 1, 45200, 690, 2) returning id into d_bbva;
  insert into public.debts (household_id, name, type, initial_balance_cents, balance_at_start_cents, tracking_start, installment_cents, interest_bps, priority)
  values (hid, 'CaixaBank', 'loan', 1200000, 640000, m0 - 1, 34900, 725, 3) returning id into d_caixa;
  insert into public.debts (household_id, name, type, initial_balance_cents, balance_at_start_cents, tracking_start, installment_cents, interest_bps, priority)
  values (hid, 'Jaecoo', 'vehicle', 2600000, 1960000, m0 - 1, 75000, 540, 4) returning id into d_jaecoo;

  -- Previstos / gastos fijos (§24, §62)
  insert into public.recurring_transactions (household_id, name, kind, expected_amount_cents, frequency, day_of_month, category_id, debt_id, account_id)
  values (hid, 'Hipoteca', 'debt_payment', 102900, 'monthly', 5, c_debt, d_mortgage, main_acc) returning id into r_mortgage;
  insert into public.recurring_transactions (household_id, name, kind, expected_amount_cents, frequency, day_of_month, category_id, subcategory_id, account_id)
  values (hid, 'Colegio', 'expense', 66500, 'monthly', 3, c_kids, s_school, main_acc) returning id into r_school;
  insert into public.recurring_transactions (household_id, name, kind, expected_amount_cents, frequency, day_of_month, category_id, account_id)
  values (hid, 'Orange', 'expense', 14000, 'monthly', 8, c_home, main_acc) returning id into r_orange;
  insert into public.recurring_transactions (household_id, name, kind, expected_amount_cents, frequency, day_of_month, category_id, account_id, extraordinary, months)
  values (hid, 'Seguro hogar', 'expense', 38000, 'yearly', 15, c_insurance, main_acc, true,
          array[extract(month from current_date)::smallint]) returning id into r_home_ins;
  insert into public.recurring_transactions (household_id, name, kind, expected_amount_cents, frequency, day_of_month, category_id, debt_id, account_id)
  values (hid, 'ING', 'debt_payment', 47500, 'monthly', 12, c_debt, d_ing, main_acc) returning id into r_ing;
  insert into public.recurring_transactions (household_id, name, kind, expected_amount_cents, frequency, day_of_month, category_id, debt_id, account_id) values
    (hid, 'BBVA', 'debt_payment', 45200, 'monthly', 12, c_debt, d_bbva, main_acc),
    (hid, 'CaixaBank', 'debt_payment', 34900, 'monthly', 14, c_debt, d_caixa, main_acc),
    (hid, 'Jaecoo', 'debt_payment', 75000, 'monthly', 20, c_debt, d_jaecoo, main_acc);

  -- Presupuestos (§52 — semanas distintas, incluidas las parciales)
  insert into public.monthly_budgets (household_id, month, planned_cents)
  values (hid, month_key, 685000) returning id into mb;

  insert into public.budget_categories (household_id, monthly_budget_id, category_id, amount_cents) values
    (hid, mb, c_food, 74000),
    (hid, mb, c_transport, 42000),
    (hid, mb, c_fun, 10000),
    (hid, mb, c_home, 14000),
    (hid, mb, c_health, 8000);

  insert into public.weekly_budgets (household_id, month, week_index, planned_cents) values
    (hid, month_key, 1, 40000),
    (hid, month_key, 2, 47000),
    (hid, month_key, 3, 47000),
    (hid, month_key, 4, 47000),
    (hid, month_key, 5, 21500);

  -- Objetivo activo (§34)
  insert into public.goals (household_id, name, start_date, end_date, savings_target_cents, extra_debt_target_cents, green_weeks_target, created_by_user_id)
  values (hid, 'Nuestro primer año', m0, (m0 + interval '1 year')::date, 1500000, 3000000, 40, carmelo);

  -- Ingresos ---------------------------------------------------------------
  insert into public.transactions (household_id, type, amount_cents, date, description, income_source_id, income_recurring, expected_amount_cents, account_id, payment_method_id, owner_user_id, created_by_user_id) values
    (hid, 'income', 541600, m0,     'Nómina',   src_carmelo, true, 530000, main_acc, pm_account, carmelo, carmelo),
    (hid, 'income', 185000, m0,     'Nómina',   src_sara,    true, 185000, main_acc, pm_account, sara,    sara),
    (hid, 'income',  71600, m0 + 4, 'Alquiler', src_rent,    true,  71600, main_acc, pm_account, carmelo, carmelo);

  -- Gastos -----------------------------------------------------------------
  insert into public.transactions (household_id, type, amount_cents, date, description, category_id, subcategory_id, merchant_id, necessity, regularity, account_id, payment_method_id, owner_user_id, created_by_user_id, planned_id, expected_amount_cents) values
    (hid, 'expense',  66500, m0 + 2,  'Colegio',        c_kids, s_school, null, 'necessary', 'ordinary', main_acc, pm_account, carmelo, carmelo, r_school, 66500),
    (hid, 'expense',  14000, m0 + 7,  'Orange',         c_home, null, null, 'necessary', 'ordinary', main_acc, pm_account, carmelo, carmelo, r_orange, 14000),
    (hid, 'expense',   8742, m0 + 1,  'Mercadona',      c_food, s_super, merchant_merca, 'necessary', 'ordinary', main_acc, pm_card, sara, sara, null, null),
    (hid, 'expense',   6200, m0 + 2,  'Repsol',         c_transport, s_fuel, merchant_repsol, 'necessary', 'ordinary', main_acc, pm_card, carmelo, carmelo, null, null),
    (hid, 'expense',   4310, m0 + 3,  'Mercadona',      c_food, s_super, merchant_merca, 'necessary', 'ordinary', main_acc, pm_card, sara, sara, null, null),
    (hid, 'expense',   3200, m0 + 4,  'Farmacia',       c_health, null, null, 'necessary', 'ordinary', main_acc, pm_cash, sara, sara, null, null),
    (hid, 'expense',   9120, m0 + 6,  'Mercadona',      c_food, s_super, merchant_merca, 'necessary', 'ordinary', main_acc, pm_card, sara, sara, null, null),
    (hid, 'expense',   6000, m0 + 6,  'Limpieza',       c_help, null, null, 'necessary', 'ordinary', main_acc, pm_cash, carmelo, carmelo, null, null),
    (hid, 'expense',   5850, m0 + 8,  'Repsol',         c_transport, s_fuel, merchant_repsol, 'necessary', 'ordinary', main_acc, pm_card, carmelo, carmelo, null, null),
    (hid, 'expense',   4230, m0 + 9,  'Amazon',         c_shop, null, merchant_amazon, 'discretionary', 'ordinary', main_acc, pm_card, sara, sara, null, null),
    (hid, 'expense',   7640, m0 + 10, 'Mercadona',      c_food, s_super, merchant_merca, 'necessary', 'ordinary', main_acc, pm_card, sara, sara, null, null),
    (hid, 'expense',   5400, m0 + 11, 'Restaurante',    c_fun, s_restaurant, null, 'discretionary', 'ordinary', main_acc, pm_card, carmelo, carmelo, null, null),
    (hid, 'expense',   8000, m0 + 12, 'Cuidadora',      c_help, null, null, 'necessary', 'ordinary', main_acc, pm_cash, sara, sara, null, null),
    (hid, 'expense',  12000, m0 + 13, 'Fisio',          c_health, s_physio, null, 'necessary', 'extraordinary', main_acc, pm_card, carmelo, carmelo, null, null),
    (hid, 'expense',   9260, m0 + 14, 'Mercadona',      c_food, s_super, merchant_merca, 'necessary', 'ordinary', main_acc, pm_card, sara, sara, null, null),
    (hid, 'expense',   6410, m0 + 15, 'Repsol',         c_transport, s_fuel, merchant_repsol, 'necessary', 'ordinary', main_acc, pm_card, carmelo, carmelo, null, null),
    (hid, 'expense',  38000, m0 + 14, 'Seguro hogar',   c_insurance, null, null, 'necessary', 'extraordinary', main_acc, pm_account, carmelo, carmelo, r_home_ins, 38000),
    (hid, 'expense',  20000, m0 + 16, 'Vuelta al cole', c_kids, null, null, 'necessary', 'extraordinary', main_acc, pm_card, sara, sara, null, null);

  -- Ahorro (§26)
  insert into public.transactions (household_id, type, amount_cents, date, description, pocket_id, saving_direction, account_id, owner_user_id, created_by_user_id) values
    (hid, 'saving', 30000, m0 + 5,  'Ahorro mensual', p_emergency, 'in', save_acc, carmelo, carmelo),
    (hid, 'saving', 20000, m0 + 5,  'Navidad',        p_xmas,      'in', save_acc, sara,    sara),
    (hid, 'saving', 10000, m0 + 12, 'Vacaciones',     p_holiday,   'in', save_acc, sara,    sara);

  -- Cuotas y amortización extraordinaria (§32)
  insert into public.transactions (household_id, type, amount_cents, date, description, debt_id, debt_payment_type, account_id, payment_method_id, owner_user_id, created_by_user_id, planned_id, expected_amount_cents) values
    (hid, 'debt_payment', 102900, m0 + 4,  'Cuota hipoteca', d_mortgage, 'installment', main_acc, pm_account, carmelo, carmelo, r_mortgage, 102900),
    (hid, 'debt_payment',  47500, m0 + 11, 'Cuota ING',      d_ing,      'installment', main_acc, pm_account, carmelo, carmelo, r_ing, 47500),
    (hid, 'debt_payment',  50000, m0 + 13, 'Amortización',   d_ing,      'extra',       main_acc, pm_account, carmelo, carmelo, null, null);

  -- Etiquetas sobre movimientos
  insert into public.transaction_tags (transaction_id, tag_id, household_id)
  select t.id, tg.id, hid
  from public.transactions t
  join public.tags tg on tg.household_id = hid and tg.name = 'Salud'
  where t.household_id = hid and t.description = 'Fisio';

  insert into public.transaction_tags (transaction_id, tag_id, household_id)
  select t.id, tg.id, hid
  from public.transactions t
  join public.tags tg on tg.household_id = hid and tg.name = 'Colegio'
  where t.household_id = hid and t.description in ('Colegio', 'Vuelta al cole');

  -- Accesos rápidos (§95, §97)
  insert into public.quick_actions (household_id, label, emoji, kind, category_id, subcategory_id, merchant_id, position) values
    (hid, 'Gasolina',  '⛽', 'expense', c_transport, s_fuel,  merchant_repsol, 0),
    (hid, 'Mercadona', '🛒', 'expense', c_food,      s_super, merchant_merca,  1),
    (hid, 'Limpieza',  '🧺', 'expense', c_help,      null,    null,            2),
    (hid, 'Cuidadora', '👶', 'expense', c_help,      null,    null,            3);

  raise notice 'Seed de desarrollo listo. carmelo@semilla.test / sara@semilla.test — semilla1234';
end
$$;
