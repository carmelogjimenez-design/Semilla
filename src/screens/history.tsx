'use client';

import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Lightbulb, LockOpen, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';

import { MonthCloseSheet } from '@/components/flows/month-close-sheet';
import { Card, Chip, EmptyState, SectionTitle } from '@/components/ui/primitives';
import {
  averageExpenses,
  buildMonthCloseDraft,
  compareCategories,
  historyMonths,
  isMonthClosable,
  monthRow,
  type CategoryChange,
} from '@/domain/closing';
import { addMonths, capitalize, formatDayLong, monthLabel } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import { useSemilla } from '@/state/semilla-provider';

/**
 * HISTÓRICO (§32, §66) — la memoria del hogar.
 *
 * Un mes cerrado se lee como se cerró: con su relato guardado, no recalculado.
 * Los meses abiertos se muestran igual, pero marcados como en curso, para que
 * nadie confunda una foto con una película a medias.
 */
export function HistoryScreen() {
  const { data, view, today, month } = useSemilla();
  const [selected, setSelected] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const months = useMemo(() => historyMonths(data, month, 12), [data, month]);

  /* Se abre por el mes que está esperando cierre. Si no hay ninguno, por el más
     reciente: quien entra aquí casi siempre viene a cerrar algo. */
  const pending = months.find(
    (entry) =>
      isMonthClosable(entry, today) &&
      !data.monthlyCloses.some((close) => close.month === entry && close.reopenedAt === null),
  );
  const openMonth = selected ?? pending ?? months[0] ?? month;

  const rows = useMemo(() => months.map((entry) => monthRow(data, entry)), [months, data]);
  const current = rows.find((row) => row.month === openMonth) ?? null;

  const draft = useMemo(
    () => buildMonthCloseDraft({ data, month: openMonth, categories: data.categories }),
    [data, openMonth],
  );

  /* Comparar contra un mes sin datos no compara nada: saldrían todas las
     categorías «subiendo» sólo porque antes no existían. */
  const previousMonth = addMonths(openMonth, -1);
  const hasPrevious = useMemo(
    () => months.includes(previousMonth),
    [months, previousMonth],
  );
  const changes = useMemo(
    () => (hasPrevious ? compareCategories({ data, month: openMonth, previous: previousMonth }) : []),
    [hasPrevious, data, openMonth, previousMonth],
  );

  const average = useMemo(() => averageExpenses(data, openMonth, 3), [data, openMonth]);
  const closable = isMonthClosable(openMonth, today);
  const closed = current?.closed ?? null;

  if (months.length === 0) {
    return (
      <div className="px-5 pb-nav pt-safe">
        <header className="py-4">
          <Link href="/progreso" className="text-[13px] font-medium text-muted">
            ‹ Progreso
          </Link>
          <h1 className="mt-1 text-title text-ink">Histórico</h1>
        </header>
        <EmptyState
          emoji="📚"
          title="Todavía no hay historia"
          body="En cuanto registréis movimientos, aquí quedará el recorrido mes a mes."
        />
      </div>
    );
  }

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/progreso" className="text-[13px] font-medium text-muted">
          ‹ Progreso
        </Link>
        <h1 className="mt-1 text-title text-ink">Histórico</h1>
        <p className="mt-0.5 text-[13px] text-muted">Cómo ha ido cada mes.</p>
      </header>

      {/* Selector de mes */}
      <div className="rail mb-4">
        {months.map((entry) => (
          <Chip key={entry} active={entry === openMonth} onClick={() => setSelected(entry)}>
            {capitalize(monthLabel(entry, { capitalize: false })).slice(0, 3)}
            <span className="ml-1 text-[11px] opacity-60">{entry.slice(2, 4)}</span>
          </Chip>
        ))}
      </div>

      {/* El mes elegido */}
      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[17px] font-semibold text-ink">
            {capitalize(monthLabel(openMonth, { year: true, capitalize: false }))}
          </p>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              closed ? 'bg-sage text-seed-800' : 'bg-stone-100 text-muted'
            }`}
          >
            {closed ? 'Cerrado' : closable ? 'Sin cerrar' : 'En curso'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <Figure label="Entró" value={draft.income} />
          <Figure label="Salió" value={draft.expenses} />
          <Figure label="Resultado" value={draft.result} signed />
        </div>

        {average !== null && draft.expenses > 0 ? (
          <p className="mt-4 text-[13px] leading-relaxed text-muted tnum">
            La media de los meses anteriores es {formatCurrency(average)}. Este mes va{' '}
            {formatCurrency(Math.abs(draft.expenses - average))}{' '}
            {draft.expenses > average ? 'por encima' : 'por debajo'}.
          </p>
        ) : null}

        {closed ? (
          <div className="mt-4 space-y-2 border-t border-stone-100 pt-4">
            {closed.narrative.map((line) => (
              <p key={line} className="text-[14px] leading-relaxed text-ink">
                {line}
              </p>
            ))}
            <p className="pt-1 text-[12px] text-muted">
              Cerrado el {formatDayLong(closed.closedAt.slice(0, 10))}.
            </p>
          </div>
        ) : null}

        {closable && !closed ? (
          <button
            type="button"
            onClick={() => setClosing(openMonth)}
            className="mt-4 w-full touch rounded-2xl bg-forest py-3.5 text-[15px] font-semibold text-white active:opacity-90"
          >
            Cerrar {monthLabel(openMonth, { capitalize: false })}
          </button>
        ) : null}
      </Card>

      {/* Comparativa por categorías (§66) */}
      {changes.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>Qué cambió</SectionTitle>
          <Card className="space-y-3.5">
            <p className="text-[12px] leading-relaxed text-muted">
              Frente a {monthLabel(previousMonth, { capitalize: false })}. Ordenado por lo que más se movió,
              no por lo que más pesa.
            </p>
            {changes.map((change) => (
              <ChangeRow key={change.categoryId} change={change} />
            ))}
          </Card>
        </section>
      ) : null}

      {/* Insights deterministas (§60) — sólo del mes en curso */}
      {openMonth === month && view.insights.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>Lo que se ve</SectionTitle>
          <Card className="space-y-3">
            {view.insights.map((insight) => (
              <div key={insight.id} className="flex gap-3">
                <Lightbulb
                  size={16}
                  className={`mt-0.5 shrink-0 ${
                    insight.tone === 'good'
                      ? 'text-seed-600'
                      : insight.tone === 'watch'
                        ? 'text-clay-deep'
                        : 'text-muted'
                  }`}
                  aria-hidden
                />
                <p className="text-[14px] leading-relaxed text-ink">{insight.text}</p>
              </div>
            ))}
            <p className="pt-1 text-[12px] leading-relaxed text-muted">
              Salen de comparar vuestros propios números. Ninguna frase la escribe una IA.
            </p>
          </Card>
        </section>
      ) : null}

      {/* Semanas cerradas del mes */}
      <WeekCloses month={openMonth} />

      <MonthCloseSheet
        open={closing !== null}
        onClose={() => setClosing(null)}
        draft={closing ? draft : null}
      />
    </div>
  );
}

function WeekCloses({ month }: { month: string }) {
  const { data, actions } = useSemilla();
  const closes = data.weeklyCloses
    .filter((close) => close.month === month)
    .sort((a, b) => a.weekIndex - b.weekIndex);

  if (closes.length === 0) return null;

  return (
    <section className="mt-6">
      <SectionTitle>Semanas cerradas</SectionTitle>
      <Card className="space-y-3">
        {closes.map((close) => (
          <div key={close.id} className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold ${
                close.green ? 'bg-sage text-seed-800' : 'bg-stone-100 text-muted'
              }`}
            >
              S{close.weekIndex}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] text-ink tnum">
                {formatCurrency(close.spent)} de {formatCurrency(close.planned)}
              </p>
              <p className="text-[12px] text-muted tnum">
                {close.margin >= 0
                  ? `Sobraron ${formatCurrency(close.margin)}`
                  : `${formatCurrency(-close.margin)} por encima`}
                {close.allocation && close.allocation.type !== 'keep' ? ' · repartido' : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => actions.reopenWeek(close.id)}
              className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-[12px] font-semibold text-ink active:bg-stone-200"
            >
              <LockOpen size={13} /> Reabrir
            </button>
          </div>
        ))}
        <p className="pt-1 text-[12px] leading-relaxed text-muted">
          Reabrir una semana borra su cierre, pero no toca los movimientos que se crearon al repartir el
          margen: esos siguen ahí.
        </p>
      </Card>
    </section>
  );
}

function ChangeRow({ change }: { change: CategoryChange }) {
  const up = change.delta > 0;
  const flat = change.delta === 0;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="w-5 shrink-0 text-center">
        {change.emoji}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{change.name}</span>
      <span className="shrink-0 text-right">
        <span className="block text-[14px] font-semibold tnum text-ink">
          {formatCurrency(change.current)}
        </span>
        <span
          className={`flex items-center justify-end gap-0.5 text-[12px] tnum ${
            flat ? 'text-muted' : up ? 'text-clay-deep' : 'text-seed-700'
          }`}
        >
          <Icon size={12} aria-hidden />
          {formatCurrency(Math.abs(change.delta))}
        </span>
      </span>
    </div>
  );
}

function Figure({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return (
    <div className="rounded-2xl bg-warm px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tnum text-ink">
        {formatCurrency(value, signed ? { signed: true } : {})}
      </p>
    </div>
  );
}
