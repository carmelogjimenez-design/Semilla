'use client';

import Link from 'next/link';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Plus, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';

import { AddTransactionSheet, type AddSheetPreset } from '@/components/flows/add-transaction-sheet';
import { PlannedSheet } from '@/components/flows/planned-sheet';
import { BudgetBar } from '@/components/ui/progress';
import { Button, Card, EmptyState, SectionTitle } from '@/components/ui/primitives';
import { buildPlannedOccurrences } from '@/domain/calculations';
import { capitalize, formatDayLong, monthLabel } from '@/domain/dates';
import { formatCurrency, formatPercent } from '@/domain/money';
import {
  annualCommitted,
  committedSummary,
  extraordinaryReport,
  frequencyLabel,
  paymentCalendar,
} from '@/domain/planned';
import type { PlannedItem, PlannedOccurrence } from '@/domain/types';
import { useSemilla } from '@/state/semilla-provider';

/**
 * COMPROMETIDO (§62, §63, §127) — lo que ya está decidido.
 *
 * Responde a la pregunta que más tranquiliza al principio de mes: de lo que
 * entra, ¿cuánto ya tiene dueño? Y a la que más angustia si no se ve venir:
 * ¿qué queda por caer y cuándo.
 */
export function CommittedScreen() {
  const { data, today, month, setMonth } = useSemilla();
  const [editing, setEditing] = useState<PlannedItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState<AddSheetPreset | null>(null);

  const occurrences = useMemo(
    () => buildPlannedOccurrences(data.plannedItems, data.transactions, month, today),
    [data.plannedItems, data.transactions, month, today],
  );
  const summary = useMemo(() => committedSummary(occurrences), [occurrences]);
  const calendar = useMemo(() => paymentCalendar(occurrences, today), [occurrences, today]);
  const extraordinary = useMemo(
    () => extraordinaryReport(data.transactions, month),
    [data.transactions, month],
  );
  const annual = useMemo(() => annualCommitted(data.plannedItems), [data.plannedItems]);

  const items = [...data.plannedItems].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.dayOfMonth - b.dayOfMonth;
  });

  function changeMonth(delta: number) {
    const [year, m] = month.split('-').map(Number);
    const date = new Date(Date.UTC(year ?? 2026, (m ?? 1) - 1 + delta, 1));
    setMonth(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  /* Pagar un previsto abre el alta con todo puesto: importe esperado, categoría y
     el enlace al compromiso. No se crea solo, porque lo que se paga casi nunca es
     exactamente lo previsto y esa diferencia es información. */
  function payPreset(occurrence: PlannedOccurrence): AddSheetPreset {
    const item = occurrence.planned;
    const pending = Math.max(0, occurrence.expectedAmount - occurrence.actualAmount);
    return {
      kind: item.kind === 'debtPayment' ? 'debtPayment' : item.kind,
      amount: pending,
      plannedId: item.id,
      description: item.name,
      ...(item.categoryId ? { categoryId: item.categoryId } : {}),
      ...(item.subcategoryId ? { subcategoryId: item.subcategoryId } : {}),
      ...(item.debtId ? { debtId: item.debtId, paymentType: 'installment' as const } : {}),
      ...(item.extraordinary ? { frequency: 'extraordinary' as const } : {}),
    };
  }

  return (
    <div className="px-5 pb-nav pt-safe">
      <header className="py-4">
        <Link href="/mas" className="text-[13px] font-medium text-muted">
          ‹ Más
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h1 className="text-title text-ink">Comprometido</h1>
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
        </div>
        <p className="mt-0.5 text-[13px] text-muted">Lo que ya está decidido antes de empezar.</p>
      </header>

      {data.plannedItems.length === 0 ? (
        <EmptyState
          emoji="📌"
          title="Todavía no hay nada fijo"
          body="El alquiler, el colegio, el seguro, la cuota del móvil. Ponedlos aquí una vez y no volveréis a hacer cuentas de cabeza a principio de mes."
          action={<Button onClick={() => setCreating(true)}>Añadir el primero</Button>}
        />
      ) : (
        <>
          {/* Resumen del mes */}
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Comprometido en {monthLabel(month, { capitalize: false })}
            </p>
            <p className="mt-1 text-display tnum text-ink">{formatCurrency(summary.expected)}</p>

            <div className="mt-4">
              <div className="mb-2 flex items-baseline justify-between text-[12px] text-muted tnum">
                <span>{formatCurrency(summary.paid)} ya pagado</span>
                <span>{formatCurrency(summary.remaining)} por caer</span>
              </div>
              <BudgetBar value={summary.ratio} status="green" height={10} />
            </div>

            {summary.overdue.length > 0 ? (
              <div className="mt-4 flex gap-2.5 rounded-2xl bg-amber-bg px-4 py-3">
                <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-deep" aria-hidden />
                <p className="text-[13px] leading-relaxed text-amber-deep">
                  {summary.overdue.length === 1
                    ? `${summary.overdue[0]?.planned.name} debía haberse pagado y no consta.`
                    : `${summary.overdue.length} pagos debían haberse hecho y no constan.`}{' '}
                  Puede ser que falte registrarlos.
                </p>
              </div>
            ) : null}

            <p className="mt-4 text-[12px] leading-relaxed text-stone-400 tnum">
              Todo lo fijo suma {formatCurrency(annual)} al año.
              {summary.expectedIncome > 0
                ? ` Con ${formatCurrency(summary.expectedIncome)} de ingresos previstos este mes.`
                : ''}
            </p>
          </Card>

          {/* Calendario de pagos (§63) */}
          <section className="mt-6">
            <SectionTitle>Cuándo cae</SectionTitle>
            {calendar.length === 0 ? (
              <EmptyState title="Este mes no hay nada previsto" />
            ) : (
              <Card className="space-y-4">
                {calendar.map((day) => (
                  <div key={day.date}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-ink">
                        {formatDayLong(day.date)}
                      </span>
                      <span className="text-[12px] text-stone-400">{relativeLabel(day.offset)}</span>
                      <span className="ml-auto text-[13px] font-semibold tnum text-ink">
                        {formatCurrency(day.total)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {day.occurrences.map((occurrence) => (
                        <OccurrenceRow
                          key={occurrence.planned.id}
                          occurrence={occurrence}
                          onPay={() => setPaying(payPreset(occurrence))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>

          {/* Lista de compromisos */}
          <section className="mt-6">
            {/* El botón de añadir va debajo de la lista y a todo el ancho: en la
                esquina derecha de una cabecera se lo come el botón flotante. */}
            <SectionTitle>Todo lo fijo</SectionTitle>
            <Card className="px-2 py-1">
              <div className="divide-y divide-stone-100">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setEditing(item)}
                    className={`flex w-full items-center gap-3 px-2 py-3 text-left ${
                      item.active ? '' : 'opacity-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-ink">
                        {item.name}
                        {item.extraordinary ? (
                          <span className="ml-1.5 text-[11px] font-semibold text-clay">extraordinario</span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[12px] text-muted">
                        {frequencyLabel(item)} · día {item.dayOfMonth}
                        {item.active ? '' : ' · dado de baja'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold tnum text-ink">
                      {item.kind === 'income' ? '+' : ''}
                      {formatCurrency(item.expectedAmount)}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
                  </button>
                ))}
              </div>
            </Card>

            <Button variant="secondary" full className="mt-3" onClick={() => setCreating(true)}>
              <Plus size={18} /> Añadir un compromiso
            </Button>
          </section>
        </>
      )}

      {/* Extraordinarios del mes (§16, §127) */}
      <section className="mt-6">
        <SectionTitle>Extraordinarios de {monthLabel(month, { capitalize: false })}</SectionTitle>
        {extraordinary.transactions.length === 0 ? (
          <Card>
            <p className="text-[13px] leading-relaxed text-muted">
              Este mes no hay ningún gasto marcado como extraordinario. Marcar así una caldera o un
              billete de avión evita que un mes raro parezca un mes malo.
            </p>
          </Card>
        ) : (
          <Card>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-muted">Fuera del mes normal</span>
              <span className="text-[17px] font-semibold tnum text-ink">
                {formatCurrency(extraordinary.total)}
              </span>
            </div>
            <p className="mt-1 text-[12px] text-stone-400 tnum">
              {formatPercent(extraordinary.shareOfExpenses)} de todo lo gastado este mes.
            </p>
            <div className="mt-4 space-y-2.5">
              {extraordinary.transactions.slice(0, 6).map((transaction) => (
                <div key={transaction.id} className="flex items-center gap-3">
                  <Zap size={15} className="shrink-0 text-clay" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                    {transaction.description || 'Gasto extraordinario'}
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tnum text-ink">
                    {formatCurrency(transaction.amount)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      <p className="mt-8 text-center text-[12px] leading-relaxed text-stone-400">
        Un compromiso no mueve dinero por sí solo.
        <br />
        El movimiento se registra el día que se paga.
      </p>

      <PlannedSheet open={creating} onClose={() => setCreating(false)} item={null} />
      <PlannedSheet open={editing !== null} onClose={() => setEditing(null)} item={editing} />
      <AddTransactionSheet
        open={paying !== null}
        onClose={() => setPaying(null)}
        {...(paying ? { preset: paying } : {})}
      />
    </div>
  );
}

function OccurrenceRow({
  occurrence,
  onPay,
}: {
  occurrence: PlannedOccurrence;
  onPay: () => void;
}) {
  const { planned, status, actualAmount, expectedAmount } = occurrence;
  const done = status === 'paid';
  const difference = actualAmount - expectedAmount;

  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
          done
            ? 'bg-sage text-seed-700'
            : status === 'overdue'
              ? 'bg-amber-bg text-amber-deep'
              : 'bg-stone-100 text-stone-400'
        }`}
      >
        {done ? <Check size={15} strokeWidth={3} aria-hidden /> : <span className="text-[13px]">·</span>}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-ink">{planned.name}</span>
        <span className="block text-[12px] text-muted tnum">
          {done
            ? difference === 0
              ? 'Pagado'
              : `Pagado · ${formatCurrency(Math.abs(difference))} ${difference > 0 ? 'más' : 'menos'} de lo previsto`
            : status === 'partial'
              ? `Pagado a medias · ${formatCurrency(actualAmount)} de ${formatCurrency(expectedAmount)}`
              : status === 'overdue'
                ? 'Debía estar pagado'
                : formatCurrency(expectedAmount)}
        </span>
      </span>

      {done ? (
        <span className="shrink-0 text-[14px] font-semibold tnum text-muted">
          {formatCurrency(actualAmount)}
        </span>
      ) : (
        <button
          type="button"
          onClick={onPay}
          className="shrink-0 rounded-full bg-stone-100 px-3 py-1.5 text-[12px] font-semibold text-ink active:bg-stone-200"
        >
          Registrar
        </button>
      )}
    </div>
  );
}

/** «Hoy» · «mañana» · «en 5 días» · «hace 3 días». */
function relativeLabel(offset: number): string {
  if (offset === 0) return 'hoy';
  if (offset === 1) return 'mañana';
  if (offset === -1) return 'ayer';
  if (offset > 1) return `en ${offset} días`;
  return `hace ${Math.abs(offset)} días`;
}
