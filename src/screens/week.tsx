'use client';

import { ChevronLeft, ChevronRight, Pencil, ShieldCheck, Waves } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AmountSheet } from '@/components/flows/amount-sheet';
import { TransactionDetailSheet } from '@/components/flows/transaction-detail-sheet';
import { TransactionRow } from '@/components/transaction-row';
import { BudgetBar, ProgressRing } from '@/components/ui/progress';
import { Card, Chip, EmptyState, SectionTitle, StatusChip } from '@/components/ui/primitives';
import { statusLabel } from '@/domain/calculations';
import { capitalize, formatRange, monthLabel, weekProgress } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import { buildCategorySpend } from '@/domain/selectors';
import type { HealthStatus, Transaction } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * SEMANA responde a: ¿cuánto podemos gastar? (§21, §129)
 *
 * La semana es la unidad psicológica de Semilla. Aquí se ve entera: lo que hay,
 * lo que se ha ido, en qué, y a qué ritmo. Sin una sola tabla.
 */
export function WeekScreen() {
  const { data, view, today, month, setMonth, actions, currentMember } = useSemilla();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [categoryLimit, setCategoryLimit] = useState<{ id: string; name: string; amount: number } | null>(
    null,
  );
  const [selected, setSelected] = useState<Transaction | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const weeks = view.weeks;
  const activeIndex = selectedIndex ?? view.currentWeek?.week.index ?? weeks[0]?.week.index ?? 1;
  const week = weeks.find((w) => w.week.index === activeIndex) ?? weeks[0] ?? null;

  /* Trae a la vista la semana seleccionada: en un mes de seis semanas, la última
     quedaría fuera de pantalla. */
  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeIndex, month]);

  const progress = week ? weekProgress(week.week, today) : { elapsed: 0, remaining: 0 };
  const elapsedRatio = week ? progress.elapsed / week.week.days : 0;
  const paceVariance = week ? Math.round(week.planned * elapsedRatio) - week.spent : 0;

  const weekTransactions = useMemo(
    () =>
      week
        ? data.transactions.filter((t) => t.date >= week.week.start && t.date <= week.week.end)
        : [],
    [data.transactions, week],
  );

  const weekBudget = week
    ? data.weeklyBudgets.find((b) => b.month === month && b.weekIndex === week.week.index)
    : undefined;

  const categories = useMemo(
    () =>
      buildCategorySpend({
        categories: data.categories,
        transactions: weekTransactions,
        limits: new Map((weekBudget?.categoryLimits ?? []).map((l) => [l.categoryId, l.amount])),
        elapsedRatio,
      }),
    [data.categories, weekTransactions, weekBudget, elapsedRatio],
  );

  const weekSpent = week?.spent ?? 0;
  const overspent = week ? week.available < 0 : false;
  const protectedCategories = categories.filter((c) => c.category.priority === 'protected');
  const flexibleCategories = categories.filter((c) => c.category.priority === 'flexible');

  function changeMonth(delta: number) {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year ?? 2026, (m ?? 1) - 1 + delta, 1));
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
    setSelectedIndex(null);
  }

  if (!week) {
    return (
      <div className="px-5 pb-nav pt-safe">
        <header className="py-4">
          <h1 className="text-title text-ink">Semana</h1>
        </header>
        <EmptyState title="Aún no hay semanas que mostrar" />
      </div>
    );
  }

  return (
    <div className="px-5 pb-nav pt-safe">
      {/* Cabecera con navegación de mes */}
      <header className="flex items-center justify-between gap-2 py-4">
        <div className="min-w-0">
          <h1 className="text-title text-ink">Semana {week.week.index}</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {formatRange(week.week.start, week.week.end)}
            {week.week.partial ? ' · semana parcial' : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-1 py-1">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => changeMonth(-1)}
            className="rounded-full p-1.5 text-ink active:bg-stone-200"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-1 text-[12px] font-semibold text-ink">
            {capitalize(monthLabel(month)).slice(0, 3)}
          </span>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => changeMonth(1)}
            className="rounded-full p-1.5 text-ink active:bg-stone-200"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* Selector de semanas del mes */}
      <div className="rail mb-4" ref={railRef}>
        {weeks.map((entry) => (
          <div key={entry.week.key} data-active={entry.week.index === week.week.index}>
            <Chip
              active={entry.week.index === week.week.index}
              onClick={() => setSelectedIndex(entry.week.index)}
            >
              S{entry.week.index}
              <span className="ml-1 text-[11px] opacity-60">
                {entry.week.start === entry.week.end
                  ? entry.week.start.slice(8)
                  : `${entry.week.start.slice(8)}–${entry.week.end.slice(8)}`}
              </span>
            </Chip>
          </div>
        ))}
      </div>

      {/* Hero: el anillo */}
      <Card className="flex flex-col items-center py-7">
        <ProgressRing
          value={week.planned > 0 ? week.ratio : 0}
          status={week.status}
          size={168}
          thickness={14}
          label={`Gastado ${formatCurrency(week.spent)} de ${formatCurrency(week.planned)}`}
        >
          <span className="text-label text-muted">
            {week.planned === 0 ? 'Gastado' : overspent ? 'Por encima' : 'Disponible'}
          </span>
          <span className="mt-1 text-display tnum text-ink">
            {formatCurrency(week.planned === 0 ? week.spent : Math.abs(week.available))}
          </span>
        </ProgressRing>

        {week.planned > 0 ? (
          <>
            <p className="mt-4 text-[13px] text-muted tnum">
              {formatCurrency(week.spent)} de {formatCurrency(week.planned)}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              <StatusChip status={week.status}>{statusLabel(week.status)}</StatusChip>
              {elapsedRatio > 0.1 ? (
                <span className="text-[13px] text-muted tnum">{paceLabel(week.status, paceVariance)}</span>
              ) : null}
            </div>
            {progress.remaining > 0 ? (
              <p className="mt-3 max-w-[30ch] text-center text-[12px] leading-relaxed text-stone-400 tnum">
                Quedan {progress.remaining} {progress.remaining === 1 ? 'día' : 'días'} · ritmo disponible{' '}
                {formatCurrency(week.available > 0 ? Math.round(week.available / progress.remaining) : 0)}/día.
                No es un objetivo de gasto.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-4 max-w-[28ch] text-center text-[13px] leading-relaxed text-muted">
            Esta semana todavía no tiene presupuesto. Ponle uno y sabréis en todo momento cuánto os queda.
          </p>
        )}

        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-4 py-2 text-[13px] font-semibold text-ink active:bg-stone-200"
        >
          <Pencil size={14} />
          {week.planned > 0 ? 'Cambiar presupuesto' : 'Poner presupuesto'}
        </button>
      </Card>

      {/* Reparto por categorías (§21) */}
      <section className="mt-6">
        <SectionTitle>En qué se ha ido</SectionTitle>
        {categories.length === 0 ? (
          <EmptyState
            emoji="🗓️"
            title="Semana en blanco"
            body="Todavía no hay gastos registrados en estos días."
          />
        ) : (
          <Card className="space-y-4">
            {categories.map((entry) => (
              <button
                key={entry.category.id}
                type="button"
                onClick={() =>
                  setCategoryLimit({
                    id: entry.category.id,
                    name: entry.category.name,
                    amount: entry.limit ?? 0,
                  })
                }
                className="block w-full text-left"
              >
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span aria-hidden>{entry.category.emoji}</span>
                  <span className="flex-1 truncate text-[14px] font-medium text-ink">
                    {entry.category.name}
                  </span>
                  <span className="text-[13px] font-semibold tnum text-ink">
                    {formatCurrency(entry.amount)}
                    {entry.limit ? (
                      <span className="font-normal text-muted"> / {formatCurrency(entry.limit)}</span>
                    ) : null}
                  </span>
                </div>
                <BudgetBar
                  value={entry.limit ? entry.ratio : weekSpent > 0 ? entry.amount / weekSpent : 0}
                  status={entry.limit ? entry.status : 'neutral'}
                  height={6}
                  {...(entry.limit ? { marker: elapsedRatio } : {})}
                />
              </button>
            ))}
            <p className="pt-1 text-[12px] text-stone-400">
              Toca una categoría para ponerle un límite en esta semana.
            </p>
          </Card>
        )}
      </section>

      {/* Prioridades (§53) — sólo cuando hace falta */}
      {overspent && flexibleCategories.length > 0 ? (
        <section className="mt-6">
          <SectionTitle>Si hay que frenar</SectionTitle>
          <Card>
            <p className="text-[13px] leading-relaxed text-muted">
              Esta semana vais {formatCurrency(Math.abs(week.available))} por encima. Nada está bloqueado:
              solo es una orientación de dónde hay margen.
            </p>
            <div className="mt-4 grid gap-3">
              <PriorityGroup
                icon={<ShieldCheck size={16} className="text-seed-700" />}
                title="Protegido"
                names={protectedCategories.map((c) => c.category.name)}
              />
              <PriorityGroup
                icon={<Waves size={16} className="text-clay" />}
                title="Flexible"
                names={flexibleCategories.map((c) => c.category.name)}
              />
            </div>
          </Card>
        </section>
      ) : null}

      {/* Movimientos de la semana */}
      <section className="mt-6">
        <SectionTitle>Movimientos de la semana</SectionTitle>
        {weekTransactions.length === 0 ? (
          <EmptyState emoji="🌱" title="Sin movimientos todavía" body="Lo que registréis aparecerá aquí." />
        ) : (
          <Card className="px-3 py-2">
            <div className="divide-y divide-stone-100">
              {weekTransactions.slice(0, 12).map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  data={data}
                  member={data.members.find((m) => m.userId === transaction.ownerUserId) ?? null}
                  onPress={() => setSelected(transaction)}
                />
              ))}
            </div>
          </Card>
        )}
      </section>

      <AmountSheet
        open={editing}
        onClose={() => setEditing(false)}
        title={`Presupuesto de la semana ${week.week.index}`}
        subtitle={formatRange(week.week.start, week.week.end)}
        initial={week.planned}
        hint={
          week.week.partial
            ? `Son ${week.week.days} días, no siete. Ponle lo que tenga sentido para esos días.`
            : 'No todas las semanas son iguales. Puedes darle a cada una su cifra.'
        }
        onSave={(amount) => actions.saveWeeklyBudget(month, week.week.index, amount)}
      />

      <AmountSheet
        open={categoryLimit !== null}
        onClose={() => setCategoryLimit(null)}
        title={categoryLimit?.name ?? ''}
        subtitle={`Límite para la semana ${week.week.index}`}
        initial={categoryLimit?.amount ?? 0}
        hint="Sirve para orientar, no para bloquear."
        onSave={(amount) =>
          categoryLimit
            ? actions.saveCategoryLimit(month, week.week.index, categoryLimit.id, amount)
            : undefined
        }
      />

      <TransactionDetailSheet
        transaction={selected}
        onClose={() => setSelected(null)}
        currentMemberName={currentMember?.name ?? ''}
        today={today}
      />
    </div>
  );
}

function PriorityGroup({
  icon,
  title,
  names,
}: {
  icon: React.ReactNode;
  title: string;
  names: string[];
}) {
  if (names.length === 0) return null;
  return (
    <div className="rounded-2xl bg-warm p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
        {icon}
        {title}
      </p>
      <p className="text-[14px] leading-relaxed text-ink">{names.join(' · ')}</p>
    </div>
  );
}

/**
 * §101 — decir la verdad, pero sin contradecirse: si el semáforo está en verde,
 * ir un poco por delante del ritmo no se cuenta como un problema.
 */
function paceLabel(status: HealthStatus, variance: number): string {
  if (variance >= 0) return `${formatCurrency(variance)} mejor que el ritmo`;
  if (status === 'green') return `${formatCurrency(Math.abs(variance))} por delante, dentro del plan`;
  return `${formatCurrency(Math.abs(variance))} por encima del ritmo`;
}
