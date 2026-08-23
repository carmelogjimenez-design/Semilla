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
