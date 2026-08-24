'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight, Copy, Split } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AmountSheet } from '@/components/flows/amount-sheet';
import { BudgetBar } from '@/components/ui/progress';
import { Button, Card, EmptyState, ListRow, SectionTitle } from '@/components/ui/primitives';
import { addMonths, capitalize, daysInMonth, formatRange, getMonthWeeks, monthLabel } from '@/domain/dates';
import { formatCurrency } from '@/domain/money';
import type { Cents, ID } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * MÁS → PRESUPUESTOS (§23, §52, §130)
 *
 * Aquí se decide el marco del mes. Todo es editable y nada se deriva a ciegas:
 * el reparto por semanas se propone, pero manda siempre lo que pongáis a mano.
 */
export function BudgetsScreen() {
  const { data, view, month, setMonth, actions } = useSemilla();

  const [editingMonth, setEditingMonth] = useState(false);
  const [editingWeek, setEditingWeek] = useState<{ index: number; planned: Cents; label: string } | null>(
    null,
  );
  const [editingCategory, setEditingCategory] = useState<{ id: ID; name: string; amount: Cents } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const weeks = useMemo(() => getMonthWeeks(month), [month]);
  const monthlyBudget = data.monthlyBudgets.find((b) => b.month === month);
  const planned = monthlyBudget?.planned ?? 0;

  const weeklyRows = weeks.map((week) => {
    const stored = data.weeklyBudgets.find((b) => b.month === month && b.weekIndex === week.index);
    const result = view.weeks.find((w) => w.week.index === week.index);
    return {
      week,
      planned: stored?.planned ?? 0,
      explicit: Boolean(stored),
      spent: result?.spent ?? 0,
    };
  });

  const assigned = weeklyRows.reduce((sum, row) => sum + row.planned, 0);
  const difference = planned - assigned;

  const categoryLimits = new Map<ID, Cents>(
    (monthlyBudget?.categoryLimits ?? []).map((l) => [l.categoryId, l.amount]),
  );

  const spentByCategory = new Map<ID, Cents>(
    view.monthCategories.map((entry) => [entry.category.id, entry.amount]),
  );

  async function distributeByDays() {
    if (planned <= 0) return;
    setBusy(true);
    try {
      const total = daysInMonth(month);
      for (const week of weeks) {
        await actions.saveWeeklyBudget(month, week.index, Math.round((planned * week.days) / total));
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyPreviousMonth() {
    const previous = addMonths(month, -1);
    const previousMonthly = data.monthlyBudgets.find((b) => b.month === previous);
    if (!previousMonthly) return;
    setBusy(true);
    try {
      await actions.saveMonthlyBudget(month, previousMonthly.planned);
      for (const limit of previousMonthly.categoryLimits) {
        await actions.saveCategoryLimit(month, null, limit.categoryId, limit.amount);
      }
      const previousWeeks = data.weeklyBudgets.filter((b) => b.month === previous);
      for (const week of weeks) {
        const source = previousWeeks.find((b) => b.weekIndex === week.index);
        if (source) await actions.saveWeeklyBudget(month, week.index, source.planned);
      }
    } finally {
      setBusy(false);
    }
  }

  const hasPrevious = data.monthlyBudgets.some((b) => b.month === addMonths(month, -1));

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="flex items-center justify-between gap-2 py-4">
        <div className="min-w-0">
          <Link href="/mas" className="text-[13px] font-medium text-muted">
            ‹ Más
          </Link>
          <h1 className="mt-1 text-title text-ink">Presupuestos</h1>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full bg-stone-100 px-1 py-1">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setMonth(addMonths(month, -1))}
            className="rounded-full p-1.5 text-ink active:bg-stone-200"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-1 text-[12px] font-semibold text-ink">{capitalize(monthLabel(month))}</span>
          <button
            type="button"
            aria-label="Mes siguiente"
            onClick={() => setMonth(addMonths(month, 1))}
            className="rounded-full p-1.5 text-ink active:bg-stone-200"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      {/* Presupuesto del mes */}
      <Card>
        <p className="label">Presupuesto del mes</p>
        <button type="button" onClick={() => setEditingMonth(true)} className="mt-1.5 block text-left">
          <span className="text-display tnum text-ink">{formatCurrency(planned)}</span>
        </button>
        {planned > 0 ? (
          <>
            <div className="mt-4 mb-2 flex items-baseline justify-between text-[12px] text-muted tnum">
              <span>{formatCurrency(view.monthSummary.expenses)} gastados</span>
              <span>{Math.round(view.monthSummary.usedRatio * 100)} %</span>
            </div>
            <BudgetBar value={view.monthSummary.usedRatio} status={view.monthSummary.status} />
          </>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Toca la cifra para fijar cuánto queréis gastar este mes. Es una referencia, no una jaula.
          </p>
        )}

        {hasPrevious && planned === 0 ? (
          <Button variant="secondary" full className="mt-4" onClick={copyPreviousMonth} disabled={busy}>
            <Copy size={16} /> Copiar el mes anterior
          </Button>
        ) : null}
      </Card>

      {/* Reparto por semanas (§52) */}
      <section className="mt-6">
        <SectionTitle
          action={
            planned > 0 ? (
              <button
                type="button"
                onClick={distributeByDays}
                disabled={busy}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-forest"
              >
                <Split size={14} /> Repartir por días
              </button>
            ) : undefined
          }
        >
          Semanas
        </SectionTitle>

        <Card className="px-3 py-1">
          <div className="divide-y divide-stone-100">
            {weeklyRows.map((row) => (
              <ListRow
                key={row.week.key}
                title={`Semana ${row.week.index}`}
                subtitle={`${formatRange(row.week.start, row.week.end)}${
                  row.week.partial ? ` · ${row.week.days} ${row.week.days === 1 ? 'día' : 'días'}` : ''
                }`}
                value={row.planned > 0 ? formatCurrency(row.planned) : '—'}
                valueHint={row.spent > 0 ? `${formatCurrency(row.spent)} gastados` : undefined}
                onClick={() =>
                  setEditingWeek({
                    index: row.week.index,
                    planned: row.planned,
                    label: formatRange(row.week.start, row.week.end),
                  })
                }
              />
            ))}
          </div>
        </Card>

        {planned > 0 ? (
          <div className="mt-3 rounded-2xl bg-warm px-4 py-3">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-muted">Asignado a semanas</span>
              <span className="font-semibold tnum text-ink">{formatCurrency(assigned)}</span>
            </div>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted tnum">
              {difference === 0
                ? 'Cuadra exactamente con el presupuesto del mes.'
                : difference > 0
                  ? `Quedan ${formatCurrency(difference)} del mes sin repartir. No pasa nada: sirve de colchón.`
                  : `Las semanas suman ${formatCurrency(Math.abs(difference))} más que el mes.`}
            </p>
          </div>
        ) : null}

        <p className="mt-3 px-1 text-[12px] leading-relaxed text-stone-400">
          Una semana sin cifra propia usa la parte proporcional del mes según sus días. Las semanas
          parciales del principio y del final cuentan solo los días que tienen.
        </p>
      </section>

      {/* Límites por categoría del mes */}
      <section className="mt-6">
        <SectionTitle>Límites por categoría</SectionTitle>
        {data.categories.length === 0 ? (
          <EmptyState title="Aún no hay categorías" />
        ) : (
          <Card className="space-y-4">
            {data.categories.map((category) => {
              const limit = categoryLimits.get(category.id) ?? 0;
              const spent = spentByCategory.get(category.id) ?? 0;
              const ratio = limit > 0 ? spent / limit : 0;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setEditingCategory({ id: category.id, name: category.name, amount: limit })
                  }
                  className="block w-full text-left"
                >
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span aria-hidden>{category.emoji}</span>
                    <span className="flex-1 truncate text-[14px] font-medium text-ink">{category.name}</span>
                    <span className="text-[13px] tnum text-muted">
                      {limit > 0 ? (
                        <>
                          <span className="font-semibold text-ink">{formatCurrency(spent)}</span> /{' '}
                          {formatCurrency(limit)}
                        </>
                      ) : (
                        'Sin límite'
                      )}
                    </span>
                  </div>
                  {limit > 0 ? (
                    <BudgetBar
                      value={ratio}
                      status={ratio > 1.1 ? 'red' : ratio > 1 ? 'amber' : 'green'}
                      height={6}
                    />
                  ) : null}
                </button>
              );
            })}
          </Card>
        )}
      </section>

      <AmountSheet
        open={editingMonth}
        onClose={() => setEditingMonth(false)}
        title="Presupuesto del mes"
        subtitle={capitalize(monthLabel(month, { year: true }))}
        initial={planned}
        hint="Cuánto queréis gastar este mes, sin contar ahorro ni amortizaciones."
        onSave={(amount) => actions.saveMonthlyBudget(month, amount)}
      />

      <AmountSheet
        open={editingWeek !== null}
        onClose={() => setEditingWeek(null)}
        title={`Semana ${editingWeek?.index ?? ''}`}
        subtitle={editingWeek?.label}
        initial={editingWeek?.planned ?? 0}
        hint="No todas las semanas son iguales. Dale a cada una lo que necesita."
        onSave={(amount) =>
          editingWeek ? actions.saveWeeklyBudget(month, editingWeek.index, amount) : undefined
        }
      />

      <AmountSheet
        open={editingCategory !== null}
        onClose={() => setEditingCategory(null)}
        title={editingCategory?.name ?? ''}
        subtitle={`Límite mensual · ${capitalize(monthLabel(month))}`}
        initial={editingCategory?.amount ?? 0}
        hint="Orienta, no bloquea. Podéis pasaros: Semilla solo os lo dirá."
        onSave={(amount) =>
          editingCategory ? actions.saveCategoryLimit(month, null, editingCategory.id, amount) : undefined
        }
      />
    </div>
  );
}
