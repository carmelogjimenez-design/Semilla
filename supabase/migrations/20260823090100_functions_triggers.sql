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
